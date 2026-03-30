# Ansible `hosts:` Variations Reference

This document explains the different ways the `hosts:` field can be used in Ansible playbooks and clearly shows **which devices will be targeted** based on the current inventory structure.

---

## Inventory Summary (Context)

The inventory defines the following main groups:

- **leafs** → leaf1, leaf2, leaf3, leaf4  
- **spines** → spine1, spine2  
- **routers** → R1  
- **hosts** → host1, host2  
- **fabric** → leafs + spines  
- **all_devices** → leafs + spines + routers + hosts  

---

## `hosts:` Variations and Their Scope

### 1. Apply to all devices
```
hosts: all
```
**Targets:**

- leaf1, leaf2, leaf3, leaf4  
- spine1, spine2  
- R1  
- host1, host2  

**Use case:**  
Connectivity checks, inventory validation.  

---

### 2. Apply only to leaf switches
```
hosts: leafs
```
**Targets:**

- leaf1  
- leaf2  
- leaf3  
- leaf4  

**Use case:**  
Configuration changes (VLANs, interface config, etc.)

---

### 3. Apply only to spine switches
```
hosts: spines
```
**Targets:**

- spine1  
- spine2  

**Use case:**  
Visibility or read-only operations.

---

### 4. Apply to the entire fabric (leafs + spines)
```
hosts: fabric
```
**Targets:**

- leaf1, leaf2, leaf3, leaf4  
- spine1, spine2  

**Meaning:**  
Any task in this playbook will be executed on both leaf and spine switches.

**Use case:**

- Interface status checks  
- Backups  
- Health and visibility reporting  

---

### 5. Apply only to routers
```
hosts: routers
```
**Targets:**

- R1  

**Use case:**  
Router-specific visibility or checks.

---

### 6. Apply only to host devices
```
hosts: hosts
```
**Targets:**

- host1  
- host2  

**Use case:**  
Host or endpoint visibility.  

---

### 7. Apply to all network and host devices
```
hosts: all_devices
```
**Targets:**

- leafs  
- spines  
- routers  
- hosts  

**Use case:**  
Generic checks only.  

---

### 8. Exclude a group
```
hosts: all:!hosts
```
**Targets:**

- leafs  
- spines  
- routers  

**Use case:**  
Run tasks on all devices **except** host containers.

---

### 9. Target a single device
```
hosts: leaf1
```
**Targets:**

- leaf1 only  

**Use case:**  
Testing or debugging.

---

## Recommended Usage Pattern (Best Practice)

**Configuration changes:**
```
hosts: leafs
```

**Fabric-wide visibility or reporting:**
```
hosts: fabric
```

**Never use for EOS modules:**
```
hosts: all_devices
```

---

## Key Takeaway

The value used in `hosts:` directly controls which inventory groups receive the task execution.  
For example, using `hosts: fabric` applies the playbook to all leaf and spine switches only.
```
