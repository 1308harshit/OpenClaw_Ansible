# Intelligent Playbook Orchestration - Feature Summary

## What We Built

We've added an **Intelligent Playbook Orchestration** capability to your Ansible MCP server that allows users to describe what they want to accomplish in natural language, and the system automatically:

1. Analyzes the request using an LLM
2. Selects the appropriate playbooks
3. Determines the optimal execution order
4. Executes the playbooks (or shows a preview in dry-run mode)

## Problem Solved

**Before**: Users had to know exact playbook names and manually create combinations
```json
{
  "playbooks": ["fabric_audit_all.yml", "show_unused_ports.yml", "generate_fabric_compliance_report.yml"]
}
```

**After**: Users just describe what they want
```json
{
  "user_request": "Audit the network and find unused ports"
}
```

The system automatically figures out which playbooks to run and in what order.

## Key Features

### 1. Natural Language Understanding
Users can request operations in plain English:
- "Audit the fabric and check for unused ports"
- "Install SQL Server and verify it's working"
- "Show me all interfaces and generate a compliance report"

### 2. Intelligent Playbook Selection
The LLM analyzes:
- Available playbooks and their capabilities
- User intent and requirements
- Dependencies between operations
- Optimal execution order

### 3. Dry Run Mode
Preview the execution plan before running:
```json
{
  "user_request": "Audit and harden the network",
  "dry_run": true
}
```

Returns the plan without executing anything.

### 4. Transparent Reasoning
Every response includes:
- Which playbooks were selected
- Why they were chosen
- Why they're in that specific order

## Technical Implementation

### New MCP Tool: `intelligent_playbook_orchestration`

**Input Schema**:
```json
{
  "user_request": "string (required)",
  "dry_run": "boolean (optional, default: false)",
  "limit": "string (optional)",
  "tags": "string (optional)",
  "extra_vars": "object (optional)"
}
```

**Output**:
```json
{
  "ok": true,
  "user_request": "Audit the fabric and check for unused ports",
  "execution_plan": {
    "playbooks": ["fabric_audit_all.yml", "show_unused_ports.yml"],
    "reasoning": "User wants comprehensive audit followed by unused port detection",
    "execution_order_rationale": "Run full audit first to gather baseline, then identify unused ports"
  },
  "execution_results": {
    "ok": true,
    "total": 2,
    "executed": 2,
    "results": [...]
  }
}
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
│         "Audit the network and check security"               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Server (Python)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Fetch available playbooks with descriptions       │  │
│  │  2. Build LLM prompt with playbook catalog            │  │
│  │  3. Call LLM API (OpenAI/Azure/Local)                 │  │
│  │  4. Parse LLM response (JSON extraction)              │  │
│  │  5. Validate selected playbooks exist                 │  │
│  │  6. Execute via existing tool_run_playbooks()         │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Execution Results + Reasoning                   │
└─────────────────────────────────────────────────────────────┘
```

## Files Modified/Created

### Modified Files
1. **`mcp_server.py`**
   - Added `intelligent_playbook_orchestration` tool definition
   - Implemented `tool_intelligent_playbook_orchestration()` method
   - Added routing in `handle_tools_call()`

2. **`.env.example`**
   - Added LLM configuration variables

### New Files
1. **`docs/intelligent-orchestration.md`** - Complete feature documentation
2. **`docs/implementation-guide.md`** - Step-by-step setup guide
3. **`test_intelligent_orchestration.py`** - Test script with examples
4. **`INTELLIGENT_ORCHESTRATION_SUMMARY.md`** - This file

## Configuration Required

Add to `.env`:
```bash
# LLM Configuration
LLM_API_KEY=your-api-key-here
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4
```

Supports:
- OpenAI (GPT-4, GPT-3.5)
- Azure OpenAI
- Local LLMs (LM Studio, Ollama)
- Any OpenAI-compatible API

## Usage Examples

### Example 1: Network Audit
**Request**: "I want to audit the entire fabric and check for unused ports"

**System Response**:
- Selects: `fabric_audit_all.yml`, `show_unused_ports.yml`
- Reasoning: "Comprehensive audit followed by unused port detection"
- Executes in order

### Example 2: Security Hardening
**Request**: "Check VLAN consistency and harden the fabric security"

**System Response**:
- Selects: `check_vlan_consistency.yml`, `harden_fabric_simple.yml`
- Reasoning: "Validate VLAN configuration before applying security hardening"
- Executes in order

### Example 3: Application Deployment
**Request**: "Install SQL Server and verify it's working"

**System Response**:
- Selects: `sql_server_install.yml`
- Reasoning: "Installation playbook includes verification steps"
- Executes

### Example 4: Dry Run Preview
**Request**: "Show me all interfaces and generate a compliance report" (dry_run: true)

**System Response**:
- Shows execution plan without running
- User can review and approve
- Then run with dry_run: false

## Benefits

### For End Users
✅ No need to memorize playbook names
✅ Natural language interface
✅ Automatic optimal sequencing
✅ Preview before execution
✅ Clear explanations of what will happen

### For Operations
✅ Reduces training time
✅ Fewer execution errors
✅ Consistent playbook combinations
✅ Self-documenting operations
✅ Audit trail with reasoning

### For Development
✅ Extensible - automatically adapts to new playbooks
✅ No hardcoded combinations
✅ Easy to add new capabilities
✅ Works with existing infrastructure

## Frontend Integration (Next Step)

To expose this in your web UI, add:

1. **New UI Section** - Text area for natural language input
2. **Dry Run Toggle** - Checkbox to preview without executing
3. **Execution Plan Display** - Show selected playbooks and reasoning
4. **Execute Button** - Run the plan

See `docs/implementation-guide.md` for complete frontend code.

## Comparison with Alternatives

### Your Approach (Intelligent MCP Tool)
✅ Integrated with existing MCP infrastructure
✅ Uses your existing playbook execution logic
✅ Single tool call handles everything
✅ Works with any MCP client
✅ Centralized intelligence in the server

### Alternative: Separate LLM Agent
❌ Requires separate service
❌ Needs to replicate MCP client logic
❌ More complex architecture
❌ Additional maintenance burden

## Testing

```bash
# 1. Configure .env with LLM_API_KEY
# 2. Restart MCP server
python mcp_server.py

# 3. Test with dry run
# Send MCP request with dry_run: true

# 4. Review execution plan
# 5. Execute with dry_run: false
```

See `test_intelligent_orchestration.py` for test cases.

## Security & Safety

✅ **Playbook Allowlist**: Only pre-approved playbooks can be executed
✅ **Input Validation**: User requests are validated
✅ **Dry Run Mode**: Preview before execution
✅ **API Key Protection**: Stored in .env (not in code)
✅ **Error Handling**: Graceful failures with clear messages

## Performance

- **LLM Call**: ~1-3 seconds (depends on model and API)
- **Playbook Execution**: Same as before (no overhead)
- **Total Overhead**: Minimal (~1-3 seconds for intelligence)

Optimization options:
- Use faster models (gpt-3.5-turbo)
- Cache common requests
- Use local LLMs for lower latency

## Cost Considerations

### OpenAI Pricing (approximate)
- GPT-4: ~$0.03 per request
- GPT-3.5-turbo: ~$0.002 per request

For 1000 requests/month:
- GPT-4: ~$30/month
- GPT-3.5-turbo: ~$2/month

### Cost Reduction Options
1. Use GPT-3.5-turbo (20x cheaper, still very capable)
2. Use local LLMs (free, but requires setup)
3. Cache common requests
4. Use Azure OpenAI with reserved capacity

## Next Steps

1. ✅ **Code Complete** - Feature is implemented
2. ⬜ **Configure LLM API** - Add API key to .env
3. ⬜ **Test Backend** - Verify MCP tool works
4. ⬜ **Update Frontend** - Add UI for natural language input
5. ⬜ **User Testing** - Get feedback from team
6. ⬜ **Production Deployment** - Roll out to users

## Documentation

- **Feature Overview**: `docs/intelligent-orchestration.md`
- **Setup Guide**: `docs/implementation-guide.md`
- **Test Script**: `test_intelligent_orchestration.py`
- **This Summary**: `INTELLIGENT_ORCHESTRATION_SUMMARY.md`

## Questions?

Common questions answered in the documentation:
- How to configure different LLM providers?
- How to customize playbook selection logic?
- How to add frontend UI?
- How to troubleshoot issues?
- How to optimize performance?

See `docs/implementation-guide.md` for detailed answers.

---

## Quick Start Command

```bash
# 1. Add to .env
echo "LLM_API_KEY=your-key-here" >> .env
echo "LLM_API_BASE=https://api.openai.com/v1" >> .env
echo "LLM_MODEL=gpt-4" >> .env

# 2. Restart server
python mcp_server.py

# 3. Test (via MCP client or frontend)
# Send request: "Audit the network and check for unused ports"
```

That's it! The system will automatically select and execute the right playbooks.
