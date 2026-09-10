// Serves the discovery files (robots.txt, sitemap, llms.txt, OpenAPI, RSS) and records which crawlers and AI agents fetch them.
import files from '../../lib/discovery-files.mjs';
import { record, botName } from '../../lib/analytics.mjs';

export default async (req, context) => {
  const path = new URL(req.url).pathname;
  const f = files[path];
  if (!f) return new Response('Not found', { status: 404 });
  const ua = req.headers.get('user-agent') || '';
  if (req.method === 'GET') await record('disco', { p: path, b: botName(ua) || 'Browser', g: context.geo?.country?.code || '' }, 1200);
  return new Response(req.method === 'HEAD' ? null : f.body, { status: 200, headers: { 'Content-Type': f.type, 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
};

export const config = { path: ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/openapi.json', '/blog/feed.xml', '/.well-known/api-catalog'] };
