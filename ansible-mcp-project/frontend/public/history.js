let allHistory = [];
let analyticsChart = null;

async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allHistory = await res.json();
    displayHistory(allHistory);
    updateStats(allHistory);
    await loadAnalytics();
  } catch (e) {
    document.getElementById("history-container").innerHTML = `
      <div class="no-history">
        <p>Failed to load history: ${e.message}</p>
      </div>
    `;
  }
}

async function loadAnalytics() {
  try {
    const res = await fetch("/api/history/analytics");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const analytics = await res.json();
    
    document.getElementById("success-rate").textContent = `${analytics.successRate}%`;
    renderChart(analytics);
  } catch (e) {
    console.error("Failed to load analytics:", e);
  }
}

function renderChart(analytics) {
  const ctx = document.getElementById("analytics-chart");
  
  if (analyticsChart) {
    analyticsChart.destroy();
  }

  analyticsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Success', 'Failure'],
      datasets: [{
        data: [analytics.success, analytics.failure],
        backgroundColor: ['#10b981', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 10,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = analytics.total;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function displayHistory(history) {
  const container = document.getElementById("history-container");
  
  if (!history || history.length === 0) {
    container.innerHTML = `
      <div class="no-history">
        <p>No query history yet.</p>
        <p>Start using Ansible MCP Buddy to see your queries here!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="history-list">
      ${history.map(item => `
        <div class="history-item">
          <div class="history-header">
            <div class="timestamp">${formatTimestamp(item.timestamp)}</div>
          </div>
          <div class="query-section">
            <div class="query-label">User Query</div>
            <div class="query-text">${escapeHtml(item.query)}</div>
          </div>
          <div class="response-section">
            <div class="response-label">AI Response</div>
            <div class="response-text">${escapeHtml(item.response)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function updateStats(history) {
  const total = history.length;
  const today = history.filter(item => {
    const itemDate = new Date(item.timestamp);
    const now = new Date();
    return itemDate.toDateString() === now.toDateString();
  }).length;

  document.getElementById("total-queries").textContent = total;
  document.getElementById("today-queries").textContent = today;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const hktDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  
  const dateStr = hktDate.toLocaleDateString("en-GB", {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  
  const timeStr = hktDate.toLocaleTimeString("en-GB", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  return `${dateStr} ${timeStr} (HKT)`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function searchHistory() {
  const searchTerm = document.getElementById("search-input").value.toLowerCase();
  if (!searchTerm) {
    displayHistory(allHistory);
    return;
  }

  const filtered = allHistory.filter(item => 
    item.query.toLowerCase().includes(searchTerm) ||
    item.response.toLowerCase().includes(searchTerm)
  );
  
  displayHistory(filtered);
}

async function deleteAllHistory() {
  if (!confirm("Are you sure you want to delete ALL query history? This cannot be undone.")) {
    return;
  }

  try {
    const res = await fetch("/api/history", {
      method: "DELETE"
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const result = await res.json();
    alert(`✅ ${result.message || 'All history deleted successfully!'}`);
    
    // Reload history
    await loadHistory();
  } catch (e) {
    alert(`❌ Failed to delete history: ${e.message}`);
  }
}

// Event listeners
document.getElementById("search-btn").addEventListener("click", searchHistory);
document.getElementById("search-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchHistory();
});
document.getElementById("clear-btn").addEventListener("click", () => {
  document.getElementById("search-input").value = "";
  displayHistory(allHistory);
});
document.getElementById("delete-all-btn").addEventListener("click", deleteAllHistory);

// Load history on page load
loadHistory();
