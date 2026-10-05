import type { CanvasClient } from "./canvas-client.js";
import { describeLinkedResource, extractContent, sanitizeResourceUrl, UNTRUSTED_CONTENT_NOTICE } from "./content.js";
import type { ContentOmission, LinkedResource } from "./content.js";

type ContextClient = Pick<CanvasClient, "baseUrl" | "getOne" | "getAll">;
type Row = Record<string, unknown>;

export interface ContextSection<T> {
  status: "available" | "blocked" | "error";
  source_url: string;
  trust: "untrusted_source_content";
  notice: string;
  data?: T;
  omissions: ContentOmission[];
  next_action?: string;
}

const MAX_ROWS = 100;
const MAX_MODULE_FETCHES = 10;
const MAX_MANIFEST_LINKS = 300;
const MAX_DESCRIPTION_CHARACTERS = 2_000;

function string(value: unknown, maxLength = 500): string | null {
  return typeof value === "string" ? value.slice(0, maxLength) : null;
}

function scalar(value: unknown): string | number | boolean | null {
  return typeof value === "string" ? value.slice(0, 500) : typeof value === "number" || typeof value === "boolean" ? value : null;
}

function asRow(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

/** Select metadata fields; never expose arbitrary response fields or signed download URLs. */
function fields(row: Row, keys: string[]): Row {
  return Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, scalar(row[key])]));
}

function section<T>(sourceUrl: string, data: T, omissions: ContentOmission[] = []): ContextSection<T> {
  return { status: "available", source_url: sourceUrl, trust: "untrusted_source_content", notice: UNTRUSTED_CONTENT_NOTICE, data, omissions };
}

function failure<T>(sourceUrl: string, error: unknown): ContextSection<T> {
  const record = asRow(error);
  const status = record.status ?? record.statusCode;
  const blocked = status === 401 || status === 403 || status === 404;
  const detail = blocked ? `Canvas did not allow this resource to be read (HTTP ${status}).` : "This Canvas request failed or exceeded a pagination/response limit; this section is not complete.";
  return {
    status: blocked ? "blocked" : "error",
    source_url: sourceUrl,
    trust: "untrusted_source_content",
    notice: UNTRUSTED_CONTENT_NOTICE,
    omissions: [{ reason: blocked ? "access_unavailable" : "request_failed", detail }],
    next_action: blocked ? "Check the signed-in user's course access and token scopes; do not infer this resource's content." : "Retry this source separately or narrow the request; do not treat the missing data as an empty list.",
  };
}

function limited<T>(rows: T[], sourceUrl: string, name: string): { rows: T[]; omissions: ContentOmission[] } {
  return {
    rows: rows.slice(0, MAX_ROWS),
    omissions: rows.length > MAX_ROWS ? [{ reason: "row_limit", detail: `${rows.length - MAX_ROWS} ${name} omitted after the ${MAX_ROWS}-item context limit.`, source_url: sourceUrl, next_action: "Use the resource's dedicated listing tool or visit the source to inspect the remaining items." }] : [],
  };
}

/**
 * Course-scoped context only. Sections fail independently and all omissions are explicit.
 * API contracts: courses_controller.rb, assignments_api_controller.rb,
 * context_modules_api_controller.rb, context_module_items_api_controller.rb,
 * wiki_pages_api_controller.rb and files_controller.rb in upstream Canvas LMS.
 */
export async function getCourseContext(client: ContextClient, courseId: string) {
  if (!/^\d+$/.test(courseId)) throw new Error("courseId must be a numeric Canvas course ID.");
  const prefix = `/courses/${courseId}`;
  const apiUrl = (endpoint: string) => `${client.baseUrl}/api/v1${endpoint}`;
  const courseUrl = `${client.baseUrl}${prefix}`;
  const linkedResources: LinkedResource[] = [];
  const manifestSeen = new Set<string>();
  let manifestOverflow = 0;
  function collect(links: LinkedResource[]): void {
    for (const link of links) {
      const key = `${link.source_url}\n${link.url}`;
      if (manifestSeen.has(key)) continue;
      manifestSeen.add(key);
      if (linkedResources.length >= MAX_MANIFEST_LINKS) { manifestOverflow++; continue; }
      linkedResources.push(link);
    }
  }
  function content(html: unknown, sourceUrl: string, maxTextCharacters = MAX_DESCRIPTION_CHARACTERS) {
    const extracted = extractContent(typeof html === "string" ? html : "", sourceUrl, client.baseUrl, { maxTextCharacters, maxLinks: 20 });
    if (html !== null && typeof html !== "string") {
      extracted.text_complete = false;
      extracted.link_discovery_complete = false;
      extracted.omissions.push({ reason: "body_not_returned", detail: "Canvas did not return this body as readable HTML. The empty text does not establish that the resource has no content." });
    }
    collect(extracted.links);
    return extracted;
  }
  function resource(raw: unknown, label: string, sourceUrl: string, hint?: "lti") {
    if (typeof raw !== "string") return null;
    const link = describeLinkedResource(raw, label, sourceUrl, client.baseUrl, hint);
    if (link) collect([link]);
    return link;
  }
  async function request<T>(endpoint: string, fetchAndMap: (sourceUrl: string) => Promise<ContextSection<T>>): Promise<ContextSection<T>> {
    const sourceUrl = apiUrl(endpoint);
    try { return await fetchAndMap(sourceUrl); } catch (error) { return failure<T>(sourceUrl, error); }
  }

  const [course, assignments, modules, pages, files] = await Promise.all([
    request(prefix, async (sourceUrl) => {
      const row = await client.getOne<Row>(prefix, { "include[]": ["syllabus_body"] });
      const syllabusPresent = typeof row.syllabus_body === "string" || row.syllabus_body === null;
      return section(sourceUrl, {
        ...fields(row, ["id", "name", "course_code", "workflow_state", "time_zone", "start_at", "end_at", "default_view"]),
        syllabus: content(row.syllabus_body, `${courseUrl}/assignments/syllabus`, 10_000),
      }, syllabusPresent ? [] : [{ reason: "syllabus_not_returned", detail: "Canvas did not return syllabus_body; an empty extracted string does not establish that the course has no syllabus." }]);
    }),
    request(`${prefix}/assignments`, async (sourceUrl) => {
      const result = limited(await client.getAll<Row>(`${prefix}/assignments`, { order_by: "due_at" }), sourceUrl, "assignments");
      return section(sourceUrl, result.rows.map((row) => {
        const id = scalar(row.id);
        const assignmentUrl = `${courseUrl}/assignments/${encodeURIComponent(String(id))}`;
        return {
          ...fields(row, ["id", "name", "due_at", "unlock_at", "lock_at", "points_possible", "published", "locked_for_user"]),
          source_url: assignmentUrl,
          submission_types: Array.isArray(row.submission_types) ? row.submission_types.slice(0, 20).map((value) => string(value)).filter(Boolean) : [],
          description: content(row.description, assignmentUrl),
        };
      }), result.omissions);
    }),
    request(`${prefix}/modules`, async (sourceUrl) => {
      const result = limited(await client.getAll<Row>(`${prefix}/modules`), sourceUrl, "modules");
      const data = [];
      let moduleFetches = 0;
      for (const row of result.rows) {
        const moduleId = String(row.id ?? "");
        const itemEndpoint = `${prefix}/modules/${encodeURIComponent(moduleId)}/items`;
        let items: ContextSection<Row[]>;
        if (!/^\d+$/.test(moduleId)) {
          items = { status: "error", source_url: sourceUrl, trust: "untrusted_source_content", notice: UNTRUSTED_CONTENT_NOTICE, omissions: [{ reason: "invalid_module_id", detail: "Canvas returned a module without a numeric identifier; its items were not requested." }] };
        } else if (moduleFetches >= MAX_MODULE_FETCHES) {
          items = {
            status: "blocked",
            source_url: apiUrl(itemEndpoint),
            trust: "untrusted_source_content",
            notice: UNTRUSTED_CONTENT_NOTICE,
            omissions: [{ reason: "module_fetch_limit", detail: `Items were not fetched: this context limits module item requests to ${MAX_MODULE_FETCHES}.`, source_url: apiUrl(itemEndpoint), next_action: "Use the module-items tool for this module." }],
            next_action: "Fetch this module's items separately before describing its contents.",
          };
        } else {
          moduleFetches++;
          // Intentionally sequential: do not fan out across a large course's modules.
          items = await request(itemEndpoint, async (itemsUrl) => {
            const listed = limited(await client.getAll<Row>(itemEndpoint, { "include[]": ["content_details"] }), itemsUrl, "module items");
            return section(itemsUrl, listed.rows.map((item) => {
              const itemUrl = sanitizeResourceUrl(typeof item.html_url === "string" ? item.html_url : `${courseUrl}/modules/items/${encodeURIComponent(String(item.id))}`, client.baseUrl) ?? itemsUrl;
              const detail = asRow(item.content_details);
              const itemLinks: LinkedResource[] = [];
              const linkOmissions: ContentOmission[] = [];
              let rejectedLinks = 0;
              let omittedLinks = 0;
              for (const [key, value] of Object.entries({ external_url: item.external_url, url: item.url, ...Object.fromEntries(Object.entries(detail).filter(([key]) => /(?:^|_)(?:url|href)$/.test(key))) })) {
                if (itemLinks.length >= 20 && typeof value === "string") { omittedLinks++; continue; }
                const link = resource(value, string(item.title) ?? key, itemUrl, item.type === "ExternalTool" ? "lti" : undefined);
                if (link) itemLinks.push(link);
                else if (typeof value === "string" && value) rejectedLinks++;
              }
              if (rejectedLinks) linkOmissions.push({ reason: "unsupported_links", detail: `${rejectedLinks} malformed or non-HTTP(S) links were rejected; they must not be fetched.` });
              if (omittedLinks) linkOmissions.push({ reason: "link_limit", detail: `${omittedLinks} additional module item links omitted after the 20-link limit.` });
              if (Object.values(detail).some((value) => value !== null && typeof value === "object")) linkOmissions.push({ reason: "nested_details_not_inspected", detail: "Nested content details were not inspected for links or copied into this context." });
              return {
                ...fields(item, ["id", "title", "type", "position", "indent", "content_id", "page_url", "published"]),
                source_url: itemUrl,
                links: itemLinks,
                omissions: linkOmissions,
                content_details: fields(detail, ["due_at", "unlock_at", "lock_at", "points_possible", "locked_for_user"]),
                ...(typeof detail.description === "string" ? { description: content(detail.description, itemUrl) } : {}),
              };
            }), listed.omissions);
          });
        }
        data.push({ ...fields(row, ["id", "name", "position", "items_count", "unlock_at", "state", "published"]), items });
      }
      const omitted = data.filter((module) => module.items.omissions.some((omission) => omission.reason === "module_fetch_limit")).length;
      if (omitted) result.omissions.push({ reason: "module_fetch_limit", detail: `Items for ${omitted} listed modules were not fetched after the ${MAX_MODULE_FETCHES}-request limit.`, source_url: sourceUrl, next_action: "Follow each module's item source URL or use its dedicated listing tool." });
      return section(sourceUrl, data, result.omissions);
    }),
    request(`${prefix}/pages`, async (sourceUrl) => {
      const result = limited(await client.getAll<Row>(`${prefix}/pages`, { sort: "title" }), sourceUrl, "pages");
      return section(sourceUrl, result.rows.map((row) => ({
        ...fields(row, ["page_id", "title", "url", "updated_at", "published", "front_page"]),
        body_status: "not_fetched",
        body_source_url: apiUrl(`${prefix}/pages/${encodeURIComponent(String(row.url ?? row.page_id))}`),
        next_action: "Fetch this page explicitly to read its body and discover its links.",
      })), [...result.omissions, { reason: "page_bodies_lazy", detail: "Page bodies and their embedded links were not fetched. The list is metadata only." }]);
    }),
    request(`${prefix}/files`, async (sourceUrl) => {
      const result = limited(await client.getAll<Row>(`${prefix}/files`), sourceUrl, "files");
      return section(sourceUrl, result.rows.map((row) => ({
        ...fields(row, ["id", "display_name", "filename", "content-type", "size", "updated_at", "locked_for_user", "hidden_for_user"]),
        source_url: apiUrl(`/files/${encodeURIComponent(String(row.id))}`),
        content_status: "not_fetched",
        next_action: "Fetch this file's metadata, then use an authorized file retrieval and text extraction workflow. No file bytes or text were read here.",
      })), [...result.omissions, { reason: "file_contents_not_fetched", detail: "Files are metadata only. No file bytes, extracted text or signed download URLs are included." }]);
    }),
  ]);

  const omissions: ContentOmission[] = [
    { reason: "bounded_course_context", detail: "This is a partial course context snapshot, not the full course. Discussions, announcements, quizzes, submissions, grades, calendars and other surfaces require separate retrieval." },
    { reason: "external_content_not_fetched", detail: "Linked resources are a discovery manifest only. Google, Microsoft, LTI and other external content remains unread until an authorized connector or browser retrieves it." },
  ];
  if (manifestOverflow) omissions.push({ reason: "manifest_limit", detail: `${manifestOverflow} additional links omitted after the ${MAX_MANIFEST_LINKS}-link manifest limit; inspect each section's content links.` });
  return {
    course_id: courseId,
    source_url: courseUrl,
    trust: "untrusted_source_content" as const,
    notice: UNTRUSTED_CONTENT_NOTICE,
    context_complete: false,
    sections: { course, assignments, modules, pages, files },
    linked_resources: linkedResources,
    omissions,
    limits: { rows_per_section: MAX_ROWS, module_item_requests: MAX_MODULE_FETCHES, description_characters: MAX_DESCRIPTION_CHARACTERS, manifest_links: MAX_MANIFEST_LINKS },
  };
}
