## Add a new instance (executor or EC2 node)

This project supports multiple executors behind one controller (EC2). Adding nodes should not require redesign: you just add a new executor target and its transport mapping.

### Add a new laptop executor (WSL Ubuntu)

#### 1) Join tailnet
- Install Tailscale on Windows
- Log in to the same tailnet as EC2
- Confirm you have a Tailscale IP in the admin panel

#### 2) Enable private SSH access (no inbound ports)
Preferred: Tailscale SSH.

On the laptop, enable Tailscale SSH and ensure your tailnet ACL allows EC2 to SSH to it.

Verify from EC2:

```bash
tailscale ssh <windows_user>@<laptop_tailnet_ip> -- whoami
```

#### 3) Prepare WSL Ubuntu executor
Inside WSL Ubuntu:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip ansible
```

Configure passwordless sudo (required; do not store passwords in inventory):

```bash
sudo visudo
```

Add:

```bash
<your_wsl_user> ALL=(ALL) NOPASSWD:ALL
```

#### 4) Copy executor project into WSL
We keep a separate executor copy in this repo:
- Windows path: `clos-medium/local-server/ansible-mcp-project/`
- WSL destination (default expected): `~/local-server/ansible-mcp-project/`

One simple approach (run in WSL) is to copy from the mounted Windows drive:

```bash
mkdir -p ~/local-server
cp -a /mnt/d/Freelancing/08-01-2025/clos-medium/local-server/ansible-mcp-project ~/local-server/
```

Install Python deps for the WSL MCP server:

```bash
cd ~/local-server/ansible-mcp-project
python3 -m pip install -r requirements.txt
```

#### 5) Configure EC2 to target this executor
On EC2, set:

- `EXECUTOR_TARGET=laptop-wsl`
- `LAPTOP_SSH_TARGET=<windows_user>@<laptop_tailnet_ip>`

Optional:
- `LAPTOP_WSL_PROJECT_ROOT=~/local-server/ansible-mcp-project`

#### 6) Verification commands (from EC2)
Using the UI dropdown:
- Select `laptop-wsl`
- Send: “Install PostgreSQL”

Using the CLI (`ec2_remote_client.py`):

```bash
python3 ec2_remote_client.py --executor laptop-wsl list-tools
python3 ec2_remote_client.py --executor laptop-wsl list-playbooks
python3 ec2_remote_client.py --executor laptop-wsl install-postgres-wsl
python3 ec2_remote_client.py --executor laptop-wsl status postgresql
python3 ec2_remote_client.py --executor laptop-wsl uninstall-postgres-wsl
python3 ec2_remote_client.py --executor laptop-wsl status postgresql
```

### Add a new EC2 node (controller peer or worker executor)

#### 1) Join tailnet
- Install Tailscale on the instance
- Log in to the same tailnet

#### 2) Decide role
- Controller peer (future): would run the same `frontend/server.js` stack
- Worker executor (future): must expose the same MCP stdio contract as other executors

#### 3) Verification
- Ensure EC2 can `tailscale ping` the new node
- Ensure `tailscale ssh` works per your ACLs
- Add a new executor target mapping (future) without changing MCP tool protocol


