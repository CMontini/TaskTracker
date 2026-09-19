import { database, ownerOf, importPending } from '@/lib/server-db';
import { taskInput, subjectInput, nextDate, type Task } from '@/lib/task-model';
import { z } from 'zod';
export const dynamic='force-dynamic';
const taskSelect=`SELECT id,title,notes,subject_id AS subjectId,type,priority,status,due_date AS dueDate,due_time AS dueTime,repeat,interval,anchor_day AS anchorDay,completed_at AS completedAt,created_at AS createdAt,version,parent_id AS parentId,archived_at AS archivedAt FROM tasks WHERE owner=?`;
const activeTask=`archived_at IS NULL AND EXISTS (SELECT 1 FROM subjects WHERE subjects.id=tasks.subject_id AND subjects.owner=tasks.owner AND subjects.archived_at IS NULL)`;
const defaults=[['classes','Classes','#5269dd','Classes'],['general','General','#1f9b85','General'],['personal','Personal','#c4588a','Personal'],['class-signals-and-systems','Signals and Systems','#5269dd','Classes'],['class-machine-design','Machine Design','#1f9b85','Classes'],['class-modern-physics','Modern Physics','#7e60bc','Classes'],['class-capstone-design','Capstone Design','#d7832b','Classes'],['class-data-acquisition','Data Acquisition','#308ea8','Classes']];
async function initialize(owner:string){
 const db=database();
 if(await db.prepare('SELECT owner FROM workspace_initialization WHERE owner=?').bind(owner).first())return;
 // One transaction ensures deleted defaults are never reseeded, including after concurrent first loads.
 await db.batch([...defaults.map(([key,name,color,category])=>db.prepare(`INSERT OR IGNORE INTO subjects(id,owner,name,color,category) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM workspace_initialization WHERE owner=?) AND NOT EXISTS (SELECT 1 FROM subjects WHERE owner=? AND category=? AND lower(name)=lower(?))`).bind(owner+':'+key,owner,name,color,category,owner,owner,category,name)),db.prepare('INSERT OR IGNORE INTO workspace_initialization(owner,created_at) VALUES(?,?)').bind(owner,new Date().toISOString())]);
}
async function state(owner:string){const db=database();const [s,t]=await db.batch([db.prepare('SELECT id,name,color,category,archived_at AS archivedAt,version FROM subjects WHERE owner=? ORDER BY category,name').bind(owner),db.prepare(taskSelect+' ORDER BY created_at DESC').bind(owner)]);return {subjects:s.results,tasks:t.results};}
function fail(error:unknown){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message||'Invalid input.'},{status:400});const message=error instanceof Error?error.message:'';if(!message.startsWith('Please'))console.error('Taskline request failed',error);return Response.json({error:message==='Sign in to access your tasks.'?message:message.startsWith('Please')?message:'Could not save or load your tasks. Please try again.'},{status:message==='Sign in to access your tasks.'?401:message.startsWith('Please')?409:503});}
function changed(changes:number|undefined){if(!changes)throw new Error('Please refresh: this item changed, was archived, or no longer exists.');}
export async function GET(req:Request){try{const owner=ownerOf(req);await initialize(owner);await importPending(owner);return Response.json(await state(owner),{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function POST(req:Request){try{
 const owner=ownerOf(req),db=database();if(req.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
 const b=z.object({action:z.enum(['saveSubject','saveTask','complete','reopen','deleteTask','archiveTask','restoreTask','archiveSubject','restoreSubject','deleteSubject']),id:z.string().optional(),version:z.number().int().positive().optional(),taskCount:z.number().int().nonnegative().optional(),task:z.unknown().optional(),subject:z.unknown().optional()}).parse(await req.json());
 const id=b.id||'';
 if(b.action!=='saveSubject'&&b.action!=='saveTask'||id){z.string().min(1).parse(id);z.number().int().positive().parse(b.version);}
 await initialize(owner);
 if(b.action==='saveSubject'){
  const s=subjectInput.parse(b.subject);
  if(id){const r=await db.prepare('UPDATE subjects SET name=?,color=?,category=?,version=version+1 WHERE id=? AND owner=? AND version=?').bind(s.name,s.color,s.category,id,owner,b.version).run();changed(r.meta.changes);}
  else await db.prepare('INSERT INTO subjects(id,owner,name,color,category) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),owner,s.name,s.color,s.category).run();
 }else if(b.action==='archiveSubject'||b.action==='restoreSubject'){
  const r=await db.prepare('UPDATE subjects SET archived_at=?,version=version+1 WHERE id=? AND owner=? AND version=?').bind(b.action==='archiveSubject'?new Date().toISOString():null,id,owner,b.version).run();changed(r.meta.changes);
 }else if(b.action==='deleteSubject'){
  const count=z.number().int().nonnegative().parse(b.taskCount);
  // Check the reviewed task count and folder version inside the atomic deletion.
  const results=await db.batch([
   db.prepare(`DELETE FROM tasks WHERE subject_id=? AND owner=? AND EXISTS (SELECT 1 FROM subjects WHERE id=? AND owner=? AND version=?) AND (SELECT COUNT(*) FROM tasks WHERE subject_id=? AND owner=?)=?`).bind(id,owner,id,owner,b.version,id,owner,count),
   db.prepare('DELETE FROM subjects WHERE id=? AND owner=? AND version=? AND NOT EXISTS (SELECT 1 FROM tasks WHERE subject_id=?)').bind(id,owner,b.version,id)
  ]);changed(results[1].meta.changes);
 }else if(b.action==='saveTask'){
  const t=taskInput.parse(b.task);
  const existing=id?await db.prepare(taskSelect+' AND id=?').bind(owner,id).first<Task>():null;
  const anchor=existing&&existing.dueDate===t.dueDate&&existing.repeat===t.repeat?existing.anchorDay:t.dueDate?Number(t.dueDate.slice(8)):null;
  const vals=[t.title,t.notes,t.subjectId,t.type,t.priority,t.status,t.dueDate,t.dueTime,t.repeat,t.interval,anchor];
  if(id){const r=await db.prepare(`UPDATE tasks SET title=?,notes=?,subject_id=?,type=?,priority=?,status=?,due_date=?,due_time=?,repeat=?,interval=?,anchor_day=?,version=version+1 WHERE id=? AND owner=? AND version=? AND status!='done' AND ${activeTask} AND EXISTS (SELECT 1 FROM subjects WHERE id=? AND owner=? AND archived_at IS NULL)`).bind(...vals,id,owner,b.version,t.subjectId,owner).run();changed(r.meta.changes);}
  else {const r=await db.prepare('INSERT INTO tasks(title,notes,subject_id,type,priority,status,due_date,due_time,repeat,interval,anchor_day,id,owner,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM subjects WHERE id=? AND owner=? AND archived_at IS NULL)').bind(...vals,crypto.randomUUID(),owner,new Date().toISOString(),t.subjectId,owner).run();changed(r.meta.changes);}
 }else if(b.action==='archiveTask'||b.action==='restoreTask'){
  const r=await db.prepare(`UPDATE tasks SET archived_at=?,version=version+1 WHERE id=? AND owner=? AND version=? AND EXISTS (SELECT 1 FROM subjects WHERE subjects.id=tasks.subject_id AND subjects.owner=tasks.owner AND subjects.archived_at IS NULL)`).bind(b.action==='archiveTask'?new Date().toISOString():null,id,owner,b.version).run();changed(r.meta.changes);
 }else if(b.action==='complete'){
  const t=await db.prepare(taskSelect+' AND id=?').bind(owner,id).first<Task>();if(!t)throw new Error('Please refresh: task no longer exists.');if(t.status==='done')return Response.json(await state(owner));if(t.version!==b.version)throw new Error('Please refresh: this task changed in another session.');
  const statements=[];
  if(t.repeat!=='none'&&t.dueDate){const next=nextDate(t.dueDate,t.repeat,t.interval,t.anchorDay);statements.push(db.prepare(`INSERT INTO tasks(id,owner,title,notes,subject_id,type,priority,status,due_date,due_time,repeat,interval,anchor_day,created_at,parent_id) SELECT ?,owner,title,notes,subject_id,type,priority,'todo',?,due_time,repeat,interval,anchor_day,?,id FROM tasks WHERE id=? AND owner=? AND version=? AND status!='done' AND ${activeTask}`).bind(crypto.randomUUID(),next,new Date().toISOString(),id,owner,b.version));}
  statements.push(db.prepare(`UPDATE tasks SET status='done',completed_at=?,version=version+1 WHERE id=? AND owner=? AND version=? AND status!='done' AND ${activeTask}`).bind(new Date().toISOString(),id,owner,b.version));const results=await db.batch(statements);changed(results[results.length-1].meta.changes);
 }else if(b.action==='reopen'){
  const child=await db.prepare('SELECT id FROM tasks WHERE parent_id=? AND owner=?').bind(id,owner).first();if(child)return Response.json({error:'This task has a next occurrence. Edit that occurrence instead.'},{status:409});
  const r=await db.prepare(`UPDATE tasks SET status='todo',completed_at=NULL,version=version+1 WHERE id=? AND owner=? AND version=? AND ${activeTask}`).bind(id,owner,b.version).run();changed(r.meta.changes);
 }else if(b.action==='deleteTask'){const r=await db.prepare('DELETE FROM tasks WHERE id=? AND owner=? AND version=?').bind(id,owner,b.version).run();changed(r.meta.changes);}
 return Response.json(await state(owner),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
