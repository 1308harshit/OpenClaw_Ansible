$key = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project\ansible-keypair.pem"
$remote = "ansible@34.197.12.47"
$remotePath = "/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project"
$localBase = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project"

# Upload the restart script
Write-Host "Uploading restart script..."
scp -i $key -o StrictHostKeyChecking=no "$localBase\remote_restart.sh" "${remote}:/tmp/remote_restart.sh"

# Execute it
Write-Host "Executing restart..."
ssh -i $key -o StrictHostKeyChecking=no $remote "bash /tmp/remote_restart.sh"
Write-Host "Done."
