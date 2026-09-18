import { z } from 'zod';
export const priorities=['Low','Medium','High','Urgent'] as const;
export const taskTypes=['Task','Assignment','Quiz','Exam','Project','Study','Meeting','Errand'] as const;
export const repeats=['none','daily','weekdays','weekly','monthly','yearly'] as const;
export const colors=['#5269dd','#1f9b85','#d7832b','#c4588a','#7e60bc','#308ea8'] as const;
export const categories=['Classes','General','Personal'] as const;
export function dateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function nextDate(date:string, repeat:string, interval:number, anchorDay?:number|null){
 const d=new Date(date+'T12:00:00Z'), day=anchorDay||d.getUTCDate();
 if(repeat==='daily')d.setUTCDate(d.getUTCDate()+interval);
 if(repeat==='weekly')d.setUTCDate(d.getUTCDate()+7*interval);
 if(repeat==='weekdays'){let left=interval;while(left){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)left--;}}
 if(repeat==='monthly'||repeat==='yearly'){const month=d.getUTCMonth()+(repeat==='yearly'?12:1)*interval;d.setUTCDate(1);d.setUTCMonth(month);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 return d.toISOString().slice(0,10);
}
export const taskInput=z.object({title:z.string().trim().min(1,'Enter a task title.').max(200),notes:z.string().max(10000).default(''),subjectId:z.string().min(1),type:z.string().trim().min(1).max(40),priority:z.enum(priorities),status:z.enum(['todo','progress']).default('todo'),dueDate:z.string().refine(validDate,'Choose a valid date.').nullable(),dueTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),repeat:z.enum(repeats).default('none'),interval:z.number().int().min(1).max(365).default(1)}).superRefine((v,c)=>{if((v.repeat!=='none'||v.dueTime)&&!v.dueDate)c.addIssue({code:'custom',message:'A due date is required for a time or repeat schedule.'});});
export const subjectInput=z.object({name:z.string().trim().min(1).max(60),color:z.enum(colors),category:z.enum(categories)});
export type Task={id:string;title:string;notes:string;subjectId:string;type:string;priority:typeof priorities[number];status:'todo'|'progress'|'done';dueDate:string|null;dueTime:string|null;repeat:typeof repeats[number];interval:number;anchorDay:number|null;completedAt:string|null;createdAt:string;version:number;parentId:string|null};
export type Subject={id:string;name:string;color:string;category:string};
