#!/usr/bin/env node
import "dotenv/config";
import { z } from "zod";
import { tools, invokeTool, createContext, errorResult } from "./tools.js";
const [command, name, ...rest] = process.argv.slice(2);
async function main() {
  if (!command || command === "help" || command === "--help") {
    console.log("canvas tools\ncanvas call TOOL '{\"course_id\":\"123\"}'\n\nCredentials come from CANVAS_BASE_URL and CANVAS_API_TOKEN in the environment.\nThis alpha reads Canvas only. Every call prints JSON. No background polling.");
  } else if (command === "tools") {
    console.log(JSON.stringify(tools.map(t => ({name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema), annotations: t.annotations})), null, 2));
  } else if (command === "call" && name) {
    let args: unknown;
    try { args = JSON.parse(rest.join(" ") || "{}"); } catch { throw new Error("Invalid argument JSON"); }
    console.log(JSON.stringify(await invokeTool(name, args, createContext()), null, 2));
  } else throw new Error("Unknown command");
}
main().catch(error => {console.error(JSON.stringify(errorResult(error))); process.exitCode = 1;});
