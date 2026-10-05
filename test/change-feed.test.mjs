import test from 'node:test';
import assert from 'node:assert/strict';
import {CourseChangeFeed} from '../dist/change-feed.js';

function client(baseUrl = 'https://school.example') {
  return {
    baseUrl,
    assignments: [{id: 10, name: 'Essay', due_at: '2026-10-10', description: 'PRIVATE BODY', submission: {score: null, body: 'PRIVATE RESPONSE'}}],
    announcements: [{id: 20, title: 'Welcome', message: 'PRIVATE ANNOUNCEMENT'}],
    calls: [], fail: undefined,
    async getAll(path, params) {
      this.calls.push({path, params});
      const kind = path.endsWith('/assignments') ? 'assignments' : 'announcements';
      if (this.fail === kind) throw new Error('partial fetch failed');
      return structuredClone(this[kind]);
    },
  };
}

test('first poll is silent; unchanged reads preserve cursor and use sequential endpoints', async () => {
  const feed = new CourseChangeFeed(); const api = client();
  const first = await feed.poll(api, '1');
  assert.equal(first.baseline_established, true);
  assert.deepEqual(first.events, []);
  assert.equal(first.total_events, 0);
  assert.deepEqual(api.calls, [
    {path: '/courses/1/assignments', params: {'include[]': ['submission']}},
    {path: '/courses/1/discussion_topics', params: {only_announcements: 'true'}},
  ]);
  const second = await feed.poll(api, '1');
  assert.equal(second.baseline_established, false);
  assert.equal(second.cursor, first.cursor);
  assert.deepEqual(second.events, []);
});

test('detects due dates, submission grades/bodies, announcements, and new resources without exposing bodies', async () => {
  const feed = new CourseChangeFeed(); const api = client();
  await feed.poll(api, '1');
  api.assignments[0].due_at = '2026-10-12';
  let result = await feed.poll(api, '1');
  assert.deepEqual(result.events.map(x => x.type), ['assignment.updated']);
  api.assignments[0].submission.score = 9;
  result = await feed.poll(api, '1');
  assert.equal(result.events[0].type, 'assignment.updated');
  api.assignments[0].submission.body = 'NEW PRIVATE RESPONSE';
  api.announcements[0].message = 'NEW PRIVATE ANNOUNCEMENT';
  api.assignments.push({id: 11, name: 'New assignment'});
  api.announcements.push({id: 21, title: 'New announcement'});
  result = await feed.poll(api, '1');
  assert.deepEqual(result.events.map(x => x.type), ['assignment.updated', 'assignment.created', 'announcement.updated', 'announcement.created']);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|score|New assignment/);
  assert.equal(new Set(result.events.map(x => x.id)).size, 4);
  assert.deepEqual((await feed.poll(api, '1')).events, []);
});

test('failure after assignments leaves committed cursor and both resource baselines unchanged', async () => {
  const feed = new CourseChangeFeed(); const api = client();
  const first = await feed.poll(api, '1');
  api.assignments[0].due_at = '2026-11-01';
  api.fail = 'announcements';
  await assert.rejects(feed.poll(api, '1'), /partial fetch failed/);
  api.fail = undefined;
  // Restore state to demonstrate the failed read did not commit its partial assignment change.
  api.assignments[0].due_at = '2026-10-10';
  assert.equal((await feed.poll(api, '1')).cursor, first.cursor);
  api.assignments[0].due_at = '2026-11-01';
  api.fail = 'announcements';
  await assert.rejects(feed.poll(api, '1'));
  api.fail = undefined;
  const retried = await feed.poll(api, '1');
  assert.equal(retried.events.length, 1);
  assert.match(retried.cursor, /:1$/);
  assert.deepEqual((await feed.poll(api, '1')).events, []);
});

test('failed first poll does not establish baseline or consume course capacity', async () => {
  const feed = new CourseChangeFeed({maxCourses: 1}); const api = client();
  api.fail = 'announcements';
  await assert.rejects(feed.poll(api, '1'));
  api.fail = undefined;
  api.assignments.push({id: 11, name: 'Appeared during retry'});
  const result = await feed.poll(api, '2');
  assert.equal(result.baseline_established, true);
  assert.deepEqual(result.events, []);
});

test('separate clients, origins, and courses have independent baselines and feed reset is explicit', async () => {
  const feed = new CourseChangeFeed(); const a = client(); const b = client(); const c = client('https://another.example');
  const first = await feed.poll(a, '1');
  a.assignments[0].due_at = '2026-11-01';
  assert.equal((await feed.poll(b, '1')).baseline_established, true);
  assert.equal((await feed.poll(c, '1')).baseline_established, true);
  assert.equal((await feed.poll(a, '2')).baseline_established, true);
  assert.equal((await feed.poll(a, '1')).events.length, 1);
  a.baseUrl = 'https://changed.example';
  assert.equal((await feed.poll(a, '1')).baseline_established, true);
  const reset = await new CourseChangeFeed().poll(b, '1');
  assert.equal(reset.baseline_established, true);
  assert.notEqual(reset.cursor.split(':')[0], first.cursor.split(':')[0]);
});

test('concurrent polls of the same scope reject while unrelated scopes can finish', async () => {
  const feed = new CourseChangeFeed(); const api = client();
  let release;
  let started;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const original = api.getAll;
  api.getAll = async function(path, params) {
    if (path === '/courses/1/assignments') { started(); await gate; }
    return original.call(this, path, params);
  };
  const running = feed.poll(api, '1');
  await entered;
  await assert.rejects(feed.poll(api, '1'), error => error.code === 'poll_in_progress');
  assert.equal((await feed.poll(api, '2')).baseline_established, true);
  assert.equal(api.calls.some(call => call.path === '/courses/1/discussion_topics'), false);
  release();
  assert.equal((await running).baseline_established, true);
  assert.deepEqual((await feed.poll(api, '1')).events, []);
});

test('disappearance never emits deletion; unchanged reappearance is not treated as creation', async () => {
  const feed = new CourseChangeFeed(); const api = client();
  const original = structuredClone(api.assignments);
  const baseline = await feed.poll(api, '1');
  api.assignments = [];
  assert.equal((await feed.poll(api, '1')).cursor, baseline.cursor);
  api.assignments = original;
  assert.deepEqual((await feed.poll(api, '1')).events, []);
});

test('caps tracked courses and returned events, marks truncation, and accounts for every change', async () => {
  const feed = new CourseChangeFeed({maxCourses: 1, maxEvents: 2}); const api = client();
  await feed.poll(api, '1');
  await assert.rejects(feed.poll(api, '2'), error => error.code === 'change_feed_limit');
  api.assignments.push(...[30, 31, 32].map(id => ({id, name: 'Added'})));
  const result = await feed.poll(api, '1');
  assert.equal(result.events.length, 2);
  assert.equal(result.total_events, 3);
  assert.equal(result.events_truncated, true);
  assert.match(result.cursor, /:3$/);
  assert.deepEqual((await feed.poll(api, '1')).events, []);
});

test('resource-limit and malformed full snapshots cannot advance the baseline', async () => {
  const feed = new CourseChangeFeed({maxItemsPerCourse: 2}); const api = client();
  const first = await feed.poll(api, '1');
  api.assignments.push({id: 30, name: 'Beyond limit'});
  await assert.rejects(feed.poll(api, '1'), error => error.code === 'change_feed_limit');
  api.assignments.pop();
  api.announcements.push({...api.announcements[0]});
  await assert.rejects(feed.poll(api, '1'), error => error.code === 'invalid_response');
  api.announcements.pop();
  assert.equal((await feed.poll(api, '1')).cursor, first.cursor);
});
