// Fetch and display Gemini model configuration
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const config = await res.json();
    document.getElementById("gemini-provider").textContent = config.provider || "GEMINI";
    document.getElementById("gemini-model").textContent = config.model || "Unknown";
    
    // Display initial user count
    if (config.activeUsers !== undefined) {
      document.getElementById("active-users").textContent = config.activeUsers;
    }
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

// Establish persistent SSE connection for user count tracking
let persistentSSE = null;
function connectUserTracking() {
  if (persistentSSE) return; // Already connected
  
  // Add timestamp to prevent caching
  persistentSSE = new EventSource('/user-tracking?t=' + Date.now());
  
  persistentSSE.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'user_count_update') {
        document.getElementById("active-users").textContent = msg.count;
      }
    } catch (e) {
      // Ignore parse errors
    }
  };
  
  persistentSSE.onerror = () => {
    persistentSSE.close();
    persistentSSE = null;
    // Reconnect after 5 seconds
    setTimeout(connectUserTracking, 5000);
  };
}

// Start tracking on page load
connectUserTracking();

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
const debugClose = document.getElementById("debug-close");
const debugLogs = document.getElementById("debug-logs");
const debugFilter = document.getElementById("debug-filter");
const debugSearch = document.getElementById("debug-search");
const debugClear = document.getElementById("debug-clear");
const debugExport = document.getElementById("debug-export");
const debugBadge = document.getElementById("debug-badge");
const appWrapper = document.querySelector(".app-wrapper");

// ── Debug System ──────────────────────────────────────────────────────────────
let debugEntries = [];
let debugStats = { total: 0, tools: 0, errors: 0, startTime: null };
let autoScroll = true;

function addDebugEntry(type, message, data = null) {
  // Convert to HKT timestamp
  const now = new Date();
  const hkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const hh = String(hkt.getHours()).padStart(2, '0');
  const mm = String(hkt.getMinutes()).padStart(2, '0');
  const ss = String(hkt.getSeconds()).padStart(2, '0');
  const ms = String(hkt.getMilliseconds()).padStart(3, '0');
  const timestamp = `${hh}:${mm}:${ss}.${ms}`;
  
  const entry = { type, message, data, timestamp, id: Date.now() + Math.random() };
  debugEntries.push(entry);
  
  // Update stats
  debugStats.total++;
  if (type === 'tool') debugStats.tools++;
  if (type === 'error') debugStats.errors++;
  
  // Update badge
  debugBadge.textContent = debugStats.total;
  debugBadge.style.display = debugStats.total > 0 ? 'block' : 'none';
  
  renderDebugLogs();
  updateDebugStats();
}

function renderDebugLogs() {
  const filterValue = debugFilter.value;
  const searchValue = debugSearch.value.toLowerCase();
  
  let filtered = debugEntries;
  
  // Apply filter
  if (filterValue !== 'all') {
    filtered = filtered.filter(e => e.type === filterValue);
  }
  
  // Apply search
  if (searchValue) {
    filtered = filtered.filter(e => 
      e.message.toLowerCase().includes(searchValue) ||
      (e.data && JSON.stringify(e.data).toLowerCase().includes(searchValue))
    );
  }
  
  if (filtered.length === 0) {
    debugLogs.innerHTML = '<div style="color: #8b949e; text-align: center; padding: 40px 20px;">No matching debug events.</div>';
    return;
  }
  
  const html = filtered.map(entry => {
    const typeLabel = entry.type.toUpperCase();
    const dataStr = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : '';
    return `
      <div class="debug-entry ${entry.type}">
        <span class="debug-timestamp">${entry.timestamp}</span>
        <span class="debug-type ${entry.type}">${typeLabel}</span>
        <div class="debug-message">${escapeHtml(entry.message)}${escapeHtml(dataStr)}</div>
      </div>
    `;
  }).join('');
  
  debugLogs.innerHTML = html;
  
  // Auto-scroll to bottom
  if (autoScroll) {
    debugLogs.scrollTop = debugLogs.scrollHeight;
  }
}

function updateDebugStats() {
  document.getElementById('debug-total').textContent = debugStats.total;
  document.getElementById('debug-tools').textContent = debugStats.tools;
  document.getElementById('debug-errors').textContent = debugStats.errors;
  
  if (debugStats.startTime) {
    const duration = Math.floor((Date.now() - debugStats.startTime) / 1000);
    document.getElementById('debug-duration').textContent = `${duration}s`;
  }
  
  // Add start and end times
  if (debugEntries.length > 0) {
    const startTime = debugEntries[0].timestamp.substring(0, 8); // HH:MM:SS
    const endTime = debugEntries[debugEntries.length - 1].timestamp.substring(0, 8);
    document.getElementById('debug-start-time').textContent = `${startTime} (HKT)`;
    document.getElementById('debug-end-time').textContent = `${endTime} (HKT)`;
  }
}

function clearDebugLogs() {
  debugEntries = [];
  debugStats = { total: 0, tools: 0, errors: 0, startTime: null };
  debugBadge.style.display = 'none';
  renderDebugLogs();
  updateDebugStats();
  debugLogs.innerHTML = '<div style="color: #8b949e; text-align: center; padding: 40px 20px;">No debug events yet. Send a query to see logs.</div>';
}

function exportDebugLogs() {
  const data = {
    timestamp: new Date().toISOString(),
    stats: debugStats,
    entries: debugEntries
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debug-log-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Debug panel toggle ────────────────────────────────────────────────────────
debugBtn.addEventListener("click", () => {
  debugPanel.classList.toggle('open');
  appWrapper.classList.toggle('debug-open');
  debugBtn.textContent = debugPanel.classList.contains('open') ? "🔍 Hide" : "🔍 Debug";
  
  // Re-add badge
  if (debugStats.total > 0) {
    debugBtn.innerHTML = debugPanel.classList.contains('open') ? "🔍 Hide" : "🔍 Debug";
    debugBtn.appendChild(debugBadge);
  }
});

debugClose.addEventListener("click", () => {
  debugPanel.classList.remove('open');
  appWrapper.classList.remove('debug-open');
  debugBtn.textContent = "🔍 Debug";
  if (debugStats.total > 0) {
    debugBtn.appendChild(debugBadge);
  }
});

debugFilter.addEventListener("change", renderDebugLogs);
debugSearch.addEventListener("input", renderDebugLogs);
debugClear.addEventListener("click", clearDebugLogs);
debugExport.addEventListener("click", exportDebugLogs);

// Keyboard shortcut: Ctrl+D or Cmd+D
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    debugBtn.click();
  }
});

// Detect manual scroll (disable auto-scroll)
debugLogs.addEventListener('scroll', () => {
  const isAtBottom = debugLogs.scrollHeight - debugLogs.scrollTop <= debugLogs.clientHeight + 50;
  autoScroll = isAtBottom;
});

function appendDebug(text) {
  // Legacy function - now uses new debug system
  addDebugEntry('system', text);
}

go.addEventListener("click", async () => {
  const text = (q.value || "").trim();
  if (!text) return;

  const { time, date } = hktTimestamp();
  const header = `${DIVIDER}\n📝 Query: "${text}"\n🕐 Time: ${time}, ${date} (HKT)\n${DIVIDER}\n\n`;

  out.textContent = header + "⏳ Connecting...";
  go.disabled = true;

  // Clear debug logs for new query
  clearDebugLogs();
  debugStats.startTime = Date.now();
  addDebugEntry('system', `Query started: "${text}"`);

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
          addDebugEntry('ai', 'AI processing started');
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
          addDebugEntry('tool', `Tool call: ${msg.name}`, { label: msg.label, name: msg.name });
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
          addDebugEntry(msg.ok !== false ? 'tool' : 'error', `Tool completed: ${msg.name}`, { ok: msg.ok, name: msg.name });
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
          addDebugEntry('ai', 'Orchestration plan generated', { playbooks: msg.playbooks, reasoning: msg.reasoning });
          renderProgress();

        } else if (msg.type === "playbook_start") {
          stopTimer();
          const label = `🚀 Running playbook: ${msg.playbook}`;
          progressLines.push(label);
          progressLines.push("   ⏳ Processing...");
          const idx = progressLines.length - 2;
          startTimer(idx, label);
          addDebugEntry('tool', `Playbook started: ${msg.playbook}`, { playbook: msg.playbook });
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
          addDebugEntry(msg.ok !== false ? 'tool' : 'error', `Playbook completed: ${msg.playbook}`, { ok: msg.ok, playbook: msg.playbook });
          renderProgress();

        } else if (msg.type === "ansible_play_start") {
          // Ansible play started
          addDebugEntry('tool', `Play started: ${msg.play}`, { play: msg.play, playbook: msg.playbook });

        } else if (msg.type === "ansible_task_start") {
          // Ansible task started
          addDebugEntry('tool', `Task started: ${msg.task} (${msg.host})`, { task: msg.task, host: msg.host, playbook: msg.playbook });

        } else if (msg.type === "ansible_task_done") {
          // Ansible task completed
          const statusIcon = msg.status === 'ok' ? '✓' : msg.status === 'failed' ? '✗' : msg.status === 'skipped' ? '⊘' : '?';
          const changeInfo = msg.changed ? ' [changed]' : '';
          addDebugEntry(
            msg.status === 'failed' ? 'error' : 'tool',
            `Task ${statusIcon}: ${msg.task} (${msg.host})${changeInfo}`,
            { task: msg.task, host: msg.host, status: msg.status, changed: msg.changed, playbook: msg.playbook }
          );

        } else if (msg.type === "user_count_update") {
          // Update active user count
          document.getElementById("active-users").textContent = msg.count;

        } else if (msg.type === "result") {
          stopTimer();
          // Remove trailing "Processing..." line then show final answer
          if (progressLines[progressLines.length - 1] === "🤖 Processing..." ||
            (progressLines[progressLines.length - 1] || "").startsWith("🤖 Processing...")) {
            progressLines.pop();
          }
          addDebugEntry('ai', 'Response received', { length: msg.text.length });
          const separator = "\n" + "─".repeat(80) + "\n";
          out.textContent = header + progressLines.join("\n") + separator + msg.text;

        } else if (msg.type === "error") {
          stopTimer();
          addDebugEntry('error', `Error: ${msg.message}`, { message: msg.message });
          out.textContent = header + progressLines.join("\n") + "\n\n❌ Error: " + msg.message;
          es.close();
          resolve();
        }
      };

      es.onerror = (err) => {
        es.close();
        addDebugEntry('error', 'Stream connection lost');
        reject(new Error("Stream connection lost"));
      };
    });

  } catch (e) {
    stopTimer();
    addDebugEntry('error', `Exception: ${e.message}`, { error: e.toString() });
    out.textContent = header + String(e);
  } finally {
    stopTimer();
    go.disabled = false;
    addDebugEntry('system', 'Query completed');
  }
});
