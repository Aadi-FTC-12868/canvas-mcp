import test from 'node:test';
import {request} from 'node:http';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createMcpServer} from '../dist/server.js';
import {createContext,invokeTool} from '../dist/tools.js';
import {createLocalHttpServer} from '../dist/http.js';
import {CanvasClient} from '../dist/canvas-client.js';

test('real stdio initializes and discovers capabilities without credentials',async()=>{
  const client=new Client({name:'test',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:['dist/index.js'],env:{PATH:process.env.PATH}});
  try {
    await client.connect(transport);
    const {tools}=await client.listTools();
    assert.ok(tools.some(t=>t.name==='get_course_context'));
    assert.ok(!tools.some(t=>t.name==='submit_assignment'));
    const result=await client.callTool({name:'describe_capabilities',arguments:{}});
    assert.equal(result.isError,undefined);
    assert.equal(result.structuredContent.version,'2.0.0-alpha.1');
    const invalid=await client.callTool({name:'get_assignment_detail',arguments:{course_id:'../secrets'}});
    assert.equal(invalid.isError,true);
  } finally {await client.close();}
});
test('tool validation blocks unknown properties and traversal before accessing Canvas',async()=>{
  let constructed=0; const ctx=createContext(()=>{constructed++;throw new Error('not reached');});
  await assert.rejects(invokeTool('get_syllabus',{course_id:'1',token:'secret'},ctx));
  await assert.rejects(invokeTool('get_assignment_detail',{course_id:'1',assignment_id:'../2'},ctx));
  await assert.rejects(invokeTool('submit_assignment',{},ctx),e=>e.code==='unknown_tool');
  assert.equal(constructed,0);
});
test('MCP preserves linked material and inaccessible errors with synthetic Canvas',async()=>{
  const ctx=createContext(()=>new CanvasClient({baseUrl:'https://school.example',token:'test',fetch:async url=>{
    if(String(url).includes('/assignments/2')) return new Response(JSON.stringify({id:2,name:'Essay',description:'Read <a href="https://docs.google.com/document/d/example/edit">source</a>'}),{status:200});
    return new Response('{}',{status:403});
  }}));
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  const server=createMcpServer(ctx); const client=new Client({name:'test',version:'1'});
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const result=await client.callTool({name:'get_assignment_detail',arguments:{course_id:'1',assignment_id:'2'}});
    assert.equal(result.isError,undefined);
    assert.equal(result.structuredContent.content.links.length,1);
    const blocked=await client.callTool({name:'get_syllabus',arguments:{course_id:'1'}});
    assert.equal(blocked.isError,true);
    assert.match(blocked.content[0].text,/permission_denied/);
  } finally {await client.close();await server.close();}
});
test('HTTP refuses anonymous/origin/foreign-host requests and serves authenticated MCP',async()=>{
  const secret='test-local-secret-with-at-least-32-characters';
  const server=createLocalHttpServer(secret);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=new URL('http://127.0.0.1:'+server.address().port+'/mcp');
  const client=new Client({name:'http-test',version:'1'});
  try {
    assert.equal((await fetch(url,{method:'POST'})).status,401);
    assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+secret,Origin:'https://evil.example'}})).status,403);
    assert.equal(await new Promise((resolve,reject)=>{const req=request(url,{method:'POST',headers:{Authorization:'Bearer '+secret,Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
    await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:'Bearer '+secret}}}));
    assert.ok((await client.listTools()).tools.length>=15);
    const result=await client.callTool({name:'describe_capabilities',arguments:{}});
    assert.equal(result.isError,undefined);
  } finally {await client.close();await new Promise(resolve=>server.close(resolve));}
});
test('individual tools expose nested material links without signed credentials or raw submission payloads',async()=>{
  const ctx=createContext(()=>new CanvasClient({baseUrl:'https://school.example',token:'test',fetch:async url=>new Response(JSON.stringify(String(url).includes('/items') ? [{id:'4',page_url:'reading',content_details:{url:'https://drive.google.com/file/d/document/view?access_token=private'},external_url:'javascript:bad'}] : {id:'2',description:'',submission:{workflow_state:'submitted',body:'private-response-body',preview_url:'https://files.example/?token=private'}}))}));
  const items=await invokeTool('list_module_items',{course_id:'1',module_id:'3'},ctx);
  assert.equal(items.items[0].page_slug,'reading');
  assert.equal(items.items[0].linked_resources[0].provider,'google_drive');
  assert.equal(items.items[0].linked_resources[0].fetched,false);
  assert.equal(items.items[0].link_discovery_complete,false);
  assert.ok(items.items[0].link_omission);
  assert.ok(!JSON.stringify(items).includes('private'));
  const assignment=await invokeTool('get_assignment_detail',{course_id:'1',assignment_id:'2'},ctx);
  assert.deepEqual(assignment.submission,{workflow_state:'submitted'});
  const profile=await invokeTool('get_profile',{},ctx);
  assert.equal(profile.trust,'untrusted_source_content');
});
