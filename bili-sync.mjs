import crypto from 'node:crypto';
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MID = '3546720686312292';
const NAME = 'YLLLD_';
const KNOWN = ['BV1eUxE6kEiQ','BV12doZBJE8k','BV1nSDkB2ESU','BV1SFJU6KEq4','BV1FXoLBpEZ8','BV1Uvyvz3EvQ','BV1fqpu6EE6j','BV114s26qEvJ'];
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA, ...headers } });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { throw new Error(url + ' not JSON: ' + t.slice(0, 100)); }
}

async function listBvids() {
  const H = { referer: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(NAME), accept: 'application/json, text/plain, */*', 'accept-language': 'zh-CN,zh;q=0.9' };
  const out = [];
  for (let pn = 1; pn <= 10; pn++) {
    const j = await getJson('https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' + encodeURIComponent(NAME) + '&order=pubdate&page=' + pn, H);
    if (j.code !== 0) throw new Error('search code ' + j.code + ' ' + (j.message || ''));
    const list = (j.data && j.data.result) || [];
    for (const v of list) if (v && String(v.mid) === MID && v.bvid && !out.includes(v.bvid)) out.push(v.bvid);
    if (list.length < 20) break;
    await sleep(1200);
  }
  if (!out.length) throw new Error('empty search');
  return out;
}

async function main() {
  let bvids, listSource = 'search';
  try { bvids = await listBvids(); } catch (e) {
    console.error('search failed:', e.message);
    fs.writeFileSync('bili-error.txt', 'search failed: ' + e.message + '\n');
    bvids = KNOWN; listSource = 'known';
  }
  console.log('videos', bvids.length, listSource, bvids.slice(0, 5));

  let play = 0, like = 0, inter = 0, videos = 0;
  for (const b of bvids) {
    try {
      const j = await getJson('https://api.bilibili.com/x/web-interface/view?bvid=' + b, { referer: 'https://www.bilibili.com/video/' + b });
      if (j.code !== 0) { console.error('view code', b, j.code); continue; }
      const s = j.data.stat || {};
      play += Number(s.view) || 0;
      like += Number(s.like) || 0;
      inter += (Number(s.reply) || 0) + (Number(s.favorite) || 0) + (Number(s.coin) || 0) + (Number(s.share) || 0) + (Number(s.danmaku) || 0);
      videos++;
    } catch (e) { console.error('view failed', b, e.message); }
    await sleep(180);
  }
  let fans = 0;
  try {
    const rel = await getJson('https://api.bilibili.com/x/relation/stat?vmid=' + MID, { referer: 'https://space.bilibili.com/' + MID });
    fans = Number(rel.data && rel.data.follower) || 0;
  } catch (e) { console.error('relation failed', e.message); }
  if (videos === 0) throw new Error('no video stats');

  const row = { date: today(), play, like, inter, fans, videos, source: 'auto' };
  const old = (() => { try { return JSON.parse(fs.readFileSync('stats.json', 'utf8')); } catch (e) { return {}; } })();
  const platforms = old.platforms || {};
  const bili = Array.isArray(platforms.bili) ? platforms.bili.slice() : [];
  const i = bili.findIndex((x) => x && x.d === row.date);
  if (i > -1) bili[i] = row; else bili.push(row);
  bili.sort((a, b) => (a.d < b.d ? -1 : 1));
  platforms.bili = bili.slice(-60);
  fs.writeFileSync('stats.json', JSON.stringify({ updated: new Date().toISOString(), platforms }, null, 2) + '\n');
  fs.writeFileSync('bili-error.txt', 'ok ' + JSON.stringify(row) + '\n');
  console.log('OK', row);
}
main().catch((e) => { console.error('FATAL', e); fs.writeFileSync('bili-error.txt', 'FATAL ' + String(e.stack || e) + '\n'); process.exitCode = 0; });
