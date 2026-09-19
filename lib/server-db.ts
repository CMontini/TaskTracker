import { env } from 'cloudflare:workers';
import { importWorkspace } from './workspace-import';
export async function importPending(owner:string){await importWorkspace(database(),owner,env as unknown as Record<string,unknown>);}
export function database(){if(!env.DB)throw new Error('Task storage is unavailable.');return env.DB;}
export function ownerOf(req:Request){const owner=req.headers.get('oai-authenticated-user-id');if(owner)return owner;if(process.env.NODE_ENV==='development')return 'local-development';throw new Error('Sign in to access your tasks.');}
