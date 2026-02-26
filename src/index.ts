/**
 * Canvas LMS MCP Server entry point.
 * Connects to Claude via stdio transport and exposes Canvas tools.
 */

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { CanvasClient } from "./canvas-client.js";
import { toolDefinitions } from "./tools.js";
import {
  handleListCourses,
  handleGetAssignments,
  handleGetAssignmentDetail,
  handleGetAnnouncements,
  handleGetSyllabus,
  handleSubmitAssignment,
  handleUploadFile,
  handleDownloadFile,
  handleListCourseFiles,
  handleGetUpcomingDeadlines,
} from "./tools.js";

// ─── Initialise MCP Server ─────────────────────────────────────────────────────

const server = new Server(
  {
    name: "canvas-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool Registry ─────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

// ─── Tool Dispatch ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // args can be undefined per SDK types; normalise to empty object
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  let client: CanvasClient;
  try {
    client = new CanvasClient();
  } catch (err) {
    return {
      content: [{ type: "text", text: `Configuration error: ${(err as Error).message}` }],
      isError: true,
    };
  }

  try {
    let result: unknown;

    switch (name) {
      case "list_courses":
        result = await handleListCourses(client, {
          enrollment_state: safeArgs.enrollment_state as string | undefined,
        });
        break;

      case "get_assignments":
        result = await handleGetAssignments(client, {
          course_id: safeArgs.course_id as string,
          include_past_due: safeArgs.include_past_due as boolean | undefined,
        });
        break;

      case "get_assignment_detail":
        result = await handleGetAssignmentDetail(client, {
          course_id: safeArgs.course_id as string,
          assignment_id: safeArgs.assignment_id as string,
        });
        break;

      case "get_announcements":
        result = await handleGetAnnouncements(client, {
          course_id: safeArgs.course_id as string | undefined,
          limit: safeArgs.limit as number | undefined,
        });
        break;

      case "get_syllabus":
        result = await handleGetSyllabus(client, {
          course_id: safeArgs.course_id as string,
        });
        break;

      case "submit_assignment":
        result = await handleSubmitAssignment(client, {
          course_id: safeArgs.course_id as string,
          assignment_id: safeArgs.assignment_id as string,
          submission_type: safeArgs.submission_type as "online_text_entry" | "online_upload",
          body: safeArgs.body as string | undefined,
          file_path: safeArgs.file_path as string | undefined,
        });
        break;

      case "upload_file":
        result = await handleUploadFile(client, {
          course_id: safeArgs.course_id as string,
          file_path: safeArgs.file_path as string,
          folder_path: safeArgs.folder_path as string | undefined,
        });
        break;

      case "download_file":
        result = await handleDownloadFile(client, {
          file_id: safeArgs.file_id as string,
          save_path: safeArgs.save_path as string | undefined,
        });
        break;

      case "list_course_files":
        result = await handleListCourseFiles(client, {
          course_id: safeArgs.course_id as string,
          folder_path: safeArgs.folder_path as string | undefined,
        });
        break;

      case "get_upcoming_deadlines":
        result = await handleGetUpcomingDeadlines(client, {
          days_ahead: safeArgs.days_ahead as number | undefined,
        });
        break;

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers communicate via stdio; logging goes to stderr only
  process.stderr.write("Canvas MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
