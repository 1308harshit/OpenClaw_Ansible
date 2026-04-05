# Task 5.2: Generate Switch Summary Report

## What This Playbook Does

This playbook generates a high-level summary report for each switch/device in the network. Each summary includes:
- Device hostname
- Total number of interfaces
- Number of interfaces that are UP
- Number of interfaces that are DOWN

**Key Features:**
- Generates per-device summary reports
- Provides high-level operational visibility
- Aggregates interface counts automatically
- Creates organized report structure
- Read-only operation (no configuration changes)

## What the Summary Shows

For each device, the summary report displays:
- **Hostname**: Device identifier
- **Total Interfaces**: Count of all interfaces
- **Interfaces UP**: Count of interfaces in operational state
- **Interfaces DOWN**: Count of interfaces not operational
- **Generated Timestamp**: When the report was created

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/generate_switch_summary.yml
```
## Serve HTML Content
```bash
python3 -m http.server 8000
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices and summary files are created.

Example output:
```
PLAY [Generate switch summary report] *************************************

TASK [Get interface status from device] **********************************
ok: [leaf1]
ok: [leaf2]
...

TASK [Display switch summary] ********************************************
ok: [leaf1] => {
    "msg": "leaf1: Total=12, UP=10, DOWN=2"
}

PLAY RECAP ******************************************************************
leaf1                      : ok=4    changed=0    unreachable=0    failed=0
```

## Where Reports Are Stored

**Summary Reports Directory:**
`~/NERD_clab_topologies/clos-medium/ansible-project/reports/switch_summary/`

**File naming:** `index.html`

## How This Helps Operational Visibility

The summary provides immediate visibility into:
- **Which devices have all interfaces up (healthy)** - Devices with DOWN=0
- **Which devices have down interfaces (need attention)** - Devices with DOWN > 0
- **Total interface capacity per device** - Total count shows device size
- **Network-wide health at a glance** - Compare summaries across devices

Example summary report:
```
Switch Summary Report
====================

Hostname: leaf1
Total Interfaces: 12
Interfaces UP: 10
Interfaces DOWN: 2

Generated: Mon Dec 30 03:35:00 UTC 2024
```

Use these summaries for:
- Daily health checks
- Capacity planning
- Identifying devices needing attention
- Network documentation
- Trend analysis (when run regularly)
