#!/bin/bash
# startup.sh - Boot script for Ansible MCP Project
# Restarts: node server.js (frontend) + openclaw gateway
# User: ansible
# Server path: /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project

FRONTEND_DIR="/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend"
LOG_FILE="/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/startup.log"

echo "========================================" >> "$LOG_FILE"
echo "[$(date)] startup.sh triggered" >> "$LOG_FILE"

# ── 1. Kill any existing node server.js process ──────────────────────────────
echo "[$(date)] Killing existing node server.js processes..." >> "$LOG_FILE"
pkill -f "node.*server.js" 2>/dev/null
sleep 3

# ── 2. Start node server.js in background ────────────────────────────────────
echo "[$(date)] Starting node server.js..." >> "$LOG_FILE"
cd "$FRONTEND_DIR"
nohup node server.js >> "$FRONTEND_DIR/frontend.nohup.log" 2>&1 &
echo "[$(date)] node server.js started (PID: $!)" >> "$LOG_FILE"

# ── 3. Stop openclaw gateway (ignore errors) ─────────────────────────────────
echo "[$(date)] Running: openclaw gateway stop..." >> "$LOG_FILE"
openclaw gateway stop >> "$LOG_FILE" 2>&1
echo "[$(date)] openclaw gateway stop done (exit code: $?)" >> "$LOG_FILE"
sleep 3

# ── 4. Start openclaw gateway (keep running) ─────────────────────────────────
echo "[$(date)] Running: openclaw gateway run..." >> "$LOG_FILE"
nohup openclaw gateway run >> "$LOG_FILE" 2>&1 &
echo "[$(date)] openclaw gateway run started (PID: $!)" >> "$LOG_FILE"

echo "[$(date)] startup.sh complete." >> "$LOG_FILE"
