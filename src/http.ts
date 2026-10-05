/** Local development transport only. A production multi-user OAuth broker is a separate milestone. */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { createContext } from "./tools.js";

export function createLocalHttpServer(secret: string) {
  if (secret.length < 32) throw new Error("MCP_LOCAL_SECRET must contain at least 32 characters.");
  const context = createContext();
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const deny = (status: number, message: string) => {res.writeHead(status, {"Content-Type": "application/json"}); res.end(JSON.stringify({error: message}));};
    // Reject browser-origin traffic; this endpoint is for direct local MCP clients.
    if (req.headers.origin) {deny(403, "Browser origins are not supported."); return;}
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? "")) {deny(403, "Loopback Host required."); return;}
    if (req.url !== "/mcp") {deny(404, "Not found."); return;}
    const actual = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from("Bearer " + secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {deny(401, "Local MCP authentication required."); return;}
    if (req.method !== "POST") {res.setHeader("Allow", "POST"); deny(405, "Only POST is supported by this stateless development transport."); return;}
    const server = createMcpServer(context);
    const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true});
    res.on("close", () => {void transport.close(); void server.close();});
    try {await server.connect(transport); await transport.handleRequest(req, res);}
    catch {if (!res.headersSent) deny(500, "MCP request failed."); else res.end();}
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const port = Number(process.env.PORT ?? 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port.");
    createLocalHttpServer(process.env.MCP_LOCAL_SECRET ?? "").listen(port, "127.0.0.1", () => {
      process.stderr.write("Canvas MCP development endpoint: http://127.0.0.1:" + port + "/mcp\n");
    }).on("error", () => {process.stderr.write("Could not listen on the local MCP port.\n"); process.exitCode = 1;});
  } catch {process.stderr.write("Set MCP_LOCAL_SECRET (at least 32 characters) and a valid PORT. This transport is loopback-only.\n"); process.exitCode = 1;}
}
