const revision = process.argv[2] ?? process.env.APP_REVISION;
const base = process.env.SMOKE_URL ?? 'http://127.0.0.1:3000';
try {
  const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) });
  const health = await response.json();
  if (!response.ok || health.status !== 'ok' || (revision && health.revision !== revision)) throw new Error('health or revision mismatch');
  const page = await fetch(base, { signal: AbortSignal.timeout(3000) });
  const html = await page.text();
  if (!page.ok || !html.includes('奶蛙爱洗澡') || !html.includes('UTF-8')) throw new Error('game document unavailable');
  for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) {
    const resource = await fetch(`${base}${asset[1]}`, { signal: AbortSignal.timeout(3000) });
    if (!resource.ok) throw new Error('game asset unavailable');
  }
  const sw = await fetch(`${base}/sw.js`, { signal: AbortSignal.timeout(3000) });
  if (!sw.ok || !(await sw.text()).includes('precache')) throw new Error('offline worker unavailable');
  console.log(`nwaxz smoke passed: ${health.revision}`);
} catch (error) { console.error(`nwaxz smoke failed: ${error.message}`); process.exit(1); }
