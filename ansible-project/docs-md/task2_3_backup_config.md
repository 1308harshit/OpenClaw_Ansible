# Task 2.3: Backup Configuration Playbook

## What This Playbook Does

This playbook creates backup copies of the running configuration from all leaf switches. Backups are stored in the `backups/` directory with timestamped filenames for easy identification and version tracking.

**Key Features:**
- Backs up running configuration from all leaf switches
- Creates timestamped backup files
- Stores backups in `backups/` directory
- One backup file per device
- Clear, readable filenames

## When to Run

**Run BEFORE making configuration changes:**
```bash
ansible-playbook playbooks/backup_config.yml
```

**Run AFTER making configuration changes:**
```bash
ansible-playbook playbooks/backup_config.yml
```

## Recommended Workflow Steps

Follow these steps when making network configuration changes:

### Step 1: Initial Backup (Before Changes)
**Purpose:** Save the current working configuration state before making any changes.

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/backup_config.yml
```

**Verify backup was created:**
```bash
ls -lh backups/
```

**Expected:** You should see 4 backup files (one per leaf switch) with timestamps.

### Step 2: Make Configuration Changes
**Purpose:** Apply the desired network configuration changes.

```bash
ansible-playbook playbooks/vlan_add.yml
```

**Verify changes were applied:**
```bash
ansible-playbook playbooks/verify_vlans.yml
```

Or check manually:
```bash
# SSH to a device and verify
ssh admin@172.20.20.11
show vlan
# You should see VLAN 100 and VLAN 200
exit
```

### Step 3: Post-Change Backup (After Changes)
**Purpose:** Save the new configuration state after successful changes.

```bash
ansible-playbook playbooks/backup_config.yml
```

**Verify new backup was created:**
```bash
ls -lt backups/ | head -5
```

**Expected:** You should now see 8 backup files total (4 from Step 1, 4 from Step 3). The newest files have later timestamps.

### Step 4: Decision Point - Keep or Rollback?

**Option A: Keep the Changes**
- If everything is working correctly, you're done!
- The post-change backup (Step 3) serves as your new baseline.

**Option B: Rollback the Changes**
- If something went wrong or you need to revert:

```bash
# Rollback the VLAN changes
ansible-playbook playbooks/vlan_rollback.yml
```

**Verify rollback:**
```bash
ansible-playbook playbooks/verify_vlans.yml
# VLANs 100 and 200 should no longer appear
```

### Quick Reference: Complete Workflow

**For Adding VLANs:**
```bash
# 1. Backup before
ansible-playbook playbooks/backup_config.yml

# 2. Add VLANs
ansible-playbook playbooks/vlan_add.yml

# 3. Backup after
ansible-playbook playbooks/backup_config.yml

# 4. Verify
ansible-playbook playbooks/verify_vlans.yml
```

**For Rolling Back:**
```bash
# 1. Rollback VLANs
ansible-playbook playbooks/vlan_rollback.yml

# 2. Backup rolled-back state
ansible-playbook playbooks/backup_config.yml

# 3. Verify rollback
ansible-playbook playbooks/verify_vlans.yml
```

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/backup_config.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices.

Example output:
```
PLAY [Backup running configuration from leaf switches] ********************

TASK [Save running configuration to backup file] *************************
changed: [leaf1]
changed: [leaf2]
...

PLAY RECAP ******************************************************************
leaf1                      : ok=5    changed=1    unreachable=0    failed=0
leaf2                      : ok=5    changed=1    unreachable=0    failed=0
```

## Where Backups Are Stored

**Backup Directory:**
`~/NERD_clab_topologies/clos-medium/ansible-project/backups/`

**Backup File Naming:**
`{hostname}_config_backup_{timestamp}.txt`

Example filenames:
- `leaf1_config_backup_1767029130.txt`
- `leaf2_config_backup_1767029130.txt`

## How to Confirm Backups Exist

```bash
# List all backup files
ls -lh backups/

# List backups sorted by time (newest first)
ls -lt backups/ | head -10

# View a specific backup file
cat backups/leaf1_config_backup_1767029130.txt
```
