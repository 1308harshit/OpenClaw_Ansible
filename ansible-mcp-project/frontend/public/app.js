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
const debugBtn = document.getElementById("debug-btn");
const debugPanel = document.getElementById("debug-panel");
const debugOut = document.getElementById("debug-out");

// ── Debug panel toggle ────────────────────────────────────────────────────────
let debugVisible = false;
debugBtn.addEventListener("click", () => {
  debugVisible = !debugVisible;
  debugPanel.style.display = debugVisible ? "block" : "none";
  debugBtn.textContent = debugVisible ? "🔍 Hide Debug" : "🔍 Debug";
});

function appendDebug(text) {
  const ts = new Date().toISOString().substring(11, 23);
  debugOut.textContent += `[${ts}] ${text}\n`;
  debugOut.scrollTop = debugOut.scrollHeight;
}

go.addEventListener("click", async () => {
  const text = (q.value || "").trim();
  if (!text) return;

  const { time, date } = hktTimestamp();
  const header = `${DIVIDER}\n📝 Query: "${text}"\n🕐 Time: ${time}, ${date} (HKT)\n${DIVIDER}\n\n`;

  out.textContent = header + "⏳ Connecting...";
  go.disabled = true;

  // Clear debug panel for new query
  debugOut.textContent = `=== Query: "${text}" ===\n`;

  // Progress lines shown while streaming
  const progressLines = [];

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  // Tracks which line index is "active" (currently running) and ticks a counter
  let activeLineIdx = -1;
  let activeLineBase = "";
  let elapsedSeconds = 0;
  let timerInterval = null;

  function startTimer(lineIdx, baseText) {
    stopTimer();
    activeLineIdx = lineIdx;
    activeLineBase = baseText;
    elapsedSeconds = 0;
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      if (activeLineIdx >= 0 && activeLineIdx < progressLines.length) {
        progressLines[activeLineIdx] = `${activeLineBase}  ⏱ ${elapsedSeconds}s`;
        renderProgress();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    activeLineIdx = -1;
    activeLineBase = "";
    elapsedSeconds = 0;
  }

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
          const idx = progressLines.length - 1;
          startTimer(idx, "🤖 Thinking...");
          appendDebug("stream started");
          renderProgress();

        } else if (msg.type === "tool_start") {
          stopTimer();
          // Replace last "Thinking..." or add new line
          const last = progressLines[progressLines.length - 1] || "";
          if (last === "🤖 Thinking..." || last.startsWith("🤖 Thinking...")) progressLines.pop();
          const label = `⚙️  ${msg.label}`;
          progressLines.push(label);
          const idx = progressLines.length - 1;
          startTimer(idx, label);
          appendDebug(`tool_start: ${msg.name} — ${msg.label}`);
          renderProgress();

        } else if (msg.type === "tool_done") {
          stopTimer();
          // Mark the last tool line with ok/fail
          const idx = progressLines.length - 1;
          if (idx >= 0) {
            const icon = msg.ok !== false ? "✅" : "❌";
            progressLines[idx] = progressLines[idx].replace(/^⚙️ /, `${icon} `).replace(/  ⏱ \d+s$/, "");
          }
          progressLines.push("🤖 Processing...");
          const pidx = progressLines.length - 1;
          startTimer(pidx, "🤖 Processing...");
          appendDebug(`tool_done: ${msg.name} ok=${msg.ok}`);
          renderProgress();

        } else if (msg.type === "orchestration_plan") {
          // Show the AI plan before execution starts — deduplicate if called multiple times
          if (progressLines[progressLines.length - 1] === "🤖 Thinking...") progressLines.pop();
          // Remove any previous plan block to avoid duplicates
          const prevPlanIdx = progressLines.findIndex(l => l.startsWith("⚙️  🧠 Intelligent orchestration"));
          if (prevPlanIdx >= 0) progressLines.splice(prevPlanIdx);
          progressLines.push("⚙️  🧠 Intelligent orchestration — planning playbook combination");
          progressLines.push("─".repeat(60));
          (msg.playbooks || []).forEach((pb, i) => {
            progressLines.push(`   ${i + 1}. 📋 ${pb}`);
          });
          if (msg.reasoning) progressLines.push(`\n   💡 ${msg.reasoning}`);
          progressLines.push("─".repeat(60));
          progressLines.push("");
          renderProgress();

        } else if (msg.type === "playbook_start") {
          stopTimer();
          const label = `🚀 Running playbook: ${msg.playbook}`;
          progressLines.push(label);
          progressLines.push("   ⏳ Processing...");
          const idx = progressLines.length - 2;
          startTimer(idx, label);
          appendDebug(`playbook_start: ${msg.playbook}`);
          renderProgress();

        } else if (msg.type === "playbook_done") {
          stopTimer();
          // Replace the last "Processing..." with done status
          const last = progressLines[progressLines.length - 1];
          if (last && last.includes("Processing...")) progressLines.pop();
          const icon = msg.ok !== false ? "✅" : "❌";
          const status = msg.ok !== false ? "Complete" : "Failed";
          // Update the "Running playbook" line — strip timer suffix
          const pbIdx = progressLines.map(l => l.includes(`Running playbook: ${msg.playbook}`)).lastIndexOf(true);
          if (pbIdx >= 0) progressLines[pbIdx] = `${icon} Running playbook: ${msg.playbook} — ${status}`;
          progressLines.push("");
          appendDebug(`playbook_done: ${msg.playbook} ok=${msg.ok}`);
          renderProgress();

        } else if (msg.type === "result") {
          stopTimer();
          // Remove trailing "Processing..." line then show final answer
          if (progressLines[progressLines.length - 1] === "🤖 Processing..." ||
            (progressLines[progressLines.length - 1] || "").startsWith("🤖 Processing...")) {
            progressLines.pop();
          }
          appendDebug("result received");
          const separator = "\n" + "─".repeat(80) + "\n";
          out.textContent = header + progressLines.join("\n") + separator + msg.text;

        } else if (msg.type === "error") {
          stopTimer();
          appendDebug(`error: ${msg.message}`);
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
    stopTimer();
    out.textContent = header + String(e);
  } finally {
    stopTimer();
    go.disabled = false;
  }
});
