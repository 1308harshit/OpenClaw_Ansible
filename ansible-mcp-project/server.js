const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");

const express = require("express");
// Always load the frontend's .env regardless of the cwd used to start node.
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { GoogleGenerativeAI } = require("@google/generative-ai");

const PORT = Number(process.env.PORT || 8000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required in frontend/.env");
  process.exit(2);
}

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MCP_SERVER_CMD =
  process.env.MCP_SERVER_CMD || path.join(PROJECT_ROOT, "venv", "bin", "python");
const MCP_SERVER_PATH =
  process.env.MCP_SERVER_PATH || path.join(PROJECT_ROOT, "mcp_server.py");

// Single-executor mode (local only).
// Set ANSIBLE_PROJECT_ROOT in frontend/.env to point to ansible-project if desired.
const ANSIBLE_PROJECT_ROOT = String(
  process.env.ANSIBLE_PROJECT_ROOT ||
    process.env.EC2_LOCALHOST_ANSIBLE_PROJECT_ROOT ||
    PROJECT_ROOT
);

const TOOL_DECLARATIONS = [
  {
    name: "list_tools",
    description:
      "List all available tools and their descriptions (what the assistant can do). Read-only.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_inventory",
    description: "Lists Ansible hosts and groups. Read-only.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_playbooks",
    description: "Lists runnable playbooks in the project. Read-only.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_playbooks_with_summary",
    description:
      "Lists runnable playbooks with a short semantic summary (name/hosts/modules/inputs). Read-only.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_reports",
    description: "Lists generated report files under reports/. Read-only.",
    parameters: {
      type: "object",
      properties: {
        prefix: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "read_report_file",
    description: "Read a generated report file under reports/. Read-only.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_backups",
    description: "Lists backup files under backups/ with metadata. Read-only.",
    parameters: {
      type: "object",
      properties: {
        prefix: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "read_backup_file",
    description:
      "Read a backup file under backups/. Output is truncated and common secret patterns are redacted. Read-only.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "summarize_unused_ports_reports",
    description:
      "Summarize unused ports reports (*_unused_ports.txt). Computes per-device counts and identifies the max. Read-only.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "read_playbook_file",
    description:
      "Read content of a playbook file from playbooks/ directory. Use this to understand what a playbook does (e.g., what it installs, what it configures) before running it. Read-only.",
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string" },
      },
      required: ["filename"],
    },
  },
  {
    name: "get_playbook_info",
    description:
      "Get semantic description and keywords for a playbook. This helps map user requests (e.g., 'install postgresql') to the correct playbook file. Returns keywords, purpose, and target service. Use this FIRST to find the right playbook before running it.",
    parameters: {
      type: "object",
      properties: {
        playbook: { type: "string" },
      },
      required: ["playbook"],
    },
  },
  {
    name: "check_service_status",
    description:
      "Check if a service (e.g., postgresql, postgres) is installed and running on localhost. Returns installation status, service status (running/stopped), and version if available. Use this when users ask 'is X installed?' or 'is X running?'.",
    parameters: {
      type: "object",
      properties: {
        service_name: { type: "string" },
      },
      required: ["service_name"],
    },
  },
  {
    name: "check_https_endpoint",
    description:
      "Check if an HTTPS endpoint is reachable and healthy. Returns HTTP status code, response content, and connection status. Use this when users ask about 'HTTPS health', 'check HTTPS endpoint', 'verify HTTPS', or similar. Example: check https://localhost/health or https://snoopy.timlam007.com/health.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full HTTPS URL to check (e.g., https://localhost/health)" },
        validate_certs: { type: "boolean", description: "Whether to validate SSL certificates (default: false for self-signed certs)" },
      },
      required: ["url"],
    },
  },
  {
    name: "run_playbook",
    description:
      "Runs a selected playbook. Supports optional limit and tags. Returns stdout/stderr.",
    parameters: {
      type: "object",
      properties: {
        playbook: { type: "string" },
        limit: { type: "string" },
        tags: { type: "string" },
        extra_vars: { type: "object" },
      },
      required: ["playbook"],
    },
  },
  {
    name: "run_playbook_check",
    description:
      "Runs a selected playbook in check mode (--check). Supports optional limit and tags.",
    parameters: {
      type: "object",
      properties: {
        playbook: { type: "string" },
        limit: { type: "string" },
        tags: { type: "string" },
        extra_vars: { type: "object" },
      },
      required: ["playbook"],
    },
  },
];

const SYSTEM_INSTRUCTION = `
You are a demo assistant that controls Ansible via MCP tools.

Rules:
- Only use the provided tools.
- Do NOT suggest running arbitrary shell commands.

Workflow:
0. If the user asks to \"list tools\", call list_tools and present a short (1-2 lines) description per tool.
1. CRITICAL: If the user mentions a playbook by partial/descriptive name (e.g. \"harden\", \"vlan\", \"interface\", \"compliance\"), you MUST call list_playbooks_with_summary FIRST to find the exact filename. Do NOT guess playbook names like \"harden.yml\" - use the actual filename from the list (e.g. \"harden_fabric_simple.yml\").
2. Use get_playbook_info if you need more details
3. Optionally read_playbook_file
4. Use run_playbook_check for check/dry-run, otherwise run_playbook

SSL Demo Environment Playbooks (CRITICAL MAPPINGS):
- When user says: \"set up SSL demo\", \"setup SSL demo\", \"install SSL demo\", \"setup demo environment\", \"set up demo environment\", \"setup complete SSL demo\", \"one-click setup\", or similar phrases about SETTING UP the SSL demo → ALWAYS run: demo_setup_all.yml (NOT individual playbooks like vault_install_configure.yml or nginx_install_configure.yml)
- When user says: \"clean SSL demo\", \"cleanup SSL demo\", \"clean demo environment\", \"cleanup demo environment\", \"remove SSL demo\", \"reset SSL demo\", \"clean up everything\", or similar phrases about CLEANING/REMOVING the SSL demo → ALWAYS run: demo_cleanup_all.yml (NOT individual uninstall playbooks)
- When user says: \"check nginx status\", \"check nginx service\", \"nginx status\", \"nginx health\", \"check nginx and https\", \"check nginx service status and https health\", \"check nginx service status and https health\", or ANY phrase mentioning \"nginx\" AND (\"status\" OR \"health\" OR \"https\") → ALWAYS run: nginx_status.yml playbook using run_playbook tool (DO NOT use check_service_status tool). The nginx_status.yml playbook checks: 1) Nginx service status (running/stopped/enabled), 2) HTTPS health endpoint (https://localhost/health), 3) SSL certificate expiry, and 4) Nginx process information. This provides complete Nginx status including HTTPS health.
- When user asks specifically about \"HTTPS health\" or \"check HTTPS endpoint\" without mentioning Nginx service → Use check_https_endpoint tool with url=\"https://localhost/health\" or url=\"https://snoopy.timlam007.com/health\" to verify the endpoint is responding.
- These are orchestration playbooks that run multiple sub-playbooks in the correct order. DO NOT break them down into individual playbooks.

Inputs:
- Prefer passing variable inputs using extra_vars (object) instead of editing playbook files.
- Prefer limiting scope using limit (host/group) instead of editing inventory/playbooks.

HTTPS Health Endpoints:
- The HTTPS health check endpoint is: https://localhost/health (for server-side checks) or https://snoopy.timlam007.com/health (for browser/client checks)
- This endpoint returns \"OK\" if Nginx is serving HTTPS correctly
- When user asks about \"HTTPS health\", they want to verify this endpoint is responding with HTTP 200

Reports:
- Some playbooks generate reports under reports/.
- The frontend serves these at the relative URL path /reports/.
- After running a report-generating playbook, call list_reports and then provide the user a link (relative URL) to the relevant report(s).
- If the user asks \"run switch summary\" (or similar), run generate_switch_summary.yml, then reply with the link: /reports/switch_summary/index.html
- For SSL certificate reports (ssl_cert_generate_report.yml): ALWAYS use the HTTPS domain link: https://snoopy.timlam007.com/reports/ssl_report/index.html (NOT the IP address). The playbook output shows both domain and IP, but prefer the domain link.
- For other report playbooks that generate .txt files, do NOT provide a browser link. Instead:
  1) Use list_reports (optionally with prefix like 'interfaces_summary/' etc.) to find the report file paths
  2) Tell the user the report path(s) under reports/
  3) Use read_report_file on the most relevant .txt and provide a short summary of its contents

Backups:
- Some playbooks create backup files under backups/.
- For backups (.txt): do NOT provide browser links. Use list_backups to find files, then read_backup_file to summarize.

IMPORTANT:
- Do NOT start or stop any HTTP servers (no python -m http.server).
- Do NOT attempt to restart the frontend or change ports.
- Assume the frontend is already running on port 8000; only provide /reports/... links.

Answer completeness:
- If the user asks multiple things (e.g. run playbooks + \"which leaf has the most unused ports\"), you MUST answer all parts.
- For \"most unused ports\" questions: run show_unused_ports.yml (often with limit leafs), then call summarize_unused_ports_reports(limit='leafs') and report the winner.

Anti-half-response checklist (MANDATORY):
- Before you send your final answer, restate the user's requested sub-tasks as a checklist and ensure every item is answered.
- If any required artifact is missing (report not generated yet, report file missing, etc.), run the needed playbook/tools first instead of guessing.
- Always include outputs in this order when relevant:
  1) What was executed (playbooks + limits)
  2) Key findings (e.g. winner leaf + counts)
  3) Report locations (txt paths) and/or dashboard link (full URL for switch summary only)
  4) Next steps (one line)
`.trim();

function getBaseUrl(req) {
  // Prefer forwarded headers when behind a proxy/reverse-proxy.
  const xfProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = xfProto || req.protocol || "http";
  const host = req.get("host") || req.headers.host || "";
  return `${proto}://${host}`;
}

function buildSystemInstruction(baseUrl) {
  // Provide runtime base URL so the model can output absolute links without hardcoding an IP.
  // Use a full URL ONLY for the switch summary dashboard.
  return `${SYSTEM_INSTRUCTION}

Base URL: ${baseUrl}
Link rules:
- For switch summary dashboard, output the full link: ${baseUrl}/reports/switch_summary/index.html
- For other .txt reports, do NOT output a browser link; output the reports/ path and summarize the text.
 - For backups, do NOT output a browser link; output the backups/ path and summarize the text.
`.trim();
}

function startMcpProcess() {
  const child = spawn(MCP_SERVER_CMD, [MCP_SERVER_PATH], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
      ANSIBLE_PROJECT_ROOT,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

  const rl = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  let stderrBuf = "";
  let nextId = 1;
  let initialized = false;

  child.stderr.on("data", (d) => {
    stderrBuf += d.toString();
    stderrBuf = stderrBuf.slice(-50_000);
  });

  rl.on("line", (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const id = msg.id;
    if (pending.has(id)) {
      pending.get(id).resolve(msg);
      pending.delete(id);
    }
  });

  child.on("exit", (code, signal) => {
    // Fail fast for any in-flight RPCs if the SSH/MCP process exits.
    for (const [id, entry] of pending.entries()) {
      try {
        entry.reject(
          new Error(
            `MCP transport exited before replying (id=${id}, code=${code}, signal=${signal}). ` +
              `stderr: ${stderrBuf || "(empty)"}`
          )
        );
      } catch {}
      pending.delete(id);
    }
  });

  function rpc(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP timeout waiting for id=${id}`));
      }, 60_000);

      pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      child.stdin.write(
        JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"
      );
    });
  }

  async function callTool(name, args) {
    // Local-only tool (doesn't require MCP).
    if (name === "list_tools") {
      return {
        tool: name,
        result: {
          ok: true,
          tools: TOOL_DECLARATIONS.map((t) => ({
            name: t.name,
            description: t.description,
          })),
        },
        mcp_stderr: stderrBuf || "",
      };
    }

    if (!initialized) {
      const init = await rpc("initialize", { protocolVersion: "0.1" });
      if (init.error) throw new Error(`MCP initialize error: ${init.error.message}`);
      initialized = true;
    }

    const resp = await rpc("tools/call", { name, arguments: args || {} });
    if (resp.error) throw new Error(`MCP tools/call error: ${resp.error.message}`);

    const text = resp.result?.content?.[0]?.text || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return { tool: name, result: parsed, mcp_stderr: stderrBuf || "" };
  }

  function close() {
    try {
      rl.close();
    } catch {}
    try {
      child.kill("SIGTERM");
    } catch {}
  }

  return { callTool, close };
}

async function runGeminiWithTools(userText, systemInstruction) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    systemInstruction,
  });

  const chat = model.startChat();

  const toolLog = [];
  let result = await chat.sendMessage(userText);
  const mcp = startMcpProcess();

  try {
    // Allow more tool iterations for multi-step "combo" prompts.
    for (let i = 0; i < 16; i++) {
      const response = result.response;
      const calls =
        typeof response.functionCalls === "function" ? response.functionCalls() : [];

      if (!calls || calls.length === 0) {
        return { text: response.text(), toolLog };
      }

      for (const call of calls) {
        const name = call.name;
        const args = call.args || call.arguments || {};

        const toolOut = await mcp.callTool(name, args);
        toolLog.push({ name, args, toolOut });

        result = await chat.sendMessage([
          { functionResponse: { name, response: toolOut.result } },
        ]);
      }
    }
  } finally {
    mcp.close();
  }

  return {
    text:
      "Reached max tool-call iterations. See toolLog for what was executed.",
    toolLog,
  };
}

const app = express();
// We're often behind Nginx reverse proxy (HTTPS->HTTP). Trust proxy headers so
// req.protocol and related helpers reflect the original client scheme.
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
// Serve generated Ansible reports (HTML/text) from the Ansible project root.
// Use relative links (/reports/...) so it works regardless of the server's IP/hostname.
app.use("/reports", express.static(path.join(ANSIBLE_PROJECT_ROOT, "reports")));

app.post("/query", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).type("text/plain").send("text required");

  try {
    const baseUrl = getBaseUrl(req);
    const out = await runGeminiWithTools(text, buildSystemInstruction(baseUrl));
    res.type("text/plain").send(out.text || "");
  } catch (e) {
    res.status(500).type("text/plain").send(String(e?.message || e));
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Express frontend listening on http://0.0.0.0:${PORT}`);
});