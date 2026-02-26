# Canvas MCP Server

A Model Context Protocol (MCP) server that connects Claude to the Canvas LMS REST API. Once configured, Claude can list your courses, read assignments and announcements, view syllabi, check upcoming deadlines, submit assignments, and manage course files — all from within Claude Code or Claude Desktop.

---

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- A **Canvas API access token** for your institution

---

## Getting a Canvas API Token

1. Log in to Canvas at `https://imsa.instructure.com`
2. Click your **account icon** in the top-left sidebar
3. Go to **Settings**
4. Scroll down to **Approved Integrations** and click **+ New Access Token**
5. Give it a name (e.g. "Claude MCP") and optionally an expiry date
6. Click **Generate Token** and copy the token — you won't see it again

---

## Setup

### 1. Install dependencies

```bash
cd canvas-mcp
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and paste your Canvas API token:

```
CANVAS_API_TOKEN=your_token_here
CANVAS_BASE_URL=https://imsa.instructure.com
```

### 3. Build the server

```bash
npm run build
```

This compiles TypeScript to `dist/index.js`.

### 4. (Optional) Run in dev mode

```bash
npm run dev
```

Uses `tsx` to run without a build step — useful during development.

---

## Configuring in Claude Code

### Option A: Project-level config (recommended)

Create or edit `.claude/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["/absolute/path/to/canvas-mcp/dist/index.js"],
      "env": {
        "CANVAS_API_TOKEN": "your_token_here",
        "CANVAS_BASE_URL": "https://imsa.instructure.com"
      }
    }
  }
}
```

Replace `/absolute/path/to/canvas-mcp` with the actual path on your machine (e.g. `/Users/yourname/canvas-mcp`).

### Option B: Global Claude Code config

Add the same JSON block to the global MCP config file. Find it by running:

```bash
claude mcp list
```

Or edit it directly at `~/.claude/mcp.json` (create if it doesn't exist).

### Restarting Claude Code

After editing the config, restart Claude Code to pick up the new MCP server:

- In VS Code: Run the **"Claude Code: Restart"** command (`Cmd+Shift+P`)
- Or quit and reopen Claude Code entirely

### Verifying the connection

Once restarted, ask Claude:

> "List my Canvas courses"

If the server is connected, Claude will use the `list_courses` tool and return your active courses.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `list_courses` | List all active courses with IDs, names, codes, and terms |
| `get_assignments` | Get assignments for a course (with optional past-due filter) |
| `get_assignment_detail` | Get full details for a single assignment including rubric |
| `get_announcements` | Get recent announcements for one or all courses |
| `get_syllabus` | Get the course syllabus as plain text |
| `submit_assignment` | Submit an assignment via text entry or file upload |
| `upload_file` | Upload a local file to a course's files area |
| `download_file` | Download a Canvas file to your local machine |
| `list_course_files` | List files in a course (optionally filtered by folder) |
| `get_upcoming_deadlines` | Get sorted upcoming deadlines across all courses |

---

## Troubleshooting

**"CANVAS_API_TOKEN environment variable is required"**
- Make sure your `.env` file exists and contains `CANVAS_API_TOKEN=...`
- Or set the token directly in the MCP config `env` block

**"Canvas API token may be invalid or expired (401)"**
- Generate a new token in Canvas → Account → Settings → New Access Token

**"You do not have permission (403)"**
- The token is valid but doesn't have access to that resource
- Check if the course is restricted or if your role grants API access

**"The requested Canvas resource was not found (404)"**
- Double-check the course ID or assignment ID
- Use `list_courses` to get valid course IDs first

**Rate limited**
- The client automatically retries with exponential backoff
- If it persists, wait a minute and try again

**Course not appearing in `list_courses`**
- By default only `active` enrollments are returned
- Pass `enrollment_state: "current_and_future"` to include upcoming courses

**TypeScript build errors**
- Make sure you're using Node.js 18+: `node --version`
- Run `npm install` again to ensure all dependencies are present
