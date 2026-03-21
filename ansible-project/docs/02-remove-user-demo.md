# Demo Step 2: Remove User Playbook

## Demo Objective

Removes `ansible_demo` user from leaf switches:
- Removes user account from configuration
- Validates removal
- Idempotent (safe to re-run)

## When to Run

Run when you need to remove `ansible_demo` user or test the add-user playbook (Demo Step 2).

## Prerequisites

1. All Docker containers are running and healthy
2. You are logged into the Ansible control node (AlmaLinux 10.1)
3. You are in the project directory: `NERD_clab_topologies/clos-medium/ansible-project`
4. The user `ansible_demo` exists on leaf switches (if testing removal)

## Exact Commands to Run

### Step 1: Navigate to Project Directory

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
```

### Step 2: Run the Remove User Playbook

```bash
ansible-playbook playbooks/remove_user.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices.

Example:
```
PLAY RECAP ******************************************************************
leaf1                      : ok=5    changed=1    unreachable=0    failed=0
leaf2                      : ok=5    changed=1    unreachable=0    failed=0
leaf3                      : ok=5    changed=1    unreachable=0    failed=0
leaf4                      : ok=5    changed=1    unreachable=0    failed=0
```

**Note:** Re-running shows `changed=0` (idempotent - safe to re-run).

## Verify Success

**Check PLAY RECAP:** All devices show `failed=0`

**Verify user removed:**
```bash
docker exec -it leaf1 FastCli -p 15 -c "show running-config | grep ansible_demo"
```

Expected: No output (empty) - user removed.

## What Devices Are Affected

###  Devices That ARE Modified (Targets)

- **leaf1** (172.20.20.11) - User removed
- **leaf2** (172.20.20.12) - User removed
- **leaf3** (172.20.20.13) - User removed
- **leaf4** (172.20.20.14) - User removed

###  Devices That Are NOT Modified (Visibility Only)

- **spine1** (172.20.20.101) - Not in playbook scope
- **spine2** (172.20.20.102) - Not in playbook scope
- **R1** (172.20.20.93) - Not in playbook scope
- **host1** (172.20.20.91) - Not in playbook scope
- **host2** (172.20.20.92) - Not in playbook scope

**Important**: These devices are visible in the inventory for topology demonstration, but this playbook does NOT modify them.

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

## Testing Workflow: Remove → Add Cycle

```bash
# Step 1: Remove user
ansible-playbook playbooks/remove_user.yml

# Step 2: Verify removal (should return nothing)
docker exec -it leaf1 FastCli -p 15 -c "show running-config | grep ansible_demo"

# Step 3: Add user
ansible-playbook playbooks/add_user.yml

# Step 4: Verify creation
docker exec -it leaf1 FastCli -p 15 -c "show running-config | grep ansible_demo"
```

---

**Demo Step 2 Complete**

