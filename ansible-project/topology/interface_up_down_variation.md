# Interface Shutdown Behavior in a Network Fabric

This document explains **why shutting an interface on one switch can affect another switch**, even when the Ansible playbook explicitly targets only a single host.

---

## Scenario Observed

An Ansible playbook was run with the following scope:

hosts: leaf1

interface_name: Ethernet1

### Expectation

Only **leaf1** should be affected.

### Observed Result

| Switch  | Result           | 
|---------|------------------|
| leaf1   | 1 interface DOWN |
| leaf2   | 1 interface DOWN |
| leaf3   | Unaffected       |
| leaf4   | Unaffected       |

---

## Why This Happened (Important)

This is **not an Ansible bug**.  
It is **expected network behavior**.

### Key Point

If an interface is physically or logically connected between two devices, then:

> Shutting the interface on one end will cause the other end of the same link to go **DOWN automatically**.

---

## Example Topology Behavior

leaf1 Ethernet1 <———> leaf2 Ethernet1

### When this command is applied on leaf1:

interface Ethernet1
shutdown

### What happens:

- **leaf1 Ethernet1** → *Administratively DOWN*  
- **leaf2 Ethernet1** → *Link DOWN* (remote side lost carrier)

Even though:
- No configuration was pushed to **leaf2**  
- Ansible never targeted **leaf2**

This is how **real switches behave** in:

- Arista cEOS  
- Physical Arista hardware  
- Cisco / Juniper / any L2/L3 device  

---

## Why Other Leaves Were NOT Affected

- **leaf3** and **leaf4** do not share that physical link.  
- Their interfaces are connected to different ports/devices.  
- Therefore, they remain unaffected.

---

## Important Distinction

| State Type | Meaning |
|-------------|----------|
| **Admin Down (shutdown)** | Configuration applied intentionally |
| **Link Down (remote)** | Physical link lost because other side went down |
| **Operational Up** | Interface is connected and forwarding |

Only **admin down** was configured.  
**Link down** on the peer happened automatically.

---

## Safe Testing Recommendation (Best Practice)

To avoid confusion during demos or reports:

**Use host-facing or unused interfaces**

Example:
interface_name: Ethernet10

**Avoid fabric-facing / uplink interfaces**

Examples:
- Ethernet1  
- Ethernet2 (commonly spine/leaf uplinks)

---

## Variation Summary

### Case 1: Shut Fabric-Connected Interface

hosts: leaf1
interface_name: Ethernet1

**Result:**
- leaf1 → DOWN  
- leaf2 → DOWN *(link impact)*  
- Others → unchanged

---

### Case 2: Shut Host-Facing Interface

hosts: leaf1
interface_name: Ethernet10

**Result:**
- leaf1 → DOWN  
- All other devices → unchanged

---

## Key Takeaway

**Ansible only applies configuration to the targeted host.**  
Any impact on other devices is due to **physical or logical link behavior**, not automation leakage.

Understanding this distinction is critical for:

- Correct troubleshooting  
- Accurate dashboards  
- Professional demos

---