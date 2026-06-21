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

/* Fetch + normalize alerts from existing collections only.
   opts.sourceIds: optional [id,...] to restrict (e.g. ?source=ssc).
   opts.perCollection: cap per collection (default 40). */
export async function fetchAlerts(db, { sourceIds, perCollection = 40 } = {}) {
  let sources = readableSources();
  if (sourceIds && sourceIds.length) sources = sources.filter(s => sourceIds.includes(s.id));

  const settled = await Promise.allSettled(sources.map(async (s) => {
    const snap = await getDocs(query(collection(db, s.collection), limit(perCollection)));
    const arr = [];
    snap.forEach((d) => {
      // no const-reassignment; pass a fresh object to the shared normalizer
      const item = normalizeDoc({ _id: d.id, ...(d.data() || {}) }, s.collection);
      // authoritative source identity from the registry entry
      item.sourceId = s.id;
      item.sourceLabel = s.shortName || item.sourceLabel;
      item.searchableText = `${item.title} ${item.dept} ${item.noticeType} ${item.sourceLabel}`.toLowerCase();
      arr.push(item);
    });
    return arr;
  }));

  let ok = 0, items = [];
  settled.forEach((r) => { if (r.status === 'fulfilled') { ok++; items.push(...r.value); } });

  // unified manual alerts — PUBLISHED only (rule-enforced). Resilient: if the
  // `alerts` rules are not deployed yet, this read is denied and silently skipped
  // so the existing collections still render.
  try {
    const snap = await getDocs(query(collection(db, 'alerts'), where('status', '==', 'published'), limit(60)));
    let al = [];
    snap.forEach((d) => al.push(normalizeAlert(d.id, d.data() || {})));
    if (sourceIds && sourceIds.length) al = al.filter((a) => sourceIds.includes(a.sourceId));
    ok++;
    items.push(...al);
  } catch (e) { /* alerts rules not deployed / denied — skip, listing unaffected */ }

  items.sort((a, b) => b.ts - a.ts);
  return { items, ok, total: sources.length + 1 };
}
