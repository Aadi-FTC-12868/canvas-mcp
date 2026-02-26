# Canvas MCP Server

Connect Claude to your Canvas LMS. Once set up, Claude can read your courses, assignments, announcements, and syllabi — and even submit assignments and manage files — directly from Claude Desktop or Claude Code.

---

## What you need

- **Node.js 18 or later** — check with `node --version`, download from [nodejs.org](https://nodejs.org) if needed
- A **Canvas account** at your institution (any school that uses Canvas LMS)
- **Claude Desktop** or **Claude Code** (VS Code extension)

---

## Step 1 — Get your Canvas API token

1. Log in to your institution's Canvas (e.g. `https://yourschool.instructure.com`)
2. Click your **profile picture / avatar** in the top-left corner
3. Go to **Settings**
4. Scroll down to **Approved Integrations**
5. Click **+ New Access Token**
6. Give it a name like `Claude MCP` and click **Generate Token**
7. **Copy the token now** — Canvas will never show it again

> Your Canvas URL is the domain your school uses. If you log in at `canvas.university.edu`, that's your base URL.

---

## Step 2 — Install and build

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/canvas-mcp.git
cd canvas-mcp

# Install dependencies
npm install

# Build
npm run build
```

That's it. This creates `dist/index.js` which is the server Claude will run.

---

## Step 3 — Connect to Claude

You need to tell Claude where the server is and give it your token. Pick the client you use:

### Claude Desktop

Open (or create) this file:
```
~/Library/Application Support/Claude/claude_desktop_config.json        ← Mac
%APPDATA%\Claude\claude_desktop_config.json                            ← Windows
```

Add the `mcpServers` block. If the file already has content, merge it in:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["/absolute/path/to/canvas-mcp/dist/index.js"],
      "env": {
        "CANVAS_API_TOKEN": "your_token_here",
        "CANVAS_BASE_URL": "https://yourschool.instructure.com"
      }
    }
  }
}
```

Replace:
- `/absolute/path/to/canvas-mcp` → the folder where you cloned this repo (e.g. `/Users/yourname/canvas-mcp`)
- `your_token_here` → the token you copied in Step 1
- `https://yourschool.instructure.com` → your institution's Canvas URL

**Quit Claude Desktop fully and reopen it** after saving.

### Claude Code (VS Code)

Create or edit `~/.claude/mcp.json` (global, works in all projects):

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["/absolute/path/to/canvas-mcp/dist/index.js"],
      "env": {
        "CANVAS_API_TOKEN": "your_token_here",
        "CANVAS_BASE_URL": "https://yourschool.instructure.com"
      }
    }
  }
}
```

Then restart Claude Code (`Cmd+Shift+P` → "Claude Code: Restart").

---

## Step 4 — Verify it works

Ask Claude:

> "List my Canvas courses"

If everything is connected, Claude will call the `list_courses` tool and return your active courses.

---

## What Claude can do

| Ask Claude to... | Tool used |
|---|---|
| "List my courses" | `list_courses` |
| "What assignments are due this week?" | `get_upcoming_deadlines` |
| "Show me the assignments for Biology" | `get_assignments` |
| "What's the rubric for the essay?" | `get_assignment_detail` |
| "Any new announcements?" | `get_announcements` |
| "What's the syllabus for CS101?" | `get_syllabus` |
| "Submit my essay for assignment 456" | `submit_assignment` |
| "Upload this file to my course" | `upload_file` |
| "Download file ID 789" | `download_file` |
| "What files are in my course?" | `list_course_files` |

---

## Troubleshooting

**Claude doesn't seem to have Canvas tools**
- Make sure you fully quit and reopened Claude Desktop (not just closed the window)
- Double-check the path to `dist/index.js` is correct and absolute
- Make sure you ran `npm run build` — the `dist/` folder must exist

**"401 Unauthorized" error**
- Your token is invalid or expired — generate a new one in Canvas → Settings → Approved Integrations

**"403 Forbidden" error**
- Your token is valid but doesn't have access to that course or resource

**"404 Not Found" error**
- The course ID or assignment ID doesn't exist — use `list_courses` first to get valid IDs

**Wrong Canvas URL**
- Make sure `CANVAS_BASE_URL` matches your institution exactly (no trailing slash)
- Example: `https://canvas.university.edu` not `https://canvas.university.edu/`

**Node.js not found**
- Install Node.js 18+ from [nodejs.org](https://nodejs.org)
- On Mac with Homebrew: `brew install node`

**"Cannot find module" error**
- Run `npm install` then `npm run build` again from the `canvas-mcp` directory

---

## Security note

Your API token gives read/write access to your Canvas account. Keep it out of version control. Never paste it into a public place. The `dist/` folder and any `.env` files are excluded from this repo by `.gitignore`.
