# Architecture Overview

## Simple Flow

```
User Request → MCP Server → LLM API → Playbook Selection → Ansible Execution → Results
```

## Detailed Flow

1. **User Input**: "Audit the network and check for unused ports"
2. **MCP Server**: Receives request via `intelligent_playbook_orchestration` tool
3. **Playbook Catalog**: Server fetches list of available playbooks
4. **LLM Prompt**: Builds prompt with playbooks + user request
5. **LLM Analysis**: LLM selects appropriate playbooks and orders them
6. **Execution**: Server runs selected playbooks via Ansible
7. **Response**: Returns plan + results to user

## Key Components

- **mcp_server.py**: Main server with new `tool_intelligent_playbook_orchestration()` method
- **LLM API**: OpenAI/Azure/Local LLM for intelligent selection
- **Ansible**: Executes the selected playbooks
- **Frontend**: Optional UI for natural language input

## Configuration

```bash
LLM_API_KEY=your-key
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4
```

## Example

**Input**: "Audit and check unused ports"

**LLM Selects**: 
- fabric_audit_all.yml
- show_unused_ports.yml

**Executes**: Both playbooks in order

**Returns**: Execution plan + results
