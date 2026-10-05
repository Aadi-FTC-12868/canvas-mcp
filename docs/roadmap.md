# Roadmap

The current milestone is a local, read-only **v2 alpha**. Items below describe implementation status, not a hosted launch or production-readiness claim.

## Delivered foundation

- A shared registry of 16 Canvas-read/context/discovery tools exposed through CLI and MCP stdio.
- An authenticated loopback HTTP development transport with one configured Canvas connection.
- Bounded Canvas reads, explicit failures, canonical provenance, inert HTML extraction, and linked-material manifests.
- A bounded course context map that reports blocked sections and unread material.
- A call-driven, in-memory assignment/announcement change feed with silent baselines and failure-safe updates.
- Source-derived API inventory/search, with a clear distinction between discovered operations and executable tools.
- Tests for transport and content boundaries, tool behavior, partial context, and change-feed state transitions.

## Next milestones

| Milestone | Completion evidence |
| --- | --- |
| Validate against a real account | Test enrolled courses, assignments, module items, page bodies, announcements, blocked resources, pagination, and token expiry; record omissions without storing private fixtures |
| Authorized file/provider extraction | Retrieve and extract supported Canvas files; add Google/Microsoft adapters with independent authorization; preserve provenance, size limits, and explicit LTI/browser gaps |
| School OAuth and multiuser service | Use our registered institution key; verify scopes, include-parameter permissions, SSO, refresh rotation, revocation, per-user isolation, and credential storage |
| ChatGPT registration and packaging | Deploy an authenticated reachable endpoint; implement discovery and approved callbacks; test linking and tool calls; package/register through the current host workflow |
| Durable monitoring and delivery | Persist subscriptions, snapshots, cursors, and an outbox; add scheduling and reconciliation; verify delivery, retry, deduplication, restart, expiry, and revoked-access behavior |
| Teacher/admin domain packs | Add explicit role-scoped tools with endpoint-specific tests; isolate any future writes behind separately designed action/approval contracts |

For ChatGPT monitoring, implement and test the [current MCP Events contract](https://developers.openai.com/plugins/build/mcp-events), including its supported protocol and surfaces. For institutional event input, [Canvas Live Events](https://developerdocs.instructure.com/services/canvas/data-services/live-events/overview/file.data_service_introduction) remains optional; polling and reconciliation are still needed. These are distinct integration layers.

The alpha has no hosted sign-in, deployed ChatGPT plugin, persistent monitor, or notification delivery. A local poll result is not evidence that any of those services exists.

## Migration before rollout

v2 removes v1 upload, submission, download, and deadline-aggregate tools and changes several inputs and response shapes. Existing integrations must migrate using the [architecture compatibility table](architecture.md#breaking-changes-from-v1). Do not restore writes merely to preserve v1 prompts; design and validate each action independently.

The source inventory can guide future coverage. An inventoried endpoint is not implemented, safe for every role, or available to every school. Mark new capabilities delivered only after their handler, authorization behavior, result contract, and tests exist.
