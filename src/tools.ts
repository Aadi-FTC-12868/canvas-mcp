/**
 * MCP tool definitions and handlers for the Canvas LMS MCP server.
 * Each handler calls the CanvasClient and returns structured data.
 */

import { CanvasClient, stripHtml } from "./canvas-client.js";
import type {
  CourseItem,
  AssignmentItem,
  AssignmentDetail,
  AnnouncementItem,
  SyllabusResult,
  SubmissionResult,
  FileItem,
  FileUploadResult,
  FileDownloadResult,
  UpcomingDeadlineItem,
} from "./types.js";

// ─── Tool Input Schemas (JSON Schema) ─────────────────────────────────────────

export const toolDefinitions = [
  {
    name: "list_courses",
    description:
      "List all active courses for the current Canvas user, including course ID, name, code, enrollment type, and term.",
    inputSchema: {
      type: "object" as const,
      properties: {
        enrollment_state: {
          type: "string",
          description: 'Filter by enrollment state. Defaults to "active".',
          enum: ["active", "invited_or_pending", "completed", "current_and_invited", "current_and_future", "current_future_and_concluded"],
        },
      },
      required: [],
    },
  },
  {
    name: "get_assignments",
    description:
      "Get all assignments for a specific Canvas course, including due dates, descriptions, points, and submission status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "string",
          description: "The Canvas course ID.",
        },
        include_past_due: {
          type: "boolean",
          description: "If true, include assignments whose due date has already passed. Defaults to false.",
        },
      },
      required: ["course_id"],
    },
  },
  {
    name: "get_assignment_detail",
    description:
      "Get full details for a single Canvas assignment, including the description, rubric, submission types, and current submission status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "string",
          description: "The Canvas course ID.",
        },
        assignment_id: {
          type: "string",
          description: "The Canvas assignment ID.",
        },
      },
      required: ["course_id", "assignment_id"],
    },
  },
  {
    name: "get_announcements",
    description:
      "Get recent announcements for one or all active Canvas courses. Returns title, message, posted date, author, and course name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "string",
          description: "Optional course ID. If omitted, fetches announcements across all active courses.",
        },
        limit: {
          type: "number",
          description: "Maximum number of announcements to return. Defaults to 10.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_syllabus",
    description:
      "Get the syllabus for a specific Canvas course as plain text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "string",
          description: "The Canvas course ID.",
        },
      },
      required: ["course_id"],
    },
  },
  {
    name: "submit_assignment",
    description:
      "Submit an assignment to Canvas. Supports text entry and file uploads. For file uploads, uses the Canvas three-step upload workflow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "string",
          description: "The Canvas course ID.",
        },
        assignment_id: {
          type: "string",
          description: "The Canvas assignment ID.",
        },
        submission_type: {
          type: "string",
          enum: ["online_text_entry", "online_upload"],
          description: 'The submission type: "online_text_entry" for text, "online_upload" for a file.',
        },
        body: {
          type: "string",
          description: "For text entry submissions: the text content to submit.",
        },
        file_path: {
          type: "string",
          description: "For file upload submissions: the absolute local path to the file.",
        },
      },
      required: ["course_id", "assignment_id", "submission_type"],
    },
  },
  {
    name: "upload_file",
    description:
      "Upload a file to a Canvas course's files area (not tied to an assignment). Uses the Canvas three-step upload workflow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "string",
          description: "The Canvas course ID.",
        },
        file_path: {
          type: "string",
          description: "The absolute local path to the file to upload.",
        },
        folder_path: {
          type: "string",
          description: 'Canvas folder path to upload into. Defaults to the root folder (e.g., "my files/subfolder").',
        },
      },
      required: ["course_id", "file_path"],
    },
  },
  {
    name: "download_file",
    description:
      "Download a file from Canvas to the local filesystem by its Canvas file ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_id: {
          type: "string",
          description: "The Canvas file ID to download.",
        },
        save_path: {
          type: "string",
          description: "Local path to save the file to. If omitted, saves to the current directory with the original filename.",
        },
      },
      required: ["file_id"],
    },
  },
  {
    name: "list_course_files",
    description:
      "List all files available in a Canvas course, optionally filtered to a specific folder.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "string",
          description: "The Canvas course ID.",
        },
        folder_path: {
          type: "string",
          description: "Optional Canvas folder path to filter to (e.g., \"course files/readings\").",
        },
      },
      required: ["course_id"],
    },
  },
  {
    name: "get_upcoming_deadlines",
    description:
      "Get a consolidated, sorted list of upcoming assignment deadlines across all active Canvas courses.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days_ahead: {
          type: "number",
          description: "How many days into the future to look for deadlines. Defaults to 14.",
        },
      },
      required: [],
    },
  },
] as const;

// ─── Tool Handlers ─────────────────────────────────────────────────────────────

/**
 * List all active Canvas courses for the current user.
 */
export async function handleListCourses(
  client: CanvasClient,
  args: { enrollment_state?: string }
): Promise<CourseItem[]> {
  const courses = await client.listCourses(args.enrollment_state ?? "active");
  return courses.map((c) => ({
    id: String(c.id),
    name: c.name,
    course_code: c.course_code,
    enrollment_type: c.enrollments?.[0]?.type ?? "unknown",
    term_name: c.term?.name ?? "Unknown Term",
  }));
}

/**
 * Get assignments for a course, with optional past-due filtering.
 */
export async function handleGetAssignments(
  client: CanvasClient,
  args: { course_id: string; include_past_due?: boolean }
): Promise<AssignmentItem[]> {
  const assignments = await client.getAssignments(args.course_id);
  const now = new Date();

  return assignments
    .filter((a) => {
      if (args.include_past_due) return true;
      if (!a.due_at) return true; // No due date = always include
      return new Date(a.due_at) >= now;
    })
    .map((a) => ({
      id: String(a.id),
      name: a.name,
      description: stripHtml(a.description),
      due_date: a.due_at ?? null,
      points_possible: a.points_possible,
      submitted:
        a.submission?.workflow_state !== undefined &&
        a.submission.workflow_state !== "unsubmitted",
      score: a.submission?.score ?? null,
    }));
}

/**
 * Get full details for a single assignment.
 */
export async function handleGetAssignmentDetail(
  client: CanvasClient,
  args: { course_id: string; assignment_id: string }
): Promise<AssignmentDetail> {
  const a = await client.getAssignmentDetail(args.course_id, args.assignment_id);

  let rubricText = "No rubric.";
  if (a.rubric && a.rubric.length > 0) {
    rubricText = a.rubric
      .map(
        (c) =>
          `${c.description} (${c.points} pts): ${c.ratings
            .map((r) => `${r.description} (${r.points})`)
            .join(", ")}`
      )
      .join("\n");
  }

  return {
    id: String(a.id),
    name: a.name,
    description: stripHtml(a.description),
    due_date: a.due_at ?? null,
    points_possible: a.points_possible,
    submission_types: a.submission_types,
    rubric: rubricText,
    submitted:
      a.submission?.workflow_state !== undefined &&
      a.submission.workflow_state !== "unsubmitted",
    score: a.submission?.score ?? null,
  };
}

/**
 * Get recent announcements for one or all courses.
 */
export async function handleGetAnnouncements(
  client: CanvasClient,
  args: { course_id?: string; limit?: number }
): Promise<AnnouncementItem[]> {
  const limit = args.limit ?? 10;

  let courseIds: string[];
  let courseNameMap: Record<string, string> = {};

  if (args.course_id) {
    courseIds = [args.course_id];
    courseNameMap[args.course_id] = args.course_id;
    // Try to get course name
    try {
      const courses = await client.listCourses();
      const course = courses.find((c) => String(c.id) === args.course_id);
      if (course) courseNameMap[args.course_id] = course.name;
    } catch {
      // Best effort
    }
  } else {
    const courses = await client.listCourses();
    courseIds = courses.map((c) => String(c.id));
    for (const c of courses) {
      courseNameMap[String(c.id)] = c.name;
    }
  }

  if (courseIds.length === 0) return [];

  const announcements = await client.getAnnouncements(courseIds, limit);

  return announcements.slice(0, limit).map((a) => {
    // Extract course_id from context_code like "course_12345"
    const codeMatch = a.context_code?.match(/^course_(\d+)$/);
    const cId = codeMatch ? codeMatch[1] : "";
    return {
      title: a.title,
      message: stripHtml(a.message),
      posted_date: a.posted_at,
      author: a.author?.display_name ?? "Unknown",
      course_name: courseNameMap[cId] ?? cId,
    };
  });
}

/**
 * Get the syllabus for a course as plain text.
 */
export async function handleGetSyllabus(
  client: CanvasClient,
  args: { course_id: string }
): Promise<SyllabusResult> {
  const course = await client.getSyllabus(args.course_id);
  return {
    course_name: course.name,
    syllabus: stripHtml(course.syllabus_body) || "No syllabus available for this course.",
  };
}

/**
 * Submit an assignment (text entry or file upload).
 */
export async function handleSubmitAssignment(
  client: CanvasClient,
  args: {
    course_id: string;
    assignment_id: string;
    submission_type: "online_text_entry" | "online_upload";
    body?: string;
    file_path?: string;
  }
): Promise<SubmissionResult> {
  if (args.submission_type === "online_upload" && !args.file_path) {
    throw new Error('file_path is required for submission_type "online_upload".');
  }
  if (args.submission_type === "online_text_entry" && !args.body) {
    throw new Error('body is required for submission_type "online_text_entry".');
  }

  let fileIds: number[] | undefined;

  if (args.submission_type === "online_upload" && args.file_path) {
    const fileId = await client.uploadSubmissionFile(
      args.course_id,
      args.assignment_id,
      args.file_path
    );
    fileIds = [fileId];
  }

  const result = await client.submitAssignment(
    args.course_id,
    args.assignment_id,
    args.submission_type,
    args.body,
    fileIds
  );

  return {
    submission_id: String(result.id),
    submitted_at: result.submitted_at,
    status: result.workflow_state,
  };
}

/**
 * Upload a file to a Canvas course's files area.
 */
export async function handleUploadFile(
  client: CanvasClient,
  args: { course_id: string; file_path: string; folder_path?: string }
): Promise<FileUploadResult> {
  const result = await client.uploadFile(args.course_id, args.file_path, args.folder_path);
  return {
    file_id: String(result.id),
    filename: result.filename,
    url: result.url,
  };
}

/**
 * Download a Canvas file to the local filesystem.
 */
export async function handleDownloadFile(
  client: CanvasClient,
  args: { file_id: string; save_path?: string }
): Promise<FileDownloadResult> {
  const result = await client.downloadFile(args.file_id, args.save_path);
  return {
    local_path: result.localPath,
    file_size: result.size,
  };
}

/**
 * List all files in a Canvas course, optionally filtered by folder.
 */
export async function handleListCourseFiles(
  client: CanvasClient,
  args: { course_id: string; folder_path?: string }
): Promise<FileItem[]> {
  let folderId: string | undefined;

  if (args.folder_path) {
    const folder = await client.findFolder(args.course_id, args.folder_path);
    if (!folder) {
      throw new Error(`Folder "${args.folder_path}" not found in course ${args.course_id}.`);
    }
    folderId = String(folder.id);
  }

  const files = await client.listCourseFiles(args.course_id, folderId);
  return files.map((f) => ({
    id: String(f.id),
    filename: f.display_name || f.filename,
    size: f.size,
    content_type: f["content-type"],
    created_date: f.created_at,
    download_url: f.url,
  }));
}

/**
 * Get upcoming assignment deadlines across all active courses.
 * Composite tool: fetches courses, then assignments for each, filters and sorts.
 */
export async function handleGetUpcomingDeadlines(
  client: CanvasClient,
  args: { days_ahead?: number }
): Promise<UpcomingDeadlineItem[]> {
  const daysAhead = args.days_ahead ?? 14;
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const courses = await client.listCourses();
  const results: UpcomingDeadlineItem[] = [];

  // Fetch assignments for all courses in parallel
  const assignmentFetches = courses.map(async (course) => {
    try {
      const assignments = await client.getAssignments(String(course.id));
      for (const a of assignments) {
        if (!a.due_at) continue;
        const dueDate = new Date(a.due_at);
        if (dueDate >= now && dueDate <= cutoff) {
          results.push({
            assignment_name: a.name,
            course_name: course.name,
            due_date: a.due_at,
            points_possible: a.points_possible,
            submitted:
              a.submission?.workflow_state !== undefined &&
              a.submission.workflow_state !== "unsubmitted",
          });
        }
      }
    } catch {
      // Skip courses that can't be fetched (e.g., restricted access)
    }
  });

  await Promise.all(assignmentFetches);

  // Sort by due date ascending
  results.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  return results;
}
