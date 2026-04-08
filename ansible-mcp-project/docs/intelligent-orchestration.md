# Intelligent Playbook Orchestration

## Overview

The Intelligent Playbook Orchestration feature allows the MCP server to automatically understand natural language requests and create optimal combinations of playbooks to execute. Instead of manually specifying which playbooks to run, users can describe what they want to accomplish, and the system will intelligently select and sequence the appropriate playbooks.

## How It Works

1. **User Input**: User provides a natural language description of their goal
2. **LLM Analysis**: The system uses an LLM to analyze available playbooks and match them to the user's intent
3. **Execution Plan**: An execution plan is generated with selected playbooks in optimal order
4. **Execution**: Playbooks are run sequentially (or dry-run mode shows the plan without executing)

## Configuration

### Required Environment Variables

Add these to your `.env` file:

```bash
# LLM API Configuration
LLM_API_KEY=your-api-key-here
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4
```

### Supported LLM Providers

- **OpenAI**: Use `https://api.openai.com/v1` as the base URL
- **Azure OpenAI**: Use your Azure endpoint
- **Local LLMs**: Any OpenAI-compatible API (e.g., LM Studio, Ollama with OpenAI compatibility)
- **Other providers**: Anthropic Claude, Google Gemini (via compatible proxies)

### Alternative Configuration

You can also use `OPENAI_API_KEY` instead of `LLM_API_KEY`:

```bash
OPENAI_API_KEY=your-openai-key-here
```

## Usage

### MCP Tool: `intelligent_playbook_orchestration`

#### Parameters

- `user_request` (required): Natural language description of what you want to accomplish
- `limit` (optional): Ansible --limit parameter to restrict execution to specific hosts
- `tags` (optional): Ansible --tags parameter
- `extra_vars` (optional): Additional Ansible variables as a JSON object
- `dry_run` (optional): If true, only returns the execution plan without running playbooks

#### Example Requests

**Example 1: Network Audit**
```json
{
  "user_request": "I want to audit the entire fabric and check for unused ports"
}
```

Response:
```json
{
  "ok": true,
  "user_request": "I want to audit the entire fabric and check for unused ports",
  "execution_plan": {
    "playbooks": ["fabric_audit_all.yml", "show_unused_ports.yml"],
    "reasoning": "User wants comprehensive fabric audit followed by unused port detection",
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

**Example 2: Security Hardening**
```json
{
  "user_request": "Check VLAN consistency and harden the fabric security"
}
```

**Example 3: SQL Server Setup**
```json
{
  "user_request": "Install SQL Server and verify it's working"
}
```

**Example 4: Dry Run**
```json
{
  "user_request": "Show me all interfaces and generate a compliance report",
  "dry_run": true
}
```

Response (dry run):
```json
{
  "ok": true,
  "dry_run": true,
  "user_request": "Show me all interfaces and generate a compliance report",
  "execution_plan": {
    "playbooks": ["show_interfaces_all.yml", "generate_fabric_compliance_report.yml"],
    "reasoning": "User wants interface visibility and compliance documentation",
    "execution_order_rationale": "Gather interface data first, then generate compliance report"
  }
}
```

## Frontend Integration

### Update Frontend to Support Intelligent Prompts

The frontend can provide a "smart mode" where users type natural language requests:

```javascript
// In frontend/public/app.js

async function runIntelligentOrchestration() {
  const userRequest = document.getElementById('smart-prompt').value;
  const dryRun = document.getElementById('dry-run-checkbox').checked;
  
  const response = await fetch('/api/intelligent-orchestration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_request: userRequest,
      dry_run: dryRun
    })
  });
  
  const result = await response.json();
  displayExecutionPlan(result);
}
```

### UI Suggestions

Add a new section to the frontend:

```html
<div class="intelligent-mode">
  <h3>🤖 Intelligent Orchestration</h3>
  <p>Describe what you want to accomplish in natural language:</p>
  
  <textarea id="smart-prompt" placeholder="Example: Audit the network and check for security issues"></textarea>
  
  <label>
    <input type="checkbox" id="dry-run-checkbox" />
    Dry run (show plan without executing)
  </label>
  
  <button onclick="runIntelligentOrchestration()">Analyze & Execute</button>
  
  <div id="execution-plan"></div>
</div>
```

## Backend API Endpoint

Add this to `frontend/server.js`:

```javascript
app.post('/api/intelligent-orchestration', async (req, res) => {
  try {
    const { user_request, dry_run, limit, tags, extra_vars } = req.body;
    
    const result = await mcpClient.callTool('intelligent_playbook_orchestration', {
      user_request,
      dry_run: dry_run || false,
      limit,
      tags,
      extra_vars
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Benefits

1. **User-Friendly**: No need to know exact playbook names or combinations
2. **Intelligent Sequencing**: LLM determines optimal execution order
3. **Flexible**: Works with any natural language description
4. **Safe**: Dry-run mode allows preview before execution
5. **Extensible**: Automatically adapts as new playbooks are added

## Example Use Cases

### Network Operations
- "Show me all down interfaces and generate a report"
- "Audit the fabric and check VLAN consistency"
- "Find unused ports and create a summary"

### Application Deployment
- "Install SQL Server and verify it's running"
- "Deploy the application and check the health endpoint"

### Security & Compliance
- "Harden the fabric and generate a compliance report"
- "Check security settings and audit all devices"

### Troubleshooting
- "Show interface status and check for VLAN mismatches"
- "Audit the network and identify configuration issues"

## Error Handling

If the LLM API is not configured:
```json
{
  "ok": false,
  "error": "LLM_API_KEY or OPENAI_API_KEY environment variable not set",
  "suggestion": "Set LLM_API_KEY in your .env file to enable this feature"
}
```

If no suitable playbooks are found:
```json
{
  "ok": false,
  "error": "No suitable playbooks found for the request",
  "reasoning": "The request doesn't match any available playbook capabilities",
  "user_request": "..."
}
```

## Advanced Configuration

### Custom System Prompt

You can modify the LLM prompt in `mcp_server.py` to customize how playbooks are selected:

```python
prompt = f"""You are an Ansible playbook orchestration assistant...
[Customize this section to add domain-specific knowledge]
"""
```

### Temperature Control

Adjust the LLM temperature for more/less creative playbook selection:

```python
"temperature": 0.3,  # Lower = more conservative, Higher = more creative
```

## Troubleshooting

### Issue: LLM returns invalid JSON
**Solution**: The code includes regex-based JSON extraction to handle markdown-wrapped responses

### Issue: Wrong playbooks selected
**Solution**: Improve playbook descriptions in YAML files or adjust the system prompt

### Issue: API timeout
**Solution**: Increase timeout in the urllib.request.urlopen call or use a faster model

## Future Enhancements

1. **Caching**: Cache LLM responses for similar requests
2. **Learning**: Track successful combinations and prefer them
3. **Validation**: Pre-validate playbook compatibility before execution
4. **Rollback**: Automatic rollback on failure
5. **Multi-step Planning**: Break complex requests into phases
