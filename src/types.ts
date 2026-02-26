/**
 * Shared TypeScript types for Canvas LMS API responses and MCP tools.
 */

// ─── Canvas API Response Types ────────────────────────────────────────────────

export interface CanvasTerm {
  id: number;
  name: string;
  start_at: string | null;
  end_at: string | null;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  term?: CanvasTerm;
  enrollments?: CanvasEnrollment[];
  workflow_state: string;
}

export interface CanvasEnrollment {
  type: string;
  role: string;
  enrollment_state: string;
}

export interface CanvasRubricCriterion {
  id: string;
  description: string;
  long_description: string;
  points: number;
  ratings: Array<{
    id: string;
    description: string;
    long_description: string;
    points: number;
  }>;
}

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at: string | null;
  workflow_state: string;
  score: number | null;
  grade: string | null;
  submission_type: string | null;
  attempt: number | null;
  late: boolean;
  missing: boolean;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  rubric?: CanvasRubricCriterion[];
  submission?: CanvasSubmission;
  has_submitted_submissions: boolean;
  course_id: number;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message: string | null;
  posted_at: string;
  author: {
    display_name: string;
  };
  context_code: string;
}

export interface CanvasFile {
  id: number;
  filename: string;
  display_name: string;
  size: number;
  'content-type': string;
  created_at: string;
  updated_at: string;
  url: string;
  folder_id: number;
}

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  folders_url: string;
  files_url: string;
}

export interface CanvasUploadToken {
  upload_url: string;
  upload_params: Record<string, string>;
}

export interface CanvasFileUploadResult {
  id: number;
  filename: string;
  url: string;
  'content-type': string;
  size: number;
}

export interface CanvasSubmissionResult {
  id: number;
  submitted_at: string;
  workflow_state: string;
  assignment_id: number;
}

// ─── MCP Tool Return Types ─────────────────────────────────────────────────────

export interface CourseItem {
  id: string;
  name: string;
  course_code: string;
  enrollment_type: string;
  term_name: string;
}

export interface AssignmentItem {
  id: string;
  name: string;
  description: string;
  due_date: string | null;
  points_possible: number;
  submitted: boolean;
  score: number | null;
}

export interface AssignmentDetail {
  id: string;
  name: string;
  description: string;
  due_date: string | null;
  points_possible: number;
  submission_types: string[];
  rubric: string;
  submitted: boolean;
  score: number | null;
}

export interface AnnouncementItem {
  title: string;
  message: string;
  posted_date: string;
  author: string;
  course_name: string;
}

export interface SyllabusResult {
  course_name: string;
  syllabus: string;
}

export interface SubmissionResult {
  submission_id: string;
  submitted_at: string;
  status: string;
}

export interface FileItem {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  created_date: string;
  download_url: string;
}

export interface FileUploadResult {
  file_id: string;
  filename: string;
  url: string;
}

export interface FileDownloadResult {
  local_path: string;
  file_size: number;
}

export interface UpcomingDeadlineItem {
  assignment_name: string;
  course_name: string;
  due_date: string;
  points_possible: number;
  submitted: boolean;
}

// ─── Canvas Syllabus Response ──────────────────────────────────────────────────

export interface CanvasCourseWithSyllabus extends CanvasCourse {
  syllabus_body: string | null;
}
