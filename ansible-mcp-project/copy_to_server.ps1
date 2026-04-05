$key = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project\ansible-keypair.pem"
$remote = "ansible@100.30.182.96"
$remotePath = "/home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project"
$localBase = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project"

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

Write-Host "Verifying remote playbooks..."
ssh -i $key -o StrictHostKeyChecking=no $remote "ls -la ${remotePath}/playbooks/"
