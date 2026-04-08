# Architecture Diagram: Intelligent Playbook Orchestration

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USER                                      │
│                                                                      │
│  "I want to audit the network and check for unused ports"           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Optional)                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  • Text input for natural language                          │    │
│  │  • Dry run checkbox                                         │    │
│  │  • Execute button                                           │    │
│  │  • Results display                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  POST /api/intelligent-orchestration                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP CLIENT                                      │
│                                                                      │
│  Sends MCP protocol request:                                        │
│  {                                                                   │
│    "method": "tools/call",                                          │
│    "params": {                                                      │
│      "name": "intelligent_playbook_orchestration",                  │
│      "arguments": {                                                 │
│        "user_request": "...",                                       │
│        "dry_run": true                                              │
│      }                                                              │
│    }                                                                │
│  }                                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MCP SERVER (mcp_server.py)                        │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  handle_tools_call()                                          │ │
│  │         │                                                      │ │
│  │         ▼                                                      │ │
│  │  tool_intelligent_playbook_orchestration()                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                             │                                        │
│                             ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STEP 1: Get Available Playbooks                              │ │
│  │  ─────────────────────────────────────────────────────────    │ │
│  │  • Call tool_list_playbooks_with_summary()                    │ │
│  │  • Get playbook names, hosts, modules                         │ │
│  │  • Build playbook catalog                                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                             │                                        │
│                             ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STEP 2: Build LLM Prompt                                     │ │
│  │  ─────────────────────────────────────────────────────────    │ │
│  │  • Include available playbooks                                │ │
│  │  • Include user request                                       │ │
│  │  • Add selection rules                                        │ │
│  │  • Request JSON response format                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                             │                                        │
│                             ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STEP 3: Call LLM API                                         │ │
│  │  ─────────────────────────────────────────────────────────    │ │
│  │  • Send prompt to LLM_API_BASE                                │ │
│  │  • Use LLM_API_KEY for auth                                   │ │
│  │  • Wait for response (1-3 seconds)                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LLM API (OpenAI/Azure/Local)                      │
│                                                                      │
│  Analyzes:                                                          │
│  • User intent                                                      │
│  • Available playbooks                                              │
│  • Dependencies                                                     │
│  • Optimal order                                                    │
│                                                                      │
│  Returns:                                                           │
│  {                                                                   │
│    "reasoning": "...",                                              │
│    "playbooks": ["fabric_audit_all.yml", "show_unused_ports.yml"], │
│    "execution_order_rationale": "..."                               │
│  }                                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MCP SERVER (continued)                            │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STEP 4: Parse LLM Response                                   │ │
│  │  ─────────────────────────────────────────────────────────    │ │
│  │  • Extract JSON from response                                 │ │
│  │  • Validate playbook names exist                              │ │
│  │  • Extract reasoning and rationale                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                             │                                        │
│                             ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STEP 5: Execute or Return Plan                               │ │
│  │  ─────────────────────────────────────────────────────────    │ │
│  │  IF dry_run == true:                                          │ │
│  │    • Return execution plan only                               │ │
│  │  ELSE:                                                         │ │
│  │    • Call tool_run_playbooks()                                │ │
│  │    • Execute playbooks sequentially                           │ │
│  │    • Collect results                                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                             │                                        │
│                             ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  STEP 6: Return Response                                      │ │
│  │  ─────────────────────────────────────────────────────────    │ │
│  │  {                                                             │ │
│  │    "ok": true,                                                │ │
│  │    "execution_plan": {...},                                   │ │
│  │    "execution_results": {...}                                 │ │
│  │  }                                                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ANSIBLE EXECUTION                                 │
│                                                                      │
│  For each playbook:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ansible-playbook playbooks/fabric_audit_all.yml            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ansible-playbook playbooks/show_unused_ports.yml           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Results collected and returned                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         USER SEES                                    │
│                                                                      │
│  ✅ Execution Plan:                                                 │
│     • Selected playbooks with reasoning                             │
│     • Execution order rationale                                     │
│                                                                      │
│  ✅ Execution Results:                                              │
│     • Per-playbook status                                           │
│     • Success/failure indicators                                    │
│     • Detailed output                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│          │         │          │         │          │         │          │
│  User    │────────▶│ Frontend │────────▶│   MCP    │────────▶│   LLM    │
│          │         │          │         │  Server  │         │   API    │
│          │         │          │         │          │         │          │
└──────────┘         └──────────┘         └──────────┘         └──────────┘
     ▲                    ▲                     │                     │
     │                    │                     │                     │
     │                    │                     ▼                     │
     │                    │              ┌──────────┐                 │
     │                    │              │          │                 │
     │                    └──────────────│ Playbook │◀────────────────┘
     │                                   │ Executor │
     │                                   │          │
     │                                   └──────────┘
     │                                        │
     │                                        ▼
     │                                   ┌──────────┐
     │                                   │          │
     └───────────────────────────────────│ Ansible  │
                                         │          │
                                         └──────────┘
```

## Data Flow

```
1. User Input
   ↓
   "Audit the network and check for unused ports"

2. Playbook Catalog
   ↓
   [
     {name: "fabric_audit_all.yml", hosts: ["all"], modules: ["ios_command"]},
     {name: "show_unused_ports.yml", hosts: ["all"], modules: ["ios_command"]},
     ...
   ]

3. LLM Prompt
   ↓
   "Available Playbooks:
    - fabric_audit_all.yml: Targets all, uses ios_command
    - show_unused_ports.yml: Targets all, uses ios_command
    ...
    
    User Request: 'Audit the network and check for unused ports'
    
    Select appropriate playbooks and order..."

4. LLM Response
   ↓
   {
     "reasoning": "User wants audit + unused port detection",
     "playbooks": ["fabric_audit_all.yml", "show_unused_ports.yml"],
     "execution_order_rationale": "Audit first for baseline, then unused ports"
   }

5. Execution
   ↓
   Run: fabric_audit_all.yml → Success
   Run: show_unused_ports.yml → Success

6. Response
   ↓
   {
     "ok": true,
     "execution_plan": {...},
     "execution_results": {
       "total": 2,
       "executed": 2,
       "results": [...]
     }
   }
```

## Sequence Diagram

```
User          Frontend       MCP Server      LLM API       Ansible
 │                │              │              │             │
 │ "Audit..."     │              │              │             │
 ├───────────────▶│              │              │             │
 │                │ MCP Request  │              │             │
 │                ├─────────────▶│              │             │
 │                │              │ Get Playbooks│             │
 │                │              ├──────────────┤             │
 │                │              │              │             │
 │                │              │ LLM Prompt   │             │
 │                │              ├─────────────▶│             │
 │                │              │              │             │
 │                │              │ JSON Plan    │             │
 │                │              │◀─────────────┤             │
 │                │              │              │             │
 │                │              │ Execute PB1  │             │
 │                │              ├─────────────────────────────▶
 │                │              │              │             │
 │                │              │ Result PB1   │             │
 │                │              │◀─────────────────────────────
 │                │              │              │             │
 │                │              │ Execute PB2  │             │
 │                │              ├─────────────────────────────▶
 │                │              │              │             │
 │                │              │ Result PB2   │             │
 │                │              │◀─────────────────────────────
 │                │              │              │             │
 │                │ MCP Response │              │             │
 │                │◀─────────────┤              │             │
 │                │              │              │             │
 │ Results        │              │              │             │
 │◀───────────────┤              │              │             │
 │                │              │              │             │
```

## File Structure

```
ansible-mcp-project/
│
├── mcp_server.py                          # Main MCP server
│   ├── class AnsibleMcpServer
│   │   ├── __init__()                     # Tool registration
│   │   │   └── "intelligent_playbook_orchestration" tool
│   │   │
│   │   ├── tool_intelligent_playbook_orchestration()  # NEW
│   │   │   ├── Get playbook catalog
│   │   │   ├── Build LLM prompt
│   │   │   ├── Call LLM API
│   │   │   ├── Parse response
│   │   │   └── Execute or return plan
│   │   │
│   │   ├── tool_run_playbooks()           # Existing (reused)
│   │   └── handle_tools_call()            # Route to new tool
│   │
│   └── main()
│
├── .env                                   # Configuration
│   ├── ANSIBLE_PROJECT_ROOT
│   ├── LLM_API_KEY                        # NEW
│   ├── LLM_API_BASE                       # NEW
│   └── LLM_MODEL                          # NEW
│
├── playbooks/                             # Ansible playbooks
│   ├── fabric_audit_all.yml
│   ├── show_unused_ports.yml
│   └── ...
│
├── docs/
│   ├── intelligent-orchestration.md       # NEW - Full docs
│   ├── implementation-guide.md            # NEW - Setup guide
│   └── architecture-diagram.md            # NEW - This file
│
├── test_intelligent_orchestration.py      # NEW - Test script
├── INTELLIGENT_ORCHESTRATION_SUMMARY.md   # NEW - Summary
└── QUICK_REFERENCE.md                     # NEW - Quick ref
```

## Decision Flow

```
                    ┌─────────────────────┐
                    │  User Request       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  LLM_API_KEY set?   │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                   NO                    YES
                    │                     │
                    ▼                     ▼
            ┌──────────────┐    ┌──────────────────┐
            │ Return Error │    │ Get Playbooks    │
            └──────────────┘    └────────┬─────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Build LLM Prompt     │
                              └────────┬─────────────┘
                                       │
                                       ▼
                              ┌──────────────────────┐
                              │ Call LLM API         │
                              └────────┬─────────────┘
                                       │
                              ┌────────┴────────┐
                              │                 │
                          SUCCESS            ERROR
                              │                 │
                              ▼                 ▼
                    ┌──────────────────┐  ┌──────────────┐
                    │ Parse Response   │  │ Return Error │
                    └────────┬─────────┘  └──────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                dry_run?          dry_run?
                 = true            = false
                    │                 │
                    ▼                 ▼
          ┌──────────────────┐  ┌──────────────────┐
          │ Return Plan Only │  │ Execute Playbooks│
          └──────────────────┘  └────────┬─────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Return Plan + Results│
                              └──────────────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Frontend (HTML/JS) - Optional                     │ │
│  │  • User input interface                            │ │
│  │  • Results display                                 │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  MCP Server (Python)                               │ │
│  │  • Tool registration                               │ │
│  │  • Request handling                                │ │
│  │  • LLM integration                                 │ │
│  │  • Playbook orchestration                          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐
│   External Services  │  │  Execution Layer     │
│  ┌────────────────┐  │  │  ┌────────────────┐  │
│  │  LLM API       │  │  │  │  Ansible       │  │
│  │  • OpenAI      │  │  │  │  • Playbooks   │  │
│  │  • Azure       │  │  │  │  • Inventory   │  │
