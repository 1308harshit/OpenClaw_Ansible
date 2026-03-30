# Task 4.2: Conditional Hostname Match

## What This Playbook Does

This playbook demonstrates conditional logic based on hostname patterns. It applies configuration only to devices whose hostname matches a specific pattern (default: `leaf*`).

**Key Features:**
- Checks hostname against a pattern before applying configuration
- Applies configuration only to matching devices
- Skips configuration for non-matching devices
- Demonstrates pattern matching with `match` test
- Targets all devices but only configures matching ones

## Hostname Matching Logic

- **Default pattern:** `leaf*` (matches leaf1, leaf2, leaf3, leaf4)
- **Pattern syntax:** Uses Ansible's `match` test with wildcard support
- **Case sensitive:** Pattern matching is case-sensitive

## Which Devices Are Affected

**With default pattern `leaf*`:**
- **Matched (configuration applied):** leaf1, leaf2, leaf3, leaf4
- **Not matched (skipped):** spine1, spine2, R1, host1, host2

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/conditional_hostname_match.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices. Some tasks will show as `skipped` for non-matching devices.

Example output:
```
PLAY [Apply configuration only if hostname matches pattern] **************

TASK [Check if hostname matches pattern] *********************************
ok: [leaf1]
ok: [spine1]
...

TASK [Display hostname check result] ************************************
ok: [leaf1] => {
    "msg": "Hostname leaf1 MATCHES pattern 'leaf*'"
}
ok: [spine1] => {
    "msg": "Hostname spine1 DOES NOT MATCH pattern 'leaf*'"
}

TASK [Apply configuration (only if hostname matches)] *******************
changed: [leaf1]
changed: [leaf2]
skipping: [spine1]
skipping: [spine2]
...

PLAY RECAP ******************************************************************
leaf1                      : ok=5    changed=1    unreachable=0    failed=0    skipped=0
spine1                     : ok=4    changed=0    unreachable=0    failed=0    skipped=1
```

## How to Verify Behavior

### Method 1: Check the Output

Look for:
- `MATCHES` or `DOES NOT MATCH` messages in the hostname check
- `skipping:` messages for non-matching devices
- `changed:` messages for matching devices

### Method 2: Verify using SSH (Direct device access)

SSH directly to the device to verify the configuration:

**For matching devices (leaf switches):**
```bash
ssh admin@172.20.20.11 "show interfaces status"
```

Look for the description in the "Name" column. You should see:
```
Port       Name                                        Status       Vlan     Duplex Speed  Type            Flags Encapsulation
Et1        "Demo conditional config - Hostname matches pattern" connected    1        full   1G     EbraTestPhyPort                   
Et2                                                    connected    1        full   1G     EbraTestPhyPort                   
...
```

**For non-matching devices (spine switches, etc.):**
```bash
ssh admin@172.20.20.101 "show interfaces status"
```

The interface name should NOT contain "Demo conditional config" because the configuration was skipped.
