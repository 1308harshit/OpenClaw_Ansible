#!/bin/bash
cd /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project

echo "=== Checking current processes ==="
ps aux | grep -v grep | grep -E "openclaw|mcp_server|node"

echo "=== Stopping openclaw gateway ==="
pkill -f "openclaw" 2>/dev/null
sleep 2

echo "=== Starting openclaw gateway ==="
set -a
source .env
set +a
nohup openclaw gateway run >> startup.log 2>&1 &
sleep 3

echo "=== Verifying processes after restart ==="
ps aux | grep -v grep | grep -E "openclaw|mcp_server|node"

echo "=== Last 10 lines of startup.log ==="
tail -10 startup.log
