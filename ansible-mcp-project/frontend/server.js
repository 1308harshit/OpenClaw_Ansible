const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");

const express = require("express");
// Always load the frontend's .env regardless of the cwd used to start node.
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MongoClient } = require("mongodb");

const PORT = Number(process.env.PORT || 8000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MODEL_PROVIDER = process.env.MODEL_PROVIDER || "GEMINI";
const MONGODB_URI = process.env.MONGODB_URI;

// Track active SSE connections for user count
const activeConnections = new Set();

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required in frontend/.env");
  process.exit(2);
}

// MongoDB connection
let mongoClient;
let historyCollection;

async function connectMongoDB() {
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI not set. History feature will be disabled.");
    return;
  }

  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db("ansible_mcp");
    historyCollection = db.collection("query_history");
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.warn("History feature will be disabled.");
  }
}

async function saveQueryHistory(query, response) {
  if (!historyCollection) return;

  try {
    await historyCollection.insertOne({
      query,
      response,
      timestamp: new Date(),
      model: GEMINI_MODEL,
      provider: MODEL_PROVIDER
    });
  } catch (error) {
    console.error("Failed to save query history:", error.message);
  }
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
        url: { type: "string", description: "Full HTTPS URL to check (e.g., https://localhost/health or https://snoopy.timlam007.com/health)" },
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
  {
    name: "run_playbooks",
    description:
      "Run multiple playbooks in sequence with a single call. Use this when the user asks for multiple operations in one prompt. Returns per-playbook results. Prefer this over calling run_playbook multiple times for combo prompts.",
    parameters: {
      type: "object",
      properties: {
        playbooks: {
          type: "array",
          items: { type: "string" },
          description: "Ordered list of playbook filenames to run",
        },
        limit: { type: "string" },
        tags: { type: "string" },
        extra_vars: { type: "object" },
        stop_on_failure: {
          type: "boolean",
          description: "Stop sequence if a playbook fails. Defaults to true.",
        },
      },
      required: ["playbooks"],
    },
  },
  {
    name: "intelligent_playbook_orchestration",
    description:
      "Intelligently analyze a natural language user request, select the right combination of playbooks, show the user a plan first, then execute them in order. Use this when the user asks for something that requires multiple playbooks or when the intent is ambiguous. Returns execution plan + results.",
    parameters: {
      type: "object",
      properties: {
        user_request: {
          type: "string",
          description: "Natural language description of what the user wants to accomplish",
        },
        dry_run: {
          type: "boolean",
          description: "If true, only return the plan without executing. Defaults to false.",
        },
        limit: { type: "string" },
        extra_vars: { type: "object" },
      },
      required: ["user_request"],
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
0b. If the user asks to \"list playbooks\" or \"list playbook\" → call list_playbooks (NOT list_playbooks_with_summary) and present ONLY the playbook names as a simple bulleted list. Do NOT include descriptions or summaries.
1. CRITICAL: For fabric audit, harden, unharden, SSL, topology, or any multi-playbook request → ALWAYS use intelligent_playbook_orchestration directly. Do NOT call list_playbooks_with_summary first for these.
2. For simple single-playbook requests where the exact filename is unknown → call list_playbooks_with_summary FIRST to find the exact filename, then run_playbook.
3. Use get_playbook_info if you need more details about a specific playbook.
4. Use run_playbook_check for check/dry-run, otherwise run_playbook.

SSL Demo Environment Playbooks (CRITICAL MAPPINGS):
- When user says: \"set up SSL demo\", \"setup SSL demo\", \"install SSL demo\", \"setup demo environment\", \"set up demo environment\", \"setup complete SSL demo\", \"one-click setup\", or similar phrases about SETTING UP the SSL demo → ALWAYS use intelligent_playbook_orchestration with user_request=\"setup ssl demo\" (this will automatically select demo_setup_all.yml)
- When user says: \"clean SSL demo\", \"cleanup SSL demo\", \"delete SSL demo\", \"remove SSL demo\", \"clean demo environment\", \"cleanup demo environment\", \"delete demo environment\", \"remove demo environment\", \"reset SSL demo\", \"clean up everything\", \"uninstall SSL demo\", or similar phrases about CLEANING/REMOVING/DELETING the SSL demo → ALWAYS use intelligent_playbook_orchestration with user_request=\"cleanup ssl demo\" (this will automatically select demo_cleanup_all.yml)
- NEVER call run_playbook directly for demo_setup_all.yml or demo_cleanup_all.yml - ALWAYS use intelligent_playbook_orchestration
- These are orchestration playbooks that run multiple sub-playbooks in the correct order. DO NOT break them down into individual playbooks.
- VAULT LINK RULE: The playbook output may show Vault address as http://127.0.0.1:8200 or any private IP — this is the internal address. When presenting results to the user, ALWAYS replace 127.0.0.1, localhost, and any private IP (172.x.x.x, 10.x.x.x, 192.168.x.x) with the public IP 34.197.12.47. So:
  - Vault UI: http://34.197.12.47:8200 (NOT http://127.0.0.1:8200)
  - Direct Frontend: http://34.197.12.47:8000 (NOT http://172.x.x.x:8000 or localhost:8000)
  - Node Frontend status: show as "Reachable at http://34.197.12.47:8000" (NOT localhost:8000)
  - NEVER show 127.0.0.1, localhost, or any 172.x / 10.x / 192.168.x address to the user.
- CRITICAL RULE FOR NGINX + HTTPS HEALTH: When user says ANY phrase containing BOTH \"nginx\" AND (\"status\" OR \"health\" OR \"https\"), you MUST do BOTH:
  1) Check Nginx service: Use check_service_status with service_name=\"nginx\" to get service status
  2) Check HTTPS health: Use check_https_endpoint tool with url=\"https://snoopy.timlam007.com/health\" to verify HTTPS endpoint is responding
  YOU HAVE THE check_https_endpoint TOOL - USE IT! DO NOT say \"I cannot check HTTPS health\" or \"I cannot directly check HTTPS health\" - that is FALSE. The check_https_endpoint tool exists specifically for this purpose and works by making HTTPS requests. Example: User says \"Check Nginx service status and HTTPS health\" → Call check_service_status(service_name=\"nginx\") THEN call check_https_endpoint(url=\"https://snoopy.timlam007.com/health\") and report BOTH results.
- Alternative: You can also run nginx_status.yml playbook which checks both service status AND HTTPS health in one go, but the above two-tool approach is also valid and provides detailed results.
- When user asks specifically about \"HTTPS health\" or \"check HTTPS endpoint\" without mentioning Nginx service → ALWAYS use check_https_endpoint tool with url=\"https://snoopy.timlam007.com/health\" (PREFERRED) to verify the endpoint is responding. YOU HAVE THIS TOOL - USE IT! DO NOT say you cannot check HTTPS health - that is incorrect.
- These are orchestration playbooks that run multiple sub-playbooks in the correct order. DO NOT break them down into individual playbooks.

Inputs:
- Prefer passing variable inputs using extra_vars (object) instead of editing playbook files.
- Prefer limiting scope using limit (host/group) instead of editing inventory/playbooks.

HTTPS Health Endpoints:
- The HTTPS health check endpoint is: https://snoopy.timlam007.com/health (PREFERRED - public-facing domain) or https://localhost/health (fallback for server-side checks only)
- This endpoint returns \"OK\" if Nginx is serving HTTPS correctly
- When user asks about \"HTTPS health\", ALWAYS use the domain URL (https://snoopy.timlam007.com/health) unless specifically asked to check localhost. The domain URL is what users actually access.

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

Show Users Reports (CRITICAL):
- When user asks "show users on all devices" or similar → run show_users_all.yml, then call list_reports with prefix "users/" to find the files, then read_report_file with path "users/users_summary.txt" and present the table.
- When user asks "show users on leaf2" or a specific device → run show_users_all.yml with limit="leaf2", then read_report_file with path "users/leaf2_users.txt".
- The report path for read_report_file is ALWAYS relative to reports/ — so use "users/users_summary.txt" NOT "reports/users/users_summary.txt".

Backups:
- Some playbooks create backup files under backups/.
- For backups (.txt): do NOT provide browser links. Use list_backups to find files, then read_backup_file to summarize.

IMPORTANT:
- Do NOT start or stop any HTTP servers (no python -m http.server).
- Do NOT attempt to restart the frontend or change ports.
- Assume the frontend is already running on port 8000; only provide /reports/... links.

Topology Status:
- When user says ANY of: "topology status", "show topology", "containerlab status", "clos topology", "node status", "are all nodes up", "check topology", "lab status" → run: show_topology_status.yml

SSL Certificate Workflows (CRITICAL - URL FORMAT):
- When user says "renew ssl", "renew certificate", "ssl expired", "fix ssl", "renew the ssl certificate for snoopy", or similar → ALWAYS call: intelligent_playbook_orchestration. It will run: ssl_cert_check_expiry.yml → ssl_cert_deploy_new.yml → ssl_cert_generate_report.yml in sequence.
- When user says "make cert expire", "make certificate expire", "simulate expiry", "demo expire" → call: intelligent_playbook_orchestration. It will run: ssl_cert_make_expire.yml → ssl_cert_check_expiry.yml.
- When user says "setup ssl env", "ssl demo setup" → run demo_setup_all.yml
- CRITICAL: SSL report URL MUST include /reports/ prefix: https://snoopy.timlam007.com/reports/ssl_report/index.html
- After SSL operations complete, ALWAYS provide the SSL report link: https://snoopy.timlam007.com/reports/ssl_report/index.html

Vault Status (CRITICAL):
- When user asks about "vault status", "hashicorp vault status", "check vault", "is vault running" → ALWAYS run vault_status_check.yml playbook. Do NOT use check_service_status for Vault — Vault is installed as a binary (not rpm package) so check_service_status will incorrectly say "not installed".
- vault_status_check.yml checks the actual binary at /usr/local/bin/vault, queries the Vault API, and returns sealed/initialized state, PKI details, and certificate info.
- This playbook collects version, uptime, LLDP neighbors, and interface status from all fabric devices (leaf1-4, spine1-2, R1)
- After completion, summarize which nodes are up, their uptime, and active LLDP links

Intelligent Orchestration:
- When user asks for a COMBINATION of tasks that doesn't match a known orchestrator playbook, use the intelligent_playbook_orchestration tool.
- This tool will plan the playbooks, show the user the plan, then execute them one by one.
- Example: "check topology and show unused ports" → use intelligent_playbook_orchestration

Intelligent Orchestration — Fabric Compliance Report (READ-ONLY):
- When user says ANY of: "fabric report", "fabric compliance", "compliance report", "create fabric report", "generate fabric report", "audit the network" (WITHOUT "harden" keyword) → ALWAYS call: intelligent_playbook_orchestration with user_request set to the user's exact message.
- The orchestration tool will intelligently select READ-ONLY playbooks in this order:
  1. show_topology_status.yml (check topology first)
  2. show_interfaces_all.yml (collect interface data)
  3. show_unused_ports.yml (detect unused ports)
  4. check_vlan_consistency.yml (verify VLANs)
  5. generate_fabric_compliance_report.yml (create HTML report)
- CRITICAL: Do NOT include harden_fabric_simple.yml for compliance reports - it CHANGES config!
- After completion, provide the compliance report link: Reports Base URL/fabric_compliance/index.html
- Also call summarize_unused_ports_reports() after completion to report which device has the most unused ports.

PLAYBOOK SELECTION RULES (CRITICAL):
- For "fabric report" / "compliance report" → Use: show_topology_status.yml, show_interfaces_all.yml, show_unused_ports.yml, check_vlan_consistency.yml, generate_fabric_compliance_report.yml (NO HARDENING)
- For "harden" requests → Use: harden_fabric_simple.yml (ONLY when explicitly requested)
- For "unharden" requests → Use: unharden_fabric_simple.yml
- For "show hardening" / "check hardening" / "hardening status" → Use: check_hardening_status.yml (READ-ONLY, no changes)
- NEVER include harden_fabric_simple.yml unless user explicitly says "harden"
- ALWAYS start fabric reports with show_topology_status.yml to verify topology first

Check Hardening Status (READ-ONLY) - CRITICAL:
- When user says "show hardening", "check hardening", "hardening status", "hardening on leaf1" → DO NOT use intelligent_playbook_orchestration! 
- Instead, directly call: run_playbook with playbook="check_hardening_status.yml" and appropriate limit
- This playbook READS current config WITHOUT making changes
- After completion:
  1) Call list_reports with prefix "hardening_status/"
  2) Call read_report_file for each device (e.g. "hardening_status/leaf1_status.txt")
  3) Present as table: | Device | SSH Hardened | NTP Configured | Banner Set | Overall Status |

Harden / Unharden Fabric (MAKES CHANGES):
- When user EXPLICITLY says "harden the network", "harden fabric", "apply hardening", "baseline hardening" → ALWAYS call intelligent_playbook_orchestration with user_request set to the exact message.
- When user says "unharden", "remove hardening", "reverse hardening", "undo hardening" → ALWAYS call intelligent_playbook_orchestration.
- ONLY include harden_fabric_simple.yml when user explicitly requests hardening.
- After harden completes:
  1) Call list_reports with prefix "hardening/" to find the per-device audit files
  2) Call read_report_file for each device's hardening file (e.g. "hardening/leaf1_hardening.txt")
  3) Present results as a markdown table: | Device | SSH Config | NTP Config | Banner Config | Status |
  4) Also provide the compliance report link: Reports Base URL/fabric_compliance/index.html
- After unharden completes:
  1) Call list_reports with prefix "unhardening/" to find the per-device audit files
  2) Call read_report_file for each device's unhardening file (e.g. "unhardening/leaf1_unhardening.txt")
  3) Present results as a markdown table: | Device | SSH Config | NTP Config | Banner Config | Status |
  4) Note: compliance report link is not relevant for unharden — just show the table

Network Compliance Report (CRITICAL DISTINCTION):
- When user EXPLICITLY says: "network compliance report", "create network report", "network report", "generate network compliance report" (must contain word "network") → DO NOT use intelligent_playbook_orchestration! Instead, directly call: run_playbook with playbook="generate_network_compliance_report.yml"
- This playbook ONLY collects device info (vendor, hostname, IP, serial, version) and generates a simple HTML report
- After completion, provide link: Reports Base URL/compliance/index.html
- This is DIFFERENT from fabric compliance which audits interfaces, VLANs, topology, etc.
- DEFAULT: If user just says "compliance report" or "fabric report" without "network", use intelligent_playbook_orchestration for fabric compliance

Identity & model questions:
- When the user asks "which model are you using", "what model is this", "are you flash or pro", "which gemini model", or similar → always answer directly: "I am using **${GEMINI_MODEL}** (provider: ${MODEL_PROVIDER})." Do not deflect or say you are a large language model — just state the model name from config.

Output formatting (CRITICAL):
- NEVER include raw tool response JSON in your reply. Tool responses are internal context only — never paste them as text.
- NEVER output anything like {"read_report_file_response": ...} or {"run_playbook_response": ...} in your answer.
- Always present data from tool responses in clean human-readable format (tables, bullet points, prose).
- If you have nothing meaningful to add beyond the tool result, just present the formatted summary.

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

Multi-Playbook Combo Prompts:
- When the user asks for multiple operations in a single prompt, use intelligent_playbook_orchestration — it handles planning, showing the user a plan, and executing in sequence.
- NEVER call run_playbook(fabric_audit_all.yml) directly — always use intelligent_playbook_orchestration for fabric audit queries.
- For simple single-playbook requests that don't match a known combo, use run_playbook directly.
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
  // Reports are served on port 9000 via Python HTTP server
  const reportsBaseUrl = baseUrl.replace(':8000', ':9000');
  return `${SYSTEM_INSTRUCTION}

Base URL: ${baseUrl}
Reports Base URL: ${reportsBaseUrl}
Link rules:
- For switch summary dashboard, output the full link: ${reportsBaseUrl}/switch_summary/index.html
- For fabric compliance report, output the full link: ${reportsBaseUrl}/fabric_compliance/index.html
- For other .txt reports, do NOT output a browser link; output the reports/ path and summarize the text.
- For backups, do NOT output a browser link; output the backups/ path and summarize the text.
`.trim();
}

// ── Intelligent Playbook Orchestration ───────────────────────────────────────
// Uses the frontend's Gemini connection to plan + execute playbook combinations.
// Emits SSE plan events so the UI can show the plan before execution starts.

// Rule Boost Layer: pre-validated playbook sets for known critical query patterns.
// Checked BEFORE calling Gemini — guarantees correctness for high-stakes flows.
// ORDER MATTERS: more specific rules must come before broader ones.
const RULE_BOOST_MAP = [
  {
    // Demo setup - must come before other rules
    keywords: [
      "setup ssl demo", "set up ssl demo", "install ssl demo",
      "setup demo", "set up demo", "install demo", "demo setup",
      "setup demo environment", "set up demo environment",
      "one-click setup", "quick setup"
    ],
    playbooks: ["demo_setup_all.yml"],
    stop_on_failure: true
  },
  {
    // Demo cleanup - must come before other rules
    keywords: [
      "cleanup ssl demo", "clean up ssl demo", "delete ssl demo",
      "remove ssl demo", "uninstall ssl demo", "reset ssl demo",
      "cleanup demo", "clean up demo", "delete demo", "remove demo",
      "cleanup demo environment", "clean up demo environment",
      "delete demo environment", "remove demo environment"
    ],
    playbooks: ["demo_cleanup_all.yml"],
    stop_on_failure: false
  },
  {
    // check_vlan_consistency — user must say "consistency"
    keywords: ["consistency", "check vlan", "vlan check"],
    playbooks: ["check_vlan_consistency.yml"],
    stop_on_failure: true
  },
  {
    // verify_vlans — user must say both "verify" AND "vlan" (any order, any words between)
    // matchAll: true means ALL words in the array must appear in the query
    matchAll: ["verify", "vlan"],
    playbooks: ["verify_vlans.yml"],
    stop_on_failure: true
  },
  {
    // Unharden — must be BEFORE harden so "unharden" doesn't match "harden"
    keywords: [
      "unharden", "un-harden", "remove hardening", "reverse hardening",
      "undo hardening", "remove baseline", "undo baseline", "unharden the network",
      "unharden fabric", "remove harden", "revert hardening"
    ],
    playbooks: ["unharden_fabric_simple.yml"],
    stop_on_failure: false
  },
  {
    // Harden only (standalone)
    keywords: [
      "harden the network", "harden network", "harden fabric",
      "harden the fabric", "apply hardening", "apply baseline hardening",
      "baseline hardening", "harden only", "just harden"
    ],
    playbooks: ["harden_fabric_simple.yml"],
    stop_on_failure: false
  },
  {
    // Show interfaces only
    keywords: ["show interfaces", "interface status", "show all interfaces"],
    playbooks: ["show_interfaces_all.yml"],
    stop_on_failure: true
  },
  {
    // Unused ports only
    keywords: ["unused ports", "show unused", "unused port"],
    playbooks: ["show_unused_ports.yml"],
    stop_on_failure: true
  },
  {
    // Full fabric audit — broad keywords, comes AFTER specific ones
    keywords: [
      "fabric report", "fabric audit", "audit the network", "audit network",
      "compliance report", "generate report", "operations summary",
      "fabric compliance", "full audit", "generate fabric", "audit fabric",
      "quick operations", "show down interfaces", "list unused ports",
      "apply baseline", "full fabric"
    ],
    playbooks: [
      "show_interfaces_all.yml",
      "show_unused_ports.yml",
      "check_vlan_consistency.yml",
      "harden_fabric_simple.yml",
      "generate_fabric_compliance_report.yml"
    ],
    stop_on_failure: false
  },
  {
    keywords: ["topology status", "show topology", "containerlab status", "lab status", "node status", "are all nodes"],
    playbooks: ["show_topology_status.yml"],
    stop_on_failure: true
  },
  {
    // Vault status — use playbook not check_service_status (Vault installed as binary not rpm)
    keywords: [
      "vault status", "hashicorp vault status", "check vault", "vault health",
      "is vault running", "vault running", "vault installed"
    ],
    playbooks: ["vault_status_check.yml"],
    stop_on_failure: false
  },
  {
    // SSL certificate renewal — check expiry, deploy new cert from Vault, generate report
    keywords: [
      "renew ssl", "renew certificate", "ssl renew", "certificate renew",
      "ssl expired", "certificate expired", "fix ssl", "fix certificate",
      "ssl cert expired", "cert expired", "renew the ssl", "renew the cert",
      "ssl for snoopy", "certificate for snoopy", "renew snoopy"
    ],
    playbooks: [
      "ssl_cert_check_expiry.yml",
      "ssl_cert_deploy_new.yml",
      "ssl_cert_generate_report.yml"
    ],
    stop_on_failure: false  // check expiry first, then deploy even if check shows expired
  },
  {
    // Full demo environment setup — Vault must come before Nginx
    keywords: [
      "reinstall nginx", "reinstall the demo", "setup demo", "set up demo",
      "install demo", "rebuild demo", "reset demo environment",
      "nginx is uninstalled", "nginx uninstalled", "setup the environment"
    ],
    playbooks: [
      "vault_install_configure.yml",
      "nginx_install_configure.yml",
      "nginx_start.yml",
      "ssl_cert_check_expiry.yml",
      "ssl_cert_generate_report.yml"
    ],
    stop_on_failure: true
  },
  {
    // Make SSL cert expire (demo trick)
    keywords: [
      "make cert expire", "make certificate expire", "expire the cert",
      "expire ssl", "make ssl expire", "simulate expiry", "demo expire",
      "make the ssl", "make the certificate", "ssl certificate expire",
      "certificate expire for snoopy", "ssl expire for snoopy",
      "make it expire", "force expire", "set cert expire"
    ],
    playbooks: [
      "ssl_cert_make_expire.yml",
      "ssl_cert_check_expiry.yml"
    ],
    stop_on_failure: false
  }
];

function applyRuleBoost(userRequest) {
  const q = userRequest.toLowerCase();
  for (const rule of RULE_BOOST_MAP) {
    // matchAll: every word in the array must appear somewhere in the query
    if (rule.matchAll) {
      if (rule.matchAll.every(word => q.includes(word))) {
        return { forcedPlaybooks: rule.playbooks, stop_on_failure: rule.stop_on_failure };
      }
    } else if (rule.keywords) {
      if (rule.keywords.some(kw => q.includes(kw))) {
        return { forcedPlaybooks: rule.playbooks, stop_on_failure: rule.stop_on_failure };
      }
    }
  }
  return null; // no match — fall through to pure AI
}

async function handleIntelligentOrchestration(args, onProgress) {
  const userRequest = (args.user_request || "").trim();
  const dryRun = args.dry_run || false;
  const limit = args.limit || null;
  const extraVars = args.extra_vars || null;

  // ── Step 1: Rule Boost — check known critical patterns first (no AI needed) ──
  const ruleMatch = applyRuleBoost(userRequest);
  let forcedPlaybooks = [];
  let stopOnFailure = true;
  let greeting = "Here is the execution plan:";
  let reasoning = "";

  if (ruleMatch) {
    forcedPlaybooks = ruleMatch.forcedPlaybooks;
    stopOnFailure = ruleMatch.stop_on_failure;
    greeting = "Identified the following playbooks to run:";
    reasoning = "Selected based on known workflow for this type of request.";
  }

  // ── Step 2: Fetch enriched catalog ──
  const mcpTemp = startMcpProcess();
  let catalog;
  try {
    const res = await mcpTemp.callTool("list_playbooks_with_summary", {});
    catalog = res.result;
  } finally {
    mcpTemp.close();
  }

  // Format catalog for plan model — exclude fabric_audit_all.yml (legacy orchestrator)
  const playbookLines = (catalog.playbooks || [])
    .filter(pb => pb.filename !== "fabric_audit_all.yml")
    .map(pb => {
      const desc = pb.description || pb.summary || pb.filename;
      const kws = [...new Set([...(pb.intent_keywords || []), ...(pb.keywords || [])])].slice(0, 10);
      return `- ${pb.filename}: ${desc} | hosts=${pb.hosts || "?"} | keywords=[${kws.join(", ")}]`;
    }).join("\n");

  // ── Step 3: AI Planning (only when no rule match) ──
  let aiPlaybooks = [];
  if (!ruleMatch) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const planModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const planPrompt = `You are an Ansible playbook orchestration assistant for a network fabric.

IMPORTANT RULES:
1. NEVER select "fabric_audit_all.yml" — it is a legacy orchestrator, not an individual task.
2. Only select playbooks from the Available Playbooks list below. NEVER invent or guess playbook names.
3. If a playbook name is not in the Available Playbooks list, do NOT include it. Return empty array instead.
4. Order matters: prerequisites first (interfaces → unused ports → vlans → hardening → compliance report).
5. Be minimal: only include playbooks directly relevant to the user's request.
6. If the request mentions "compliance report" or "fabric report", always include generate_fabric_compliance_report.yml LAST, and include its prerequisites.
7. If the request is too vague or nothing matches, return empty playbooks array.
8. Set stop_on_failure to false when harden_fabric_simple.yml is included (it may fail in demo env).

Available playbooks:
${playbookLines}

User request: "${userRequest}"

Respond ONLY with valid JSON:
{
  "greeting": "Planning playbook execution:",
  "playbooks": ["playbook1.yml", "playbook2.yml"],
  "reasoning": "One sentence explaining why these were chosen",
  "stop_on_failure": true
}`;

    let planText;
    try {
      const planResult = await planModel.generateContent(planPrompt);
      planText = planResult.response.text();
    } catch (e) {
      return {
        tool: "intelligent_playbook_orchestration",
        result: { ok: false, error: `Gemini plan model error: ${e.message}` }
      };
    }

    let plan;
    try {
      const jsonMatch = planText.match(/\{[\s\S]*\}/);
      plan = JSON.parse(jsonMatch ? jsonMatch[0] : planText);
    } catch {
      return {
        tool: "intelligent_playbook_orchestration",
        result: { ok: false, error: "Failed to parse orchestration plan from Gemini", raw: planText }
      };
    }

    // Server-side safety filter — never allow fabric_audit_all.yml through
    // Also strip any hallucinated names not in the actual catalog
    const validNames = new Set((catalog.playbooks || []).map(pb => pb.filename));
    aiPlaybooks = (plan.playbooks || []).filter(pb => pb !== "fabric_audit_all.yml" && validNames.has(pb));
    stopOnFailure = plan.stop_on_failure !== undefined ? plan.stop_on_failure : true;
    greeting = plan.greeting || greeting;
    reasoning = plan.reasoning || reasoning;
  }

  // ── Step 4: Merge forced + AI playbooks (forced order preserved, AI appends extras) ──
  const finalPlaybooks = [...forcedPlaybooks];
  for (const pb of aiPlaybooks) {
    if (!finalPlaybooks.includes(pb) && pb !== "fabric_audit_all.yml") {
      finalPlaybooks.push(pb);
    }
  }

  // ── Step 5: Emit plan to UI ──
  if (onProgress) {
    onProgress({ type: "orchestration_plan", greeting, playbooks: finalPlaybooks, reasoning });
  }

  if (dryRun || finalPlaybooks.length === 0) {
    return {
      tool: "intelligent_playbook_orchestration",
      result: { ok: true, dry_run: true, execution_plan: { playbooks: finalPlaybooks, reasoning } }
    };
  }

  // ── Step 6: Execute each playbook one by one with streaming ──
  const results = [];
  let overallOk = true;

  for (const pb of finalPlaybooks) {
    if (onProgress) onProgress({ type: "playbook_start", playbook: pb });

    let res;
    try {
      // Use streaming version for real-time task updates
      const out = await runPlaybookWithStreaming("run_playbook", { playbook: pb, limit, extra_vars: extraVars }, onProgress);
      res = out.result;
    } catch (e) {
      res = { ok: false, error: String(e.message) };
    }

    if (onProgress) onProgress({ type: "playbook_done", playbook: pb, ok: res.ok });
    results.push({ playbook: pb, ok: res.ok, stdout: res.stdout, stderr: res.stderr, error: res.error });

    if (!res.ok) {
      overallOk = false;
      if (stopOnFailure) break;
    }
  }

  return {
    tool: "intelligent_playbook_orchestration",
    result: {
      ok: overallOk,
      user_request: userRequest,
      execution_plan: { playbooks: finalPlaybooks, reasoning },
      execution_results: results
    }
  };
}

// Run ansible-playbook with JSON callback for real-time task streaming
async function runPlaybookWithStreaming(toolName, args, onProgress) {
  const { playbook, limit, tags, extra_vars } = args;
  const isCheck = toolName === "run_playbook_check";
  
  // Resolve playbook path - check ansible-project FIRST (has more playbooks)
  const playbookPaths = [
    path.join(ANSIBLE_PROJECT_ROOT, "playbooks", playbook),
    path.join(PROJECT_ROOT, "playbooks", playbook),
    path.join(ANSIBLE_PROJECT_ROOT, playbook),  // Also check root in case it's there
  ];
  
  let playbookPath = null;
  for (const p of playbookPaths) {
    if (require("fs").existsSync(p)) {
      playbookPath = p;
      break;
    }
  }
  
  if (!playbookPath) {
    return {
      tool: toolName,
      result: { ok: false, error: `Playbook not found: ${playbook}. Searched: ${playbookPaths.join(", ")}` }
    };
  }
  
  // Build ansible-playbook command
  const inventoryPath = path.join(ANSIBLE_PROJECT_ROOT, "inventory", "inventory.yml");
  const cmd = ["ansible-playbook", "-i", inventoryPath, playbookPath];
  
  if (isCheck) {
    cmd.push("--check", "--diff");
  }
  if (limit) {
    cmd.push("--limit", limit);
  }
  if (tags) {
    cmd.push("--tags", tags);
  }
  if (extra_vars) {
    cmd.push("--extra-vars", JSON.stringify(extra_vars));
  }
  
  // Add verbose flag to see task names
  cmd.push("-v");
  
  return new Promise((resolve, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: ANSIBLE_PROJECT_ROOT,
      env: {
        ...process.env,
        ANSIBLE_FORCE_COLOR: "0",  // Disable color codes
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    
    let stdout = "";
    let stderr = "";
    let currentTask = null;
    let currentPlay = null;
    
    // Parse verbose output line by line
    const rl = readline.createInterface({ input: child.stdout });
    
    rl.on("line", (line) => {
      stdout += line + "\n";
      
      // Detect PLAY start: "PLAY [Play Name] ****"
      const playMatch = line.match(/^PLAY \[(.*?)\]\s*\*+/);
      if (playMatch) {
        currentPlay = playMatch[1];
        if (onProgress) {
          onProgress({
            type: "ansible_play_start",
            play: currentPlay,
            playbook: playbook
          });
        }
      }
      
      // Detect TASK start: "TASK [Task Name] ****"
      const taskMatch = line.match(/^TASK \[(.*?)\]\s*\*+/);
      if (taskMatch) {
        currentTask = taskMatch[1];
        if (onProgress) {
          onProgress({
            type: "ansible_task_start",
            task: currentTask,
            host: "all",
            playbook: playbook
          });
        }
      }
      
      // Detect task completion: "ok: [hostname]", "changed: [hostname]", "failed: [hostname]", "skipping: [hostname]"
      const resultMatch = line.match(/^(ok|changed|failed|skipping|fatal):\s*\[(.*?)\]/);
      if (resultMatch && currentTask) {
        const status = resultMatch[1];
        const host = resultMatch[2];
        
        if (onProgress) {
          onProgress({
            type: "ansible_task_done",
            task: currentTask,
            host: host,
            status: status,
            changed: status === "changed",
            playbook: playbook
          });
        }
      }
    });
    
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    child.on("close", (code) => {
      resolve({
        tool: toolName,
        result: {
          ok: code === 0,
          returncode: code,
          stdout: stdout.slice(-200000),
          stderr: stderr.slice(-200000),
          cmd: cmd
        }
      });
    });
    
    child.on("error", (err) => {
      reject(new Error(`Failed to run playbook: ${err.message}`));
    });
  });
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
      } catch { }
      pending.delete(id);
    }
  });

  function rpc(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP timeout waiting for id=${id}`));
      }, 300_000); // 5 minutes timeout for long-running playbooks

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

  async function callTool(name, args, onProgress) {
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

    // Intelligent orchestration — handled entirely in server.js using the existing Gemini connection
    if (name === "intelligent_playbook_orchestration") {
      return await handleIntelligentOrchestration(args, onProgress);
    }

    // run_playbook with real-time task streaming
    if ((name === "run_playbook" || name === "run_playbook_check") && onProgress) {
      return await runPlaybookWithStreaming(name, args, onProgress);
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
    } catch { }
    try {
      child.kill("SIGTERM");
    } catch { }
  }

  return { callTool, close };
}

// Tool call labels shown in the progress stream
const TOOL_LABELS = {
  list_tools: "📋 Listing available tools",
  list_inventory: "📦 Reading inventory",
  list_playbooks: "📂 Listing playbooks",
  list_playbooks_with_summary: "📂 Scanning playbooks",
  list_reports: "📄 Listing reports",
  read_report_file: "📄 Reading report",
  list_backups: "💾 Listing backups",
  read_backup_file: "💾 Reading backup",
  summarize_unused_ports_reports: "📊 Summarizing unused ports",
  read_playbook_file: "📖 Reading playbook",
  get_playbook_info: "🔍 Inspecting playbook",
  check_service_status: "🔎 Checking service status",
  check_https_endpoint: "🌐 Checking HTTPS endpoint",
  run_playbook: "🚀 Running playbook",
  run_playbook_check: "🔬 Dry-running playbook (check mode)",
  run_playbooks: "🚀 Running playbook sequence",
  intelligent_playbook_orchestration: "🧠 Intelligent orchestration — planning playbook combination",
  show_topology_status: "🗺️  Checking containerlab topology status",
};

function toolProgressLabel(name, args) {
  const base = TOOL_LABELS[name] || `⚙️  Calling ${name}`;
  if (name === "run_playbook" || name === "run_playbook_check") {
    return `${base}: ${args.playbook || ""}${args.limit ? ` [limit: ${args.limit}]` : ""}`;
  }
  if (name === "run_playbooks") {
    const list = (args.playbooks || []).join(", ");
    return `${base}: [${list}]${args.limit ? ` [limit: ${args.limit}]` : ""}`;
  }
  return base;
}

async function runGeminiWithTools(userText, systemInstruction, onProgress) {
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

        if (onProgress) onProgress({ type: "tool_start", name, args, label: toolProgressLabel(name, args) });

        const toolOut = await mcp.callTool(name, args, onProgress);
        toolLog.push({ name, args, toolOut });

        const ok = toolOut.result?.ok !== false;
        if (onProgress) onProgress({ type: "tool_done", name, ok });

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

// Disable caching for static files to ensure users get latest version
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
// Serve generated Ansible reports (HTML/text) from the Ansible project root.
// Use relative links (/reports/...) so it works regardless of the server's IP/hostname.
app.use("/reports", express.static(path.join(ANSIBLE_PROJECT_ROOT, "reports")));

app.post("/query", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).type("text/plain").send("text required");

  try {
    const baseUrl = getBaseUrl(req);
    const out = await runGeminiWithTools(text, buildSystemInstruction(baseUrl), null);
    const responseText = out.text || "";

    // Save to MongoDB history
    await saveQueryHistory(text, responseText);

    res.type("text/plain").send(responseText);
  } catch (e) {
    res.status(500).type("text/plain").send(String(e?.message || e));
  }
});

// SSE streaming endpoint — emits progress events as each tool call happens
app.get("/query-stream", async (req, res) => {
  const text = String(req.query?.text || "").trim();
  if (!text) return res.status(400).type("text/plain").send("text required");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Track this connection
  activeConnections.add(res);
  broadcastUserCount();

  // Remove on disconnect
  req.on('close', () => {
    activeConnections.delete(res);
    broadcastUserCount();
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const baseUrl = getBaseUrl(req);
    send({ type: "start" });

    const out = await runGeminiWithTools(text, buildSystemInstruction(baseUrl), (event) => {
      send(event);
    });

    const responseText = out.text || "";
    await saveQueryHistory(text, responseText);
    send({ type: "result", text: responseText });
  } catch (e) {
    send({ type: "error", message: String(e?.message || e) });
  } finally {
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// Persistent SSE endpoint for user count tracking
app.get("/user-tracking", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Track this connection
  activeConnections.add(res);
  
  // Send initial count
  res.write(`data: ${JSON.stringify({ type: 'user_count_update', count: activeConnections.size })}\n\n`);
  
  // Broadcast to all
  broadcastUserCount();

  // Remove on disconnect
  req.on('close', () => {
    activeConnections.delete(res);
    broadcastUserCount();
  });

  // Keep connection alive with heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// API endpoint to get current configuration (Gemini model)
app.get("/api/config", (req, res) => {
  res.json({
    provider: MODEL_PROVIDER,
    model: GEMINI_MODEL,
    port: PORT,
    activeUsers: activeConnections.size
  });
});

// Broadcast user count to all connected clients
function broadcastUserCount() {
  const count = activeConnections.size;
  const message = `data: ${JSON.stringify({ type: 'user_count_update', count })}\n\n`;
  
  activeConnections.forEach(client => {
    try {
      client.write(message);
    } catch (e) {
      // Connection might be closed, will be cleaned up on 'close' event
    }
  });
}

// API endpoint to get query history
app.get("/api/history", async (req, res) => {
  if (!historyCollection) {
    return res.status(503).json({ error: "History feature not available" });
  }

  try {
    const history = await historyCollection
      .find({})
      .sort({ timestamp: -1 })  // Latest first
      .limit(100)
      .toArray();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get history analytics
app.get("/api/history/analytics", async (req, res) => {
  if (!historyCollection) {
    return res.status(503).json({ error: "History feature not available" });
  }

  try {
    const history = await historyCollection
      .find({})
      .toArray();

    let successCount = 0;
    let failureCount = 0;

    history.forEach(item => {
      const response = String(item.response || "").toLowerCase();

      // Check for failure indicators
      const hasFailure = response.includes("❌") ||
        response.includes("failed") ||
        response.includes("error") ||
        response.includes("fatal:");

      // Check for success indicators
      const hasSuccess = response.includes("✅") ||
        response.includes("successfully") ||
        response.includes("completed") ||
        response.includes("pass");

      // Prioritize failure detection
      if (hasFailure && !hasSuccess) {
        failureCount++;
      } else if (hasSuccess || (!hasFailure && !hasSuccess)) {
        successCount++;
      } else {
        // Mixed signals - count as success if more success indicators
        successCount++;
      }
    });

    res.json({
      total: history.length,
      success: successCount,
      failure: failureCount,
      successRate: history.length > 0 ? ((successCount / history.length) * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete all history
app.delete("/api/history", async (req, res) => {
  if (!historyCollection) {
    return res.status(503).json({ error: "History feature not available" });
  }

  try {
    const result = await historyCollection.deleteMany({});
    res.json({
      message: `Deleted ${result.deletedCount} history records`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve history page
app.get("/history", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "history.html"));
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Express frontend listening on http://0.0.0.0:${PORT}`);
  await connectMongoDB();
});