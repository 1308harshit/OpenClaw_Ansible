$key = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project\ansible-keypair.pem"
$remote = "ansible@34.197.12.47"
$remotePath = "/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project"

Write-Host "Killing existing node server..."
ssh -i $key -o StrictHostKeyChecking=no $remote "pkill -f 'node server.js'; sleep 1"

Write-Host "Starting node server..."
ssh -i $key -o StrictHostKeyChecking=no $remote "cd ${remotePath}/frontend && nohup node server.js >> frontend.nohup.log 2>&1 </dev/null &"

Start-Sleep -Seconds 3

Write-Host "Checking process..."
ssh -i $key -o StrictHostKeyChecking=no $remote "ps aux | grep 'node server' | grep -v grep || echo 'NOT RUNNING'"
Write-Host "Done."
