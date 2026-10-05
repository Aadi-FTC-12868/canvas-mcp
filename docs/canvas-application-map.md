# Canvas LMS application and agent capability map

This map describes the upstream Canvas LMS source at commit `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c`. It separates what Canvas contains, what an agent integration could expose, and what still needs implementation or verification. It is a planning and discovery artifact, not a claim that every Canvas feature is available through an MCP server.

The accompanying `canvas-inventory.json` records 837 documented controller actions and 142 named API groups; 17 of those actions have no group annotation. There are 178 group annotations because multiple controllers share groups. One additional `@API` annotation cannot be confidently associated with a method and remains visible in diagnostics. The checked-in GraphQL schema has 28 query roots and 103 mutation roots; the Canvas Live Events directory contains 78 named event definitions. Regeneration is deterministic for a given checkout.

The static route matcher links 782 documented actions to at least one resolved route. It records 1,365 expanded route records from 1,194 declarations, including 109 unresolved records. Records are not unique public endpoints: aliases, multiple contexts, conditions, and undocumented routes are retained. The 55 unmatched documented actions and unresolved records are review work, not absent Canvas capabilities. See `inventory-summary.md` for every discovered group and unresolved action and `documented-endpoints.csv` for exact source links.

## Product boundary

Build a separate agent integration repository that consumes Canvas APIs. Keep the original Canvas fork as a pinned reference and optional test deployment. The Rails application is a large LMS with its own database, workers, frontend, institution configuration, and deployment concerns; most of that is unnecessary for a connector that reads an existing school's Canvas. A standalone client library can serve MCP, a CLI, ChatGPT, and Claude without copying the whole server into each integration.

Shared layers should be:

1. A Canvas connection: institution origin, signed-in identity, token storage, granted scopes, and detected capabilities.
2. A Canvas client: pagination, request limits, error normalization, string identifiers, safe redirects, retries, and provenance.
3. Domain operations: courses, course content, assessment, communication, people, and administration.
4. Context and change services: compose readable course context; report incomplete sources; normalize changes.
5. Delivery adapters: MCP tools/resources, CLI commands, and host-specific packaging or authentication bridges.

Host-specific packages should share domain behavior and return schemas. A second independent implementation for each host would multiply permission and correctness problems.

## Application layers in the source

| Layer | Source area | Agent integration implication |
| --- | --- | --- |
| Browser application | `ui/`, `app/views/`, `app/stylesheets/` | Useful for understanding workflows and terminology. UI routes are not automatically stable API contracts. |
| Rails request handling | `app/controllers/`, `config/routes.rb` | Controller documentation and authorization checks reveal public actions, parameters, and role boundaries. |
| Domain data | `app/models/`, `db/` | Models show relationships, state machines, tenant boundaries, and feature dependencies; the connector should not query a school's database directly. |
| REST serializers | `lib/api/v1/` | Response fields, visibility filtering, and content-specific transformations. |
| GraphQL | `app/graphql/`, `schema.graphql`, `app/controllers/graphql_controller.rb` | A second API surface; inspect query-specific permissions and deployment support. |
| Async execution | `lib/`, `app/models/`, `config/` | Exports, imports, reports, migrations, and other long-running actions may return progress handles. |
| Plugins | `gems/plugins/`, runtime route loading | A school's deployed capability surface may differ from the checked-out code. |
| API documentation | `doc/api/`, `lib/swagger_yard/` | Transport rules and an existing native OpenAPI generation path. |
| LTI integrations | `app/controllers/lti/`, `app/models/lti/`, `lib/lti/` | Service credentials and tool launches are separate from acting as a signed-in Canvas user. |
| Events | `app/observers/live_events_observer.rb`, `doc/api/data_services/` | Event delivery can trigger a fresh authorized API read, where available. |

Multi-tenancy is based on account hierarchies and user memberships; sharding adds deployment complexity. Treat the institution origin, user, account/course, and credential grant as parts of every cache and change-stream key. Never assume two different institutions' numeric identifiers refer to the same object.

## Distinct API and integration surfaces

| Surface | Evidence | Intended use and constraints |
| --- | --- | --- |
| User REST API | `ApiRouteSet::V1` in `config/routes.rb`; `doc/api/README.md` | Primary connector surface. OAuth bearer credentials and Canvas permissions apply. Many actions have course, user, group, section, or account variants. |
| GraphQL | `POST /api/graphql`; `schema.graphql` | Nested reads and capabilities not mirrored exactly by REST. Query roots and mutation roots are listed separately in the inventory. Do not count GraphQL fields as implemented MCP tools. |
| LTI services | `/api/lti`, `/api/lti/v1`; `doc/api/oauth.md` | Tool registration, Names and Roles, Assignment and Grade Services, asset processing, plagiarism, and notices. LTI tokens and launches are not an alternative general student API token. |
| SIS integration | `/api/sis`, SIS import controllers, `doc/api/sis_csv.md` | Institution provisioning and synchronization. Requires administrative integration scope and explicit supported workflows. |
| Browser/internal routes | Rails routes outside the documented API; unannotated API controllers | Internal UI, sessions, redirects, and feature-specific actions. Discovery evidence only until intentionally reviewed. |
| Live Events | `doc/api/data_services/` | Institution-managed event delivery over HTTPS webhooks or AWS SQS. It is not a universal personal webhook available to every student. |
| External tools and content | Module items, rich text links, collaborations, LTI launches | May require a separate provider's connection or a browser session. A Canvas URL alone does not grant access to the underlying document. |

Canvas already provides a native OpenAPI task in `lib/tasks/openapi.rake`. It loads runtime routes through `TokenScopes` and needs the Rails environment and a database. Once a Canvas development deployment is available, run its `doc:openapi` task in the web container and compare the resulting routes with this static inventory. The lightweight script is useful before that setup; it is not a replacement for runtime route resolution.

## Roles and capability boundaries

The source defines Student, Teacher, TA, Designer, and Observer enrollment types in `app/models/role.rb`. Account administrators and custom roles add a separate permission dimension. Course membership, section restrictions, enrollment state, dates, feature flags, OAuth scopes, and customized permissions can all narrow access. Role labels below are planning defaults; the server must enforce actual Canvas authorization and represent 401/403/404 results faithfully.

| Persona | Useful initial actions | Actions needing additional capability checks |
| --- | --- | --- |
| Student | Own profile, enrolled courses, published syllabus/pages/modules, assignments and due dates, own submissions/grades, announcements, calendar | Locked content, other users' submissions or grades, membership rosters, quiz details, submission changes, communication sends |
| Teacher / TA | Course content, assignments, discussions, enrolled users, submission review, grading workflows | Grade writes, publishing, due-date changes, accommodations, bulk actions, role-specific grading permissions |
| Designer | Content organization, pages, modules, imports and exports where allowed | Student records, grading, enrollment management, publishing rights |
| Observer | Linked learner and course context permitted by Canvas | Never treat observer access as unrestricted student impersonation; retrieve only authorized observee data |
| Account / institution admin | Account hierarchy, terms, users, roles, reporting, SIS, developer keys, institutional integrations | Tenant-wide exports, identity configuration, user creation/deletion, impersonation, event subscriptions, and secret management |
| External LTI tool | Its granted launches and service scopes | General Canvas user API access, arbitrary course/user data, unrelated provider resources |

`app/models/role_override.rb` and `lib/permissions.rb` are the source areas for granular permissions. A tool's argument should select the target course/user explicitly; the current user should be the default for personal read operations. A role inferred from one course cannot authorize actions in a different course.

## Domain map

All named API groups are listed in the generated summary. The following domain map relates them to agent workflows without pretending each controller group needs its own tool.

| Domain | Canvas objects and API families | Agent workflows | Boundary / sequencing |
| --- | --- | --- | --- |
| Identity and connection | Users, Logins, Access Tokens, API Token Scopes, Developer Keys, Authentication Providers, Communication Channels | Identify current user and institution; explain missing connection or permission | Connection foundation. Administration of identity is a separate privileged surface. |
| Institution structure | Accounts, Sections, Enrollment Terms, Enrollments, Admins, Roles, User Observees, Temporary Enrollment Pairings | Discover permitted courses and people; later support institution administration | Course/section/account membership is not interchangeable. |
| Course home and navigation | Courses, Tabs, Favorites, syllabus endpoints, Course Pace, Blackout Dates, History | Build course overview, syllabus context, current schedule, navigation | Read-first context backbone; observe effective dates and enrollment visibility. |
| Learning sequence | Modules, Module Items, prerequisites, requirements, mastery paths, overrides | Explain what to do next; relate pages, files and assignments to modules | Preserve typed item links and lock reasons; reading metadata must not silently mark work completed. |
| Pages and reusable content | Pages, Content Shares, Blueprint Courses, Content Migrations, Content Exports, ePub Exports, BlockEditorTemplate | Read learning materials; later create/edit content and import/export courses | HTML extraction is separate from mutation and publishing. Imports/exports may require async progress polling. |
| Files and media | Files, folders, Usage Rights, Media Objects, media tracks, document previews | Retrieve accessible file metadata, parse supported content, report missing text | Metadata availability does not mean byte download or extraction succeeded. Files may be locked or served on another host. |
| Work and due dates | Assignments, Assignment Groups, Extensions, Overrides, Learning Object Dates, Planner | Explain instructions and deadlines; assemble a work queue | Effective per-student dates matter more than a single course-wide due date. |
| Submissions and assessment | Submissions, Submission Comments, Peer Reviews, Moderated Grading, Rubrics, gradebook families, Late Policy, What If Grades | Read own work and feedback; later allow explicitly confirmed submissions and grading | Student records and grades require clear target identity. Grade writes and submissions are consequential actions. |
| Quizzes | Quizzes, questions/groups, reports/statistics, submissions/events, extensions, quiz-next aggregation | Discover quiz metadata and deadlines; later integrate supported quiz workflows | Classic and New Quizzes have different surfaces. Do not claim full New Quizzes internals from this repository alone. |
| Discussion and communication | Announcements, Discussion Topics, Conversations, Notification Preferences, Account Notifications, CommMessages | Read course news and discussions; later draft/send communication | Mark-read endpoints can change state. Sending messages is distinct from reading context. |
| Calendar and scheduling | Calendar Events, Appointment Groups, Account Calendars, Planner Notes/Overrides | Merge workload and appointments; later book/modify events | Preserve timezone, recurrence, and appointment availability; detect duplicates with assignment due dates. |
| Groups and collaboration | Groups, Group Categories, Collaborations, Conferences, Microsoft Sync | Group work context and collaboration links | Canvas metadata often points into another authenticated provider. |
| Outcomes and mastery | Outcomes, Outcome Groups, Outcome Results, Proficiency Ratings, LiveAssessments, Outcome Imports | Explain learning objectives and authorized progress | Results can contain student-specific records; account and course outcomes differ. |
| Discovery and personal utilities | Search, Smart Search, Bookmarks, Services, Poll families, ePortfolios | Find course content and user utilities | Feature availability and search coverage vary. Search result snippets are not the complete underlying document. |
| Institutional operations | SIS Imports/Errors/Integration, Account/Course Reports, Audit logs, Grade Change Log, Progress | Admin reporting and provisioning | Add only through separately reviewed administration workflows. |
| Platform configuration | Feature Flags, Brand Configs, Shared Brand Configs, CSP settings, Security, JWTs, InstAccess tokens, error reporting | Diagnose enabled features and approved configuration | Many endpoints are internal, privileged, or intentionally out of a student-first connector's scope. |
| Accessibility and newer experiences | Accessibility Course Scans/Statistics, Discovery Pages, AI Experiences/Conversations, Study Assist, Canvas Career | Future compatibility and accessibility context | Source presence is not evidence the user's institution enables the feature. |
| LTI platform | Registrations, Deployments, ContextControls, Resource Links, Dynamic Registration, Names and Roles, Line Items, Scores/Results, Asset Processor, Notices, Plagiarism, Data Services | Integrate properly registered external learning tools | Separate credentials, trust, scopes, and deployment lifecycle from the user REST connection. |

## Context assembly and linked resources

A useful course context response should be an evidence-bearing bundle, not a prose summary detached from its sources. Start with course identity and syllabus, then list modules and typed items, then the explicitly requested assignments, pages, announcements, files, and schedules. Include source URLs, object identifiers, timestamps, query bounds, pagination completion, and omitted or failed sections. Keep course content in a data field so model instructions found in imported documents are not confused with the user's request.

Canvas module items explicitly distinguish `File`, `Page`, `Discussion`, `Assignment`, `Quiz`, `SubHeader`, `ExternalUrl`, and `ExternalTool` in `app/controllers/context_module_items_api_controller.rb`. Preserve that type and fields such as `content_id`, `page_url`, `external_url`, and `html_url`. Follow Canvas objects through their API endpoints instead of assuming the browser URL is downloadable text. Rich-text bodies can also contain links and embedded iframes outside the module-item list.

Use an explicit resource resolution record:

```json
{
  "source_url": "https://docs.google.com/document/d/example/edit",
  "provider": "google_drive",
  "status": "requires_provider_connection",
  "text": null,
  "reason": "Canvas returned a link; document content has not been retrieved.",
  "next_action": "Connect the document provider or open the source with authorized access.",
  "discovered_in": {"type": "page", "course_id": "123", "id": "456"}
}
```

Plan statuses such as `resolved`, `metadata_only`, `locked`, `permission_denied`, `requires_provider_connection`, `requires_browser`, `unsupported_media`, `not_found`, and `fetch_failed`. The first implementation can detect and report a link without claiming to fetch its content. If a provider connection exists later, route to that provider under its own credentials. Never send a Canvas bearer token to Google, Microsoft, an LTI tool, or an arbitrary destination.

For Canvas files, `app/controllers/files_controller.rb` documents `content-type`, download `url`, `locked_for_user`, `lock_explanation`, and user-specific preview URLs. Download and text extraction need separate limits and validation: supported MIME types, size limits, redirect handling, malware/active-content isolation where appropriate, and a visible partial-result state. An HTML login page must not be reported as the text of the requested PDF.

Reading context should not automatically complete a module, change notification preferences, or mark items read. The source has a separate `mark_item_read` action that satisfies a module's view requirement. This is a product action, not ordinary context retrieval.

## Notifications and changes

There are three independent layers:

1. Detect a change in Canvas using authorized polling or an institution-enabled Live Events feed.
2. Normalize and persist a change record with user/tenant isolation, deduplication, source time, receipt time, and cursor/checkpoint state.
3. Deliver it using capabilities the agent host actually supports. An MCP server being online does not imply it can wake any arbitrary assistant or create a user-visible notification.

Start with bounded polling for assignments and announcements. A first snapshot establishes a baseline; it must not claim every existing assignment is new. A disappearance must not be called a deletion until the fetch is complete and visibility changes are understood. Restart behavior, durable storage, multiple connections, and scheduled execution are separate milestones. An in-memory diff only works during that process lifetime.

Canvas's Live Events introduction says delivery can use HTTPS webhooks or AWS SQS and recommends the regular API for data needing the freshest state. Treat events as signals to fetch the latest permitted object, not as a complete replacement for authorization or the API. The 78 event definitions are discoverable candidates, not proof a student's token can subscribe. Notification Preferences controls Canvas's own preferences; it is not a generic agent callback registration API. LTI plagiarism subscriptions and LTI notices have their own specialized purposes.

## Delivery sequence and completion criteria

| Stage | Concrete deliverable | Completion evidence |
| --- | --- | --- |
| Source foundation | Separate connector repository, source inventory, architecture decisions, upstream/license provenance | Regeneratable artifacts pinned to a commit; no changes to upstream app behavior |
| Personal context MVP | Profile, courses, syllabus, assignments, announcements, modules/items, pages, file metadata, linked-resource reports | Tool tests with mocked pagination/error cases plus one explicitly authorized real account test |
| Robust context | Supported file extraction, course graph, schedules, own submissions/feedback, durable caching | Per-resource completeness and access status; no silent skipped links; deadline/timezone fixtures |
| Change service | Persistent user-isolated cursors, polling scheduler, optional institution event ingestion, delivery adapter | Restart/replay/deduplication tests and observed host notification behavior |
| Institution onboarding | Supported OAuth configuration and admin setup guide, connection health, scoped capabilities | Successful login/refresh/revoke with an institution-approved developer key |
| Host packaging | General MCP, ChatGPT connection package, Claude connection package, CLI | Each target host installs/connects successfully against shared domain behavior |
| Teacher/admin expansion | Explicit reviewed capabilities and workflows | Permission matrices, preview/confirmation for consequential writes, auditability, deployment tests |
| Broad surface coverage | Incremental implementation of the generated domain backlog | Inventory coverage tracks implemented/tested tools separately from discovered source operations |

Keep tool discovery selective. Exposing hundreds of raw REST actions at once would make the model choose poorly and hide authorization distinctions. Searchable API inventory is useful documentation; it must not provide unrestricted arbitrary URL execution. High-level tools should express stable user tasks with typed inputs and documented limits.

## Source references

All links below are pinned to the mapped commit:

- [Controller routes](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/config/routes.rb)
- [ApiRouteSet implementation](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/lib/api_route_set.rb)
- [REST API conventions](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/doc/api/README.md)
- [Pagination](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/doc/api/pagination.md) and [throttling](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/doc/api/throttling.md)
- [OAuth user and LTI flows](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/doc/api/oauth.md)
- [GraphQL schema](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql)
- [Roles](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/models/role.rb) and [permission definitions](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/lib/permissions.rb)
- [Module item variants and view-requirement action](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/context_module_items_api_controller.rb)
- [File metadata and download behavior](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/files_controller.rb)
- [Classic/New Quizzes aggregation](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/quizzes_next/quizzes_api_controller.rb)
- [Live Events introduction](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/doc/api/data_services/md/static/data_service_introduction.md) and [subscription setup](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/doc/api/data_services/md/static/data_service_setup.md)
- [Native OpenAPI generator task](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/lib/tasks/openapi.rake) and [route/documentation adapter](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/lib/swagger_yard/canvas_adapter.rb)

This map is about software behavior and implementation scope. Licensing and distribution obligations should be recorded separately; whether a project charges money does not determine whether license requirements apply.
