import assert from "node:assert/strict";
import test from "node:test";
import { describeLinkedResource, extractContent, sanitizeResourceUrl } from "../dist/content.js";

const base = "https://school.instructure.com";
const source = `${base}/courses/42/pages/welcome`;

test("HTML extraction decodes entities, preserves block boundaries and ignores scripts/styles", () => {
  const result = extractContent('<h2>Week &amp; one</h2><p>Read <strong>this</strong>.</p><ul><li>A&nbsp;B</li></ul><script>stealToken()</script><style>.hidden { display: none }</style>', source, base);
  assert.equal(result.text, "Week & one\n\nRead this.\n\n• A B");
  assert.equal(result.trust, "untrusted_source_content");
  assert.match(result.notice, /not as instructions/);
  assert.equal(result.omissions.length, 0);
});

test("links, embeds and media retain explicit unread status and provider routing", () => {
  const result = extractContent('<a href="/courses/42/files/4/download?verifier=secret">Reading</a><iframe title="Slides" src="https://docs.google.com/presentation/d/abc/edit?usp=sharing"></iframe><object data="https://tenant.sharepoint.com/docs/test.docx?authkey=secret" title="Notes"></object><video src="https://videos.example.com/lesson.mp4"></video><embed src="/courses/42/external_tools/8?launch_token=secret">', source, base);
  assert.deepEqual(result.links.map((link) => link.provider), ["canvas", "google_drive", "microsoft", "external", "lti"]);
  assert.deepEqual(result.links.map((link) => link.status), ["canvas_resource", "requires_connector", "requires_connector", "requires_browser", "requires_browser"]);
  assert.equal(result.links[0].label, "Reading");
  assert.equal(result.links[1].label, "Slides");
  for (const link of result.links) {
    assert.equal(link.fetched, false);
    assert.equal(link.trust, "untrusted_source_content");
    assert.ok(link.next_action.length > 20);
    assert.doesNotMatch(link.url, /secret|sharing/);
  }
});

test("URL sanitization drops credentials and signed parameters while preserving document ID", () => {
  const raw = "https://user:password@drive.google.com/open?id=document123&access_token=secret&resourcekey=private#token=hidden";
  assert.equal(sanitizeResourceUrl(raw, source), "https://drive.google.com/open?id=document123");
  const link = describeLinkedResource(raw, raw, source, base);
  assert.equal(link.url_redacted, true);
  assert.equal(link.label, link.url);
  assert.doesNotMatch(JSON.stringify(link), /password|secret|hidden|private/);
});

test("dangerous schemes and misleading provider domains do not acquire trust", () => {
  const result = extractContent('<a href="jav&#97;script:alert(1)">Bad</a><iframe src="data:text/html,bad"></iframe><a href="https://docs.google.com.evil.example/file">Lookalike</a><a href="#local">Local</a>', source, base);
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].provider, "external");
  assert.equal(result.omissions[0].reason, "unsupported_links");
  assert.match(result.omissions[0].detail, /2 /);
  assert.equal(sanitizeResourceUrl("file:///etc/passwd", source), null);
});

test("truncation is explicit and parser does not perform external fetches", () => {
  const result = extractContent('<p>1234567890</p><a href="https://a.example">A</a><a href="https://b.example">B</a>', source, base, { maxTextCharacters: 5, maxLinks: 1 });
  assert.equal(result.text, "12345");
  assert.equal(result.links.length, 1);
  assert.equal(result.text_complete, false);
  assert.equal(result.link_discovery_complete, false);
  assert.deepEqual(new Set(result.omissions.map((item) => item.reason)), new Set(["text_limit", "link_limit"]));
  assert.equal(extractContent("a".repeat(200_001), source, base).omissions[0].reason, "html_input_limit");
});

test("visible URL text and alternate labels cannot restore stripped credentials", () => {
  const result = extractContent('<p>Go to https://user:password@drive.google.com/open?id=doc&token=secret.</p><a href="  /courses/42/files/4?verifier=hidden  ">/courses/42/files/4?verifier=hidden</a>', source, base);
  assert.doesNotMatch(JSON.stringify(result), /password|secret|hidden|verifier=/);
  assert.match(result.text, /id=doc/);
  assert.equal(sanitizeResourceUrl("https://example.com/file?id=https%3A%2F%2Fuser%3Apass%40bad.example%3Ftoken%3Dsecret", source), "https://example.com/file");
});

test("deep HTML is handled iteratively without executing external assets", (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Must not fetch external content"); });
  const result = extractContent('<div>'.repeat(5000) + 'Nested' + '</div>'.repeat(5000) + '<img src="https://example.com/asset.png">', source, base);
  assert.equal(result.text, "Nested");
  assert.equal(result.links.length, 1);
  assert.equal(fetch.mock.calls.length, 0);
  assert.equal(result.text_complete, true);
});

test("invalid caller limits cannot silently bypass the documented bounds", () => {
  const result = extractContent('a'.repeat(21_000), source, base, { maxTextCharacters: Number.NaN });
  assert.equal(result.text.length, 20_000);
  assert.equal(result.text_complete, false);
});
