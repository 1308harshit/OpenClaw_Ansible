# Task 2.2: Rollback VLANs Playbook

## What Rollback Means

Rollback means removing previously added VLAN configurations to return the network to its previous state. This playbook removes VLAN 100 and VLAN 200 from all leaf switches.

**Key Features:**
- Removes VLAN 100 from leaf switches
- Removes VLAN 200 from leaf switches
- Only targets leaf switches (leaf1, leaf2, leaf3, leaf4)
- Does not fail if VLAN is already absent (idempotent)
- Includes verification tasks to confirm VLANs are removed

## When to Run Rollback

**Run this playbook when:**
- You need to remove VLAN 100 and/or VLAN 200 from leaf switches
- You want to undo changes made by vlan_add.yml
- You need to return the network to a previous state

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/vlan_rollback.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all leaf devices.

Example output:
```
PLAY [Rollback VLANs 100 and 200 from leaf switches] **********************

TASK [Remove VLANs from leaf switches] ***********************************
changed: [leaf1] => (item=100)
changed: [leaf2] => (item=100)
...

PLAY RECAP ******************************************************************
leaf1                      : ok=4    changed=2    unreachable=0    failed=0
leaf2                      : ok=4    changed=2    unreachable=0    failed=0
```

## How to Verify VLAN Removal

### Method 1: Using Verification Playbook (Recommended)

```bash
ansible-playbook playbooks/verify_vlans.yml
```

VLANs 100 and 200 should no longer appear in the output.

### Method 2: SSH to a Leaf Switch

```bash
ssh admin@172.20.20.11
show vlan
exit
```

VLANs 100 and 200 should not be present in the VLAN list.

## Safety Notes

- **Idempotent**: Safe to run multiple times. If VLANs are already removed, the playbook will report them as "not found or already removed" without failing.
- **Target Scope**: Only affects leaf switches. Spine switches, routers, and hosts are not modified.
- **No Data Loss**: This only removes VLAN definitions. Interfaces assigned to these VLANs will need to be reconfigured separately if needed.
