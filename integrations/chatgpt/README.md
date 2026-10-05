# ChatGPT integration status

**This alpha is not a deployed ChatGPT plugin.** It provides shared tools, MCP stdio, and a loopback HTTP development endpoint. The latter uses a local bearer secret for one configured Canvas connection. It has no hosted OAuth linking, multiuser credential store, public registration, or MCP Events implementation.

The HTTP launcher is intended for a local MCP client or inspector. Starting `npm run start:http` does not make a remote ChatGPT connection available. Do not expose that development server as a multiuser endpoint.

## Planned connection flow

1. Deploy a service with an MCP-facing authorization server and an isolated linked-account store.
2. Let the user link their school through **our own Canvas OAuth registration**. Bind school origin, Canvas user, permitted scopes, and refreshed credentials to the service identity. The first-party mobile QR workflow is not a replacement for registration.
3. Implement the current [OpenAI authentication contract](https://developers.openai.com/plugins/build/auth). Use its discovery, PKCE, audience checks, and exact management-page callback requirements. Keep upstream Canvas tokens behind the broker.
4. Package and register the service using [OpenAI's connect-and-test workflow](https://developers.openai.com/plugins/deploy/connect-chatgpt). Verify account linking and tool calls before describing the integration as installed. Publication is a separate step.
5. Exercise the same 16 tool handlers exposed locally. Preserve unread-material and partial-context markers in responses; a returned link is not a fetched document.

See [architecture](../../docs/architecture.md) and [authentication and events research](../../docs/authentication-and-events.md) for implementation boundaries and source evidence.

## Notifications require a separate milestone

Current [OpenAI documentation supports MCP Events](https://developers.openai.com/plugins/build/mcp-events); this repository's v1 SDK-based server does not implement that protocol. The planned bridge is:

```text
Canvas polling / approved institutional event stream
          -> normalized durable outbox
          -> authorized MCP event subscriptions
          -> supported ChatGPT destination
```

Persist subscription ownership, filters, delivery state, and replay cursors. Verify callbacks, sign deliveries, bound retries, and stop after access is revoked. Confirm host eligibility and protocol compatibility during registration. A successful `poll_course_updates` call only compares the current process's snapshots; it does not create a ChatGPT subscription or notification.

The first implementation should keep the existing read tools usable by other MCP clients while adding ChatGPT-specific event delivery behind a separately tested adapter. Provider content retrieval likewise remains an independent feature requiring the user's Google, Microsoft, or tool-provider access.
