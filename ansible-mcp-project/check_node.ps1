$key = "C:\Pratik\Freelancing\Harshit_ansible\ansible-mcp-project\ansible-keypair.pem"
$remote = "ansible@34.197.12.47"

ssh -i $key -o StrictHostKeyChecking=no $remote "ps aux | grep 'node server.js' | grep -v grep"
