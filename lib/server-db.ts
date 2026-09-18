import { env } from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Task storage is unavailable.');return env.DB;}
export function ownerOf(req:Request){const owner=req.headers.get('oai-authenticated-user-id');if(owner)return owner;if(process.env.NODE_ENV==='development')return 'local-development';throw new Error('Sign in to access your tasks.');}
