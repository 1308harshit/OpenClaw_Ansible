// Fetch and display Gemini model configuration
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const config = await res.json();
    console.log("Config loaded:", config); // Debug log
    document.getElementById("gemini-provider").textContent = config.provider || "GEMINI";
    document.getElementById("gemini-model").textContent = config.model || "Unknown";
  } catch (e) {
    console.error("Failed to load config:", e);
    document.getElementById("gemini-provider").textContent = "GEMINI";
    document.getElementById("gemini-model").textContent = "Error loading";
  }
}

// Update HKT time display
function updateHKTTime() {
  const now = new Date();
  
  // Convert to HKT (GMT+8)
  const hktTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  
  // Format time (HH:MM:SS)
  const hours = String(hktTime.getHours()).padStart(2, '0');
  const minutes = String(hktTime.getMinutes()).padStart(2, '0');
  const seconds = String(hktTime.getSeconds()).padStart(2, '0');
  const timeString = `${hours}:${minutes}:${seconds}`;
  
  // Format date (Day, DD Mon YYYY)
  const dateString = hktTime.toLocaleDateString("en-GB", {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: "Asia/Hong_Kong"
  });
  
  document.getElementById("hkt-time").textContent = timeString;
  document.getElementById("hkt-date").textContent = `${dateString} (HKT)`;
}

// Initialize on page load
loadConfig();
updateHKTTime();
setInterval(updateHKTTime, 1000); // Update every second

// History button handler
document.getElementById("history-btn").addEventListener("click", () => {
  window.location.href = "/history";
});

async function runQuery(text) {
  const res = await fetch("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(body || `HTTP ${res.status}`);
  return body;
}

const q = document.getElementById("q");
const out = document.getElementById("out");
const go = document.getElementById("go");

go.addEventListener("click", async () => {
  const text = (q.value || "").trim();
  if (!text) return;

  out.textContent = "Running...";
  go.disabled = true;

  try {
    const resultText = await runQuery(text);
    out.textContent = resultText;
  } catch (e) {
    out.textContent = String(e);
  } finally {
    go.disabled = false;
  }
});


