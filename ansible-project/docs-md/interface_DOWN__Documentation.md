# Task: Bring Interface DOWN

## Purpose

This playbook is used to safely shut down a specific Ethernet interface on a leaf switch. It is commonly used during maintenance windows or isolation scenarios.

## When to Run This Playbook

\- Before maintenance on connected servers or devices  
\- To isolate faulty links  
\- During testing or failure simulations  
\- To intentionally disable unused interfaces

## Playbook Behavior

1\. Connects to the specified leaf switch  
2\. Enters the interface configuration mode  
3\. Executes \`shutdown\` on the interface  
4\. Verifies interface status using a show command  
5\. Displays the interface status output

## YOU CAN CHANGE THE HOST TO APPLY CHANGES ON DIFFERENT NETWORK DEVICES, FOLLOW MD FILES TO SEE VARIATION

## Command to Run

ansible-playbook interface_down.yml

(OR PRESS RUN BUTTON ON TERMINAL)

## Expected Output

You should see:  
\- Successful task execution (failed=0)  
\- Interface state as \`disabled\` or \`notconnect\`  
\- No unintended changes to other interfaces  
<br/>Example output:  
Ethernet10 disabled

## Success Criteria

\- Play recap shows failed=0  
\- Interface status confirms the link is DOWN  
\- Connected device loses link as expected