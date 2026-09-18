import { database, ownerOf } from '@/lib/server-db';
import { taskInput, subjectInput, nextDate } from '@/lib/task-model';
import { z } from 'zod';
export const dynamic='force-dynamic';
const taskSelect=`SELECT id,title,notes,subject_id AS subjectId,type,priority,status,due_date AS dueDate,due_time AS dueTime,repeat,interval,anchor_day AS anchorDay,completed_at AS completedAt,created_at AS createdAt,version,parent_id AS parentId FROM tasks WHERE owner=?`;
async function state(owner:string){const db=database();const [s,t]=await db.batch([db.prepare('SELECT id,name,color,category FROM subjects WHERE owner=? ORDER BY category,name').bind(owner),db.prepare(taskSelect+' ORDER BY created_at DESC').bind(owner)]);return {subjects:s.results,tasks:t.results};}
function fail(error:unknown){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message||'Invalid input.'},{status:400});console.error('Taskline request failed',error);const message=error instanceof Error?error.message:'';return Response.json({error:message==='Sign in to access your tasks.'?message:message.startsWith('Please')?message:'Could not save or load your tasks. Please try again.'},{status:message==='Sign in to access your tasks.'?401:message.startsWith('Please')?409:503});}
export async function GET(req:Request){try{const owner=ownerOf(req),db=database();await db.batch([['classes','Classes','#5269dd','Classes'],['general','General','#1f9b85','General'],['personal','Personal','#c4588a','Personal'],
 ['class-signals-and-systems','Signals and Systems','#5269dd','Classes'],
 ['class-machine-design','Machine Design','#1f9b85','Classes'],
 ['class-modern-physics','Modern Physics','#7e60bc','Classes'],
 ['class-capstone-design','Capstone Design','#d7832b','Classes'],
 ['class-data-acquisition','Data Acquisition','#308ea8','Classes']
 ].map(([key,name,color,category])=>db.prepare('INSERT OR IGNORE INTO subjects(id,owner,name,color,category) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE owner=? AND category=? AND lower(name)=lower(?))').bind(owner+':'+key,owner,name,color,category,owner,category,name)));return Response.json(await state(owner),{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function POST(req:Request){try{
 const owner=ownerOf(req),db=database();if(req.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});
 const b=z.object({action:z.string(),id:z.string().optional(),version:z.number().int().positive().optional(),task:z.unknown().optional(),subject:z.unknown().optional()}).parse(await req.json());const id=typeof b.id==='string'?b.id:'';
 if(b.action==='saveSubject'){const s=subjectInput.parse(b.subject);if(id){const r=await db.prepare('UPDATE subjects SET name=?,color=?,category=? WHERE id=? AND owner=?').bind(s.name,s.color,s.category,id,owner).run();if(!r.meta.changes)throw new Error('Please reload: subject no longer exists.');}else{await db.prepare('INSERT INTO subjects(id,owner,name,color,category) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),owner,s.name,s.color,s.category).run();}}
 else if(b.action==='saveTask'){
 const t=taskInput.parse(b.task);if(!await db.prepare('SELECT id FROM subjects WHERE id=? AND owner=?').bind(t.subjectId,owner).first())return Response.json({error:'Choose an existing subject.'},{status:400});
 const existing=id?await db.prepare('SELECT due_date,repeat,anchor_day FROM tasks WHERE id=? AND owner=?').bind(id,owner).first<{due_date:string|null;repeat:string;anchor_day:number|null}>():null;
 const anchor=existing&&existing.due_date===t.dueDate&&existing.repeat===t.repeat?existing.anchor_day:t.dueDate?Number(t.dueDate.slice(8)):null;
 const vals=[t.title,t.notes,t.subjectId,t.type,t.priority,t.status,t.dueDate,t.dueTime,t.repeat,t.interval,anchor];
 if(id){const r=await db.prepare('UPDATE tasks SET title=?,notes=?,subject_id=?,type=?,priority=?,status=?,due_date=?,due_time=?,repeat=?,interval=?,anchor_day=?,version=version+1 WHERE id=? AND owner=? AND version=? AND status!=\'done\'').bind(...vals,id,owner,b.version).run();if(!r.meta.changes)throw new Error('Please reload: this task changed in another session.');}
 else await db.prepare('INSERT INTO tasks(title,notes,subject_id,type,priority,status,due_date,due_time,repeat,interval,anchor_day,id,owner,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...vals,crypto.randomUUID(),owner,new Date().toISOString()).run();
 }else if(b.action==='complete'){
 const t=await db.prepare(taskSelect+' AND id=?').bind(owner,id).first<any>();if(!t)throw new Error('Please reload: task no longer exists.');if(t.status==='done')return Response.json(await state(owner));if(t.version!==b.version)throw new Error('Please reload: this task changed in another session.');
 const statements=[];
 if(t.repeat!=='none'&&t.dueDate){const next=nextDate(t.dueDate,t.repeat,t.interval,t.anchorDay);statements.push(db.prepare(`INSERT INTO tasks(id,owner,title,notes,subject_id,type,priority,status,due_date,due_time,repeat,interval,anchor_day,created_at,parent_id) SELECT ?,owner,title,notes,subject_id,type,priority,'todo',?,due_time,repeat,interval,anchor_day,?,id FROM tasks WHERE id=? AND owner=? AND version=? AND status!='done'`).bind(crypto.randomUUID(),next,new Date().toISOString(),id,owner,b.version));}
 statements.push(db.prepare("UPDATE tasks SET status='done',completed_at=?,version=version+1 WHERE id=? AND owner=? AND version=? AND status!='done'").bind(new Date().toISOString(),id,owner,b.version));await db.batch(statements);
 }else if(b.action==='reopen'){
 const child=await db.prepare('SELECT id FROM tasks WHERE parent_id=? AND owner=?').bind(id,owner).first();if(child)return Response.json({error:'This task has a next occurrence. Edit that occurrence instead.'},{status:409});
 await db.prepare("UPDATE tasks SET status='todo',completed_at=NULL,version=version+1 WHERE id=? AND owner=? AND version=?").bind(id,owner,b.version).run();
 }else if(b.action==='deleteTask'){const r=await db.prepare('DELETE FROM tasks WHERE id=? AND owner=? AND version=?').bind(id,owner,b.version).run();if(!r.meta.changes)throw new Error('Please reload: this task changed in another session.');}
 else return Response.json({error:'Unknown action.'},{status:400});
 return Response.json(await state(owner),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
