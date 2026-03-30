# Task 3.2: Show Down Interfaces Playbook

## What This Playbook Shows

This playbook filters and shows only interfaces that are in a DOWN state from all devices. It helps identify connectivity issues and interfaces that need attention.

**Key Features:**
- Filters interface output to show only down interfaces
- Targets ALL devices for visibility
- Creates report files for all devices
- Summary output only shows devices with actual down interfaces
- Read-only operation (no configuration changes)

## Filtering Logic

The playbook filters interface output to show only lines containing "down" (case-insensitive). This includes:
- Interfaces that are physically down
- Interfaces that are administratively down
- Interfaces with link-down status

**Note:**
- Report files are created for ALL devices (even if no down interfaces are found)
- The summary output only displays devices that actually have down interfaces
- Devices with no down interfaces create reports but are not shown in the summary

## When to Run

**Run this playbook when:**
- You need to identify interfaces that are down
- You want to troubleshoot connectivity issues
- You need to audit which devices have problematic interfaces
- You are performing network health checks

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/show_interfaces_down.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices.

Example output (when some devices have down interfaces):
```
PLAY [Show only down interfaces from all devices] *************************

TASK [Filter down interfaces] *********************************************
ok: [leaf1]
ok: [leaf2]
...

TASK [Display summary] ****************************************************
ok: [leaf3] => {
    "msg": "Down interfaces report saved to .../reports/leaf3_interfaces_down.txt (2 down interfaces found)"
}

PLAY RECAP ******************************************************************
leaf1                      : ok=4    changed=0    unreachable=0    failed=0
```

**Note:** Only devices with down interfaces will show summary messages. Devices with no down interfaces will still create report files but won't display summary output.

## Verify Reports Were Created

```bash
# List all down interface reports
ls -lh reports/*_interfaces_down.txt

# View a specific report
cat reports/leaf1_interfaces_down.txt
```

## How to Interpret Empty Results

If a device shows "No down interfaces found on this device" in its report file, it means all interfaces on that device are in an UP/connected state. This is a good sign indicating healthy connectivity.

## Report File Format

Each report file contains:
- Device hostname
- Timestamp when the report was generated
- List of down interfaces (if any)
- Message indicating no down interfaces if none are found

Example report content (with down interfaces):
```
Device: leaf3
Timestamp: Mon Dec 30 03:20:00 UTC 2024

Down Interfaces:
Et5        admin down  1        full   1G     EbraTestPhyPort                   
Et6        notconnect  1        full   1G     EbraTestPhyPort                   
```

Example report content (no down interfaces):
```
Device: leaf1
Timestamp: Mon Dec 30 03:20:00 UTC 2024

Down Interfaces:
No down interfaces found on this device.
```
