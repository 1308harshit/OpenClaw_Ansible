# Task 3.1: Show All Interfaces Playbook

## What This Playbook Shows

This playbook collects interface status information from all devices in the network topology. It shows all interfaces (up, down, and their states) for complete network visibility.

**Key Features:**
- Collects interface status from ALL devices (leafs, spines, routers, hosts)
- Shows all interfaces regardless of state
- Saves output to individual report files per device
- Read-only operation (no configuration changes)
- Includes timestamp in reports

## When to Run

**Run this playbook when:**
- You need to see the status of all interfaces across all devices
- You want to audit interface states in your network
- You need a baseline snapshot of interface status
- You are troubleshooting connectivity issues

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/show_interfaces_all.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices and report files are created.

Example output:
```
PLAY [Show all interfaces from all devices] *********************************

TASK [Get all interfaces information] *************************************
ok: [leaf1]
ok: [leaf2]
...

TASK [Display summary] ****************************************************
ok: [leaf1] => {
    "msg": "Interfaces report saved to .../reports/leaf1_interfaces_all.txt"
}

PLAY RECAP ******************************************************************
leaf1                      : ok=4    changed=0    unreachable=0    failed=0
leaf2                      : ok=4    changed=0    unreachable=0    failed=0
```

## Where Reports Are Stored

**Report Directory:**
`~/NERD_clab_topologies/clos-medium/ansible-project/reports/`

**Report File Naming:**
`{hostname}_interfaces_all.txt`

Example filenames:
- `leaf1_interfaces_all.txt`
- `spine1_interfaces_all.txt`
- `R1_interfaces_all.txt`

## Verify Reports Were Created

```bash
# List all interface reports
ls -lh reports/*_interfaces_all.txt

# View a specific report
cat reports/leaf1_interfaces_all.txt
```

## Report File Format

Each report file contains:
- Device hostname
- Timestamp when the report was generated
- Complete `show interfaces status` output from the device

Example report content:
```
Device: leaf1
Timestamp: Mon Dec 30 03:15:00 UTC 2024

Port       Name     Status       Vlan     Duplex Speed  Type            Flags Encapsulation
Et1                  connected    1        full   1G     EbraTestPhyPort                   
Et2                  connected    1        full   1G     EbraTestPhyPort                   
...
```
