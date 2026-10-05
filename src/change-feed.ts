import {createHash, randomUUID} from "node:crypto";
import {CanvasError, type CanvasClient} from "./canvas-client.js";

type FeedClient = Pick<CanvasClient, "baseUrl" | "getAll">;
type Resource = Record<string, unknown>;
type ResourceKind = "assignment" | "announcement";
export interface CourseChangeEvent {
  id: string;
  type: `${ResourceKind}.created` | `${ResourceKind}.updated`;
  resource_id: string;
  course_id: string;
  observed_at: string;
}
export interface CourseChangePoll {
  canvas_origin: string;
  course_id: string;
  baseline_established: boolean;
  cursor: string;
  events: CourseChangeEvent[];
  total_events: number;
  events_truncated: boolean;
  limitation: string;
}
interface CourseState {
  generation: string;
  sequence: number;
  hashes: Map<string, string> | null;
  busy: boolean;
}
interface FeedOptions { maxCourses?: number; maxEvents?: number; maxItemsPerCourse?: number; }

const ASSIGNMENT_FIELDS = ["name", "description", "due_at", "unlock_at", "lock_at", "points_possible", "grading_type", "published", "submission_types", "allowed_extensions"];
const SUBMISSION_FIELDS = ["workflow_state", "score", "grade", "graded_at", "posted_at", "submitted_at", "late", "missing", "excused", "attempt", "submission_type", "body", "url"];
const ANNOUNCEMENT_FIELDS = ["title", "message", "posted_at", "delayed_post_at", "published", "discussion_type"];
const LIMITATION = "Observations since the previous successful poll in this process; the first poll establishes a silent baseline. No background delivery or restart persistence. Created means newly observed; deletions are not inferred. Submission changes depend on Canvas returning submission data. A truncated event list requires a fresh resource read.";

function pick(record: Resource, fields: string[]): Resource {
  return Object.fromEntries(fields.map(key => [key, record[key] ?? null]));
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}
function resourceId(value: unknown): string {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new CanvasError("invalid_response", "Canvas returned a resource without a safe numeric ID; no baseline was advanced.");
}
function snapshot(kind: ResourceKind, values: unknown[]): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CanvasError("invalid_response", "Canvas returned an invalid resource; no baseline was advanced.");
    const row = value as Resource;
    const key = `${kind}:${resourceId(row.id)}`;
    if (hashes.has(key)) throw new CanvasError("invalid_response", "Canvas repeated a resource in the snapshot; no baseline was advanced.");
    const material = pick(row, kind === "assignment" ? ASSIGNMENT_FIELDS : ANNOUNCEMENT_FIELDS);
    if (kind === "assignment") {
      material.submission = row.submission && typeof row.submission === "object" && !Array.isArray(row.submission) ? pick(row.submission as Resource, SUBMISSION_FIELDS) : null;
    }
    hashes.set(key, createHash("sha256").update(JSON.stringify(stable(material))).digest("hex"));
  }
  return hashes;
}

/** Small local-pilot change detector. Keep each client's credentials fixed for its lifetime. */
export class CourseChangeFeed {
  // Object identity isolates separate users even when their Canvas origin is identical.
  private readonly clients = new Map<FeedClient, Map<string, CourseState>>();
  private courseCount = 0;
  private readonly maxCourses: number;
  private readonly maxEvents: number;
  private readonly maxItemsPerCourse: number;

  constructor(options: FeedOptions = {}) {
    this.maxCourses = options.maxCourses ?? 100;
    this.maxEvents = options.maxEvents ?? 200;
    this.maxItemsPerCourse = options.maxItemsPerCourse ?? 5000;
    if (![this.maxCourses, this.maxEvents, this.maxItemsPerCourse].every(n => Number.isSafeInteger(n) && n > 0)) throw new RangeError("Change-feed limits must be positive safe integers.");
  }

  async poll(client: FeedClient, courseId: string): Promise<CourseChangePoll> {
    if (!/^\d+$/.test(courseId)) throw new CanvasError("invalid_course_id", "Course ID must contain digits only.");
    const origin = new URL(client.baseUrl).origin;
    const key = `${origin}/courses/${courseId}`;
    let courses = this.clients.get(client);
    let state = courses?.get(key);
    if (state?.busy) throw new CanvasError("poll_in_progress", "A poll for this connection and course is already running. Retry after it finishes.");
    const fresh = !state;
    if (!state) {
      if (this.courseCount >= this.maxCourses) throw new CanvasError("change_feed_limit", "This local change feed has reached its tracked-course limit.");
      if (!courses) { courses = new Map(); this.clients.set(client, courses); }
      state = {generation: randomUUID(), sequence: 0, hashes: null, busy: false};
      courses.set(key, state);
      this.courseCount++;
    }
    const current = state;
    current.busy = true;
    try {
      // These reads must remain sequential; no partial response can commit a baseline.
      const assignments = await client.getAll<Resource>(`/courses/${courseId}/assignments`, {"include[]": ["submission"]});
      const announcements = await client.getAll<Resource>(`/courses/${courseId}/discussion_topics`, {only_announcements: "true"});
      const observed = new Map([...snapshot("assignment", assignments), ...snapshot("announcement", announcements)]);
      // Keep unseen prior hashes: a temporarily hidden item is not a deletion or a new item on return.
      const nextHashes = new Map(current.hashes);
      for (const [resource, hash] of observed) nextHashes.set(resource, hash);
      if (nextHashes.size > this.maxItemsPerCourse) throw new CanvasError("change_feed_limit", "This course exceeds the local change-feed resource limit; no baseline was advanced.");
      const baselineEstablished = current.hashes === null;
      let sequence = current.sequence;
      const events: CourseChangeEvent[] = [];
      let totalEvents = 0;
      const observedAt = new Date().toISOString();
      if (!baselineEstablished) {
        for (const [resource, hash] of observed) {
          const previous = current.hashes!.get(resource);
          if (previous === hash) continue;
          const [kind, id] = resource.split(":") as [ResourceKind, string];
          sequence++;
          totalEvents++;
          // Bound returned/retained events; sequence still accounts for every observed change.
          if (events.length < this.maxEvents) events.push({id: `${current.generation}:${sequence}`, type: `${kind}.${previous === undefined ? "created" : "updated"}`, resource_id: id, course_id: courseId, observed_at: observedAt});
        }
      }
      current.hashes = nextHashes;
      current.sequence = sequence;
      return {canvas_origin: origin, course_id: courseId, baseline_established: baselineEstablished, cursor: `${current.generation}:${sequence}`, events, total_events: totalEvents, events_truncated: totalEvents > events.length, limitation: LIMITATION};
    } catch (error) {
      if (fresh) {
        courses!.delete(key);
        this.courseCount--;
        if (courses!.size === 0) this.clients.delete(client);
      }
      throw error;
    } finally {
      current.busy = false;
    }
  }
}
