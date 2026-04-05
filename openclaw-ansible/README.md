# OpenClaw Setup - Ansible Automation

This folder contains Ansible playbooks for managing OpenClaw installation on an AlmaLinux 10.1 EC2 server.

## 🎯 What This Is

A self-contained Ansible project for:
- Installing OpenClaw and its dependencies (Node.js 24)
- Updating OpenClaw to the latest version
- Uninstalling OpenClaw cleanly
- Checking server health metrics
- Restarting system services

## ⚠️ Important Notes

- This folder is completely self-contained
- Nothing outside `openclaw-setup/` is affected by these playbooks
- Existing server configurations remain untouched
- Ports 22, 80, 443, 8080, and 8000 are not modified

## 🚀 Getting Started

### Step 1: Configure Variables

Edit `vars.yml` and replace placeholders:

```yaml
ansible_user: ansible
server_ip: 100.30.182.96  # Your actual server IP
whatsapp_phone: +1234567890  # Your WhatsApp number
```

### Step 2: Configure Inventory

Edit `inventory/hosts.ini` and replace the placeholder IP:

```ini
openclaw_server ansible_host=100.30.182.96 ansible_user=ansible
```

### Step 3: Test Connection

```bash
ansible -i inventory/hosts.ini openclaw -m ping
```

## 📋 Playbook Execution Order

### 1. Install OpenClaw (Run First)

```bash
ansible-playbook -i inventory/hosts.ini playbooks/install_openclaw.yml
```

This playbook:
- Checks for Node.js >= 24, installs if needed
- Installs OpenClaw globally via npm
- Displays manual steps you must complete

### 2. Complete Manual Steps (Required After Install)

After the install playbook completes, SSH into the server and run:

```bash
# Step 1: Run onboarding wizard (interactive)
openclaw onboard --install-daemon

# Step 2: Login to WhatsApp (QR code scan)
openclaw channels login

# Step 3: Verify daemon is running
sudo systemctl status openclaw
```

### 3. Update OpenClaw

```bash
ansible-playbook -i inventory/hosts.ini playbooks/update_openclaw.yml
```

Updates OpenClaw to the latest version, runs health checks, and restarts the gateway.

### 4. Check Server Health

```bash
ansible-playbook -i inventory/hosts.ini playbooks/check_health.yml
```

Displays disk usage, memory, CPU load, and OpenClaw status.

### 5. Restart a Service

```bash
ansible-playbook -i inventory/hosts.ini playbooks/restart_service.yml -e "service_name=nginx"
```

Restarts any systemd service with error handling.

### 6. Uninstall OpenClaw

```bash
ansible-playbook -i inventory/hosts.ini playbooks/uninstall_openclaw.yml
```

Removes OpenClaw and its configuration (keeps Node.js and other packages).

## 📁 Project Structure

```
openclaw-setup/
├── vars.yml                      # Configuration variables
├── inventory/
│   └── hosts.ini                 # Server inventory
├── playbooks/
│   ├── install_openclaw.yml      # Install Node.js + OpenClaw
│   ├── update_openclaw.yml       # Update to latest version
│   ├── uninstall_openclaw.yml    # Remove OpenClaw
│   ├── check_health.yml          # System health metrics
│   └── restart_service.yml       # Restart any service
├── soul/
│   └── SOUL.md                   # Assistant behavior guidelines
└── README.md                     # This file
```

## 🔧 Manual Steps After Installation

The install playbook does NOT complete the full setup. You must manually:

1. **Run onboarding wizard** - Configures AI model, provider auth, daemon
   ```bash
   openclaw onboard --install-daemon
   ```

2. **Login to WhatsApp** - Scan QR code with your phone
   ```bash
   openclaw channels login
   ```

3. **Verify daemon** - Ensure service is running
   ```bash
   sudo systemctl status openclaw
   ```

## 🛡️ What's NOT Modified

These playbooks do NOT touch:
- Firewall rules or iptables
- Network configuration
- Port settings (22, 80, 443, 8080, 8000 remain open)
- Existing folders in `/home/ansible/clos-medium/`
- Docker, fail2ban, or other system packages
- User accounts or SSH keys

## 📝 Example Commands

```bash
# Install OpenClaw
ansible-playbook -i inventory/hosts.ini playbooks/install_openclaw.yml

# Update OpenClaw
ansible-playbook -i inventory/hosts.ini playbooks/update_openclaw.yml

# Check health
ansible-playbook -i inventory/hosts.ini playbooks/check_health.yml

# Restart nginx
ansible-playbook -i inventory/hosts.ini playbooks/restart_service.yml -e "service_name=nginx"

# Uninstall OpenClaw
ansible-playbook -i inventory/hosts.ini playbooks/uninstall_openclaw.yml
```

## 🐛 Troubleshooting

### Connection Issues
```bash
# Test connectivity
ansible -i inventory/hosts.ini openclaw -m ping

# Check SSH access
ssh -i /path/to/key ansible@YOUR_SERVER_IP
```

### Playbook Failures
- Verify `vars.yml` has correct values
- Ensure `inventory/hosts.ini` has correct IP
- Check server has internet access for npm installs
- Review playbook output for specific error messages

### OpenClaw Issues
```bash
# Check OpenClaw version
openclaw --version

# Run diagnostics
openclaw doctor

# Check daemon status
sudo systemctl status openclaw

# View logs
journalctl -u openclaw -n 50
```

## 📞 Support

For OpenClaw-specific issues, refer to the official documentation or run:
```bash
openclaw doctor --fix
```

---

**Version:** 1.0.0  
**Target OS:** AlmaLinux 10.1 (RHEL-based)  
**Package Manager:** dnf  
**Node.js Version:** 24.x
