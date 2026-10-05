#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

createMcpServer().connect(new StdioServerTransport()).catch(() => {
  process.stderr.write("Canvas MCP could not start.\n");
  process.exitCode = 1;
});
