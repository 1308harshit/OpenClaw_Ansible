# Task 4.1: Conditional Skip If Interface Down

## What This Playbook Does

This playbook demonstrates conditional logic in Ansible. It checks the status of a specific interface before applying configuration. If the interface is DOWN, the configuration task is skipped. If the interface is UP, the configuration is applied.

**Key Features:**
- Checks interface status before applying configuration
- Skips configuration if interface is down
- Applies configuration only if interface is up
- Demonstrates `when` conditional statements
- Targets leaf switches only

## Condition Being Checked

The playbook checks if the interface (default: Ethernet1) is in a DOWN state by looking for:
- "down" in the interface status
- "notconnect" in the interface status
- "admin down" in the interface status

## When the Task is Skipped

The configuration task is skipped when the interface is DOWN. The playbook will display a "SKIPPED" message for devices where the interface is down.

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/conditional_skip_if_down.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices. Some tasks may show as `skipped`.

Example output (when interface is UP):
```
PLAY [Conditional skip if interface is down] ******************************

TASK [Check interface status] ********************************************
ok: [leaf1]
ok: [leaf2]
...

TASK [Display interface status] ******************************************
ok: [leaf1] => {
    "msg": "Interface Ethernet1 on leaf1 is UP"
}

TASK [Apply configuration (only if interface is UP)] *********************
changed: [leaf1]
changed: [leaf2]
...

PLAY RECAP ******************************************************************
leaf1                      : ok=5    changed=1    unreachable=0    failed=0    skipped=0
```

Example output (when interface is DOWN):
```
TASK [Apply configuration (only if interface is UP)] *********************
skipping: [leaf1] => {"msg": "Conditional check failed, skipping task"}

TASK [Display skip message (if interface is DOWN)] **********************
ok: [leaf1] => {
    "msg": "SKIPPED: Interface Ethernet1 is DOWN on leaf1. Configuration not applied."
}
```

## How to Verify Behavior

### Method 1: Check the Output

Look for:
- `skipping:` messages when interface is DOWN
- `changed:` messages when interface is UP and config is applied

### Method 2: Check Interface Configuration

```bash
ansible leaf1 -m arista.eos.eos_command -a '{"commands": ["show interfaces Ethernet1"]}' | grep -i description
```

If configuration was applied, you should see:
```
Description: "Demo conditional config - Interface is UP"
```

If configuration was skipped, the description may not be present or different.
