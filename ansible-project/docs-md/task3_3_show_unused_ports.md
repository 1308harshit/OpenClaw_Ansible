# Task 3.3: Show Unused Ports Playbook

## What This Playbook Shows

This playbook identifies and reports unused ports from all devices. It helps identify available capacity and ports that can be used for new connections.

**Key Features:**
- Identifies unused ports across all devices
- Filters for administratively down, not connected, or disabled ports
- Creates report files per device
- Read-only operation (no configuration changes)

## What is Considered "Unused" in This Demo

This demo considers a port as "unused" if it matches any of these conditions:
- **Administratively down** - Port is manually shut down
- **Not connected** - Port has no physical connection
- **Disabled** - Port is disabled in configuration

The playbook uses pattern matching on the interface status output to identify these conditions.

## When to Run

**Run this playbook when:**
- You need to identify available ports for new connections
- You want to audit unused capacity in your network
- You are planning network expansion
- You need to identify ports that can be repurposed

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/show_unused_ports.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices and report files are created.

Example output:
```
PLAY [Show unused ports from all devices] **********************************

TASK [Filter unused ports] ***********************************************
ok: [leaf1]
ok: [leaf2]
...

TASK [Display summary] ****************************************************
ok: [leaf1] => {
    "msg": "Unused ports report saved to .../reports/leaf1_unused_ports.txt (5 unused ports found)"
}

PLAY RECAP ******************************************************************
leaf1                      : ok=4    changed=0    unreachable=0    failed=0
```

## Verify Reports Were Created

```bash
# List all unused ports reports
ls -lh reports/*_unused_ports.txt

# View a specific report
cat reports/leaf1_unused_ports.txt
```

## Limitations of This Demo Logic

This demo uses simple pattern matching to identify unused ports. Limitations include:
- **Pattern Matching Only** - Uses text matching on interface status output, not deep configuration analysis
- **No Historical Data** - Doesn't track how long a port has been unused
- **Static Snapshot** - Shows current state only, not trends over time
- **No Context** - Doesn't consider why a port is unused (planned, temporary, etc.)

For production use, you would want more sophisticated logic that considers:
- Historical usage patterns
- Configuration intent
- Business context
- Port reservation policies

## Report File Format

Each report file contains:
- Device hostname
- Timestamp when the report was generated
- List of unused ports (if any)
- Note explaining what is considered "unused"

Example report content:
```
Device: leaf1
Timestamp: Mon Dec 30 03:25:00 UTC 2024

Unused Ports (admin down, not connected, or disabled):
Et5        admin down  1        full   1G     EbraTestPhyPort                   
Et6        notconnect  1        full   1G     EbraTestPhyPort                   
Et7        notconnect  1        full   1G     EbraTestPhyPort                   

Note: This demo considers ports as "unused" if they are:
- Administratively down
- Not connected
- Disabled
```
