import { z } from 'zod';
import { taskInput } from './task-model';

// Import data lives in private runtime secrets, never in source or browser assets.
const snapshotInput = z.object({
  tasks: z.array(z.object({
    sourceId: z.string().min(1).max(100),
    task: z.unknown(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })).min(1).max(2000),
});

export async function importWorkspace(db: D1Database, owner: string, settings: Record<string, unknown>) {
  if (settings.TASKLINE_IMPORT_OWNER !== owner || !settings.TASKLINE_IMPORT_ID) return;
  const batchId = z.string().min(1).max(100).parse(settings.TASKLINE_IMPORT_ID);
  const receiptId = `${owner}:${batchId}`;
  if (await db.prepare('SELECT id FROM workspace_imports WHERE id=? AND owner=?').bind(receiptId, owner).first()) return;
  const count = z.coerce.number().int().min(1).max(60).parse(settings.TASKLINE_IMPORT_PART_COUNT);
  const parts = Array.from({ length: count }, (_, i) => z.string().min(1).parse(settings[`TASKLINE_IMPORT_PART_${i}`]));
  const snapshot = snapshotInput.parse(JSON.parse(parts.join('')));
  const rows = snapshot.tasks.map(row => ({
    ...taskInput.parse(row.task),
    id: `${owner}:todoist:${row.sourceId}`,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    status: row.completedAt ? 'done' : 'todo',
  }));
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Please check the import: duplicate source tasks.');
  const folders = await db.prepare('SELECT id FROM subjects WHERE owner=? AND archived_at IS NULL').bind(owner).all<{id:string}>();
  const allowed = new Set(folders.results.map(folder => folder.id));
  if (rows.some(row => !allowed.has(row.subjectId))) throw new Error('Please restore the destination folders before importing your tasks.');
  // Data and receipt commit together. The receipt survives task deletion, so a
  // later refresh never recreates removed tasks or overwrites subsequent edits.
  await db.batch([
    db.prepare(`INSERT INTO tasks(id,owner,title,notes,subject_id,type,priority,status,due_date,due_time,repeat,interval,anchor_day,completed_at,created_at)
      SELECT json_extract(value,'$.id'),?,json_extract(value,'$.title'),json_extract(value,'$.notes'),json_extract(value,'$.subjectId'),json_extract(value,'$.type'),json_extract(value,'$.priority'),json_extract(value,'$.status'),json_extract(value,'$.dueDate'),json_extract(value,'$.dueTime'),json_extract(value,'$.repeat'),json_extract(value,'$.interval'),CAST(substr(json_extract(value,'$.dueDate'),9,2) AS INTEGER),json_extract(value,'$.completedAt'),json_extract(value,'$.createdAt')
      FROM json_each(?) WHERE NOT EXISTS (SELECT 1 FROM workspace_imports WHERE id=?)
      ON CONFLICT(id) DO NOTHING`).bind(owner, JSON.stringify(rows), receiptId),
    db.prepare('INSERT OR IGNORE INTO workspace_imports(id,owner,provider,task_count,completed_at) VALUES(?,?,?,?,?)').bind(receiptId, owner, 'todoist', rows.length, new Date().toISOString()),
  ]);
}
