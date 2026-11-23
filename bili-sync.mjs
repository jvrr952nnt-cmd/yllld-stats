import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MID = '3546720686312292';
const NAME = 'YLLLD_';
const BVS = ['BV1eUxE6kEiQ','BV12doZBJE8k','BV1nSDkB2ESU','BV1SFJU6KEq4','BV1FXoLBpEZ8','BV1Uvyvz3EvQ','BV1fqpu6EE6j','BV114s26qEvJ'];
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const errors = [];

async function text(url, headers = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9', ...headers } });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  return r.text();
}

async function videoStat(bv) {
  const html = await text('https://www.bilibili.com/video/' + bv, { referer: 'https://www.bilibili.com/' });
  const m = html.match(/"stat":({[^}]+})/);
  if (!m) throw new Error('no stat in ' + bv);
  return JSON.parse(m[1]);
}

async function main() {
  let play = 0, like = 0, inter = 0, videos = 0;
  for (const bv of BVS) {
    try {
      const s = await videoStat(bv);
      play += Number(s.view) || 0;
      like += Number(s.like) || 0;
      inter += (Number(s.reply) || 0) + (Number(s.favorite) || 0) + (Number(s.coin) || 0) + (Number(s.share) || 0) + (Number(s.danmaku) || 0);
      videos++;
    } catch (e) { errors.push(bv + ': ' + e.message); }
    await new Promise((r) => setTimeout(r, 350));
  }
  let fans = 0, totalVideos = 0;
  try {
    const html = await text('https://search.bilibili.com/all?keyword=' + encodeURIComponent(NAME), { referer: 'https://www.bilibili.com/' });
    const fm = html.match(new RegExp('mid:' + MID + ',[\\s\\S]{0,600}?fans:(\\d+),videos:(\\d+)'));
    if (fm) { fans = Number(fm[1]) || 0; totalVideos = Number(fm[2]) || 0; }
  } catch (e) { errors.push('search: ' + e.message); }
  if (!fans) {
    try {
      const r = await fetch('https://api.bilibili.com/x/relation/stat?vmid=' + MID, { headers: { 'user-agent': UA, referer: 'https://space.bilibili.com/' + MID } });
      if (r.ok) { const j = await r.json(); fans = Number(j.data && j.data.follower) || 0; }
      else errors.push('relation HTTP ' + r.status);
    } catch (e) { errors.push('relation: ' + e.message); }
  }
  const row = { date: today(), play, like, inter, fans, videos, totalVideos, source: 'auto', scope: 'featured' };
  fs.writeFileSync('bili-debug.json', JSON.stringify({ row, errors, at: new Date().toISOString() }, null, 2));
  if (!videos) throw new Error('no video stats');

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
main().catch((e) => { fs.writeFileSync('bili-error.txt', 'FATAL ' + String(e.stack || e) + '\n' + JSON.stringify(errors, null, 2)); process.exitCode = 0; });
