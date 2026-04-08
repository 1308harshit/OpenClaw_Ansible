#!/bin/bash
pkill -f "node server.js" 2>/dev/null
sleep 2
cd /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend
nohup node server.js >> frontend.nohup.log 2>&1 &
echo "Started node server.js PID: $!"
sleep 2
ps aux | grep "node server.js" | grep -v grep
