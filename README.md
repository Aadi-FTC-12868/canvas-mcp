# Canvas MCP

An open-source Canvas LMS integration for MCP clients and CLI agents. The v2 alpha is a working, local, read-only foundation with a source-derived map of the wider Canvas application.

**Status:** implemented and tested with synthetic data. Not yet live-tested against a school, deployed as a ChatGPT plugin, or equipped with hosted OAuth and background push delivery.

## Two repositories

- [canvas-mcp](https://github.com/Aadi-FTC-12868/canvas-mcp): this standalone TypeScript integration; shared by Codex, Claude and other contributors.
- [canvas-lms](https://github.com/Aadi-FTC-12868/canvas-lms): reference fork of the full Instructure application. No Rails installation is required to run this MCP.

Work for this alpha is on `codex/agent-platform-foundation`. The existing v1 remains on `main` until review. v2 intentionally changes response shapes and removes submission, upload, filesystem download and aggregate-deadline tools; see [migration notes](docs/architecture.md).

## Start locally

Requires Node.js 22 or newer. Python 3 is needed only to regenerate the source inventory.

```sh
git clone --branch codex/agent-platform-foundation https://github.com/Aadi-FTC-12868/canvas-mcp.git
cd canvas-mcp
npm ci --ignore-scripts
npm run build
npm test
```

Discovery and API-map search work without credentials:

```sh
node dist/cli.js tools
node dist/cli.js call describe_capabilities '{}'
node dist/cli.js call search_api_catalog '{"query":"assignments", "limit":5}'
```

For live reads, copy `.env.example` to `.env` and configure your own Canvas HTTPS origin and development token locally. Do not paste credentials into chat or tool arguments. The normal school-wide onboarding target is browser OAuth with an institution-approved developer key; that flow is planned, not implemented.

```sh
node dist/cli.js call get_profile '{}'
node dist/cli.js call get_course_context '{"course_id":"123"}'
```

## Connect an MCP client

Run `node /absolute/path/to/canvas-mcp/dist/index.js` as a stdio server. Use the client's secret/environment configuration for `CANVAS_BASE_URL` and `CANVAS_API_TOKEN`. Example configuration shape (replace the path and placeholders locally):

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["/absolute/path/to/canvas-mcp/dist/index.js"],
      "env": {
        "CANVAS_BASE_URL": "https://your-school.instructure.com",
        "CANVAS_API_TOKEN": "SET_LOCALLY_DO_NOT_COMMIT"
      }
    }
  }
}
```

Host-specific configuration locations differ. The portable server requires no LLM API key. Claude-specific packaging can be maintained in Claude against this shared contract.

A Streamable HTTP development endpoint is also available: set a separate random `MCP_LOCAL_SECRET` of at least 32 characters, then `npm run start:http`. It listens only at `http://127.0.0.1:3000/mcp`, requires `Authorization: Bearer <MCP_LOCAL_SECRET>`, and rejects browser origins. **Do not publicly proxy this single-user pilot.** See [ChatGPT integration requirements](integrations/chatgpt/README.md) for the separate hosted OAuth work.

## Implemented tools

| Area | Tools |
| --- | --- |
| Identity and courses | `get_profile`, `list_courses` |
| Assignment context | `get_assignments`, `get_assignment_detail`, `get_syllabus` |
| Announcements | `get_announcements` |
| Structure and pages | `list_modules`, `list_module_items`, `list_pages`, `get_page` |
| File metadata | `list_course_files`, `get_file` |
| Course map | `get_course_context` |
| Local change observation | `poll_course_updates` |
| Discovery | `describe_capabilities`, `search_api_catalog` |

All Canvas calls are reads. The polling tool updates local observation state, and its annotations reflect that. Lists either finish within limits or return an explicit error. Composite course context reports failures by section and always identifies itself as partial.

Descriptions retain linked-resource manifests: Google/Microsoft documents need their own authorized connector; LTI may need a browser; file metadata does not imply file contents were read. Returned source text is marked as untrusted material.

`poll_course_updates` establishes a silent first baseline, then reports changed assignments/announcements while the same server process remains alive. It does not run in the background, survive a restart, or wake ChatGPT. Separate CLI calls start fresh processes. Durable event ingestion, scheduling and host-specific delivery are the next layer.

## Canvas application map

The pinned reference revision is `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c`. The map contains **837 documented controller actions across 142 named API groups**, 1,365 static route records, 28 GraphQL query roots, 103 mutation roots, and 78 event definitions.

- [Application and domain map](docs/canvas-application-map.md)
- [Inventory summary and gaps](docs/generated/inventory-summary.md)
- [Machine-readable inventory](docs/generated/canvas-inventory.json)
- [Endpoint review worksheet](docs/generated/documented-endpoints.csv)
- [Integration architecture and migration](docs/architecture.md)
- [Authentication, QR login, events and licensing research](docs/authentication-and-events.md)
- [Implementation roadmap](docs/roadmap.md)

The inventory is not 837 implemented tools. Static analysis leaves 55 documented actions without a route match, 109 route records unresolved, and one unclassified API annotation. Some actions have no named group. Runtime plugins, conditions, roles, feature flags and deployed versions still need validation. Canvas's own Rails OpenAPI task is the planned runtime cross-check.

Regenerate deterministically from the reference checkout:

```sh
python3 scripts/inventory_canvas.py --source '/path/to/canvas-lms' --output docs/generated
```

## Testing and limits

`npm test` builds TypeScript and runs offline tests for credential isolation, pagination, rate limits, external-link handling, partial context, change detection, schema validation and real stdio/HTTP MCP handshakes. No live student data or credentials are in the fixtures. CI checks Node 22 and 24.

Defaults: 10 API pages / 1,000 items per list, 4 MiB per API response, 15-second request timeout, and 2 MiB per tool result. Course context shows at most 100 rows per section and fetches items from at most 10 modules. Every truncation is reported. Returned course text and links must not be treated as agent instructions.

## License and attribution

AGPL-3.0-only; see [LICENSE](LICENSE) and [NOTICE](NOTICE). The generated map comes from Instructure's AGPLv3 Canvas source and retains pinned source citations. This project is independently maintained and is not endorsed by Instructure, OpenAI or Anthropic.

Free distribution and credit alone do not replace license obligations. Before distribution or hosting, preserve the required notices and source availability and review dependency licenses. Open-sourcing this server does not authorize publishing private course data or third-party teaching materials.
