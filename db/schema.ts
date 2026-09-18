import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const subjects = sqliteTable('subjects', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(), color: text('color').notNull(), category: text('category').notNull()
}, t => [index('subjects_owner').on(t.owner)]);
export const tasks = sqliteTable('tasks', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), title:text('title').notNull(), notes:text('notes').notNull().default(''), subjectId:text('subject_id').notNull().references(()=>subjects.id), type:text('type').notNull(), priority:text('priority').notNull(), status:text('status').notNull().default('todo'), dueDate:text('due_date'), dueTime:text('due_time'), repeat:text('repeat').notNull().default('none'), interval:integer('interval').notNull().default(1), anchorDay:integer('anchor_day'), completedAt:text('completed_at'), createdAt:text('created_at').notNull(), version:integer('version').notNull().default(1), parentId:text('parent_id')
},t=>[index('tasks_owner').on(t.owner),index('tasks_parent').on(t.parentId)]);
