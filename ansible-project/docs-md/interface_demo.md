**Viewing the HTML Switch Report**

**Step 1: Generate Switch Summary**
ansible-playbook generate_switch_summary.yml

**Step 2: Serve the HTML Report**

python3 -m http.server 8000

Open the browser and view the generated switch summary.

Press **Ctrl + C** after viewing to stop the HTTP server.  
This is recommended before running the next demo to avoid port conflicts.

**Host-Based Interface Down - Simple Demo Flow**

**Step 3: Make interface down**
**Run interface down playbook  

**ansible-playbook interface_down.yml

- You may use variations as documented in the hosted Markdown files above.

**Step 4: Generate summary again**
**Generate switch summary again  
**ansible-playbook generate_switch_summary.yml

- python3 -m http.server 8000

**Expected Result**

- Only **leaf1** is affected (as defined in the current playbook)
- Other devices remain unchanged
- Interface state changes are clearly visible in the report

**Resetting the Lab (Interface UP)**

To restore the environment to its original state:

Run the **interface UP** playbook  
ansible-playbook interface_up.yml

- - Use the **same host and interface_name** as used in interface_down.yml

Regenerate switch summary  
ansible-playbook generate_switch_summary.yml

- python3 -m http.server 8000
- Verify that the interface is **UP** again

**Operational Notes**

- Always stop the Python HTTP server before running another report
- Multiple demos can be run using separate terminals if required
- The current setup is intentionally scoped to **leaf1** for safe experimentation
- Behavior can be modified using the documented host and interface variations