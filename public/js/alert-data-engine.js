/* ============================================================================
   Unified Alert Data Engine (READ-ONLY, registry-driven).
   - Reads ONLY collections declared in source-registry.js (readableSources()).
     A future source auto-joins by adding a `collection` to its registry entry.
   - Reuses portal-engine.js's proven (hotfixed) normalize / filter / card /
     filter-bar primitives — does NOT modify or duplicate them.
   - No Firestore writes. No innerHTML with data. No eval/Function/document.write.
   ============================================================================ */
import { collection, getDocs, query, limit }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { readableSources, sourceById } from './source-registry.js';
import {
  normalizeDoc, applyFilters, buildFilterOptions, isDefaultState,
  buildCard, buildGrid, buildEmpty, mountFilterBar,
  CATEGORIES, CAT_BY_ID, sanitizeParam
} from '../portal-engine.js';

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
  items.sort((a, b) => b.ts - a.ts);
  return { items, ok, total: sources.length };
}
