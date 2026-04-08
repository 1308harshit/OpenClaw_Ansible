# Implementation Guide: Intelligent Playbook Orchestration

## Quick Start

### Step 1: Configure LLM API

Add to your `.env` file:

```bash
# Copy from .env.example
LLM_API_KEY=sk-your-actual-api-key-here
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4
```

### Step 2: Restart MCP Server

```bash
cd ansible-mcp-project
source venv/bin/activate  # or venv\Scripts\activate on Windows
python mcp_server.py
```

### Step 3: Test the Feature

#### Option A: Via Frontend (Recommended)

Update `frontend/server.js` to add the new endpoint:

```javascript
// Add this endpoint
app.post('/api/intelligent-orchestration', async (req, res) => {
  try {
    const { user_request, dry_run, limit, tags, extra_vars } = req.body;
    
    const result = await callMcpTool('intelligent_playbook_orchestration', {
      user_request,
      dry_run: dry_run || false,
      limit,
      tags,
      extra_vars
    });
    
    res.json(result);
  } catch (error) {
    console.error('Intelligent orchestration error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

Update `frontend/public/app.js` to add UI:

```javascript
// Add to your HTML
function addIntelligentOrchestrationUI() {
  const html = `
    <div class="card intelligent-mode">
      <h3>🤖 Intelligent Orchestration</h3>
      <p>Describe what you want to accomplish:</p>
      
      <textarea id="smart-prompt" rows="3" style="width: 100%; margin: 10px 0;"
        placeholder="Example: Audit the network and check for security issues"></textarea>
      
      <div style="margin: 10px 0;">
        <label>
          <input type="checkbox" id="dry-run-checkbox" checked />
          Dry run (preview without executing)
        </label>
      </div>
      
      <button onclick="runIntelligentOrchestration()" class="btn-primary">
        Analyze & Execute
      </button>
      
      <div id="execution-plan" style="margin-top: 20px;"></div>
    </div>
  `;
  
  document.getElementById('intelligent-section').innerHTML = html;
}

async function runIntelligentOrchestration() {
  const userRequest = document.getElementById('smart-prompt').value.trim();
  const dryRun = document.getElementById('dry-run-checkbox').checked;
  
  if (!userRequest) {
    alert('Please enter a request');
    return;
  }
  
  const planDiv = document.getElementById('execution-plan');
  planDiv.innerHTML = '<p>🔄 Analyzing request...</p>';
  
  try {
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
  } catch (error) {
    planDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}

function displayExecutionPlan(result) {
  const planDiv = document.getElementById('execution-plan');
  
  if (!result.ok) {
    planDiv.innerHTML = `
      <div style="color: red; padding: 10px; border: 1px solid red; border-radius: 5px;">
        <strong>Error:</strong> ${result.error || 'Unknown error'}
        ${result.suggestion ? `<br><em>${result.suggestion}</em>` : ''}
      </div>
    `;
    return;
  }
  
  const plan = result.execution_plan;
  let html = `
    <div style="border: 1px solid #4CAF50; border-radius: 5px; padding: 15px; background: #f9f9f9;">
      <h4>📋 Execution Plan</h4>
      
      <div style="margin: 10px 0;">
        <strong>Reasoning:</strong>
        <p style="margin: 5px 0; font-style: italic;">${plan.reasoning}</p>
      </div>
      
      <div style="margin: 10px 0;">
        <strong>Selected Playbooks:</strong>
        <ol style="margin: 5px 0;">
          ${plan.playbooks.map(pb => `<li><code>${pb}</code></li>`).join('')}
        </ol>
      </div>
      
      <div style="margin: 10px 0;">
        <strong>Execution Order Rationale:</strong>
        <p style="margin: 5px 0; font-style: italic;">${plan.execution_order_rationale}</p>
      </div>
  `;
  
  if (result.dry_run) {
    html += `
      <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">
        <strong>ℹ️ Dry Run Mode:</strong> This is a preview. Uncheck "Dry run" to execute.
      </div>
    `;
  } else if (result.execution_results) {
    const execResults = result.execution_results;
    html += `
      <div style="margin-top: 15px;">
        <strong>Execution Results:</strong>
        <p>Total: ${execResults.total} | Executed: ${execResults.executed} | Skipped: ${execResults.skipped}</p>
        <details>
          <summary>View detailed results</summary>
          <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${JSON.stringify(execResults.results, null, 2)}</pre>
        </details>
      </div>
    `;
  }
  
  html += '</div>';
  planDiv.innerHTML = html;
}
```

Add to your HTML:

```html
<div id="intelligent-section"></div>
<script>
  // Call this when page loads
  addIntelligentOrchestrationUI();
</script>
```

#### Option B: Via MCP Client

```python
import json

# Send MCP request
request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "intelligent_playbook_orchestration",
        "arguments": {
            "user_request": "Audit the fabric and check for unused ports",
            "dry_run": True
        }
    }
}

# Send to MCP server and get response
```

## Architecture

```
User Input (Natural Language)
         ↓
Frontend/MCP Client
         ↓
MCP Server (mcp_server.py)
         ↓
tool_intelligent_playbook_orchestration()
         ↓
    ┌────────────────────────┐
    │  1. Get playbook list  │
    │  2. Build LLM prompt   │
    │  3. Call LLM API       │
    │  4. Parse response     │
    │  5. Execute playbooks  │
    └────────────────────────┘
         ↓
Execution Results
```

## LLM Provider Options

### OpenAI (Recommended for Production)

```bash
LLM_API_KEY=sk-...
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4
```

### Azure OpenAI

```bash
LLM_API_KEY=your-azure-key
LLM_API_BASE=https://your-resource.openai.azure.com/openai/deployments/your-deployment
LLM_MODEL=gpt-4
```

### Local LLM (LM Studio)

```bash
LLM_API_KEY=not-needed
LLM_API_BASE=http://localhost:1234/v1
LLM_MODEL=local-model
```

### Ollama (with OpenAI compatibility)

```bash
# Start Ollama with OpenAI compatibility
ollama serve

# Configure
LLM_API_KEY=not-needed
LLM_API_BASE=http://localhost:11434/v1
LLM_MODEL=llama2
```

## Testing

### Test 1: Dry Run

```bash
python test_intelligent_orchestration.py
```

### Test 2: Real Execution

Use the frontend or send MCP request with `dry_run: false`

### Test 3: Error Handling

Test without LLM_API_KEY to verify error messages

## Common Issues

### Issue: "LLM_API_KEY not set"

**Solution**: Add LLM_API_KEY to your .env file and restart the MCP server

### Issue: "No suitable playbooks found"

**Solution**: The request might be too vague or unrelated to available playbooks. Try being more specific.

### Issue: LLM timeout

**Solution**: 
- Use a faster model (gpt-3.5-turbo instead of gpt-4)
- Increase timeout in the code
- Check network connectivity

### Issue: Wrong playbooks selected

**Solution**:
- Improve playbook YAML documentation
- Add more descriptive names and comments
- Adjust the system prompt in the code

## Performance Optimization

1. **Cache LLM responses**: Add caching for similar requests
2. **Use faster models**: gpt-3.5-turbo is faster than gpt-4
3. **Reduce prompt size**: Only include relevant playbook info
4. **Parallel execution**: Run independent playbooks in parallel (future enhancement)

## Security Considerations

1. **API Key Protection**: Never commit .env files with real API keys
2. **Input Validation**: User requests are validated before LLM processing
3. **Playbook Allowlist**: Only pre-approved playbooks can be executed
4. **Audit Logging**: All executions are logged (add this if needed)

## Next Steps

1. ✅ Configure LLM API
2. ✅ Update frontend with new UI
3. ✅ Test with dry_run=true
4. ✅ Test real execution
5. ⬜ Add caching (optional)
6. ⬜ Add audit logging (optional)
7. ⬜ Train team on usage

## Support

For issues or questions:
1. Check the logs in the MCP server output
2. Verify .env configuration
3. Test with dry_run=true first
4. Review the documentation in `docs/intelligent-orchestration.md`
