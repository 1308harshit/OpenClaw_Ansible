# Ansible Network Automation Demo Project

## Environment Overview

### Control Node
- **OS**: AlmaLinux 10.1
- **Role**: Ansible control node (where automation runs)
- **Location**: Remote server at 100.30.182.96

### Network Devices
All network devices run as **Docker containers** using Arista cEOS (Containerized EOS):
- **Image**: ceos:4.34.0F
- **Management Network**: 172.20.20.0/24
- **Connection Method**: HTTP API (eAPI) over HTTPS

### Topology: clos-medium
A Clos (leaf-spine) network topology with:
- **4 Leaf Switches** (leaf1-leaf4) - **CONFIGURATION TARGETS**
- **2 Spine Switches** (spine1-spine2) - Visibility only
- **1 Router** (R1) - Visibility only
- **2 Hosts** (host1, host2) - Visibility only

### Why Multiple Devices?
- **Leaf switches**: Receive configuration changes (demo targets)
- **Other devices**: Shown for complete topology visibility but NOT configured
- This demonstrates selective automation - configuring only what's needed

## Project Structure

```
ansible-project/
├── ansible.cfg              # Ansible configuration
├── inventory/
│   └── inventory.yml        # Device inventory with grouping
├── playbooks/
│   └── add_user.yml         # Demo Step 1: Add user playbook
├── group_vars/              # Group-specific variables (future use)
├── docs/
│   └── 01-add-user-demo.md  # Step-by-step demo documentation
└── README.md                # This file
```

### Directory Purposes

#### `inventory/`
Contains device inventory files that define:
- All network devices and their IP addresses
- Device grouping (leafs, spines, routers, hosts)
- Connection parameters (credentials, API settings)
- Which devices are configuration targets vs visibility only

#### `playbooks/`
Contains Ansible playbooks that automate network tasks:
- Each playbook targets specific device groups
- Playbooks are idempotent (safe to re-run)
- Follow naming convention: `descriptive-name.yml`

#### `group_vars/`
Contains variable files for device groups (future use):
- Common variables for leaf switches
- Common variables for spine switches
- Reduces repetition in playbooks

#### `docs/`
Contains step-by-step documentation:
- Demo instructions
- Expected outputs
- Troubleshooting guides
- Follows naming: `##-task-name.md` (numbered for sequence)

## Quick Start

1. Navigate to project directory:
   ```bash
   cd ~/NERD_clab_topologies/clos-medium/ansible-project
   ```

2. Verify inventory:
   ```bash
   ansible-inventory --list
   ```

3. Run Demo Step 1:
   ```bash
   ansible-playbook playbooks/add_user.yml
   ```

4. See detailed instructions:
   ```bash
   cat docs/01-add-user-demo.md
   ```

## Device Inventory

### Leaf Switches (Configuration Targets)
- leaf1: 172.20.20.11
- leaf2: 172.20.20.12
- leaf3: 172.20.20.13
- leaf4: 172.20.20.14

### Spine Switches (Visibility Only)
- spine1: 172.20.20.101
- spine2: 172.20.20.102

### Router (Visibility Only)
- R1: 172.20.20.93

### Hosts (Visibility Only)
- host1: 172.20.20.91
- host2: 172.20.20.92

## Connection Details

- **Protocol**: HTTP API (eAPI)
- **Port**: 443 (HTTPS)
- **Default User**: admin
- **Default Password**: admin
- **SSL Validation**: Disabled (lab environment)

## Demo Sequence

1. **Step 1**: Add User Playbook (this validates Ansible access)
2. **Step 2+**: Future automation tasks (VLANs, interfaces, etc.)

Each step has detailed documentation in the `docs/` directory.

## Important Notes

- **Only leaf switches receive configuration changes**
- **Other devices are for topology visibility only**
- **All playbooks are idempotent** (safe to re-run)
- **Always verify PLAY RECAP shows `failed=0`** before proceeding

