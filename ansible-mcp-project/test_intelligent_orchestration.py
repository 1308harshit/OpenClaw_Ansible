#!/usr/bin/env python3
"""
Test script for intelligent playbook orchestration feature.
This demonstrates how to use the new intelligent_playbook_orchestration tool.
"""

import json
import subprocess
import sys

def test_intelligent_orchestration(user_request, dry_run=True):
    """Test the intelligent orchestration feature via MCP protocol."""
    
    # Prepare MCP request
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "intelligent_playbook_orchestration",
            "arguments": {
                "user_request": user_request,
                "dry_run": dry_run
            }
        }
    }
    
    print(f"\n{'='*60}")
    print(f"Testing: {user_request}")
    print(f"Dry Run: {dry_run}")
    print(f"{'='*60}\n")
    
    # Send request to MCP server (assuming it's running)
    # In production, this would go through the MCP client
    print("Request:")
    print(json.dumps(request, indent=2))
    print("\n" + "="*60 + "\n")
    
    return request

def main():
    """Run test cases."""
    
    test_cases = [
        "I want to audit the entire fabric and check for unused ports",
        "Check VLAN consistency and harden the fabric security",
        "Show me all interfaces and generate a compliance report",
        "Install SQL Server and verify it's working",
        "Find all down interfaces and create a summary report"
    ]
    
    print("Intelligent Playbook Orchestration - Test Cases")
    print("=" * 60)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest Case {i}:")
        request = test_intelligent_orchestration(test_case, dry_run=True)
        
        # In a real scenario, you would:
        # 1. Send this request to the MCP server
        # 2. Receive the response
        # 3. Display the execution plan
        
        print("\nExpected behavior:")
        print("- LLM analyzes the request")
        print("- Selects appropriate playbooks")
        print("- Returns execution plan with reasoning")
        print("\n" + "-"*60)
    
    print("\n" + "="*60)
    print("To actually test this feature:")
    print("1. Ensure LLM_API_KEY is set in .env")
    print("2. Start the MCP server: python mcp_server.py")
    print("3. Use the frontend or MCP client to call the tool")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
