/* ============================================================================
   Read-only sitemap generator for published detail URLs.
   - Reads the 4 public collections + PUBLISHED alerts only (via public Firestore
     REST API + public web key — no secret, no service account).
   - NO Firestore writes (no set/update/add/delete). Writes only a local XML file.
   - Excludes review/draft/archived alerts, admin, and invalid ids.
   Run:  node scripts/generate-alert-sitemap.mjs   (from repo root)
   ============================================================================ */
import { writeFileSync } from 'node:fs';

const PROJECT = 'newjobsarkari';
const KEY  = 'AIzaSyD6fwR3EsspTbw7YJPQiSEGChdLBcOCEU8';   // public web key (already in frontend)
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const SITE = 'https://newjobsarkari.web.app';
const COLLECTIONS = ['ssc_jobs', 'rsmssb_jobs', 'rssb_jobs', 'scholarship_notices'];

function lastmodOf(fields = {}) {
  for (const k of ['updated_at', 'updatedAt', 'published_at', 'publishedAt', 'created_at', 'createdAt']) {
    const v = fields[k];
    if (v && typeof v.timestampValue === 'string') return v.timestampValue.slice(0, 10); // YYYY-MM-DD
  }
  return null;   // no fake lastmod
}
function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function readCollection(col) {
  const out = []; let pageToken = '';
  do {
    const url = `${BASE}/${col}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}&key=${KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${col} HTTP ${r.status}`);
    const j = await r.json();
    (j.documents || []).forEach(d => { const id = d.name.split('/').pop(); if (id) out.push({ col, id, lastmod: lastmodOf(d.fields) }); });
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function readPublishedAlerts() {
  const out = [];
  const body = { structuredQuery: { from: [{ collectionId: 'alerts' }],
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
    limit: 1000 } };
  const r = await fetch(`${BASE}:runQuery?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('alerts HTTP ' + r.status);
  const j = await r.json();
  (Array.isArray(j) ? j : []).forEach(x => {
    if (!x.document) return;
    const f = x.document.fields || {};
    if ((f.status && f.status.stringValue) !== 'published') return;   // belt-and-suspenders
    const id = x.document.name.split('/').pop();
    if (id) out.push({ col: 'alerts', id, lastmod: lastmodOf(f) });
  });
  return out;
}

(async () => {
  const counts = {}; let all = [];
  for (const col of COLLECTIONS) { const docs = await readCollection(col); counts[col] = docs.length; all = all.concat(docs); }
  const alerts = await readPublishedAlerts(); counts['alerts(published)'] = alerts.length; all = all.concat(alerts);

  // dedupe by col+id, drop empties
  const seen = new Set();
  const uniq = all.filter(u => u.id && u.col && (() => { const k = u.col + '|' + u.id; if (seen.has(k)) return false; seen.add(k); return true; })());
  // newest first
  uniq.sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || ''));

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const u of uniq) {
    const loc = `${SITE}/alert-detail.html?id=${encodeURIComponent(u.id)}&src=${encodeURIComponent(u.col)}`;
    xml += `  <url><loc>${xmlEsc(loc)}</loc>`;
    if (u.lastmod) xml += `<lastmod>${u.lastmod}</lastmod>`;
    xml += `<changefreq>weekly</changefreq></url>\n`;
  }
  xml += '</urlset>\n';
  writeFileSync('public/sitemap-alerts.xml', xml);
  console.log('counts by source:', counts);
  console.log('total detail URLs:', uniq.length);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
