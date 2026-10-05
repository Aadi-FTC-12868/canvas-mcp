# Architecture

This repository is the standalone [Canvas MCP application](https://github.com/Aadi-FTC-12868/canvas-mcp). It connects to an existing institution's Canvas account. The separate [Instructure Canvas LMS checkout](https://github.com/instructure/canvas-lms) supplies reference code and API documentation; it is not bundled into this service. Running a forked LMS would create a separate school platform, not attach the student's existing courses.

## Implemented in v2 alpha

A shared registry in `src/tools.ts` owns validated input schemas, handlers, descriptions, and annotations. The CLI and both MCP transports use that registry and the same Canvas client.

```text
CLI / MCP stdio / authenticated loopback HTTP
                    |
          typed tool registry
                    |
        credential-bound Canvas client
                    |
        configured institution API
```

There are 16 tools. They read Canvas data or local capability metadata; none modifies Canvas. `poll_course_updates` changes its local baseline and is annotated accordingly.

| Area | Tools |
| --- | --- |
| Account and course access | `get_profile`, `list_courses` |
| Assignments and course text | `get_assignments`, `get_assignment_detail`, `get_syllabus`, `get_announcements` |
| Course structure and pages | `list_modules`, `list_module_items`, `list_pages`, `get_page` |
| File metadata | `list_course_files`, `get_file` |
| Context and changes | `get_course_context`, `poll_course_updates` |
| Capability discovery | `describe_capabilities`, `search_api_catalog` |

The transport restricts authenticated requests to the configured Canvas origin and API paths, bounds pagination and response sizes, and reports incomplete reads as errors. Credentials come from the process environment and are never tool arguments. One process context represents one Canvas connection.

HTML is parsed as inert source material into text and a link manifest. Each linked material carries provider/access hints and remains `fetched: false`. File tools return metadata. Course context keeps successful sections when another section fails, marks omissions, and always reports `context_complete: false`; page bodies, file bytes, and other domains need separate retrieval.

The generated API inventory describes source-documented operations at a pinned Canvas revision. It is discovery metadata, not a full runtime mapping, a permission grant, or an arbitrary-request tool. Only the registered tools execute.

## Transport and change-feed boundaries

The alpha uses the **v1 MCP TypeScript SDK line**. `src/server.ts` registers tools; it does not advertise MCP 2.0 or MCP Events. The local HTTP launcher binds `127.0.0.1`, requires `MCP_LOCAL_SECRET`, rejects browser Origin headers and unexpected Host headers, and accepts POST requests at `/mcp`. It is a development transport, not hosted OAuth or a multiuser service.

The change feed reads assignments and announcements when called. A first successful poll establishes a silent baseline; later successful polls return changed resource IDs. Failures do not advance state. It keeps hashes, isolates client/course scopes, reports overflow, and never infers deletion from disappearance. A restart resets it. Separate CLI invocations also reset it, so delta polling requires a continuously running MCP server. There is no scheduler, durable queue, replay service, or notification delivery.

## Planned service boundary

```text
MCP client -> our OAuth resource server -> tool registry
                       |                       |
                linked-account store -> Canvas OAuth/API
                                               |
            provider adapters <- linked materials

scheduler / approved Canvas Live Events
                -> durable change outbox
                -> host-specific event delivery
```

School sign-in will use **our own registered OAuth developer key**, with institution-approved scopes and tested refresh behavior. A separate MCP-facing authorization layer will issue audience-bound service tokens while keeping Canvas tokens in the credential store. The first-party mobile QR workflow is not our registration mechanism. See [authentication research](authentication-and-events.md).

Google Drive, Microsoft, and LTI extraction will use independently authorized adapters. Canvas credentials must not follow external links. Resolution must distinguish available content, provider connection requirements, browser-only launches, and inaccessible material.

ChatGPT event delivery is a later adapter: current [OpenAI MCP Events documentation](https://developers.openai.com/plugins/build/mcp-events) defines eligible Work/Cloud surfaces and a protocol 2.0 webhook subscription contract. Supporting it requires protocol implementation, durable subscriptions/outbox storage, access rechecks, and callback validation. None of that is implemented or deployed in this alpha.

## Breaking changes from v1

This alpha is a major API change; existing client prompts and integrations need review.

| v1 behavior | v2 alpha behavior |
| --- | --- |
| `submit_assignment`, `upload_file`, `download_file` | Removed; there are no submission, upload, or file-byte download tools |
| `get_upcoming_deadlines` aggregate | Removed; select courses and inspect their assignments explicitly |
| `get_announcements` accepts optional course and a limit | Requires one `course_id`; no `limit` argument |
| `list_course_files` accepts `folder_path` | Course-level metadata listing; no folder-path argument |
| Assignment past-due filtering defaults off | `include_past_due` defaults to `true` |
| Broad enrollment-state strings | `active`, `invited_or_pending`, or `completed` |
| Bare arrays and flattened text fields | Named result objects, canonical source links, content manifests, and explicit completeness/access information |
| Flattened `due_date`, `submitted`, `score`, rubric text | Canvas-shaped `due_at`, nested submission data when available, rubric data, and extracted `content` |
| File results expose download URLs | Metadata and canonical links; no signed download URLs |

Unknown arguments and removed tool names fail explicitly. Inspect `canvas tools` for the exact current input schemas; do not assume v1 return shapes remain compatible.
