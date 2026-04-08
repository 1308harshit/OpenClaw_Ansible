// Fetch and display Gemini model configuration
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const config = await res.json();
    document.getElementById("gemini-provider").textContent = config.provider || "GEMINI";
    document.getElementById("gemini-model").textContent = config.model || "Unknown";
  } catch (e) {
    document.getElementById("gemini-provider").textContent = "GEMINI";
    document.getElementById("gemini-model").textContent = "Error loading";
  }
}

// Update HKT time display
function updateHKTTime() {
  const now = new Date();
  const hktTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const hours = String(hktTime.getHours()).padStart(2, '0');
  const minutes = String(hktTime.getMinutes()).padStart(2, '0');
  const seconds = String(hktTime.getSeconds()).padStart(2, '0');
  document.getElementById("hkt-time").textContent = `${hours}:${minutes}:${seconds}`;
  document.getElementById("hkt-date").textContent = hktTime.toLocaleDateString("en-GB", {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: "Asia/Hong_Kong"
  }) + " (HKT)";
}

loadConfig();
updateHKTTime();
setInterval(updateHKTTime, 1000);

document.getElementById("clear-btn").addEventListener("click", () => {
  document.getElementById("q").value = "";
  document.getElementById("q").focus();
});

document.getElementById("history-btn").addEventListener("click", () => {
  window.location.href = "/history";
});

function hktTimestamp() {
  const now = new Date();
  const hkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const hh = String(hkt.getHours()).padStart(2, '0');
  const mm = String(hkt.getMinutes()).padStart(2, '0');
  const ss = String(hkt.getSeconds()).padStart(2, '0');
  const date = hkt.toLocaleDateString("en-GB", {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: "Asia/Hong_Kong"
  });
  return { time: `${hh}:${mm}:${ss}`, date };
}

const DIVIDER = "━".repeat(80);

const q = document.getElementById("q");
const out = document.getElementById("out");
const go = document.getElementById("go");

go.addEventListener("click", async () => {
  const text = (q.value || "").trim();
  if (!text) return;

  const { time, date } = hktTimestamp();
  const header = `${DIVIDER}\n📝 Query: "${text}"\n🕐 Time: ${time}, ${date} (HKT)\n${DIVIDER}\n\n`;

  out.textContent = header + "⏳ Connecting...";
  go.disabled = true;

  // Progress lines shown while streaming
  const progressLines = [];

  function renderProgress() {
    out.textContent = header + progressLines.join("\n");
  }

  try {
    const url = `/query-stream?text=${encodeURIComponent(text)}`;
    const es = new EventSource(url);

    await new Promise((resolve, reject) => {
      es.onmessage = (e) => {
        if (e.data === "[DONE]") { es.close(); resolve(); return; }

        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }

        if (msg.type === "start") {
          progressLines.push("🤖 Thinking...");
          renderProgress();

        } else if (msg.type === "tool_start") {
          // Replace last "Thinking..." or add new line
          const last = progressLines[progressLines.length - 1] || "";
          if (last === "🤖 Thinking...") progressLines.pop();
          progressLines.push(`⚙️  ${msg.label}`);
          renderProgress();

        } else if (msg.type === "tool_done") {
          // Mark the last tool line with ok/fail
          const idx = progressLines.length - 1;
          if (idx >= 0) {
            const icon = msg.ok !== false ? "✅" : "❌";
            progressLines[idx] = progressLines[idx].replace(/^⚙️ /, `${icon} `);
          }
          progressLines.push("🤖 Processing...");
          renderProgress();

        } else if (msg.type === "orchestration_plan") {
          // Show the AI plan before execution starts
          if (progressLines[progressLines.length - 1] === "🤖 Thinking...") progressLines.pop();
          progressLines.push("─".repeat(60));
          progressLines.push(`🤖 ${msg.greeting}`);
          progressLines.push("");
          (msg.playbooks || []).forEach((pb, i) => {
            progressLines.push(`   ${i + 1}. 📋 ${pb}`);
          });
          if (msg.reasoning) progressLines.push(`\n   💡 ${msg.reasoning}`);
          progressLines.push("─".repeat(60));
          progressLines.push("");
          renderProgress();

        } else if (msg.type === "playbook_start") {
          progressLines.push(`🚀 Running playbook: ${msg.playbook}`);
          progressLines.push("   ⏳ Processing...");
          renderProgress();

        } else if (msg.type === "playbook_done") {
          // Replace the last "Processing..." with done status
          const last = progressLines[progressLines.length - 1];
          if (last && last.includes("Processing...")) progressLines.pop();
          const icon = msg.ok !== false ? "✅" : "❌";
          const status = msg.ok !== false ? "Complete" : "Failed";
          // Update the "Running playbook" line
          const pbIdx = progressLines.map(l => l.includes(`Running playbook: ${msg.playbook}`)).lastIndexOf(true);
          if (pbIdx >= 0) progressLines[pbIdx] = `${icon} Running playbook: ${msg.playbook} — ${status}`;
          progressLines.push("");
          renderProgress();

        } else if (msg.type === "result") {
          // Remove trailing "Processing..." line then show final answer
          if (progressLines[progressLines.length - 1] === "🤖 Processing...") {
            progressLines.pop();
          }
          const separator = "\n" + "─".repeat(80) + "\n";
          out.textContent = header + progressLines.join("\n") + separator + msg.text;

        } else if (msg.type === "error") {
          out.textContent = header + progressLines.join("\n") + "\n\n❌ Error: " + msg.message;
          es.close();
          resolve();
        }
      };

      es.onerror = (err) => {
        es.close();
        reject(new Error("Stream connection lost"));
      };
    });

  } catch (e) {
    out.textContent = header + String(e);
  } finally {
    go.disabled = false;
  }
});
