import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Exercise the actual route queries against SQLite with D1-compatible atomic batches.
test('archive, restore, deletion, ownership, and recurrence through the workspace API',async()=>{
 const dir=await mkdtemp(resolve('.sites-runtime/archive-test-'));
 try{
 await writeFile(resolve(dir,'database.mjs'),`import {DatabaseSync} from 'node:sqlite';
 export const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 export function ownerOf(req){return req.headers.get('test-owner')||'alice'};
 class Statement{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Statement(this.sql,args)}async first(){return sqlite.prepare(this.sql).get(...this.args)||null}async run(){const s=sqlite.prepare(this.sql);if(/^SELECT/i.test(this.sql))return {results:s.all(...this.args),meta:{changes:0}};const r=s.run(...this.args);return {results:[],meta:{changes:Number(r.changes)}}}}
 const db={prepare:sql=>new Statement(sql),async batch(items){sqlite.exec('BEGIN');try{const r=[];for(const s of items)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};export function database(){return db};`);
 const shim=await import(pathToFileURL(resolve(dir,'database.mjs')).href);
 for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())shim.sqlite.exec(await readFile(resolve('drizzle',f),'utf8'));
 let source=await readFile('app/api/workspace/route.ts','utf8');source=source.replace("'@/lib/server-db'","'./database.mjs'").replace("'@/lib/task-model'",JSON.stringify(pathToFileURL(resolve('lib/task-model.ts')).href));
 await writeFile(resolve(dir,'route.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {GET,POST}=await import(pathToFileURL(resolve(dir,'route.mjs')).href);
 async function call(body,owner='alice',status=200){const req=new Request('https://taskline.test/api/workspace',{method:body?'POST':'GET',headers:{'test-owner':owner,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const r=await (body?POST(req):GET(req));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
 let d=await call();const folder=d.subjects.find(s=>s.name==='Machine Design');
 const task={title:'Repeat test',subjectId:folder.id,type:'Task',priority:'High',dueDate:'2026-09-19',dueTime:null,repeat:'weekly'};
 d=await call({action:'saveTask',task});let t=d.tasks[0];
 d=await call({action:'archiveTask',id:t.id,version:t.version});t=d.tasks[0];assert.ok(t.archivedAt);
 await call({action:'complete',id:t.id,version:t.version},'alice',409);assert.equal((await call()).tasks.length,1);
 await call({action:'restoreTask',id:t.id,version:t.version},'bob',409);
 d=await call({action:'archiveSubject',id:folder.id,version:folder.version});let archived=d.subjects.find(s=>s.id===folder.id);assert.ok(archived.archivedAt);
 await call({action:'restoreTask',id:t.id,version:t.version},'alice',409);
 await call({action:'saveTask',task},'alice',409);
 d=await call({action:'restoreSubject',id:folder.id,version:archived.version});assert.ok(d.tasks[0].archivedAt,'Restoring folder must preserve independently archived tasks');
 d=await call({action:'restoreTask',id:t.id,version:t.version});t=d.tasks[0];assert.equal(t.archivedAt,null);
 d=await call({action:'complete',id:t.id,version:t.version});assert.equal(d.tasks.length,2);assert.ok(d.tasks.some(t=>t.dueDate==='2026-09-26'));assert.ok(d.tasks.some(t=>t.status==='done'));
 const current=d.subjects.find(s=>s.id===folder.id);
 await call({action:'deleteSubject',id:folder.id,version:folder.version,taskCount:2},'alice',409);
 await call({action:'deleteSubject',id:folder.id,version:current.version,taskCount:1},'alice',409);
 assert.equal((await call()).tasks.length,2,'Stale count must not partially delete tasks');
 await call({action:'deleteSubject',id:folder.id,version:current.version,taskCount:2},'bob',409);
 d=await call({action:'deleteSubject',id:folder.id,version:current.version,taskCount:2});assert.equal(d.tasks.length,0);assert.ok(!d.subjects.some(s=>s.id===folder.id));
 d=await call();assert.ok(!d.subjects.some(s=>s.name==='Machine Design'),'Deleted default must not be reseeded');
 assert.ok((await call(undefined,'bob')).subjects.some(s=>s.name==='Machine Design'),'Other owner must retain their folder');
 const another=d.subjects[0];d=await call({action:'saveTask',task:{...task,subjectId:another.id,repeat:'none'}});t=d.tasks[0];
 d=await call({action:'deleteTask',id:t.id,version:t.version});assert.equal(d.tasks.length,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
