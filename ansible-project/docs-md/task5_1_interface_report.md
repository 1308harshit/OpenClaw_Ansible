# Task 5.1: Generate Interface Status Report

## What This Playbook Does

This playbook collects interface status information from all devices and generates two types of reports:
1. **Raw interface output** - Complete interface status data per device
2. **Summarized report** - Aggregated counts of interfaces (total, up, down) per device

**Key Features:**
- Collects interface data from ALL devices
- Saves raw interface output per device
- Generates aggregated summary per device
- Creates organized directory structure for reports
- Read-only operation (no configuration changes)

## What Data is Collected

- Interface status from all devices using `show interfaces status`
- Per-device raw interface output (saved to `reports/interfaces_raw/`)
- Aggregated interface counts per device (saved to `reports/interfaces_summary/`)

## How Aggregation Works (High-Level)

1. **Data Collection**: Runs `show interfaces status` on each device
2. **Raw Storage**: Complete interface output is saved per device
3. **Pattern Matching**: Interface lines are filtered using pattern matching:
   - Total interfaces: Lines matching interface name patterns (Et, Ma, Lo)
   - Up interfaces: Lines containing "connected" or "up" (excluding admin down/notconnect)
   - Down interfaces: Lines containing "down", "notconnect", or "disabled"
4. **Counting**: The filtered lists are counted to get totals
5. **Summary Generation**: Counts are saved to summary files

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/generate_interface_report.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices and report files are created.

Example output:
```
PLAY [Generate interface status report from all devices] ******************

TASK [Get interface status from device] **********************************
ok: [leaf1]
ok: [leaf2]
...

TASK [Display summary] ****************************************************
ok: [leaf1] => {
    "msg": "Interface report saved for leaf1 - Total: 12, UP: 10, DOWN: 2"
}

PLAY RECAP ******************************************************************
leaf1                      : ok=5    changed=0    unreachable=0    failed=0
```

## Where Reports Are Stored

**Raw Interface Output:**
`~/NERD_clab_topologies/clos-medium/ansible-project/reports/interfaces_raw/`

**Summarized Reports:**
`~/NERD_clab_topologies/clos-medium/ansible-project/reports/interfaces_summary/`

## Verify Reports Were Created

```bash
# List raw interface reports
ls -lh reports/interfaces_raw/

# List summary reports
ls -lh reports/interfaces_summary/

# View a raw report
cat reports/interfaces_raw/leaf1_interfaces_raw.txt

# View a summary report
cat reports/interfaces_summary/leaf1_summary.txt
```

## How to Interpret the Report

### Raw Interface Report

Contains the complete `show interfaces status` output for detailed analysis.

### Summary Report

Contains aggregated counts:
- **Total Interfaces**: All interfaces found on the device
- **Interfaces UP**: Interfaces in operational/connected state
- **Interfaces DOWN**: Interfaces not operational

Example summary report:
```
Device: leaf1
Timestamp: Mon Dec 30 03:30:00 UTC 2024

Interface Summary:
- Total Interfaces: 12
- Interfaces UP: 10
- Interfaces DOWN: 2
```

Use the summary reports for quick health checks and the raw reports for detailed troubleshooting.
