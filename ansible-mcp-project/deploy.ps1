$key = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project\ansible-keypair.pem"
$remote = "ansible@34.197.12.47"
$base = "/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project"
$local = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project"

Write-Host "--- Pushing mcp_server.py ---"
& scp -i $key -o StrictHostKeyChecking=no "$local\mcp_server.py" "${remote}:${base}/mcp_server.py"

Write-Host "--- Pushing server.js ---"
& scp -i $key -o StrictHostKeyChecking=no "$local\frontend\server.js" "${remote}:${base}/frontend/server.js"

Write-Host "--- Verifying PLAYBOOK_CATALOG ---"
& ssh -i $key -o StrictHostKeyChecking=no $remote "grep -c PLAYBOOK_CATALOG ${base}/mcp_server.py"

Write-Host "--- Verifying RULE_BOOST_MAP ---"
& ssh -i $key -o StrictHostKeyChecking=no $remote "grep -c RULE_BOOST_MAP ${base}/frontend/server.js"

Write-Host "--- Checking old routing removed ---"
& ssh -i $key -o StrictHostKeyChecking=no $remote "grep -c 'ALWAYS run: fabric_audit_all' ${base}/frontend/server.js || echo 0"

Write-Host "--- Restarting node ---"
& ssh -i $key -o StrictHostKeyChecking=no $remote "pkill -f 'node server.js'; sleep 2; cd ${base}/frontend && nohup node server.js >> frontend.nohup.log 2>&1 & sleep 3 && ps aux | grep 'node server.js' | grep -v grep"

Write-Host "--- Deploy complete ---"
