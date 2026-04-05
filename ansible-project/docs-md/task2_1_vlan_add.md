# Task 2.1: Add VLANs Playbook

## What This Playbook Does

This playbook adds VLAN 100 and VLAN 200 to all leaf switches in the network topology. It demonstrates idempotent network configuration management using Ansible.

**Key Features:**
- Adds VLAN 100 (named VLAN_100) to leaf switches
- Adds VLAN 200 (named VLAN_200) to leaf switches
- Only targets leaf switches (leaf1, leaf2, leaf3, leaf4)
- Idempotent: safe to run multiple times
- Includes verification tasks to confirm VLANs exist

## When to Run

**Run this playbook when:**
- You need to add VLAN 100 and/or VLAN 200 to the leaf switches
- You want to demonstrate VLAN configuration automation
- You are preparing for network segmentation

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/vlan_add.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all leaf devices.

Example output:
```
PLAY [Add VLANs 100 and 200 to leaf switches] ******************************

TASK [Add VLANs to leaf switches] *****************************************
changed: [leaf1] => (item={'vlan_id': 100, 'name': 'VLAN_100'})
changed: [leaf2] => (item={'vlan_id': 100, 'name': 'VLAN_100'})
...

PLAY RECAP ******************************************************************
leaf1                      : ok=4    changed=2    unreachable=0    failed=0
leaf2                      : ok=4    changed=2    unreachable=0    failed=0
```

## How to Verify VLANs Exist

### Method 1: Using Verification Playbook (Recommended)

```bash
ansible-playbook playbooks/verify_vlans.yml
```

### Method 2: SSH to a Leaf Switch

```bash
ssh admin@172.20.20.11
show vlan
exit
```

## What Devices Are Affected

**Target Devices (Configuration Applied):**
- leaf1 (172.20.20.11)
- leaf2 (172.20.20.12)
- leaf3 (172.20.20.13)
- leaf4 (172.20.20.14)

**Not Affected (Visibility Only):**
- spine1, spine2 (spine switches)
- R1 (router)
- host1, host2 (host devices)
