import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

test('private import preserves fields and completion, is atomic, and never reseeds deleted tasks', async () => {
  const dir = await mkdtemp(resolve('.sites-runtime/import-test-'));
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  try {
    for (const file of (await readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) sqlite.exec(await readFile(resolve('drizzle', file), 'utf8'));
    let source = await readFile('lib/workspace-import.ts', 'utf8');
    source = source.replace("'./task-model'", JSON.stringify(pathToFileURL(resolve('lib/task-model.ts')).href));
    await writeFile(resolve(dir, 'import.mjs'), ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
    const { importWorkspace } = await import(pathToFileURL(resolve(dir, 'import.mjs')).href);
    class Statement {
      constructor(sql, args=[]) { this.sql=sql; this.args=args; }
      bind(...args) { return new Statement(this.sql,args); }
      async first() { return sqlite.prepare(this.sql).get(...this.args)||null; }
      async all() { return {results:sqlite.prepare(this.sql).all(...this.args)}; }
      async run() { return sqlite.prepare(this.sql).run(...this.args); }
    }
    const db={prepare:sql=>new Statement(sql),async batch(items){sqlite.exec('BEGIN');try{for(const item of items)await item.run();sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}}};
    sqlite.prepare('INSERT INTO subjects(id,owner,name,color,category) VALUES(?,?,?,?,?)').run('folder','alice','Signals and Systems','#5269dd','Classes');
    const row={sourceId:'task-1',createdAt:'2026-09-01T00:00:00.000Z',completedAt:null,task:{title:'Homework',notes:'Original notes',subjectId:'folder',type:'Assignment',priority:'High',dueDate:'2026-09-23',dueTime:'23:59',repeat:'none',interval:1}};
    const rows=[row,{...row,sourceId:'task-2',completedAt:'2026-09-18T20:00:00.000Z'}];
    const settings={TASKLINE_IMPORT_OWNER:'alice',TASKLINE_IMPORT_ID:'snapshot-1',TASKLINE_IMPORT_PART_COUNT:'2',TASKLINE_IMPORT_PART_0:JSON.stringify({tasks:rows}).slice(0,100),TASKLINE_IMPORT_PART_1:JSON.stringify({tasks:rows}).slice(100)};
    await importWorkspace(db,'bob',settings);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,0,'Wrong owner cannot import');
    await importWorkspace(db,'alice',settings);
    let saved=sqlite.prepare('SELECT * FROM tasks ORDER BY id').all();
    assert.equal(saved.length,2);assert.equal(saved[0].due_date,'2026-09-23');assert.equal(saved[0].due_time,'23:59');assert.equal(saved[0].priority,'High');assert.equal(saved[0].notes,'Original notes');assert.equal(saved[1].status,'done');assert.equal(saved[1].completed_at,rows[1].completedAt);
    await importWorkspace(db,'alice',settings);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,2);
    sqlite.exec("DELETE FROM tasks WHERE status='todo'");
    await importWorkspace(db,'alice',settings);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,1,'Deleted imports stay deleted');
    const bad={...settings,TASKLINE_IMPORT_ID:'snapshot-2',TASKLINE_IMPORT_PART_COUNT:'1',TASKLINE_IMPORT_PART_0:JSON.stringify({tasks:[{...row,sourceId:'new'}, {...row,sourceId:'wrong',task:{...row.task,subjectId:'foreign-folder'}}]})};
    await assert.rejects(importWorkspace(db,'alice',bad),/destination folders/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM workspace_imports').get().n,1);
    // A database failure rolls back both the task insert and receipt.
    sqlite.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON workspace_imports WHEN NEW.id='alice:broken' BEGIN SELECT RAISE(ABORT,'failure'); END");
    await assert.rejects(importWorkspace(db,'alice',{...settings,TASKLINE_IMPORT_ID:'broken'}));
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,1);
  } finally { sqlite.close(); await rm(dir,{recursive:true,force:true}); }
});
