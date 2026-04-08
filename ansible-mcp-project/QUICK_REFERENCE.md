# Intelligent Orchestration - Quick Reference

## Setup (One Time)

```bash
# Add to .env file
LLM_API_KEY=your-api-key-here
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4

# Restart MCP server
python mcp_server.py
```

## MCP Tool Call

**Tool Name**: `intelligent_playbook_orchestration`

**Minimal Request**:
```json
{
  "user_request": "Audit the network and check for unused ports"
}
```

**Full Request**:
```json
{
  "user_request": "Audit the network and check for unused ports",
  "dry_run": true,
  "limit": "leaf1,leaf2",
  "tags": "audit",
  "extra_vars": {"verbose": true}
}
```

## Example Requests

| User Request | Expected Playbooks |
|-------------|-------------------|
| "Audit the fabric and check for unused ports" | `fabric_audit_all.yml`, `show_unused_ports.yml` |
| "Check VLAN consistency and harden security" | `check_vlan_consistency.yml`, `harden_fabric_simple.yml` |
| "Show all interfaces" | `show_interfaces_all.yml` |
| "Install SQL Server and verify" | `sql_server_install.yml` |
| "Generate compliance report" | `generate_fabric_compliance_report.yml` |

## Response Format

```json
{
  "ok": true,
  "user_request": "...",
  "execution_plan": {
    "playbooks": ["playbook1.yml", "playbook2.yml"],
    "reasoning": "Why these playbooks",
    "execution_order_rationale": "Why this order"
  },
  "execution_results": {
    "ok": true,
    "total": 2,
    "executed": 2,
    "results": [...]
  }
}
```

## Dry Run vs Execute

**Dry Run** (preview only):
```json
{"user_request": "...", "dry_run": true}
```

**Execute**:
```json
{"user_request": "...", "dry_run": false}
```
or
```json
{"user_request": "..."}
```

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "LLM_API_KEY not set" | Missing API key | Add to .env file |
| "No suitable playbooks found" | Request doesn't match playbooks | Be more specific |
| "LLM API error: 401" | Invalid API key | Check API key |
| "LLM API error: 429" | Rate limit | Wait or upgrade plan |

## LLM Provider Quick Config

**OpenAI**:
```bash
LLM_API_KEY=sk-...
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4
```

**Azure OpenAI**:
```bash
LLM_API_KEY=your-azure-key
LLM_API_BASE=https://your-resource.openai.azure.com/...
LLM_MODEL=gpt-4
```

**Local (LM Studio)**:
```bash
LLM_API_KEY=not-needed
LLM_API_BASE=http://localhost:1234/v1
LLM_MODEL=local-model
```

## Frontend Integration Snippet

```javascript
async function runSmartPlaybook() {
  const response = await fetch('/api/intelligent-orchestration', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      user_request: document.getElementById('prompt').value,
      dry_run: true
    })
  });
  const result = await response.json();
  console.log(result.execution_plan);
}
```

## Testing

```bash
# Test script
python test_intelligent_orchestration.py

# Manual test via curl (if MCP server exposes HTTP)
curl -X POST http://localhost:3000/api/intelligent-orchestration \
  -H "Content-Type: application/json" \
  -d '{"user_request": "Audit the network", "dry_run": true}'
```

## Troubleshooting

1. **Check .env**: Ensure LLM_API_KEY is set
2. **Check logs**: Look at MCP server output
3. **Test dry_run**: Always test with dry_run first
4. **Verify API**: Test API key with curl

## Documentation

- Full docs: `docs/intelligent-orchestration.md`
- Setup guide: `docs/implementation-guide.md`
- Summary: `INTELLIGENT_ORCHESTRATION_SUMMARY.md`
