import test from 'node:test';
import assert from 'node:assert/strict';
import {CanvasClient} from '../dist/canvas-client.js';
const baseUrl='https://school.example';
const token='test-token-never-forward';
function client(fetcher, rest={}) { return new CanvasClient({baseUrl,token,fetch:fetcher,sleep:async()=>{},...rest}); }
function response(data, status=200, headers={}) {return new Response(JSON.stringify(data),{status,headers});}

test('pagination returns complete arrays and repeats query fields', async()=>{
  const seen=[];
  const c=client(async(url, init)=>{seen.push([String(url),init]); return seen.length===1 ? response([{id:1}],200,{link:'<https://school.example/api/v1/courses?page=2>; rel="next"'}) : response([{id:2}]);});
  assert.deepEqual(await c.getAll('/courses',{'include[]':['term','enrollments']}),[{id:1},{id:2}]);
  assert.deepEqual(new URL(seen[0][0]).searchParams.getAll('include[]'),['term','enrollments']);
  assert.equal(seen[0][1].redirect,'manual');
  assert.equal(seen[1][1].headers.Authorization,'Bearer '+token);
  assert.equal(seen[0][1].headers.Accept,'application/json+canvas-string-ids');
});
test('pagination handles parameter ordering, multiple relations, and quoted titles',async()=>{
  let calls=0;
  const c=client(async()=>++calls===1 ? response([{id:'9007199254740993'}],200,{link:'<?page=1>; title="ignore; rel=next"; rel="prev", <?page=2>; type="application/json"; rel="next last"'}) : response([{id:'9007199254740994'}]));
  assert.deepEqual(await c.getAll('/courses'),[{id:'9007199254740993'},{id:'9007199254740994'}]);
  assert.equal(calls,2);
  const ambiguous=client(async()=>response([],200,{link:'<?page=2>; rel="next", <?page=3>; rel="next"'}));
  await assert.rejects(ambiguous.getAll('/courses'),e=>e.code==='invalid_pagination');
});
test('never forwards credentials to external, changed-path, userinfo or token pagination links', async()=>{
  for(const next of ['https://evil.example/api/v1/courses?page=2','https://school.example/api/v1/users?page=2','https://a:b@school.example/api/v1/courses?page=2','https://school.example/api/v1/courses?access_token=leak']){
    let calls=0; const c=client(async()=>{calls++; return response([],200,{link:'<'+next+'>; rel="next"'});});
    await assert.rejects(c.getAll('/courses'), e=>e.code==='unsafe_pagination'); assert.equal(calls,1);
  }
});
test('redirect and private response body do not escape error result', async()=>{
  const c=client(async()=>response({secret:token},302,{location:'https://evil.example'}));
  await assert.rejects(c.getOne('/courses/1'),e=>e.code==='upstream_error'&&!e.message.includes(token));
});
test('partial list does not look complete after authorization failure', async()=>{
  let calls=0; const c=client(async()=>++calls===1 ? response([{id:1}],200,{link:'<?page=2>; rel="next"'}) : response({secret:token},403));
  await assert.rejects(c.getAll('/courses'),e=>e.code==='permission_denied'&&e.status===403);
});
test('pagination limits, cycles, response size and wrong shape fail explicitly', async()=>{
  await assert.rejects(client(async()=>response([],200,{link:'<?page=2>; rel="next"'}),{maxPages:1}).getAll('/courses'),e=>e.code==='pagination_limit');
  await assert.rejects(client(async()=>response([],200,{link:'<?per_page=100>; rel="next"'})).getAll('/courses'),e=>e.code==='pagination_cycle');
  await assert.rejects(client(async()=>response('large text'),{maxBytes:3}).getOne('/courses/1'),e=>e.code==='response_limit');
  await assert.rejects(client(async()=>response({})).getAll('/courses'),e=>e.code==='invalid_response');
});
test('bounded retry honors short Retry-After and stops on long delay',async()=>{
  let calls=0; const delays=[];
  const c=client(async()=>++calls===1 ? response({},429,{'retry-after':'2'}) : response([]),{sleep:async ms=>{delays.push(ms);}});
  assert.deepEqual(await c.getAll('/courses'),[]); assert.deepEqual(delays,[2000]);
  await assert.rejects(client(async()=>response({},429,{'retry-after':'999'})).getAll('/courses'),e=>e.code==='rate_limited');
});
test('HTTPS origin and endpoint paths are validated before any request',async()=>{
  for(const baseUrl of ['http://school.example','https://a:b@school.example','https://school.example/course','https://school.example?secret=1']) {
    assert.throws(()=>new CanvasClient({baseUrl,token}),e=>e.code==='invalid_origin');
  }
  let calls=0; const c=client(async()=>{calls++;return response({});});
  for(const path of ['//evil.example','/courses/../users','/courses/%2e%2e/users','/courses?token=x','/courses\\evil']) await assert.rejects(c.getOne(path),e=>e.code==='invalid_endpoint');
  assert.equal(calls,0);
});
