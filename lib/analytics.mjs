// First-party, cookieless analytics on Netlify Blobs.
// Each hit is one blob whose KEY encodes the event, so a day is read with a single list() call.
import { getStore, getDeployStore } from '@netlify/blobs';

let testStore = null;
export function setStoreForTests(s) { testStore = s; }
export function store() {
  if (testStore) return testStore;
  const prod = globalThis.Netlify?.context?.deploy?.context === 'production';
  return prod ? getStore('analytics') : getDeployStore('analytics');
}

const BOTS = [
  ['Google-InspectionTool', 'Google (inspection)'], ['GoogleOther', 'Google (other)'], ['Google-Extended', 'Google AI'], ['Googlebot', 'Googlebot'], ['Storebot-Google', 'Google Shopping'],
  ['bingbot', 'Bingbot'], ['BingPreview', 'Bing preview'], ['OAI-SearchBot', 'OpenAI search'], ['ChatGPT-User', 'ChatGPT user fetch'], ['GPTBot', 'OpenAI GPTBot'],
  ['Claude-SearchBot', 'Anthropic search'], ['Claude-User', 'Claude user fetch'], ['ClaudeBot', 'Anthropic ClaudeBot'], ['anthropic-ai', 'Anthropic'],
  ['Perplexity-User', 'Perplexity user fetch'], ['PerplexityBot', 'PerplexityBot'], ['Applebot-Extended', 'Apple AI'], ['Applebot', 'Applebot'],
  ['MistralAI-User', 'Mistral user fetch'], ['cohere-ai', 'Cohere'], ['DuckAssistBot', 'DuckDuckGo AI'], ['DuckDuckBot', 'DuckDuckBot'], ['YandexBot', 'YandexBot'],
  ['Baiduspider', 'Baidu'], ['Amazonbot', 'Amazonbot'], ['meta-externalagent', 'Meta AI'], ['meta-externalfetcher', 'Meta AI fetch'], ['facebookexternalhit', 'Facebook preview'],
  ['Bytespider', 'ByteDance'], ['CCBot', 'Common Crawl'], ['Diffbot', 'Diffbot'], ['YouBot', 'You.com'], ['PetalBot', 'PetalBot'], ['SemrushBot', 'Semrush'], ['AhrefsBot', 'Ahrefs'],
  ['LinkedInBot', 'LinkedIn preview'], ['Twitterbot', 'X preview'], ['Slackbot', 'Slack preview'], ['WhatsApp', 'WhatsApp preview'], ['TelegramBot', 'Telegram preview'], ['Discordbot', 'Discord preview']
];
export function botName(ua) {
  ua = ua || '';
  for (const [needle, name] of BOTS) if (ua.includes(needle)) return name;
  if (/bot|crawl|spider|slurp|headless|lighthouse|python-requests|python-httpx|aiohttp|curl\/|wget|go-http-client|node-fetch|axios|okhttp|java\//i.test(ua)) return 'Other bot or script';
  if (!ua) return 'No user agent';
  return '';
}
const AI_REF = [[/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, 'ChatGPT'], [/(^|\.)perplexity\.ai$/, 'Perplexity'], [/(^|\.)claude\.ai$/, 'Claude'],
  [/^gemini\.google\.com$|^bard\.google\.com$/, 'Gemini'], [/^copilot\.microsoft\.com$/, 'Copilot'], [/(^|\.)you\.com$/, 'You.com'], [/(^|\.)phind\.com$/, 'Phind'],
  [/(^|\.)poe\.com$/, 'Poe'], [/(^|\.)meta\.ai$/, 'Meta AI'], [/(^|\.)grok\.com$|(^|\.)x\.ai$/, 'Grok'], [/(^|\.)deepseek\.com$/, 'DeepSeek'], [/^chat\.mistral\.ai$/, 'Mistral']];
const SEARCH_REF = [[/(^|\.)google\.[a-z.]+$/, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo'],
  [/(^|\.)ecosia\.org$/, 'Ecosia'], [/^search\.brave\.com$/, 'Brave'], [/(^|\.)yandex\.[a-z.]+$/, 'Yandex'], [/(^|\.)qwant\.com$/, 'Qwant'], [/(^|\.)startpage\.com$/, 'Startpage']];
export function aiSource(host, utm) {
  const u = (utm || '').toLowerCase();
  for (const [re, n] of AI_REF) if (re.test(host || '')) return n;
  if (u.includes('chatgpt') || u.includes('openai')) return 'ChatGPT';
  if (u.includes('perplexity')) return 'Perplexity';
  if (u.includes('claude')) return 'Claude';
  if (u.includes('gemini')) return 'Gemini';
  if (u.includes('copilot')) return 'Copilot';
  return '';
}
export function searchSource(host) { for (const [re, n] of SEARCH_REF) if (re.test(host || '')) return n; return ''; }
export function device(ua) { return /iPad|Tablet/i.test(ua || '') ? 't' : /Mobi|Android|iPhone/i.test(ua || '') ? 'm' : 'd'; }

const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
const b64u = s => Buffer.from(s, 'utf8').toString('base64url');
export function day(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 10); }

export async function visitorHash(ip, ua, salt) {
  const data = new TextEncoder().encode(`${salt}|${day()}|${ip}|${ua}`);
  const h = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(h)].slice(0, 5).map(b => b.toString(16).padStart(2, '0')).join('');
}

// kind: pv | ev | bot | disco | api | badge
export async function record(kind, payload, timeoutMs = 1500) {
  const clean = {};
  for (const [k, v] of Object.entries(payload)) if (v !== '' && v != null) clean[k] = typeof v === 'string' ? cut(v, k === 'p' ? 120 : 60) : v;
  let enc = b64u(JSON.stringify(clean));
  if (enc.length > 520) { delete clean.x; delete clean.c; clean.p = cut(clean.p, 60); enc = b64u(JSON.stringify(clean)); }
  const key = `e/${day()}/${kind}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}~${enc}`;
  try {
    await Promise.race([store().set(key, '1'), new Promise(r => setTimeout(r, timeoutMs))]);
  } catch (e) { console.log('analytics write failed', e.message); }
}

export async function readDay(d) {
  const { blobs } = await store().list({ prefix: `e/${d}/` });
  const out = [];
  for (const b of blobs) {
    const parts = b.key.split('/'); // e, day, kind, id~payload
    const kind = parts[2], rest = parts.slice(3).join('/'), i = rest.indexOf('~');
    let data = {};
    try { data = JSON.parse(Buffer.from(rest.slice(i + 1), 'base64url').toString('utf8')); } catch (e) { continue; }
    out.push({ kind, ...data });
  }
  return out;
}
