// Always use the network for authenticated pages and data. Never cache tasks,
// API responses, or sign-in redirects on a shared device.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname !== '/') return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#132239"><title>Taskline — Offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fb;color:#132239;font:16px/1.6 system-ui,sans-serif}main{max-width:380px;margin:24px}h1{font-size:28px;line-height:1.2}p{color:#5b687b}a{display:inline-block;margin-top:12px;padding:10px 20px;background:#3046c8;color:white;border-radius:8px;text-decoration:none}a:focus-visible{outline:3px solid #132239;outline-offset:4px}</style></head>
<body><main><h1>You’re offline</h1><p>Reconnect to the internet to view and save your tasks. Your saved tasks are safe in your Taskline workspace.</p><a href="/">Try again</a></main></body></html>`, {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
