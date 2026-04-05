# Task: Bring Interface UP

## Purpose

This playbook is used to bring a specific Ethernet interface UP (no shutdown) on a leaf switch. It is typically used during troubleshooting, maintenance completion, or after intentional shutdowns.

## When to Run This Playbook

\- After maintenance work is completed  
\- When an interface was previously shut down intentionally  
\- To restore connectivity to a server or downstream device  
\- During testing or validation in lab environments

## Playbook Behavior

1\. Connects to the specified leaf switch  
2\. Enters the interface configuration mode  
3\. Executes \`no shutdown\` on the interface  
4\. Verifies interface status using a show command  
5\. Displays the interface status output

**YOU CAN CHANGE THE HOST TO APPLY CHANGES ON DIFFERENT NETWORK DEVICES, FOLLOW MD FILES TO SEE VARIATION**

## Command to Run

ansible-playbook interface_up.yml

(OR PRESS RUN BUTTON ON TERMINAL)

## Expected Output

You should see:  
\- Successful task execution (failed=0)  
\- Interface state as \`connected\` or \`up\`  
 

Example output:  
Ethernet10 connected full 10G

## Success Criteria

\- Play recap shows failed=0  
\- Interface status confirms the link is UP  
\- Downstream connectivity is restored