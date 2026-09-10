// Beacon endpoint for pageviews and events. Cookieless: no IP is stored, visitors are counted with a daily-rotating hash.
import { record, botName, aiSource, searchSource, device, visitorHash } from '../../lib/analytics.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  let body = {};
  try { body = JSON.parse((await req.text()).slice(0, 4000)); } catch (e) { return new Response(null, { status: 400 }); }
  const ua = req.headers.get('user-agent') || '';
  const bot = botName(ua);
  const country = context.geo?.country?.code || '';
  let refHost = '';
  try { refHost = body.r ? new URL(body.r).hostname.replace(/^www\./, '') : ''; } catch (e) { }
  const selfHost = new URL(req.url).hostname;
  if (refHost === selfHost) refHost = '';
  const utm = [body.s, body.m, body.c].filter(Boolean).join(' / ');
  const k = body.k;
  if (k === 'pv') {
    const v = await visitorHash(context.ip || '', ua, Netlify.env.get('STATS_KEY') || 'ts');
    await record(bot ? 'bot' : 'pv', { p: body.p, r: refHost, ai: aiSource(refHost, body.s), se: searchSource(refHost), s: body.s, m: body.m, c: body.c, g: country, d: device(ua), b: bot, v: bot ? '' : v });
  } else if (k === 'ev') {
    if (!bot) await record('ev', { n: body.n, x: body.x, p: body.p, g: country });
  } else if (k === 'badge') {
    if (!body.h || body.h === selfHost || /^(localhost|127\.)/.test(body.h)) return new Response(null, { status: 204 });
    await record('badge', { h: body.h, p: body.p, x: body.x, g: country, b: bot });
  } else {
    return new Response(null, { status: 400 });
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/t' };
