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
```

## What Devices Are Affected

**Devices That ARE Configured (Targets)**
- **leaf1** (172.20.20.11) - User created
- **leaf2** (172.20.20.12) - User created
- **leaf3** (172.20.20.13) - User created
- **leaf4** (172.20.20.14) - User created

**Devices That Are NOT Configured (Visibility Only)**
- spine1, spine2, R1, host1, host2
