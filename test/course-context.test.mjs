import assert from "node:assert/strict";
import test from "node:test";
import { getCourseContext } from "../dist/course-context.js";

const baseUrl = "https://school.instructure.com";

function fakeClient(overrides = {}) {
  const calls = [];
  const client = {
    baseUrl,
    calls,
    async getOne(endpoint, params) {
      calls.push({ method: "getOne", endpoint, params });
      if (overrides.getOne) return overrides.getOne(endpoint, params);
      return { id: 42, name: "Literature", syllabus_body: '<p>Read <a href="https://docs.google.com/document/d/readme/edit?access_token=secret">The guide</a></p>' };
    },
    async getAll(endpoint, params) {
      calls.push({ method: "getAll", endpoint, params });
      if (overrides.getAll) return overrides.getAll(endpoint, params);
      if (endpoint.endsWith("/assignments")) return [{ id: 5, name: "Essay", description: '<p>Write a response.</p>', due_at: null }];
      if (endpoint.endsWith("/modules")) return [{ id: 6, name: "Week One", items_count: 2 }];
      if (endpoint.endsWith("/items")) return [{ id: 7, title: "External reading", type: "ExternalUrl", external_url: "https://example.com/book", content_details: { html_url: "https://tenant.sharepoint.com/file.docx?authkey=secret" } }, { id: 8, title: "Publisher", type: "ExternalTool", external_url: "https://publisher.example.com/launch?token=secret" }];
      if (endpoint.endsWith("/pages")) return [{ page_id: 9, title: "Welcome", url: "welcome", body: "must not expose an accidentally included page body" }];
      if (endpoint.endsWith("/files")) return [{ id: 10, filename: "reading.pdf", size: 123, url: "https://s3.example.com/file?signature=secret" }];
      throw new Error(`Unexpected endpoint ${endpoint}`);
    },
  };
  return client;
}

test("course context includes independently sourced sections and an unread link manifest", async () => {
  const client = fakeClient();
  const result = await getCourseContext(client, "42");
  assert.equal(result.context_complete, false);
  assert.equal(result.trust, "untrusted_source_content");
  assert.deepEqual(Object.keys(result.sections), ["course", "assignments", "modules", "pages", "files"]);
  for (const section of Object.values(result.sections)) {
    assert.equal(section.status, "available");
    assert.match(section.source_url, /\/api\/v1\/courses\/42/);
    assert.equal(section.trust, "untrusted_source_content");
  }
  assert.equal(result.sections.modules.data[0].items.data.length, 2);
  assert.equal(result.sections.pages.data[0].body_status, "not_fetched");
  assert.equal(result.sections.files.data[0].content_status, "not_fetched");
  assert.deepEqual(new Set(result.linked_resources.map((link) => link.provider)), new Set(["google_drive", "external", "microsoft", "lti"]));
  assert.doesNotMatch(JSON.stringify(result), /access_token|authkey|signature=|secret|accidentally included/);
  assert.deepEqual(client.calls.find((call) => call.method === "getOne").params, { "include[]": ["syllabus_body"] });
  assert.deepEqual(client.calls.find((call) => call.endpoint.endsWith("/items")).params, { "include[]": ["content_details"] });
  assert.ok(client.calls.every((call) => call.endpoint.startsWith("/courses/42")));
  assert.ok(!client.calls.some((call) => /\/pages\/.+/.test(call.endpoint)));
});

test("one blocked or incomplete section does not hide available course context", async () => {
  const client = fakeClient({
    getAll(endpoint) {
      if (endpoint.endsWith("/files")) throw Object.assign(new Error("sensitive server message"), { status: 403 });
      if (endpoint.endsWith("/assignments")) throw new Error("pagination limit reached");
      return [];
    },
  });
  const result = await getCourseContext(client, "42");
  assert.equal(result.sections.course.status, "available");
  assert.equal(result.sections.files.status, "blocked");
  assert.equal(result.sections.assignments.status, "error");
  assert.equal(result.sections.assignments.data, undefined);
  assert.equal(result.sections.files.data, undefined);
  assert.match(result.sections.files.next_action, /access/);
  assert.doesNotMatch(JSON.stringify(result), /sensitive server message/);
});

test("module item requests are sequential, bounded and explicitly omitted after ten", async () => {
  let concurrent = 0;
  let peakConcurrent = 0;
  let itemRequests = 0;
  const client = fakeClient({
    async getAll(endpoint) {
      if (endpoint.endsWith("/modules")) return Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Module ${i + 1}` }));
      if (endpoint.endsWith("/items")) {
        itemRequests++;
        concurrent++;
        peakConcurrent = Math.max(peakConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 1));
        concurrent--;
      }
      return [];
    },
  });
  const result = await getCourseContext(client, "42");
  assert.equal(itemRequests, 10);
  assert.equal(peakConcurrent, 1);
  assert.equal(result.sections.modules.data.length, 12);
  assert.equal(result.sections.modules.data[10].items.status, "blocked");
  assert.equal(result.sections.modules.data[10].items.data, undefined);
  assert.match(result.sections.modules.data[10].items.source_url, /\/modules\/11\/items$/);
  assert.equal(result.sections.modules.data[10].items.omissions[0].reason, "module_fetch_limit");
  assert.match(result.sections.modules.omissions[0].detail, /2 listed modules/);
});

test("bounded rows and missing syllabus are reported without claiming completeness", async () => {
  const client = fakeClient({
    getOne() { return { id: 42, name: "No included syllabus" }; },
    getAll(endpoint) { return endpoint.endsWith("/pages") ? Array.from({ length: 102 }, (_, id) => ({ page_id: id, url: `page-${id}`, title: `Page ${id}` })) : []; },
  });
  const result = await getCourseContext(client, "42");
  assert.equal(result.sections.pages.data.length, 100);
  assert.equal(result.sections.pages.omissions[0].reason, "row_limit");
  assert.equal(result.sections.pages.omissions[1].reason, "page_bodies_lazy");
  assert.equal(result.sections.course.omissions[0].reason, "syllabus_not_returned");
});

test("course identifiers cannot inject another API route", async () => {
  const client = fakeClient();
  await assert.rejects(getCourseContext(client, "42/../../users"), /numeric/);
  assert.equal(client.calls.length, 0);
});

test("unreturned bodies and rejected module links remain explicit gaps", async () => {
  const client = fakeClient({
    getAll(endpoint) {
      if (endpoint.endsWith("/assignments")) return [{ id: 5, name: "Locked assignment" }];
      if (endpoint.endsWith("/modules")) return [{ id: 6 }];
      if (endpoint.endsWith("/items")) return [{ id: 7, type: "ExternalUrl", external_url: "javascript:bad()", content_details: { nested: { url: "https://example.com/private?token=hidden" } } }];
      return [];
    },
  });
  const result = await getCourseContext(client, "42");
  const description = result.sections.assignments.data[0].description;
  assert.equal(description.text_complete, false);
  assert.equal(description.omissions[0].reason, "body_not_returned");
  const item = result.sections.modules.data[0].items.data[0];
  assert.deepEqual(item.omissions.map((item) => item.reason), ["unsupported_links", "nested_details_not_inspected"]);
  assert.doesNotMatch(JSON.stringify(result), /javascript:|token=hidden|bad\(\)/);
});

test("module item link and global manifest limits have explicit omissions", async () => {
  const client = fakeClient({
    getAll(endpoint) {
      if (endpoint.endsWith("/assignments")) return Array.from({ length: 20 }, (_, id) => ({ id, description: Array.from({ length: 20 }, (_, i) => `<a href="https://example.com/${id}/${i}">Link ${i}</a>`).join("") }));
      if (endpoint.endsWith("/modules")) return [{ id: 6 }];
      if (endpoint.endsWith("/items")) return [{ id: 7, content_details: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`item${i}_url`, `https://example.com/${i}`])) }];
      return [];
    },
  });
  const result = await getCourseContext(client, "42");
  assert.equal(result.linked_resources.length, 300);
  assert.equal(result.omissions.at(-1).reason, "manifest_limit");
  const item = result.sections.modules.data[0].items.data[0];
  assert.equal(item.links.length, 20);
  assert.equal(item.omissions[0].reason, "link_limit");
  assert.match(item.omissions[0].detail, /2 additional/);
});
