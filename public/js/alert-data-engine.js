/* ============================================================================
   Unified Alert Data Engine (READ-ONLY, registry-driven).
   - Reads ONLY collections declared in source-registry.js (readableSources()).
     A future source auto-joins by adding a `collection` to its registry entry.
   - Reuses portal-engine.js's proven (hotfixed) normalize / filter / card /
     filter-bar primitives — does NOT modify or duplicate them.
   - No Firestore writes. No innerHTML with data. No eval/Function/document.write.
   ============================================================================ */
import { collection, getDocs, query, limit, where }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { readableSources, sourceById } from './source-registry.js';
import {
  normalizeDoc, applyFilters, buildFilterOptions, isDefaultState,
  buildCard, buildGrid, buildEmpty, mountFilterBar,
  classifyNotice, toMillis, safeUrl,
  CATEGORIES, CAT_BY_ID, sanitizeParam
} from '../portal-engine.js';

const ALERT_SRC_COLOR = { ssc:'#1d4ed8', rsmssb:'#7c3aed', rssb:'#16a34a', scholarship:'#ea580c' };

// normalize a manual `alerts` doc into the shared card/filter shape
function normalizeAlert(id, a) {
  const reg = sourceById(a.sourceId) || {};
  const item = {
    id, col: 'alerts',
    sourceId: a.sourceId || 'manual',
    sourceLabel: a.sourceLabel || reg.shortName || a.sourceId || 'सूचना',
    sourceColor: ALERT_SRC_COLOR[a.sourceId] || '#0ea5e9',
    sourceIcon: '📋',
    title: a.title || '',
    noticeType: String(a.alertType || '').toUpperCase(),
    dept: a.department || a.sourceHindiName || reg.hindiName || '',
    qualification: Array.isArray(a.qualification) ? a.qualification.join(' ') : (a.qualification || ''),
    ts: toMillis(a.publishedAt) || toMillis(a.updatedAt) || toMillis(a.createdAt),
    pdf: safeUrl(a.officialPdf || a.officialUrl || a.applyUrl),
    // mapped field names so the shared date picker / cards work unchanged
    raw: {
      last_date: a.lastDate, document_last_date: a.lastDate, correction_end_date: a.lastDate,
      result_date: a.resultDate, exam_date: a.examDate, objection_end_date: a.objectionEndDate,
      form_start_date: a.startDate, published_at: a.publishedAt
    }
  };
  item.catId = classifyNotice(item.noticeType, 'alerts');
  item.searchableText = `${item.title} ${item.dept} ${item.noticeType} ${item.sourceLabel}`.toLowerCase();
  return item;
}

// re-export render/filter primitives so the page imports from one place
export {
  applyFilters, buildFilterOptions, isDefaultState,
  buildCard, buildGrid, buildEmpty, mountFilterBar,
  CATEGORIES, CAT_BY_ID, sanitizeParam, readableSources, sourceById
};

// valid source ids that currently have data (used to validate ?source= params)
export const READABLE_SOURCE_IDS = readableSources().map(s => s.id);

/* ── Resilient read layer ──────────────────────────────────────────────────
   The Firestore Web SDK uses a WebChannel/Listen streaming transport that some
   user networks (proxies/firewalls) block — getDocs then fails OR resolves from
   an empty offline cache, blanking the listing. We add a public Firestore REST
   fallback (plain HTTPS, rules still enforced, public web key only — NO secret,
   NO service account, READ-ONLY). SDK is tried first; REST covers failures and
   the offline-empty case. ----------------------------------------------------- */
const FS_PROJECT = 'newjobsarkari';
const FS_KEY = 'AIzaSyD6fwR3EsspTbw7YJPQiSEGChdLBcOCEU8'; // public web API key (already in frontend)
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FS_PROJECT}/databases/(default)/documents`;
const SDK_TIMEOUT_MS = 6000;

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('sdk-timeout')), ms))]);
}
// Firestore REST typed value -> plain JS
function fromRestValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue; // ISO string; toMillis() parses it
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromRestValue);
  if ('mapValue' in v) { const o = {}; const f = v.mapValue.fields || {}; for (const k in f) o[k] = fromRestValue(f[k]); return o; }
  return null;
}
function restDocToObj(d) {
  const o = { _id: (d.name || '').split('/').pop() };
  const f = d.fields || {};
  for (const k in f) o[k] = fromRestValue(f[k]);
  return o;
}
async function restReadCollection(col, perCollection) {
  const r = await fetch(`${FS_BASE}/${encodeURIComponent(col)}?pageSize=${perCollection}&key=${FS_KEY}`);
  if (!r.ok) throw new Error('REST ' + r.status);
  const j = await r.json();
  return (j.documents || []).map(restDocToObj);
}
async function restReadPublishedAlerts(limitN) {
  const body = { structuredQuery: { from: [{ collectionId: 'alerts' }],
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
    limit: limitN } };
  const r = await fetch(`${FS_BASE}:runQuery?key=${FS_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('REST ' + r.status);
  const j = await r.json();
  return (Array.isArray(j) ? j : []).filter(x => x.document).map(x => restDocToObj(x.document));
}
// SDK first (timed); on failure OR suspicious empty, fall back to REST.
async function readCollectionResilient(db, col, perCollection) {
  try {
    const snap = await withTimeout(getDocs(query(collection(db, col), limit(perCollection))), SDK_TIMEOUT_MS);
    const docs = [];
    snap.forEach(d => docs.push({ _id: d.id, ...(d.data() || {}) }));
    if (docs.length > 0) return docs;
    // SDK resolved empty (possibly offline cache) — confirm via REST, prefer the larger
    try { const r = await restReadCollection(col, perCollection); return r.length > docs.length ? r : docs; }
    catch (e) { return docs; }
  } catch (e) {
    // SDK failed / timed out → REST fallback (throws only if REST also fails)
    return await restReadCollection(col, perCollection);
  }
}

/* Fetch + normalize alerts from existing collections only.
   opts.sourceIds: optional [id,...] to restrict (e.g. ?source=ssc).
   opts.perCollection: cap per collection (default 40).
   Returns { items, ok, failed, total }. */
export async function fetchAlerts(db, { sourceIds, perCollection = 40 } = {}) {
  let sources = readableSources();
  if (sourceIds && sourceIds.length) sources = sources.filter(s => sourceIds.includes(s.id));

  const settled = await Promise.allSettled(sources.map(async (s) => {
    const raws = await readCollectionResilient(db, s.collection, perCollection);
    return raws.map((raw) => {
      const item = normalizeDoc(raw, s.collection);
      item.sourceId = s.id;                       // authoritative identity from registry
      item.sourceLabel = s.shortName || item.sourceLabel;
      item.searchableText = `${item.title} ${item.dept} ${item.noticeType} ${item.sourceLabel}`.toLowerCase();
      return item;
    });
  }));

  let ok = 0, failed = 0, items = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled') { ok++; items.push(...r.value); }
    else { failed++; }
  });

  // unified manual alerts — PUBLISHED only (rule-enforced), SDK→REST resilient.
  // Failure here (rules undeployed / denied / transport) must NOT hide collections.
  try {
    let alertRaw;
    try {
      const snap = await withTimeout(getDocs(query(collection(db, 'alerts'), where('status', '==', 'published'), limit(60))), SDK_TIMEOUT_MS);
      alertRaw = []; snap.forEach((d) => alertRaw.push({ _id: d.id, ...(d.data() || {}) }));
      if (alertRaw.length === 0) { try { const r = await restReadPublishedAlerts(60); if (r.length) alertRaw = r; } catch (e) {} }
    } catch (e) {
      alertRaw = await restReadPublishedAlerts(60);
    }
    let al = alertRaw.map((a) => normalizeAlert(a._id, a));
    if (sourceIds && sourceIds.length) al = al.filter((a) => sourceIds.includes(a.sourceId));
    items.push(...al);
  } catch (e) { /* alerts unavailable — skip, listing unaffected */ }

  items.sort((a, b) => b.ts - a.ts);
  return { items, ok, failed, total: sources.length };
}
