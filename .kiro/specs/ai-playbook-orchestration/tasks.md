# Tasks

## Task List

- [x] 1. Add PLAYBOOK_CATALOG to mcp_server.py
  - [x] 1.1 Define PLAYBOOK_CATALOG dict with entries for show_interfaces_all.yml, show_unused_ports.yml, check_vlan_consistency.yml, harden_fabric_simple.yml, and generate_fabric_compliance_report.yml (each with description, intent_keywords, hosts, produces, order_hint)
  - [x] 1.2 Update _extract_playbook_info to merge PLAYBOOK_CATALOG metadata over auto-extracted info when the filename is present in the catalog

- [x] 2. Add RULE_BOOST_MAP and applyRuleBoost to server.js
  - [x] 2.1 Define RULE_BOOST_MAP constant with entries for fabric audit, VLAN-only, and interface-only query patterns
  - [x] 2.2 Implement applyRuleBoost(userRequest) function that performs case-insensitive substring matching and returns { forcedPlaybooks, stop_on_failure } or null

- [x] 3. Update handleIntelligentOrchestration in server.js
  - [x] 3.1 Call applyRuleBoost at the start of handleIntelligentOrchestration and store the result
  - [x] 3.2 Update formatCatalogForPrompt (or inline catalog formatting) to exclude fabric_audit_all.yml from the lines passed to the Plan_Model
  - [x] 3.3 Replace the existing planPrompt string with the hardened version: explicit fabric_audit_all.yml exclusion rule, stop_on_failure field in JSON schema, prerequisite ordering guidance, and harden-triggers-false instruction
  - [x] 3.4 After parsing the Plan_Model JSON response, apply server-side filter to remove fabric_audit_all.yml from plan.playbooks
  - [x] 3.5 Implement merge logic: when rule boost matched, merge forcedPlaybooks + aiPlaybooks (deduplicated, forced order first); when no rule boost, use AI plan directly
  - [x] 3.6 Update the execution loop to read stop_on_failure from the plan (defaulting to true) and break or continue accordingly

- [ ] 4. Update SYSTEM_INSTRUCTION in server.js
  - [x] 4.1 Remove the "Fabric Audit (CRITICAL MAPPINGS)" block that routes fabric audit phrases to run_playbook(fabric_audit_all.yml)
  - [x] 4.2 Add an "Intelligent Orchestration — Fabric Audit Queries" routing rule that maps fabric audit phrases to intelligent_playbook_orchestration with the user's exact message as user_request
  - [x] 4.3 Ensure the post-completion instruction to provide the compliance report link (BASE_URL/reports/fabric_compliance/index.html) is present in the new routing rule

- [ ] 5. Write tests
  - [ ] 5.1 Write property test: applyRuleBoost returns correct playbook list for any request containing a known keyword (Property 1)
  - [ ] 5.2 Write property test: applyRuleBoost returns null for any request with no known keyword (Property 2)
  - [ ] 5.3 Write property test: applyRuleBoost never returns fabric_audit_all.yml (Property 3)
  - [ ] 5.4 Write property test: catalog formatting never includes fabric_audit_all.yml (Property 4)
  - [ ] 5.5 Write property test: server-side filter removes fabric_audit_all.yml from any array (Property 5)
  - [ ] 5.6 Write property test: all PLAYBOOK_CATALOG entries contain required fields (Property 6)
  - [ ] 5.7 Write property test: hybrid merge preserves forced order, appends AI additions, excludes duplicates and fabric_audit_all.yml (Property 12)
  - [ ] 5.8 Write property test: stop_on_failure=false causes all playbooks to be attempted (Property 9)
  - [ ] 5.9 Write property test: stop_on_failure=true halts after first failure (Property 10)
  - [ ] 5.10 Write example test: SYSTEM_INSTRUCTION does not contain run_playbook(fabric_audit_all.yml) routing for fabric audit phrases
  - [ ] 5.11 Write example test: orchestration prompt contains fabric_audit_all.yml exclusion rule and stop_on_failure schema field
