# Canvas source inventory

Pinned upstream: `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c` from [https://github.com/instructure/canvas-lms](https://github.com/instructure/canvas-lms).

Generated without booting Rails or contacting a live institution. Counts describe source evidence, not delivered MCP tools.

| Metric | Count |
| --- | ---: |
| api group annotations | 178 |
| distinct api groups | 142 |
| documented operations | 837 |
| matched documented operations | 782 |
| route declarations | 1194 |
| expanded route records | 1365 |
| resolved static route records | 1256 |
| unresolved route records | 109 |
| route records without api annotation | 299 |
| unclassified api annotations | 1 |
| graphql query fields | 28 |
| graphql mutation fields | 103 |
| canvas event types | 78 |

## Coverage limits

- This is a source inventory, not implemented MCP tools or a live API contract.
- Controller @API tags and checked-in GraphQL schema are scanned exhaustively within the listed source roots.
- Route matching statically handles explicit verb declarations within ApiRouteSet blocks, controller scopes, simple %w loops, and tuple %w loops. It does not execute Ruby.
- Computed path prefixes, resources/concerns, route-generating helper methods, plugins loaded at runtime, conditions, and arbitrary interpolation require runtime validation; unresolved records remain in diagnostics.
- Even resolved static routes may depend on feature flags, deployment version, permissions, installed plugins, and account configuration.
- HTTP verbs do not prove read-only semantics; some GET actions mutate state. Review each tool's controller before exposing it.
- Undocumented routes are not assumed public or stable. LTI uses a separate authorization and service model.
- GraphQL field existence does not imply REST parity, universal role access, or a stable endpoint in a different Canvas deployment.
- The authoritative next step is Canvas's doc:openapi task inside its configured web container, with its Rails environment and database available.

## Documented capability groups

All discovered group names appear below. Role eligibility must be checked at runtime; group names are not permission grants.

| Group | Documented actions | Statically matched | Controllers |
| --- | ---: | ---: | --- |
| (Ungrouped source annotations) | 17 | 17 | `canvadoc_sessions`, `course_pacing/pace_contexts_api`, `gradebooks`, `learning_mastery_gradebook_settings_api`, `lmgb_user_details`, `quizzes_next/quizzes_api`, `support_helpers/asset_processor`, `support_helpers/plagiarism_platform`, `syllabus_api`, `web_zip_exports` |
| AI Conversations | 8 | 8 | `ai_conversations` |
| AI Experiences | 9 | 9 | `ai_experiences` |
| API Token Scopes | 1 | 1 | `scopes_api` |
| Access Tokens | 5 | 5 | `tokens` |
| Accessibility Course Scans | 1 | 1 | `accessibility_course_scans` |
| Accessibility Course Statistics | 1 | 1 | `accessibility_course_statistics` |
| Account Calendars | 6 | 6 | `account_calendars_api` |
| Account Notifications | 5 | 5 | `account_notifications` |
| Account Reports | 6 | 6 | `account_reports` |
| Accounts | 21 | 21 | `accounts`, `sub_accounts` |
| Accounts (LTI) | 1 | 1 | `lti/account_external_tools`, `lti/account_lookup` |
| Admins | 4 | 4 | `admins` |
| Announcement External Feeds | 3 | 3 | `external_feeds` |
| Announcements | 1 | 1 | `announcements_api` |
| Appointment Groups | 8 | 8 | `appointment_groups` |
| Assessment Question Banks | 3 | 3 | `assessment_question_banks` |
| Asset Processor | 4 | 4 | `lti/ims/asset_processor`, `lti/ims/asset_processor_eula` |
| Assignment Extensions | 1 | 1 | `assignment_extensions` |
| Assignment Groups | 5 | 1 | `assignment_groups`, `assignment_groups_api` |
| Assignments | 19 | 19 | `assignment_overrides`, `assignments`, `assignments_api` |
| Authentication Providers | 8 | 8 | `authentication_providers` |
| Authentications Log | 3 | 3 | `authentication_audit_api` |
| Blackout Dates | 7 | 7 | `blackout_dates` |
| BlockEditorTemplate | 1 | 1 | `block_editor_templates_api` |
| Blueprint Courses | 13 | 13 | `master_courses/master_templates` |
| Bookmarks | 5 | 5 | `bookmarks/bookmarks` |
| Brand Configs | 2 | 2 | `brand_configs_api` |
| Calendar Events | 11 | 11 | `calendar_events_api` |
| Canvas Career Experiences | 4 | 4 | `career_experience` |
| Collaborations | 3 | 3 | `collaborations` |
| CommMessages | 1 | 1 | `comm_messages_api` |
| Communication Channels | 4 | 4 | `communication_channels` |
| Conferences | 2 | 1 | `conferences` |
| Content Exports | 3 | 0 | `content_exports_api` |
| Content Migrations | 10 | 10 | `content_migrations`, `migration_issues` |
| Content Security Policy Settings | 6 | 6 | `csp_settings` |
| Content Shares | 7 | 7 | `content_shares` |
| Conversations | 13 | 13 | `conversations` |
| Course Audit log | 2 | 2 | `course_audit_api` |
| Course Pace | 4 | 4 | `course_paces` |
| Course Quiz Extensions | 1 | 1 | `quizzes/course_quiz_extensions` |
| Course Reports | 3 | 3 | `course_reports` |
| Courses | 29 | 29 | `content_imports`, `courses` |
| Custom Gradebook Columns | 8 | 1 | `custom_gradebook_column_data_api`, `custom_gradebook_columns_api` |
| Data Services | 5 | 5 | `lti/data_services` |
| Developer Key Account Bindings | 1 | 1 | `developer_key_account_bindings` |
| Developer Keys | 5 | 5 | `developer_keys` |
| Discovery Pages | 3 | 3 | `discovery_pages_api` |
| Discussion Topics | 29 | 29 | `discussion_entries`, `discussion_topics`, `discussion_topics_api` |
| Enrollment Terms | 5 | 5 | `terms`, `terms_api` |
| Enrollments | 11 | 11 | `enrollments_api` |
| Error Reports | 1 | 1 | `errors` |
| External Tools | 12 | 12 | `external_tools` |
| Favorites | 8 | 8 | `favorites` |
| Feature Flags | 6 | 1 | `feature_flags` |
| Files | 24 | 20 | `files`, `folders`, `usage_rights` |
| Grade Change Log | 5 | 5 | `grade_change_audit_api` |
| Gradebook History | 4 | 4 | `gradebook_history_api` |
| Grading Period Sets | 4 | 4 | `grading_period_sets` |
| Grading Periods | 5 | 5 | `grading_periods` |
| Grading Standards | 5 | 5 | `grading_standards_api` |
| Group Categories | 13 | 10 | `group_categories` |
| Groups | 20 | 12 | `group_memberships`, `groups` |
| History | 1 | 1 | `history` |
| InstAccess tokens | 1 | 1 | `inst_access_tokens` |
| JWTs | 2 | 2 | `jwts` |
| LTI 2 Authorization | 1 | 0 | `lti/ims/authorization` |
| LTI Advantage Feature Flags | 1 | 0 | `lti/feature_flags` |
| LTI ContextControls | 6 | 6 | `lti/context_controls` |
| LTI Deployments | 5 | 5 | `lti/deployments` |
| LTI Dynamic Registrations | 2 | 2 | `lti/ims/dynamic_registration` |
| LTI Launch Definitions | 1 | 1 | `lti/lti_apps` |
| LTI Registrations | 20 | 20 | `lti/registrations` |
| LTI Resource Links | 6 | 6 | `lti/resource_links` |
| Late Policy | 3 | 3 | `late_policy` |
| Learning Object Dates | 2 | 2 | `learning_object_dates` |
| Line Items | 5 | 5 | `lti/ims/line_items` |
| LiveAssessments | 4 | 4 | `live_assessments/assessments`, `live_assessments/results` |
| Logins | 5 | 5 | `pseudonyms` |
| Media Objects | 4 | 4 | `media_objects`, `media_tracks` |
| Microsoft Sync - Groups | 0 | 0 | `microsoft_sync/groups` |
| Moderated Grading | 7 | 7 | `anonymous_provisional_grades`, `moderation_set`, `provisional_grades` |
| Modules | 17 | 17 | `context_module_items_api`, `context_modules_api`, `module_assignment_overrides` |
| Names and Role | 2 | 2 | `lti/ims/names_and_roles` |
| Notice Handlers | 2 | 2 | `lti/ims/notice_handlers` |
| Notification Preferences | 6 | 6 | `notification_preferences` |
| Originality Reports | 3 | 3 | `lti/originality_reports_api` |
| Outcome Groups | 12 | 0 | `outcome_groups_api` |
| Outcome Imports | 3 | 3 | `outcome_imports_api` |
| Outcome Results | 6 | 6 | `outcome_results` |
| Outcomes | 3 | 3 | `outcomes_api` |
| Pages | 11 | 11 | `wiki_pages_api` |
| Peer Reviews | 4 | 4 | `peer_reviews_api` |
| Plagiarism Detection Platform Assignments | 1 | 1 | `lti/plagiarism_assignments_api` |
| Plagiarism Detection Platform Users | 2 | 2 | `lti/users_api` |
| Plagiarism Detection Submissions | 2 | 2 | `lti/submissions_api` |
| Planner | 12 | 12 | `planner`, `planner_notes`, `planner_overrides` |
| Poll Sessions | 9 | 9 | `polling/poll_sessions` |
| PollChoices | 5 | 5 | `polling/poll_choices` |
| PollSubmissions | 2 | 2 | `polling/poll_submissions` |
| Polls | 5 | 5 | `polling/polls` |
| Proficiency Ratings | 2 | 2 | `outcome_proficiency_api` |
| Progress | 3 | 3 | `lti/ims/progress`, `progress` |
| Public JWK | 1 | 1 | `lti/public_jwk` |
| Quiz Assignment Overrides | 2 | 2 | `quizzes/quiz_assignment_overrides` |
| Quiz Extensions | 1 | 1 | `quizzes/quiz_extensions` |
| Quiz IP Filters | 1 | 1 | `quizzes/quiz_ip_filters` |
| Quiz Question Groups | 6 | 6 | `quizzes/quiz_groups` |
| Quiz Questions | 5 | 5 | `quizzes/quiz_questions` |
| Quiz Reports | 4 | 4 | `quizzes/quiz_reports` |
| Quiz Statistics | 1 | 1 | `quizzes/quiz_statistics` |
| Quiz Submission Events | 2 | 2 | `quizzes/quiz_submission_events_api` |
| Quiz Submission Files | 1 | 1 | `quizzes/quiz_submission_files` |
| Quiz Submission Questions | 5 | 5 | `quizzes/quiz_submission_questions` |
| Quiz Submission User List | 1 | 1 | `quizzes/quiz_submission_users` |
| Quiz Submissions | 7 | 7 | `quizzes/quiz_submissions_api` |
| Quizzes | 7 | 7 | `quizzes/quizzes_api` |
| Result | 2 | 2 | `lti/ims/results` |
| Roles | 9 | 9 | `permissions_help`, `role_overrides` |
| Rubrics | 15 | 15 | `rubric_assessment_imports`, `rubric_assessments`, `rubric_associations`, `rubrics`, `rubrics_api` |
| SIS Import Errors | 1 | 1 | `sis_import_errors_api` |
| SIS Imports | 7 | 7 | `sis_imports_api` |
| SIS Integration | 2 | 2 | `disable_post_to_sis_api`, `sis_api` |
| Score | 1 | 1 | `lti/ims/scores` |
| Search | 2 | 2 | `search` |
| Sections | 8 | 8 | `sections` |
| Security | 1 | 1 | `security` |
| Services | 2 | 2 | `services_api` |
| Shared Brand Configs | 3 | 3 | `shared_brand_configs` |
| Smart Search | 1 | 1 | `smart_search` |
| Study Assist | 1 | 1 | `study_assist` |
| Submission Comments | 3 | 3 | `submission_comments_api` |
| Submissions | 21 | 21 | `submissions`, `submissions_api` |
| Tabs | 2 | 2 | `tabs` |
| Temporary Enrollment Pairings | 5 | 5 | `temporary_enrollment_pairings_api` |
| Tool Configuration API | 4 | 4 | `lti/tool_configurations_api` |
| User Observees | 8 | 8 | `observer_pairing_codes_api`, `user_observees` |
| Users | 45 | 42 | `course_nicknames`, `custom_data`, `page_views`, `profile`, `users` |
| Webhooks Subscriptions for Plagiarism Platform | 5 | 5 | `lti/subscriptions_api` |
| What If Grades | 2 | 2 | `what_if_grades_api` |
| ePortfolios | 7 | 7 | `eportfolios_api` |
| ePub Exports | 3 | 0 | `epub_exports` |

## Documented actions needing route review

- [assignment_groups_api#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/assignment_groups_api_controller.rb#L28): Get an Assignment Group
- [assignment_groups_api#create](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/assignment_groups_api_controller.rb#L67): Create an Assignment Group
- [assignment_groups_api#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/assignment_groups_api_controller.rb#L99): Edit an Assignment Group
- [assignment_groups_api#destroy](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/assignment_groups_api_controller.rb#L138): Destroy an Assignment Group
- [conferences#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/conferences_controller.rb#L173): List conferences
- [content_exports_api#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/content_exports_api_controller.rb#L91): List content exports
- [content_exports_api#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/content_exports_api_controller.rb#L107): Show content export
- [content_exports_api#create](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/content_exports_api_controller.rb#L119): Export content
- [custom_data#set_data](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_data_controller.rb#L27): Store custom data
- [custom_data#get_data](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_data_controller.rb#L232): Load custom data
- [custom_data#delete_data](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_data_controller.rb#L270): Delete custom data
- [custom_gradebook_column_data_api#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_gradebook_column_data_api_controller.rb#L46): List entries for a column
- [custom_gradebook_column_data_api#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_gradebook_column_data_api_controller.rb#L73): Update column data
- [custom_gradebook_columns_api#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_gradebook_columns_api_controller.rb#L69): List custom gradebook columns
- [custom_gradebook_columns_api#create](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_gradebook_columns_api_controller.rb#L96): Create a custom gradebook column
- [custom_gradebook_columns_api#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_gradebook_columns_api_controller.rb#L117): Update a custom gradebook column
- [custom_gradebook_columns_api#destroy](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_gradebook_columns_api_controller.rb#L128): Delete a custom gradebook column
- [custom_gradebook_columns_api#reorder](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/custom_gradebook_columns_api_controller.rb#L143): Reorder custom columns
- [epub_exports#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/epub_exports_controller.rb#L114): List courses with their latest ePub export
- [epub_exports#create](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/epub_exports_controller.rb#L134): Create ePub Export
- [epub_exports#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/epub_exports_controller.rb#L162): Show ePub export
- [feature_flags#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/feature_flags_controller.rb#L142): List features
- [feature_flags#enabled_features](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/feature_flags_controller.rb#L179): List enabled features
- [feature_flags#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/feature_flags_controller.rb#L223): Get feature flag
- [feature_flags#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/feature_flags_controller.rb#L254): Set feature flag
- [feature_flags#delete](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/feature_flags_controller.rb#L341): Remove feature flag
- [files#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/files_controller.rb#L653): Download file
- [group_categories#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_categories_controller.rb#L190): Get a single group category
- [group_categories#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_categories_controller.rb#L559): Update a Group Category
- [group_categories#destroy](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_categories_controller.rb#L640): Delete a Group Category
- [group_memberships#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_memberships_controller.rb#L82): List group memberships
- [group_memberships#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_memberships_controller.rb#L113): Get a single group membership
- [group_memberships#create](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_memberships_controller.rb#L134): Create a membership
- [group_memberships#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_memberships_controller.rb#L247): Update a membership
- [group_memberships#destroy](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/group_memberships_controller.rb#L284): Leave a group
- [groups#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/groups_controller.rb#L510): Get a single group
- [groups#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/groups_controller.rb#L717): Edit a group
- [groups#destroy](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/groups_controller.rb#L841): Delete a group
- [lti/feature_flags#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/lti/feature_flags_controller.rb#L53): Show the specified feature flag
- [lti/ims/authorization#authorize](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/lti/ims/authorization_controller.rb#L88): authorize
- [outcome_groups_api#redirect](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L149): Redirect to root outcome group for context
- [outcome_groups_api#index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L165): Get all outcome groups for context
- [outcome_groups_api#link_index](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L176): Get all outcome links for context
- [outcome_groups_api#show](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L214): Show an outcome group
- [outcome_groups_api#update](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L225): Update an outcome group
- [outcome_groups_api#destroy](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L295): Delete an outcome group
- [outcome_groups_api#outcomes](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L333): List linked outcomes
- [outcome_groups_api#link](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L405): Create/link an outcome
- [outcome_groups_api#unlink](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L556): Unlink an outcome
- [outcome_groups_api#subgroups](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L589): List subgroups
- [outcome_groups_api#create](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L613): Create a subgroup
- [outcome_groups_api#import](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/outcome_groups_api_controller.rb#L663): Import an outcome group
- [usage_rights#set_usage_rights](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/usage_rights_controller.rb#L89): Set usage rights
- [usage_rights#remove_usage_rights](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/usage_rights_controller.rb#L126): Remove usage rights
- [usage_rights#licenses](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/app/controllers/usage_rights_controller.rb#L143): List licenses

## GraphQL entry points

### Mutation

[`acceptEnrollmentInvitation`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7199), [`addConversationMessage`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7205), [`applyInstitutionalTag`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7211), [`autoGradeSubmission`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7217), [`createAccountDomainLookup`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7223), [`createAllocationRule`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7229), [`createAssignment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7235), [`createCommentBankItem`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7241), [`createConversation`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7247), [`createDiscussionEntry`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7253), [`createDiscussionTopic`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7259), [`createGroupInSet`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7265), [`createGroupSet`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7271), [`createInstitutionalTag`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7277), [`createInstitutionalTagCategory`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7283), [`createInternalSetting`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7289), [`createLearningOutcome`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7295), [`createLearningOutcomeGroup`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7301), [`createModule`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7307), [`createOutcomeCalculationMethod`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7313), [`createOutcomeProficiency`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7319), [`createSubmission`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7329), [`createSubmissionComment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7335), [`createSubmissionDraft`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7341), [`createUserInboxLabel`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7347), [`deleteAccountDomainLookup`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7353), [`deleteAllocationRule`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7359), [`deleteCommentBankItem`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7365), [`deleteConversationMessages`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7371), [`deleteConversations`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7377), [`deleteCustomGradeStatus`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7383), [`deleteDiscussionEntry`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7389), [`deleteDiscussionTopic`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7395), [`deleteInternalSetting`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7401), [`deleteOutcomeCalculationMethod`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7407), [`deleteOutcomeLinks`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7413), [`deleteOutcomeProficiency`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7419), [`deleteSubmissionComment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7425), [`deleteSubmissionDraft`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7431), [`deleteUserInboxLabel`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7437), [`dismissAccountNotification`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7443), [`hideAssignmentGrades`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7449), [`hideAssignmentGradesForSections`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7455), [`importOutcomes`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7461), [`markSubmissionCommentsRead`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7467), [`moveOutcomeLinks`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7473), [`postAssignmentGrades`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7479), [`postAssignmentGradesForSections`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7485), [`postDraftSubmissionComment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7491), [`rejectEnrollmentInvitation`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7497), [`removeInstitutionalTag`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7503), [`reorderModuleItems`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7509), [`restoreDeletedDiscussionEntry`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7515), [`saveRubricAssessment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7521), [`selectProvisionalGrade`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7527), [`setAssignmentPostPolicy`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7537), [`setCoursePostPolicy`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7548), [`setFriendlyDescription`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7554), [`setModuleItemCompletion`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7560), [`setOverrideScore`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7571), [`setOverrideStatus`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7577), [`setRubricSelfAssessment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7583), [`submitAutoGradeFeedback`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7589), [`subscribeToDiscussionTopic`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7595), [`updateAccountDomainLookup`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7601), [`updateAllocationRule`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7607), [`updateAssignment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7613), [`updateCommentBankItem`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7619), [`updateConversationParticipants`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7625), [`updateDiscussionEntriesReadState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7631), [`updateDiscussionEntry`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7637), [`updateDiscussionEntryParticipant`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7643), [`updateDiscussionReadState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7649), [`updateDiscussionThreadReadState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7655), [`updateDiscussionTopic`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7661), [`updateDiscussionTopicParticipant`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7667), [`updateGradebookGroupFilter`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7673), [`updateInstitutionalTag`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7679), [`updateInstitutionalTagArchivedState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7685), [`updateInstitutionalTagCategory`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7691), [`updateInstitutionalTagCategoryArchivedState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7697), [`updateInternalSetting`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7703), [`updateLearnerDashboardTabSelection`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7709), [`updateLearningOutcome`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7715), [`updateLearningOutcomeGroup`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7721), [`updateMyInboxSettings`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7727), [`updateNotificationPreferences`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7733), [`updateOutcomeCalculationMethod`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7739), [`updateOutcomeProficiency`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7745), [`updateRubricArchivedState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7751), [`updateRubricAssessmentReadState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7757), [`updateSpeedGraderSettings`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7763), [`updateSplitScreenViewDeeplyNestedAlert`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7769), [`updateSubmissionGrade`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7775), [`updateSubmissionGradeStatus`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7781), [`updateSubmissionSticker`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7787), [`updateSubmissionStudentEnteredScore`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7793), [`updateSubmissionsReadState`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7799), [`updateUserDiscussionsSplitscreenView`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7805), [`updateWidgetDashboardConfig`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7811), [`updateWidgetDashboardLayout`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7817), [`upsertCustomGradeStatus`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7823), [`upsertStandardGradeStatus`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L7829)

### Query

[`account`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9206), [`accountNotifications`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9221), [`allCourses`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9231), [`assignment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9232), [`assignmentGroup`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9249), [`auditLogs`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9260), [`course`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9261), [`courseInstructorsConnection`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9276), [`courses`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9316), [`enrollmentInvitations`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9331), [`folder`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9336), [`institutionalTag`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9342), [`institutionalTagCategory`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9348), [`internalSetting`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9358), [`internalSettings`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9373), [`learningOutcome`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9378), [`learningOutcomeGroup`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9388), [`legacyNode`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9398), [`moduleItem`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9403), [`myInboxSettings`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9409), [`node`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9414), [`outcomeCalculationMethod`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9424), [`outcomeProficiency`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9434), [`peerReviewSubAssignment`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9440), [`rubric`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9450), [`submission`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9456), [`term`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9477), [`user`](https://github.com/instructure/canvas-lms/blob/1c9f0bb8013ed69c4f2efe11fd483025469b7e6c/schema.graphql#L9488)

## Canvas Live Events names

`account_created`, `account_notification_created`, `account_updated`, `asset_accessed`, `assignment_created`, `assignment_group_created`, `assignment_group_updated`, `assignment_override_created`, `assignment_override_updated`, `assignment_updated`, `attachment_created`, `attachment_deleted`, `attachment_updated`, `content_migration_completed`, `conversation_created`, `conversation_forwarded`, `conversation_message_created`, `course_completed`, `course_created`, `course_grade_change`, `course_progress`, `course_section_created`, `course_section_updated`, `course_updated`, `discussion_entry_created`, `discussion_entry_submitted`, `discussion_topic_created`, `discussion_topic_updated`, `enrollment_created`, `enrollment_state_created`, `enrollment_state_updated`, `enrollment_updated`, `final_grade_custom_status`, `grade_change`, `grade_override`, `group_category_created`, `group_category_updated`, `group_created`, `group_membership_created`, `group_membership_updated`, `group_updated`, `learning_outcome_created`, `learning_outcome_group_created`, `learning_outcome_group_updated`, `learning_outcome_link_created`, `learning_outcome_link_updated`, `learning_outcome_result_created`, `learning_outcome_result_updated`, `learning_outcome_updated`, `logged_in`, `logged_out`, `lti_resource_link_created`, `lti_resource_link_updated`, `module_created`, `module_item_created`, `module_item_updated`, `module_updated`, `outcome_calculation_method_created`, `outcome_calculation_method_updated`, `outcome_proficiency_created`, `outcome_proficiency_updated`, `outcomes_retry_outcome_alignment_clone`, `plagiarism_resubmit`, `quiz_submitted`, `rubric_assessed`, `sis_batch_created`, `sis_batch_updated`, `submission_comment_created`, `submission_created`, `submission_custom_grade_status`, `submission_updated`, `syllabus_updated`, `user_account_association_created`, `user_created`, `user_updated`, `wiki_page_created`, `wiki_page_deleted`, `wiki_page_updated`

## Regenerate

```sh
python3 inventory_canvas.py --source /path/to/canvas-lms --output ./inventory
```

The JSON includes all parsed route declarations, conditions, unresolved records, argument annotations, exact source locations, GraphQL roots, and event definitions. The CSV is a review worksheet; unmatched actions retain a row.
