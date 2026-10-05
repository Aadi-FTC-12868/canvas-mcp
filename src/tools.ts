import { z } from "zod";
import { CanvasClient, CanvasError } from "./canvas-client.js";
import { extractContent, sanitizeResourceUrl, describeLinkedResource } from "./content.js";
import { getCourseContext } from "./course-context.js";
import { CourseChangeFeed } from "./change-feed.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const VERSION = "2.0.0-alpha.1";
export interface ToolContext { client: () => CanvasClient; feed: CourseChangeFeed }
const id = z.string().regex(/^[1-9]\d*$/, "Use a numeric Canvas ID as a string.");
const courseInput = z.object({course_id: id}).strict();
const coursePath = (courseId: string) => "/courses/" + courseId;
type Row = Record<string, any>;

function source(client: CanvasClient, path: string) { return client.baseUrl + path; }
function record(client: CanvasClient, value: Row, url: string, htmlField?: string) {
  // Never expose short-lived signed download URLs as citations.
  const result: Row = {};
  for (const field of ["id", "name", "title", "course_code", "workflow_state", "due_at", "updated_at", "posted_at", "points_possible", "submission_types", "rubric", "submission", "enrollments", "term", "page_id", "url", "type", "content_id", "position", "completion_requirement", "content_details", "display_name", "filename", "size", "content-type", "locked_for_user", "lock_explanation"]) {
    if (value[field] !== undefined && field !== "url") result[field] = value[field];
  }
  const pick = (input: Row, fields: string[]) => Object.fromEntries(fields.filter(k => input[k] !== undefined).map(k => [k, input[k]]));
  if (value.submission) result.submission = pick(value.submission, ["id", "workflow_state", "submitted_at", "score", "grade", "late", "missing", "attempt", "submission_type"]);
  if (value.enrollments) result.enrollments = value.enrollments.map((v: Row) => pick(v, ["type", "role", "enrollment_state"]));
  if (value.term) result.term = pick(value.term, ["id", "name", "start_at", "end_at"]);
  if (value.content_details) result.content_details = pick(value.content_details, ["due_at", "unlock_at", "lock_at", "points_possible", "locked_for_user"]);
  if (value.completion_requirement) result.completion_requirement = pick(value.completion_requirement, ["type", "min_score", "completed"]);
  if (value.rubric) result.rubric = value.rubric.map((v: Row) => ({...pick(v, ["id", "description", "long_description", "points"]), ratings: v.ratings?.map((r: Row) => pick(r, ["id", "description", "long_description", "points"]))}));
  result.source_url = url;
  result.trust = "untrusted_source_content";
  if (htmlField) {
    result.content = extractContent(value[htmlField] ?? "", url, client.baseUrl);
    result.content_status = typeof value[htmlField] === "string" ? "retrieved" : "not_returned";
    if (result.content_status === "not_returned") result.omission = "The requested body was not returned. This may require another API, permission, or browser access; content has not been read.";
  }
  if (htmlField === "description") result.submission_status = value.submission ? "returned" : "not_returned";
  if (typeof value.page_url === "string") result.page_slug = value.page_url;
  const resourceUrls = Object.entries(value.content_details ?? {}).filter(([key, raw]) => /(?:url|href)$/i.test(key) && typeof raw === "string");
  if (typeof value.external_url === "string") {
    result.external_url = sanitizeResourceUrl(value.external_url, url);
    resourceUrls.unshift(["external_url", value.external_url]);
  }
  if (resourceUrls.length) {
    result.linked_resources = resourceUrls.slice(0, 20).map(([key, raw]) => describeLinkedResource(String(raw), key, url, client.baseUrl, value.type === "ExternalTool" ? "lti" : undefined)).filter(Boolean);
    result.link_discovery_complete = resourceUrls.length <= 20 && result.linked_resources.length === resourceUrls.length;
    if (!result.link_discovery_complete) result.link_omission = "Some linked URLs were unsupported or exceeded the 20-link limit. Open the source page to inspect remaining resources.";
  }
  return result;
}
export function errorResult(err: unknown) {
  if (err instanceof z.ZodError) return {code: "invalid_arguments", message: "Invalid tool arguments.", issues: err.issues.map(i => ({path: i.path, message: i.message}))};
  if (err instanceof CanvasError) return {code: err.code, message: err.message, status: err.status};
  return {code: "operation_failed", message: "The operation failed. No complete result is available."};
}
function define<S extends z.ZodObject>(name: string, description: string, schema: S, handler: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown> | unknown, localState = false) {
  return {
    name, description, schema,
    annotations: {readOnlyHint: !localState, destructiveHint: false, idempotentHint: !localState, openWorldHint: false},
    invoke: async (args: unknown, ctx: ToolContext) => handler(schema.parse(args), ctx)
  };
}
export const tools: ReturnType<typeof define>[] = [
  define("get_profile", "Read the connected Canvas user's identity and school origin. No credentials are returned.", z.object({}).strict(), async (_, ctx) => {
    const c = ctx.client(); const p = await c.getOne<Row>("/users/self/profile");
    return {id: String(p.id), name: p.name, display_name: p.short_name, canvas_origin: c.baseUrl, source_url: c.baseUrl + "/profile", trust: "untrusted_source_content"};
  }),
  define("list_courses", "List visible courses with enrollment context. Bounded pagination fails explicitly if the list cannot be completed.", z.object({enrollment_state: z.enum(["active", "invited_or_pending", "completed"]).default("active")}).strict(), async (a, ctx) => {
    const c = ctx.client(); const rows = await c.getAll<Row>("/courses", {enrollment_state: a.enrollment_state, "include[]": ["term", "enrollments"]});
    return {courses: rows.map(v => record(c, v, source(c, coursePath(String(v.id))))), complete: true};
  }),
  define("get_assignments", "Read course assignments, including descriptions with linked-material manifests and the user's submission state.", courseInput.extend({include_past_due: z.boolean().default(true)}).strict(), async (a, ctx) => {
    const c = ctx.client(); const path = coursePath(a.course_id); const rows = await c.getAll<Row>(path + "/assignments", {"include[]": ["submission"], order_by: "due_at"});
    return {assignments: rows.filter(v => a.include_past_due || !v.due_at || Date.parse(v.due_at) >= Date.now()).map(v => record(c, v, source(c, path + "/assignments/" + v.id), "description")), complete: true, include_past_due: a.include_past_due};
  }),
  define("get_assignment_detail", "Read an assignment, rubric, submission state, and linked-material gaps.", courseInput.extend({assignment_id: id}).strict(), async (a, ctx) => {
    const c = ctx.client(); const path = coursePath(a.course_id) + "/assignments/" + a.assignment_id;
    return record(c, await c.getOne<Row>(path, {"include[]": ["submission", "rubric_assessment"]}), source(c, path), "description");
  }),
  define("get_syllabus", "Read the syllabus and identify linked resources that still require reading.", courseInput, async (a, ctx) => {
    const c = ctx.client(); const path = coursePath(a.course_id); const row = await c.getOne<Row>(path, {"include[]": ["syllabus_body"]});
    return {course_id: a.course_id, course_name: row.name, content_status: typeof row.syllabus_body === "string" ? "retrieved" : "not_returned", omission: typeof row.syllabus_body === "string" ? null : "Syllabus body was not returned; do not infer an empty syllabus.", ...extractContent(row.syllabus_body ?? "", source(c, path + "/assignments/syllabus"), c.baseUrl)};
  }),
  define("get_announcements", "Read announcements for one explicit course. Includes source URLs and external-link gaps.", courseInput, async (a, ctx) => {
    const c = ctx.client(); const path = coursePath(a.course_id);
    const rows = await c.getAll<Row>(path + "/discussion_topics", {only_announcements: "true"});
    return {announcements: rows.map(v => record(c, v, source(c, path + "/discussion_topics/" + v.id), "message")), complete: true};
  }),
  define("list_modules", "List a course's module structure. Call list_module_items for contents.", courseInput, async (a, ctx) => {
    const c = ctx.client(); const rows = await c.getAll<Row>(coursePath(a.course_id) + "/modules");
    return {modules: rows.map(v => record(c, v, source(c, coursePath(a.course_id) + "/modules/" + v.id))), complete: true};
  }),
  define("list_module_items", "Read module items including external URLs and content metadata. Linked content is not automatically fetched.", courseInput.extend({module_id: id}).strict(), async (a, ctx) => {
    const c = ctx.client(); const rows = await c.getAll<Row>(coursePath(a.course_id) + "/modules/" + a.module_id + "/items", {"include[]": ["content_details"]});
    return {items: rows.map(v => record(c, v, source(c, coursePath(a.course_id) + "/modules/items/" + v.id))), complete: true};
  }),
  define("list_pages", "List Canvas pages visible in a course. Bodies require get_page.", courseInput, async (a, ctx) => {
    const c = ctx.client(); const rows = await c.getAll<Row>(coursePath(a.course_id) + "/pages");
    return {pages: rows.map(v => ({...record(c, v, source(c, coursePath(a.course_id) + "/pages/" + encodeURIComponent(v.url))), page_slug: v.url})), complete: true};
  }),
  define("get_page", "Read a Canvas page body with provenance and a manifest of linked resources.", courseInput.extend({page_slug: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/)}).strict(), async (a, ctx) => {
    const c = ctx.client(); const path = coursePath(a.course_id) + "/pages/" + encodeURIComponent(a.page_slug);
    return record(c, await c.getOne<Row>(path), source(c, path), "body");
  }),
  define("list_course_files", "List visible course file metadata. Does not download files or claim to have read their contents.", courseInput, async (a, ctx) => {
    const c = ctx.client(); const rows = await c.getAll<Row>(coursePath(a.course_id) + "/files");
    return {files: rows.map(v => record(c, v, source(c, coursePath(a.course_id) + "/files/" + v.id))), content_status: "metadata_only", next_action: "Read the file through an authorized browser or file connector before using its contents.", complete: true};
  }),
  define("get_file", "Read Canvas file metadata, access restrictions, and a canonical source link. File contents remain unread.", z.object({file_id: id}).strict(), async (a, ctx) => {
    const c = ctx.client(); const row = await c.getOne<Row>("/files/" + a.file_id);
    return {...record(c, row, source(c, "/files/" + a.file_id)), content_status: "metadata_only", next_action: "Read this file through an authorized browser or file connector."};
  }),
  define("get_course_context", "Collect a bounded course context map with syllabus, assignments, modules/items, page index, files, and explicit inaccessible or unread material. This is not all course content.", courseInput, (a, ctx) => getCourseContext(ctx.client(), a.course_id)),
  define("poll_course_updates", "Compare assignments and announcements with this server's in-memory baseline. First call establishes baseline; later calls report changes. Call-driven, no background notifications; state resets on restart.", courseInput, (a, ctx) => ctx.feed.poll(ctx.client(), a.course_id), true),
  define("describe_capabilities", "Describe implemented tools and the planned integration boundaries. No Canvas credentials required.", z.object({}).strict(), () => ({
    version: VERSION, mode: "read-only Canvas pilot", tools: tools.map(t => t.name),
    transports: ["stdio", "authenticated loopback Streamable HTTP development transport"],
    limitations: ["No hosted OAuth or ChatGPT installation yet", "No write tools in v2 alpha", "No file extraction or external connector retrieval", "Notifications are call-driven and in-memory", "API inventory is discovery metadata, not executable tool coverage"],
    source: "https://github.com/Aadi-FTC-12868/canvas-mcp"
  })),
  define("search_api_catalog", "Search the source-derived Canvas API map. Results describe endpoints; they do not grant access or execute arbitrary requests.", z.object({query: z.string().min(2).max(120), limit: z.number().int().min(1).max(30).default(10)}).strict(), (a) => {
    const catalog = JSON.parse(readFileSync(fileURLToPath(new URL("../docs/generated/canvas-inventory.json", import.meta.url)), "utf8"));
    const rows: Row[] = catalog.endpoints ?? catalog.operations ?? [];
    const terms = a.query.toLowerCase().split(/\s+/);
    const matches = rows.filter(v => terms.every(term => JSON.stringify(v).toLowerCase().includes(term)));
    return {matches: matches.slice(0, a.limit), total_matches: matches.length, inventory_only: true, provenance: {upstream: catalog.upstream, revision: catalog.source_revision}, limitations: catalog.limitations};
  })
];

export function createContext(clientFactory: () => CanvasClient = () => new CanvasClient()): ToolContext {
  let client: CanvasClient | undefined;
  return {client: () => client ??= clientFactory(), feed: new CourseChangeFeed()};
}
export async function invokeTool(name: string, args: unknown, context: ToolContext) {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new CanvasError("unknown_tool", "Unknown or unavailable tool. Write and download tools from v1 are not available in this alpha.");
  const value = await tool.invoke(args, context);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 2 * 1024 * 1024) throw new CanvasError("tool_result_limit", "Result exceeded 2 MiB. Use a narrower individual tool; this result was not returned.");
  return value;
}
