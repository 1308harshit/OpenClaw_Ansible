$key = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project\ansible-keypair.pem"
$remote = "ansible@34.197.12.47"
$remotePath = "/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project"
$localBase = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project"

# Push the updated MCP server and env config
Write-Host "Copying mcp_server.py ..."
scp -i $key -o StrictHostKeyChecking=no "$localBase\mcp_server.py" "${remote}:${remotePath}/mcp_server.py"

Write-Host "Copying frontend/server.js ..."
scp -i $key -o StrictHostKeyChecking=no "$localBase\frontend\server.js" "${remote}:${remotePath}/frontend/server.js"

Write-Host "Copying frontend/public/app.js ..."
scp -i $key -o StrictHostKeyChecking=no "$localBase\frontend\public\app.js" "${remote}:${remotePath}/frontend/public/app.js"

Write-Host "Copying .env ..."
scp -i $key -o StrictHostKeyChecking=no "$localBase\.env" "${remote}:${remotePath}/.env"

$playbooks = @(
    "show_interfaces_all.yml",
    "show_unused_ports.yml",
    "check_vlan_consistency.yml",
    "harden_fabric_simple.yml",
    "generate_fabric_compliance_report.yml",
    "fabric_audit_all.yml"
)

foreach ($pb in $playbooks) {
    Write-Host "Copying $pb ..."
    scp -i $key -o StrictHostKeyChecking=no "$localBase\playbooks\$pb" "${remote}:${remotePath}/playbooks/$pb"
}

Write-Host "Restarting MCP server..."
ssh -i $key -o StrictHostKeyChecking=no $remote "sudo systemctl restart ansible-mcp-startup && sleep 2 && sudo systemctl status ansible-mcp-startup --no-pager"

Write-Host "Verifying remote playbooks..."
ssh -i $key -o StrictHostKeyChecking=no $remote "ls -la ${remotePath}/playbooks/"
