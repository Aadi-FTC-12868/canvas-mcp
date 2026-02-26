/**
 * Canvas LMS API client with automatic pagination, rate limit handling,
 * and HTML stripping utilities.
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import type {
  CanvasCourse,
  CanvasAssignment,
  CanvasDiscussionTopic,
  CanvasCourseWithSyllabus,
  CanvasFile,
  CanvasFolder,
  CanvasUploadToken,
  CanvasFileUploadResult,
  CanvasSubmissionResult,
} from "./types.js";

// ─── HTML Utilities ────────────────────────────────────────────────────────────

/**
 * Strips HTML tags from a string, converting block-level tags to newlines
 * first so the resulting plain text is readable.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}

interface FetchResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  rawBuffer?: Buffer;
}

/** Minimal fetch wrapper using Node's built-in http/https modules. */
function nodeFetch(url: string, options: FetchOptions = {}): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const bodyData =
      options.body instanceof Buffer
        ? options.body
        : options.body
        ? Buffer.from(options.body)
        : undefined;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || "GET",
        headers: {
          ...(options.headers || {}),
          ...(bodyData ? { "Content-Length": String(bodyData.length) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const rawBuffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[]>,
            body: rawBuffer.toString("utf-8"),
            rawBuffer,
          });
        });
      }
    );

    req.on("error", reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

/** Parse the Link header to find the next page URL, if any. */
function parseLinkHeader(header: string | string[] | undefined): string | null {
  if (!header) return null;
  const headerStr = Array.isArray(header) ? header.join(", ") : header;
  const match = headerStr.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

// ─── Canvas API Client ─────────────────────────────────────────────────────────

export class CanvasClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = (process.env.CANVAS_BASE_URL || "https://imsa.instructure.com").replace(
      /\/+$/,
      ""
    );
    this.token = process.env.CANVAS_API_TOKEN || "";
    if (!this.token) {
      throw new Error("CANVAS_API_TOKEN environment variable is required.");
    }
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Make a single GET request to the Canvas API with rate-limit awareness.
   */
  private async rawGet(url: string, retries = 3): Promise<FetchResponse> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const res = await nodeFetch(url, { headers: this.authHeaders });

      if (res.status === 429) {
        // Rate limited — wait and retry with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (res.status === 401) {
        throw new Error("Canvas API token may be invalid or expired (401 Unauthorized).");
      }
      if (res.status === 403) {
        throw new Error("You do not have permission to access this resource (403 Forbidden).");
      }
      if (res.status === 404) {
        throw new Error("The requested Canvas resource was not found (404 Not Found).");
      }
      if (res.status >= 400) {
        throw new Error(`Canvas API error: HTTP ${res.status} — ${res.body.slice(0, 200)}`);
      }

      return res;
    }
    throw new Error("Canvas API rate limit exceeded after multiple retries.");
  }

  /**
   * Fetch all pages of a paginated Canvas API endpoint.
   * Automatically follows Link header `next` links.
   */
  async getAll<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    const searchParams = new URLSearchParams({ per_page: "100", ...params });
    let url = `${this.baseUrl}/api/v1${endpoint}?${searchParams.toString()}`;
    const results: T[] = [];

    while (url) {
      const res = await this.rawGet(url);
      const page: T[] = JSON.parse(res.body);
      results.push(...page);

      const next = parseLinkHeader(res.headers["link"]);
      url = next ?? "";
    }

    return results;
  }

  /**
   * Fetch a single Canvas API resource (not paginated).
   */
  async getOne<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.toString();
    const url = `${this.baseUrl}/api/v1${endpoint}${query ? "?" + query : ""}`;
    const res = await this.rawGet(url);
    return JSON.parse(res.body) as T;
  }

  /**
   * POST to a Canvas API endpoint with a JSON body.
   */
  async post<T>(endpoint: string, body: unknown, retries = 3): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    for (let attempt = 0; attempt < retries; attempt++) {
      const res = await nodeFetch(url, {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (res.status === 401) throw new Error("Canvas API token may be invalid or expired.");
      if (res.status === 403) throw new Error("You do not have permission for this action.");
      if (res.status >= 400) {
        throw new Error(`Canvas API error: HTTP ${res.status} — ${res.body.slice(0, 200)}`);
      }
      return JSON.parse(res.body) as T;
    }
    throw new Error("Canvas API rate limit exceeded after multiple retries.");
  }

  // ─── Domain-Specific Methods ──────────────────────────────────────────────

  /** List all active courses for the current user. */
  async listCourses(enrollmentState = "active"): Promise<CanvasCourse[]> {
    const searchParams = new URLSearchParams({
      enrollment_state: enrollmentState,
      per_page: "100",
    });
    searchParams.append("include[]", "term");
    searchParams.append("include[]", "enrollments");
    let url = `${this.baseUrl}/api/v1/courses?${searchParams.toString()}`;
    const results: CanvasCourse[] = [];
    while (url) {
      const res = await this.rawGet(url);
      results.push(...(JSON.parse(res.body) as CanvasCourse[]));
      url = parseLinkHeader(res.headers["link"]) ?? "";
    }
    return results;
  }

  /** Get all assignments for a course, with submission info. */
  async getAssignments(courseId: string): Promise<CanvasAssignment[]> {
    const searchParams = new URLSearchParams({ per_page: "100", order_by: "due_at" });
    searchParams.append("include[]", "submission");
    let url = `${this.baseUrl}/api/v1/courses/${courseId}/assignments?${searchParams.toString()}`;
    const results: CanvasAssignment[] = [];
    while (url) {
      const res = await this.rawGet(url);
      results.push(...(JSON.parse(res.body) as CanvasAssignment[]));
      url = parseLinkHeader(res.headers["link"]) ?? "";
    }
    return results;
  }

  /** Get a single assignment with full detail. */
  async getAssignmentDetail(courseId: string, assignmentId: string): Promise<CanvasAssignment> {
    // Canvas requires include[] as repeated params; getOne uses URLSearchParams
    // so we build the URL manually here to append multiple include[] values
    const searchParams = new URLSearchParams();
    searchParams.append("include[]", "submission");
    searchParams.append("include[]", "rubric_assessment");
    const url = `${this.baseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}?${searchParams.toString()}`;
    const res = await this.rawGet(url);
    return JSON.parse(res.body) as CanvasAssignment;
  }

  /** Get announcements for a course (discussion topics of type announcement). */
  async getAnnouncements(courseIds: string[], limit: number): Promise<CanvasDiscussionTopic[]> {
    // context_codes must be repeated params, not comma-joined
    const searchParams = new URLSearchParams({ per_page: String(Math.min(limit, 100)) });
    for (const id of courseIds) {
      searchParams.append("context_codes[]", `course_${id}`);
    }
    const url = `${this.baseUrl}/api/v1/announcements?${searchParams.toString()}`;
    const res = await this.rawGet(url);
    return JSON.parse(res.body) as CanvasDiscussionTopic[];
  }

  /** Get the syllabus for a course. */
  async getSyllabus(courseId: string): Promise<CanvasCourseWithSyllabus> {
    return this.getOne<CanvasCourseWithSyllabus>(`/courses/${courseId}`, {
      include: "syllabus_body",
    });
  }

  /** List files in a course (optionally filtered by folder). */
  async listCourseFiles(courseId: string, folderId?: string): Promise<CanvasFile[]> {
    if (folderId) {
      return this.getAll<CanvasFile>(`/folders/${folderId}/files`);
    }
    return this.getAll<CanvasFile>(`/courses/${courseId}/files`);
  }

  /** Find a Canvas folder by its full path within a course. */
  async findFolder(courseId: string, folderPath: string): Promise<CanvasFolder | null> {
    try {
      const folder = await this.getOne<CanvasFolder>(
        `/courses/${courseId}/folders/by_path/${encodeURIComponent(folderPath)}`
      );
      return folder;
    } catch {
      return null;
    }
  }

  /** Get root folder of a course. */
  async getRootFolder(courseId: string): Promise<CanvasFolder> {
    return this.getOne<CanvasFolder>(`/courses/${courseId}/folders/root`);
  }

  /**
   * Upload a file to Canvas using the three-step upload workflow:
   * 1. Request an upload URL
   * 2. POST the file to the upload URL
   * 3. Confirm the upload
   */
  async uploadFile(
    courseId: string,
    filePath: string,
    folderPath?: string
  ): Promise<CanvasFileUploadResult> {
    const filename = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    // Step 1: Request upload URL
    const tokenBody: Record<string, unknown> = {
      name: filename,
      size: fileSize,
    };
    if (folderPath) tokenBody.folder = folderPath;

    const token = await this.post<CanvasUploadToken>(
      `/courses/${courseId}/files`,
      tokenBody
    );

    // Step 2: Upload the file to the provided URL
    const formData = this.buildMultipartForm(token.upload_params, filename, fileBuffer);
    const uploadRes = await nodeFetch(token.upload_url, {
      method: "POST",
      headers: { "Content-Type": formData.contentType },
      body: formData.body,
    });

    if (uploadRes.status >= 400 && uploadRes.status !== 301 && uploadRes.status !== 302) {
      throw new Error(`File upload failed: HTTP ${uploadRes.status}`);
    }

    // Step 3: Confirm upload — Canvas returns a redirect; follow it or use the Location
    let confirmUrl = uploadRes.headers["location"] as string | undefined;
    if (!confirmUrl) {
      // Try to parse confirm URL from body
      try {
        const body = JSON.parse(uploadRes.body);
        confirmUrl = body.location || body.url;
      } catch {
        // ignore parse error; guard below will throw
      }
    }
    if (!confirmUrl) {
      throw new Error("Could not determine file confirmation URL after upload.");
    }

    const confirmRes = await nodeFetch(confirmUrl, {
      method: "POST",
      headers: this.authHeaders,
      body: "{}",
    });

    if (confirmRes.status >= 400) {
      throw new Error(`File confirmation failed: HTTP ${confirmRes.status}`);
    }

    return JSON.parse(confirmRes.body) as CanvasFileUploadResult;
  }

  /**
   * Upload a file as an assignment submission attachment.
   * Returns the Canvas file ID after the three-step upload.
   */
  async uploadSubmissionFile(
    courseId: string,
    assignmentId: string,
    filePath: string
  ): Promise<number> {
    const filename = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    // Step 1: Request upload token for submission
    const token = await this.post<CanvasUploadToken>(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/self/files`,
      { name: filename, size: fileSize }
    );

    // Step 2: Upload
    const formData = this.buildMultipartForm(token.upload_params, filename, fileBuffer);
    const uploadRes = await nodeFetch(token.upload_url, {
      method: "POST",
      headers: { "Content-Type": formData.contentType },
      body: formData.body,
    });

    let confirmUrl = uploadRes.headers["location"] as string | undefined;
    if (!confirmUrl) {
      try {
        const body = JSON.parse(uploadRes.body);
        confirmUrl = body.location || body.url;
      } catch {
        // ignore parse error; guard below will throw
      }
    }
    if (!confirmUrl) {
      throw new Error("Could not determine submission file confirmation URL.");
    }

    // Step 3: Confirm
    const confirmRes = await nodeFetch(confirmUrl, {
      method: "POST",
      headers: this.authHeaders,
      body: "{}",
    });

    if (confirmRes.status >= 400) {
      throw new Error(`Submission file confirmation failed: HTTP ${confirmRes.status}`);
    }

    const confirmed = JSON.parse(confirmRes.body) as CanvasFileUploadResult;
    return confirmed.id;
  }

  /** Submit an assignment (text entry or file upload). */
  async submitAssignment(
    courseId: string,
    assignmentId: string,
    submissionType: "online_text_entry" | "online_upload",
    body?: string,
    fileIds?: number[]
  ): Promise<CanvasSubmissionResult> {
    const payload: Record<string, unknown> = {
      submission: {
        submission_type: submissionType,
        ...(body ? { body } : {}),
        ...(fileIds && fileIds.length > 0 ? { file_ids: fileIds } : {}),
      },
    };
    return this.post<CanvasSubmissionResult>(
      `/courses/${courseId}/assignments/${assignmentId}/submissions`,
      payload
    );
  }

  /** Download a file from Canvas to the local filesystem. */
  async downloadFile(fileId: string, savePath?: string): Promise<{ localPath: string; size: number }> {
    // Get file metadata
    const fileMeta = await this.getOne<CanvasFile>(`/files/${fileId}`);
    const localPath = savePath
      ? path.resolve(savePath)
      : path.resolve(process.cwd(), fileMeta.filename);

    // Canvas file URLs are pre-signed S3 URLs — do NOT send auth headers or S3 rejects with 400
    const res = await nodeFetch(fileMeta.url, {});
    if (res.status >= 400) {
      throw new Error(`Failed to download file: HTTP ${res.status}`);
    }

    fs.writeFileSync(localPath, res.rawBuffer ?? Buffer.from(res.body));
    return { localPath, size: res.rawBuffer?.length ?? res.body.length };
  }

  // ─── Multipart Form Builder ───────────────────────────────────────────────

  /**
   * Build a multipart/form-data body from Canvas upload params + file buffer.
   */
  private buildMultipartForm(
    params: Record<string, string>,
    filename: string,
    fileBuffer: Buffer
  ): { contentType: string; body: Buffer } {
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    for (const [key, value] of Object.entries(params)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
        )
      );
    }

    // File part
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
      )
    );
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    return {
      contentType: `multipart/form-data; boundary=${boundary}`,
      body: Buffer.concat(parts),
    };
  }
}
