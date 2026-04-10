# Requirements Document

## Introduction

This feature replaces the hardcoded `fabric_audit_all.yml` orchestrator mapping in the Ansible MCP project's AI system instruction with a hybrid AI-driven playbook selection system. When a user submits a natural-language request such as "audit the network" or "generate fabric report", the system intelligently selects the correct individual playbooks, presents an execution plan to the user, and runs them one by one with live streaming progress. The hybrid approach combines a deterministic Rule Boost Layer (keyword matching) with AI-based selection (Gemini plan model) to guarantee correctness for known critical flows while retaining full flexibility for novel requests.

## Glossary

- **Orchestrator**: The `handleIntelligentOrchestration` function in `server.js` that plans and executes playbook sequences.
- **Rule_Boost_Layer**: A keyword-matching pre-filter that injects a pre-validated playbook list before the AI plan model is called.
- **Plan_Model**: The secondary Gemini API call inside `handleIntelligentOrchestration` that selects and orders playbooks from the enriched catalog.
- **PLAYBOOK_CATALOG**: A static Python dict in `mcp_server.py` that overlays curated metadata (description, intent keywords, order hints) on top of auto-extracted playbook info.
- **System_Instruction**: The `SYSTEM_INSTRUCTION` constant in `server.js` that governs how the main Gemini chat model routes user requests to tools.
- **Orchestration_Prompt**: The prompt string passed to the Plan_Model inside `handleIntelligentOrchestration`.
- **SSE**: Server-Sent Events — the streaming protocol used to push real-time progress from `server.js` to the browser.
- **Execution_Loop**: The `for` loop inside `handleIntelligentOrchestration` that calls `run_playbook` for each selected playbook in sequence.
- **stop_on_failure**: A boolean field in the orchestration plan JSON that controls whether the Execution_Loop halts on the first playbook failure.
- **MCP_Server**: The `mcp_server.py` Python process that executes Ansible playbooks and returns results over JSON-RPC stdio.
- **Fabric_Audit_Sequence**: The canonical 5-playbook sequence: `show_interfaces_all.yml` → `show_unused_ports.yml` → `check_vlan_consistency.yml` → `harden_fabric_simple.yml` → `generate_fabric_compliance_report.yml`.

## Requirements

### Requirement 1: Route Fabric Audit Queries to Intelligent Orchestration

**User Story:** As a network operator, I want fabric audit queries to be handled by the intelligent orchestration tool, so that the AI selects the correct individual playbooks dynamically instead of running a hardcoded orchestrator playbook.

#### Acceptance Criteria

1. WHEN a user submits a request containing any of the phrases "audit the full fabric", "fabric audit", "fabric report", "fabric compliance", "operations summary", "quick operations summary", "show down interfaces", "list unused ports", "verify vlan consistency", "apply baseline hardening", "generate compliance report", "compliance report", "audit the network", or "generate fabric report", THEN THE System_Instruction SHALL route the request to the `intelligent_playbook_orchestration` tool with the user's exact message as `user_request`.
2. THE System_Instruction SHALL NOT contain any routing rule that maps fabric audit phrases directly to `run_playbook` with `fabric_audit_all.yml`.
3. WHEN the `intelligent_playbook_orchestration` tool completes a fabric audit sequence, THE System_Instruction SHALL instruct the main chat model to provide the compliance report link at `BASE_URL/reports/fabric_compliance/index.html`.

---

### Requirement 2: Rule Boost Layer

**User Story:** As a system architect, I want known critical query patterns to be resolved deterministically before the AI is called, so that high-stakes playbook sequences are always correct regardless of AI variability.

#### Acceptance Criteria

1. THE Orchestrator SHALL implement a `RULE_BOOST_MAP` constant containing keyword-to-playbook-list mappings for known critical query patterns.
2. WHEN a user request contains any keyword from a `RULE_BOOST_MAP` entry (case-insensitive substring match), THE Rule_Boost_Layer SHALL return the pre-validated ordered playbook list and `stop_on_failure` value for that entry without calling the Plan_Model.
3. WHEN no `RULE_BOOST_MAP` entry matches the user request, THE Rule_Boost_Layer SHALL return null and THE Orchestrator SHALL proceed to the AI planning path.
4. THE `RULE_BOOST_MAP` SHALL include an entry for fabric audit queries with keywords including "fabric report", "fabric audit", "audit the network", "audit network", "compliance report", "generate report", "operations summary", "fabric compliance", and "full audit", mapping to the Fabric_Audit_Sequence with `stop_on_failure: false`.
5. THE `RULE_BOOST_MAP` SHALL include an entry for VLAN-only queries with keywords "check vlan", "vlan consistency", "verify vlan", "vlan check", mapping to `["check_vlan_consistency.yml"]` with `stop_on_failure: true`.
6. THE `RULE_BOOST_MAP` SHALL include an entry for interface-only queries with keywords "show interfaces", "interface status", "show all interfaces", mapping to `["show_interfaces_all.yml"]` with `stop_on_failure: true`.
7. IF a rule match is found, THEN THE Rule_Boost_Layer SHALL never include `fabric_audit_all.yml` in the returned playbook list.

---

### Requirement 3: Enriched Playbook Catalog

**User Story:** As a developer, I want the playbook catalog served to the Plan_Model to include curated intent-level metadata, so that Gemini can accurately select and order playbooks from natural-language descriptions.

#### Acceptance Criteria

1. THE MCP_Server SHALL define a `PLAYBOOK_CATALOG` dict in `mcp_server.py` that maps playbook filenames to curated metadata objects.
2. WHEN `_extract_playbook_info` is called for a playbook whose filename exists in `PLAYBOOK_CATALOG`, THE MCP_Server SHALL merge the catalog metadata over the auto-extracted info, with catalog values taking precedence.
3. THE `PLAYBOOK_CATALOG` SHALL include entries for `show_interfaces_all.yml`, `show_unused_ports.yml`, `check_vlan_consistency.yml`, `harden_fabric_simple.yml`, and `generate_fabric_compliance_report.yml` at minimum.
4. EACH `PLAYBOOK_CATALOG` entry SHALL contain a `description` field (human-readable intent description), an `intent_keywords` list (phrases a user would say to trigger this playbook), a `hosts` field, a `produces` field (output artifact path pattern), and an `order_hint` integer.
5. THE MCP_Server SHALL always return a non-empty `description` field for any playbook returned by `list_playbooks_with_summary`.

---

### Requirement 4: Hardened Orchestration Prompt

**User Story:** As a developer, I want the orchestration prompt sent to the Plan_Model to explicitly exclude `fabric_audit_all.yml` and include `stop_on_failure` in the response schema, so that the AI never selects the legacy orchestrator and partial-failure semantics are correctly communicated.

#### Acceptance Criteria

1. THE Orchestration_Prompt SHALL contain an explicit rule stating that `fabric_audit_all.yml` must never be selected.
2. THE Orchestration_Prompt SHALL include the JSON response schema with a `stop_on_failure` boolean field.
3. THE Orchestration_Prompt SHALL include ordering guidance specifying the prerequisite sequence: interfaces → unused ports → VLANs → hardening → compliance report.
4. THE Orchestration_Prompt SHALL instruct the Plan_Model to set `stop_on_failure: false` when `harden_fabric_simple.yml` is included in the plan.
5. THE Orchestration_Prompt SHALL instruct the Plan_Model to return an empty `playbooks` array when the request is too vague or no playbooks match.
6. WHEN the Orchestrator formats the playbook catalog for the Plan_Model prompt, THE Orchestrator SHALL exclude `fabric_audit_all.yml` from the catalog lines passed to the Plan_Model.

---

### Requirement 5: Catalog Formatting Excludes Legacy Orchestrator

**User Story:** As a developer, I want `fabric_audit_all.yml` to be invisible to the Plan_Model, so that it can never be selected even if the exclusion rule in the prompt is ignored.

#### Acceptance Criteria

1. WHEN the Orchestrator formats the playbook catalog for the Plan_Model prompt, THE Orchestrator SHALL skip any playbook whose filename is `fabric_audit_all.yml`.
2. THE Orchestrator SHALL apply a server-side filter to remove `fabric_audit_all.yml` from `plan.playbooks` after parsing the Plan_Model response, before any execution occurs.
3. IF the server-side filter removes all playbooks from `plan.playbooks`, THEN THE Orchestrator SHALL return a dry-run result with an empty playbook list.

---

### Requirement 6: stop_on_failure Execution Semantics

**User Story:** As a network operator, I want the execution loop to respect the `stop_on_failure` flag from the orchestration plan, so that the compliance report is still generated even when the hardening step fails in the demo environment.

#### Acceptance Criteria

1. WHEN the orchestration plan contains `stop_on_failure: false` and a playbook in the sequence fails, THE Execution_Loop SHALL continue executing the remaining playbooks in the sequence.
2. WHEN the orchestration plan contains `stop_on_failure: true` (or the field is absent) and a playbook fails, THE Execution_Loop SHALL halt after the failed playbook and not execute any remaining playbooks.
3. THE Execution_Loop SHALL record each attempted playbook's result (playbook name, ok status, stdout, stderr) in the `execution_results` array regardless of success or failure.
4. WHEN `stop_on_failure: false` and all playbooks in the plan are attempted, THE Execution_Loop SHALL set `overallOk: false` if any individual playbook failed.

---

### Requirement 7: SSE Progress Streaming

**User Story:** As a user, I want to see the execution plan and per-playbook progress in real time, so that I know what the AI decided to run and can track each step as it completes.

#### Acceptance Criteria

1. WHEN the Orchestrator has determined the final playbook list (after rule boost and/or AI planning), THE Orchestrator SHALL emit an `orchestration_plan` SSE event containing `greeting`, `playbooks`, and `reasoning` fields before any playbook execution begins.
2. WHEN the Execution_Loop begins executing a playbook, THE Orchestrator SHALL emit a `playbook_start` SSE event containing the playbook filename.
3. WHEN the Execution_Loop finishes executing a playbook, THE Orchestrator SHALL emit a `playbook_done` SSE event containing the playbook filename and `ok` boolean.
4. THE Orchestrator SHALL emit `orchestration_plan` exactly once per invocation, before any `playbook_start` events.
5. IF `dry_run` is true or the final playbook list is empty, THEN THE Orchestrator SHALL emit the `orchestration_plan` SSE event and return without emitting any `playbook_start` or `playbook_done` events.

---

### Requirement 8: Merge Strategy for Rule Boost and AI Plan

**User Story:** As a developer, I want the rule boost and AI plan results to be merged correctly, so that the forced playbook order is preserved and any AI-suggested additions are appended without duplication.

#### Acceptance Criteria

1. WHEN both a rule boost match and an AI plan are available, THE Orchestrator SHALL produce a merged playbook list where all entries from the forced playbook list appear first in their original order.
2. WHEN merging, THE Orchestrator SHALL append any AI-suggested playbooks not already present in the forced list, in the order the AI suggested them.
3. THE merged playbook list SHALL never contain duplicate entries.
4. THE merged playbook list SHALL never contain `fabric_audit_all.yml`.

---

### Requirement 9: Graceful Error Handling

**User Story:** As a user, I want the system to handle errors gracefully and provide meaningful feedback, so that I understand what went wrong and can take corrective action.

#### Acceptance Criteria

1. IF the Plan_Model returns a response that cannot be parsed as valid JSON, THEN THE Orchestrator SHALL return `{ ok: false, error: "Failed to parse orchestration plan from Gemini", raw: <raw_text> }`.
2. IF a `run_playbook` MCP call throws an exception or times out, THEN THE Orchestrator SHALL catch the error, record `{ ok: false, error: <error_message> }` for that playbook, emit a `playbook_done` SSE event with `ok: false`, and apply `stop_on_failure` logic as normal.
3. IF the final playbook list is empty after all filtering, THEN THE Orchestrator SHALL return a dry-run result and THE main chat model SHALL ask the user to clarify their request.
4. WHILE the MCP process is running, IF the child process exits unexpectedly, THEN THE MCP_Server SHALL reject all in-flight RPC calls with a descriptive error message including the exit code and stderr output.
