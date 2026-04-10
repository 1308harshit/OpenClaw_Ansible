#!/bin/bash
BASE=/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project

echo "=== File timestamps ==="
ls -la $BASE/mcp_server.py $BASE/frontend/server.js

echo "=== PLAYBOOK_CATALOG in mcp_server.py ==="
grep -c "PLAYBOOK_CATALOG" $BASE/mcp_server.py && echo "OK: PLAYBOOK_CATALOG found" || echo "MISSING"

echo "=== RULE_BOOST_MAP in server.js ==="
grep -c "RULE_BOOST_MAP" $BASE/frontend/server.js && echo "OK: RULE_BOOST_MAP found" || echo "MISSING"

echo "=== fabric_audit_all removed from routing ==="
if grep -q "ALWAYS run: fabric_audit_all" $BASE/frontend/server.js; then
  echo "FAIL: old routing still present"
else
  echo "OK: old fabric_audit_all routing removed"
fi

echo "=== Restarting node server.js ==="
pkill -f "node server.js" 2>/dev/null
sleep 2
cd $BASE/frontend
nohup node server.js >> frontend.nohup.log 2>&1 &
NODE_PID=$!
sleep 3
if ps -p $NODE_PID > /dev/null 2>&1; then
  echo "OK: node server.js running PID=$NODE_PID"
else
  echo "WARN: checking process list..."
  ps aux | grep "node server" | grep -v grep
fi
echo "=== Done ==="
