#!/bin/bash
echo "=== File timestamps ==="
ls -la /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/mcp_server.py
ls -la /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/server.js

echo "=== Checking PLAYBOOK_CATALOG in mcp_server.py ==="
grep -c "PLAYBOOK_CATALOG" /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/mcp_server.py && echo "PLAYBOOK_CATALOG found" || echo "NOT FOUND"

echo "=== Checking RULE_BOOST_MAP in server.js ==="
grep -c "RULE_BOOST_MAP" /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/server.js && echo "RULE_BOOST_MAP found" || echo "NOT FOUND"

echo "=== Checking fabric_audit_all removed from SYSTEM_INSTRUCTION ==="
grep "fabric_audit_all" /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/server.js | grep -v "NEVER\|legacy\|filter\|fabric_audit_all\.yml.*exclusion\|fabric_audit_all\.yml.*filter" | head -5

echo "=== Restarting node server.js ==="
pkill -f "node server.js" 2>/dev/null
sleep 2
cd /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend
nohup node server.js >> frontend.nohup.log 2>&1 &
sleep 3
echo "PID: $!"
ps aux | grep "node server.js" | grep -v grep
echo "=== Done ==="
