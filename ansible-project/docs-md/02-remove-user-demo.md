# Demo Step 2: Remove User Playbook

## Demo Objective

Removes the `ansible_demo` user from leaf switches to clean up after demo.

## When to Run

**Run when:**
- You need to remove the demo user
- You want to clean up after testing

## Exact Command to Run

```bash
cd ~/NERD_clab_topologies/clos-medium/ansible-project
ansible-playbook playbooks/remove_user.yml
```

## Expected Output

**Success criteria:** PLAY RECAP shows `failed=0` for all devices.

Example output:
```
PLAY [Remove ansible_demo user from leaf switches] ************************

TASK [Remove user] *********************************************************
changed: [leaf1]
changed: [leaf2]
...

PLAY RECAP ******************************************************************
leaf1                      : ok=4    changed=1    unreachable=0    failed=0
leaf2                      : ok=4    changed=1    unreachable=0    failed=0
```

## What Devices Are Affected

**Devices That ARE Configured (Targets)**
- leaf1, leaf2, leaf3, leaf4 - User removed

**Devices That Are NOT Configured (Visibility Only)**
- spine1, spine2, R1, host1, host2
