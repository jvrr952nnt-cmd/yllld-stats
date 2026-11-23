import crypto from 'node:crypto';
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MID = '3546720686312292';
const KNOWN = ['BV1eUxE6kEiQ','BV12doZBJE8k','BV1nSDkB2ESU','BV1SFJU6KEq4','BV1FXoLBpEZ8','BV1Uvyvz3EvQ','BV1fqpu6EE6j','BV114s26qEvJ'];
const MIXIN = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const mixin = (o) => MIXIN.map((n) => o[n]).join('').slice(0, 32);
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA, ...headers } });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { throw new Error(url + ' not JSON: ' + t.slice(0, 100)); }
}

async function listBvids() {
  const H = { referer: 'https://space.bilibili.com/' + MID, accept: 'application/json, text/plain, */*', 'accept-language': 'zh-CN,zh;q=0.9' };
  const nav = await getJson('https://api.bilibili.com/x/web-interface/nav', H);
  const img = nav.data.wbi_img.img_url.split('/').pop().split('.')[0];
  const sub = nav.data.wbi_img.sub_url.split('/').pop().split('.')[0];
  const key = mixin(img + sub);
  const out = [];
  for (let pn = 1; pn <= 10; pn++) {
    const p = { mid: MID, ps: '30', pn: String(pn), order: 'pubdate', platform: 'web', web_location: '1550101' };
    p.wts = Math.round(Date.now() / 1000);
    const q = Object.keys(p).sort().map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(p[k]).replace(/[!'()*]/g, ''))).join('&');
    const j = await getJson('https://api.bilibili.com/x/space/wbi/arc/search?' + q + '&w_rid=' + md5(q + key), H);
    if (j.code !== 0) throw new Error('list code ' + j.code + ' ' + (j.message || ''));
    const vlist = (j.data && j.data.list && j.data.list.vlist) || [];
    for (const v of vlist) if (v && v.bvid) out.push(v.bvid);
    const total = Number(j.data && j.data.page && j.data.page.count) || 0;
    if (!total || out.length >= total || !vlist.length) break;
    await sleep(400);
  }
  if (!out.length) throw new Error('empty list');
  return out;
}

async function main() {
  let bvids, listSource = 'list';
  try { bvids = await listBvids(); } catch (e) { console.error('list failed:', e.message); bvids = KNOWN; listSource = 'known'; }
  console.log('videos', bvids.length, listSource, bvids.slice(0, 5));

  let play = 0, like = 0, inter = 0, videos = 0;
  for (const b of bvids) {
    try {
      const j = await getJson('https://api.bilibili.com/x/web-interface/view?bvid=' + b, { referer: 'https://www.bilibili.com/video/' + b });
      if (j.code !== 0) continue;
      const s = j.data.stat || {};
      play += Number(s.view) || 0;
      like += Number(s.like) || 0;
      inter += (Number(s.reply) || 0) + (Number(s.favorite) || 0) + (Number(s.coin) || 0) + (Number(s.share) || 0) + (Number(s.danmaku) || 0);
      videos++;
    } catch (e) { console.error('view failed', b, e.message); }
    await sleep(150);
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
  console.log('OK', row);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
