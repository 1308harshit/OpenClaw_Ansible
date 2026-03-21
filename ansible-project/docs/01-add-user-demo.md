# Demo Step 1: Add User Playbook

## Demo Objective

First validation step of Ansible network automation:
- Proves Ansible can connect to network devices
- Creates `ansible_demo` user on leaf switches
- Validates connectivity and access

## When to Run

**Run FIRST** before any other automation tasks (Demo Step 1).

## Prerequisites

1. All Docker containers are running and healthy
2. You are logged into the Ansible control node (AlmaLinux 10.1)
3. You are in the project directory: `NERD_clab_topologies/clos-medium/ansible-project`

## Exact Commands to Run

### Step 1: Navigate to Project Directory

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
```

### Step 2: Verify Inventory

```bash
ansible-inventory --list
```

Expected output: You should see all devices grouped under `leafs`, `spines`, `routers`, and `hosts`.

### Step 3: Run the Add User Playbook

```bash
ansible-playbook playbooks/add_user.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices.

Example:
```
PLAY RECAP ******************************************************************
leaf1                      : ok=6    changed=1    unreachable=0    failed=0
leaf2                      : ok=6    changed=1    unreachable=0    failed=0
leaf3                      : ok=6    changed=1    unreachable=0    failed=0
leaf4                      : ok=6    changed=1    unreachable=0    failed=0
```

**Note:** Re-running shows `changed=0` (idempotent - safe to re-run).

## Verify Success

**Check PLAY RECAP:** All devices show `failed=0`

**Verify user exists:**
```bash
docker exec -it leaf1 FastCli -p 15 -c "show running-config | grep ansible_demo"
```

Expected: `username ansible_demo privilege 15 role network-admin secret sha512 $6$...`

## What Devices Are Affected

###  Devices That ARE Configured (Targets)

- **leaf1** (172.20.20.11) - User created
- **leaf2** (172.20.20.12) - User created
- **leaf3** (172.20.20.13) - User created
- **leaf4** (172.20.20.14) - User created

###  Devices That Are NOT Configured (Visibility Only)

- **spine1** (172.20.20.101) - Not in playbook scope
- **spine2** (172.20.20.102) - Not in playbook scope
- **R1** (172.20.20.93) - Not in playbook scope
- **host1** (172.20.20.91) - Not in playbook scope
- **host2** (172.20.20.92) - Not in playbook scope

**Important**: These devices are visible in the inventory for topology demonstration, but this playbook does NOT configure them.

## Troubleshooting

**Connection Error (UNREACHABLE):**
- Verify container: `docker ps | grep leaf1`
- Test connectivity: `ping 172.20.20.11`

**Authentication Failed:**
- Check credentials in `inventory/inventory.yml` (admin/admin)
- Test login: `docker exec -it leaf1 FastCli -p 15`

**Module Not Found:**
```bash
ansible-galaxy collection install arista.eos
```

## User Details

- **Username:** `ansible_demo`
- **Password:** `ansible_demo`
- **Privilege:** 15 (admin)
- **Role:** `network-admin`

---

**Demo Step 1 Complete** 

