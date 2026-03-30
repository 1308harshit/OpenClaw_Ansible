# Ansible MCP Buddy - MongoDB History Feature Deployment Guide

## 📋 Summary of Changes

### New Features Added:
1. **MongoDB Integration** - Query history stored in MongoDB
2. **History Page** - View all past queries and responses at `/history`
3. **Navigation Buttons** - Easy navigation between main page and history
4. **Search Functionality** - Search through query history
5. **Statistics Dashboard** - Shows total queries and today's queries
6. **Title Update** - Changed from "MCP Buddy" to "Ansible MCP Buddy"

---

## 📁 Files Modified/Created

### 1. **frontend/.env** ✏️ MODIFIED
- Added: `MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@ansiblemcp.1ndutmu.mongodb.net/`
- This connects the app to your MongoDB Atlas cluster
- **IMPORTANT:** Replace USERNAME and PASSWORD with your actual MongoDB credentials

### 2. **frontend/package.json** ✏️ MODIFIED
- Added dependency: `"mongodb": "^6.3.0"`
- Required for MongoDB connection

### 3. **frontend/server.js** ✏️ MODIFIED
**New Functions:**
- `connectMongoDB()` - Establishes MongoDB connection on server start
- `saveQueryHistory(query, response)` - Saves each query/response to database

**New API Endpoints:**
- `GET /api/history` - Returns last 100 queries from MongoDB (sorted by newest first)
- `GET /history` - Serves the history HTML page

**Modified:**
- `POST /query` - Now saves query and response to MongoDB after processing
- `app.listen()` - Now calls `connectMongoDB()` on startup

**MongoDB Schema:**
```javascript
{
  query: String,        // User's input
  response: String,     // AI's response
  timestamp: Date,      // When query was made
  model: String,        // e.g., "gemini-2.5-flash"
  provider: String      // e.g., "GEMINI"
}
```

### 4. **frontend/public/index.html** ✏️ MODIFIED
- Changed title: "MCP Buddy" → "Ansible MCP Buddy"
- Changed h1: "MCP Buddy" → "Ansible MCP Buddy"
- Added "View History" button next to "Send" button
- Button styling: Purple background (#764ba2) to match theme

### 5. **frontend/public/app.js** ✏️ MODIFIED
- Added event listener for "View History" button
- Redirects to `/history` when clicked

### 6. **frontend/public/history.html** ✨ NEW FILE
**Features:**
- Clean, modern UI matching main page design
- Header with "Back to MCP Buddy" button
- Statistics dashboard showing:
  - Total queries count
  - Today's queries count
- Search bar with real-time filtering
- Query history cards showing:
  - Timestamp (in HKT timezone)
  - User query (in light gray box)
  - AI response (in dark code-style box)
- Responsive design
- Scrollable responses (max 400px height)

### 7. **frontend/public/history.js** ✨ NEW FILE
**Functions:**
- `loadHistory()` - Fetches history from `/api/history` endpoint
- `displayHistory(history)` - Renders history cards
- `updateStats(history)` - Updates total and today's query counts
- `formatTimestamp(timestamp)` - Converts to HKT timezone format
- `searchHistory()` - Filters history by search term
- `escapeHtml(text)` - Prevents XSS attacks

**Features:**
- Auto-loads history on page load
- Search filters both queries and responses
- Clear button resets search
- Enter key triggers search

---

## 🚀 Deployment Steps

### Step 1: Copy Files to Server
Copy these files from local to server:

```bash
# Local → Server file mappings:

D:\Freelancing\28-12-2025-Ansible\ansible-mcp-project\frontend\.env
→ /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/.env

D:\Freelancing\28-12-2025-Ansible\ansible-mcp-project\frontend\package.json
→ /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/package.json

D:\Freelancing\28-12-2025-Ansible\ansible-mcp-project\frontend\server.js
→ /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/server.js

D:\Freelancing\28-12-2025-Ansible\ansible-mcp-project\frontend\public\index.html
→ /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/public/index.html

D:\Freelancing\28-12-2025-Ansible\ansible-mcp-project\frontend\public\app.js
→ /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/public/app.js

D:\Freelancing\28-12-2025-Ansible\ansible-mcp-project\frontend\public\history.html
→ /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/public/history.html

D:\Freelancing\28-12-2025-Ansible\ansible-mcp-project\frontend\public\history.js
→ /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend/public/history.js
```

### Step 2: Install MongoDB Driver
SSH into server and run:
```bash
cd /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend
npm install
```

### Step 3: Restart Node.js Server
```bash
# Stop current server
pkill -f "node.*server.js"

# Start with new code
cd /home/ansible/NERD_clab_topologies/clos-medium/ansible-mcp-project/frontend
nohup node server.js > frontend.nohup.log 2>&1 &

# Verify it's running
ps aux | grep "node.*server.js" | grep -v grep

# Check logs for MongoDB connection
tail -f frontend.nohup.log
```

You should see:
```
Express frontend listening on http://0.0.0.0:8000
✅ Connected to MongoDB
```

---

## 🧪 Testing

### Test 1: Main Page
1. Visit: `http://100.30.182.96:8000/`
2. Verify title shows "Ansible MCP Buddy"
3. Verify "View History" button appears next to "Send"
4. Submit a test query
5. Verify response appears

### Test 2: History Page
1. Click "View History" button
2. Should redirect to: `http://100.30.182.96:8000/history`
3. Verify your test query appears in history
4. Verify timestamp shows HKT timezone
5. Verify statistics show correct counts

### Test 3: Search Functionality
1. On history page, type search term
2. Click "Search" or press Enter
3. Verify filtered results
4. Click "Clear" to reset

### Test 4: Navigation
1. On history page, click "← Back to MCP Buddy"
2. Should return to main page
3. Verify seamless navigation

### Test 5: MongoDB Connection
1. Check server logs: `tail -f frontend.nohup.log`
2. Should see: `✅ Connected to MongoDB`
3. If connection fails, history feature gracefully disables

---

## 🗄️ MongoDB Database Structure

**Database Name:** `ansible_mcp`
**Collection Name:** `query_history`

**Document Example:**
```json
{
  "_id": ObjectId("..."),
  "query": "List playbooks",
  "response": "Available playbooks:\n1. add_user.yml\n2. remove_user.yml\n...",
  "timestamp": ISODate("2026-03-28T15:30:00.000Z"),
  "model": "gemini-2.5-flash",
  "provider": "GEMINI"
}
```

---

## 🎨 UI/UX Features

### Main Page Changes:
- Title: "Ansible MCP Buddy"
- Two buttons side-by-side: "Send" (blue) and "View History" (purple)
- Clean, modern design maintained

### History Page Features:
- Purple gradient background (matches main page)
- White card container with rounded corners
- Statistics dashboard at top
- Search bar with filter functionality
- History cards with:
  - Timestamp in HKT
  - User query in light gray box
  - AI response in dark code-style box
  - Hover effect on cards
- Responsive design
- Scrollable long responses

---

## 🔧 Troubleshooting

### MongoDB Connection Issues:
**Symptom:** History page shows "History feature not available"
**Solution:** 
1. Check `.env` has correct `MONGODB_URI`
2. Verify MongoDB Atlas allows connections from server IP
3. Check server logs for connection errors

### History Not Saving:
**Symptom:** Queries work but don't appear in history
**Solution:**
1. Check MongoDB connection in logs
2. Verify `saveQueryHistory()` is called in `/query` endpoint
3. Check MongoDB Atlas for network access rules

### Page Not Loading:
**Symptom:** `/history` shows 404
**Solution:**
1. Verify `history.html` exists in `public/` folder
2. Restart Node.js server
3. Check server logs for errors

---

## 📊 Features Summary

| Feature | Status | URL |
|---------|--------|-----|
| Main MCP Interface | ✅ Working | http://100.30.182.96:8000/ |
| Query History Page | ✅ New | http://100.30.182.96:8000/history |
| MongoDB Storage | ✅ New | Atlas Cloud |
| Search History | ✅ New | /history page |
| Statistics Dashboard | ✅ New | /history page |
| Navigation Buttons | ✅ New | Both pages |
| HKT Timezone | ✅ Working | Both pages |
| Model Display | ✅ Working | Main page |

---

## 🎯 Next Steps (Optional Enhancements)

1. **Pagination** - Add pagination for history (currently limited to 100)
2. **Date Range Filter** - Filter history by date range
3. **Export History** - Download history as CSV/JSON
4. **Delete History** - Add button to clear old queries
5. **User Authentication** - Add login to track per-user history
6. **Analytics Dashboard** - Show charts/graphs of usage patterns

---

## ✅ Deployment Checklist

- [ ] Copy all 7 files to server
- [ ] Run `npm install` in frontend directory
- [ ] Verify `.env` has `MONGODB_URI`
- [ ] Stop old Node.js process
- [ ] Start new Node.js process
- [ ] Check logs for "✅ Connected to MongoDB"
- [ ] Test main page at http://100.30.182.96:8000/
- [ ] Test history page at http://100.30.182.96:8000/history
- [ ] Submit test query and verify it appears in history
- [ ] Test search functionality
- [ ] Test navigation buttons
- [ ] Verify statistics update correctly

---

**Version:** 2.0.0  
**Date:** March 28, 2026  
**MongoDB:** Atlas Cloud (ansiblemcp cluster)  
**Database:** ansible_mcp  
**Collection:** query_history
