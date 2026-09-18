import test from 'node:test';
import assert from 'node:assert/strict';
import {nextDate,taskInput} from '../lib/task-model.ts';
test('monthly schedule preserves month-end anchor through February',()=>{
 assert.equal(nextDate('2026-01-31','monthly',1,31),'2026-02-28');
 assert.equal(nextDate('2026-02-28','monthly',1,31),'2026-03-31');
});
test('yearly leap-day schedule recovers leap day',()=>{
 assert.equal(nextDate('2024-02-29','yearly',1,29),'2025-02-28');
 assert.equal(nextDate('2027-02-28','yearly',1,29),'2028-02-29');
});
test('weekdays skip weekends; intervals remain anchored',()=>{
 assert.equal(nextDate('2026-09-18','weekdays',1),'2026-09-21');
 assert.equal(nextDate('2026-09-18','weekdays',2),'2026-09-22');
 assert.equal(nextDate('2026-09-18','weekly',2),'2026-10-02');
});
test('rejects impossible dates and recurring tasks without dates',()=>{
 const base={title:'Study',subjectId:'s',type:'Task',priority:'High',dueDate:null,dueTime:null};
 assert.equal(taskInput.safeParse({...base,repeat:'weekly'}).success,false);
 assert.equal(taskInput.safeParse({...base,dueDate:'2026-02-30'}).success,false);
 assert.equal(taskInput.safeParse({...base,dueTime:'12:00'}).success,false);
 assert.equal(taskInput.safeParse(base).success,true);
});
