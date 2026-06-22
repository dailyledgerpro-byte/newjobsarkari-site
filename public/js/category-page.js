/* ============================================================================
   Shared category-page renderer. Each category HTML sets window.__PAGE_ID and
   imports this. It fetches via the existing alert-data-engine (which reads the
   4 public collections + PUBLISHED alerts only — no review docs leak), filters
   to the page's category, and renders the same safe card grid + filter bar.
   READ-ONLY. No Firestore writes. No innerHTML with data.
   ============================================================================ */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import * as Engine from './alert-data-engine.js';
import { SEO_PAGES } from './seo-page-config.js';

const firebaseConfig = {
  apiKey:'AIzaSyD6fwR3EsspTbw7YJPQiSEGChdLBcOCEU8',
  authDomain:'newjobsarkari.firebaseapp.com',
  projectId:'newjobsarkari',
  storageBucket:'newjobsarkari.firebasestorage.app',
  messagingSenderId:'489662168900',
  appId:'1:489662168900:web:b214ef3f1269ef3a9de111'
};
const _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
let db; try { db = initializeFirestore(_app, { experimentalAutoDetectLongPolling: true }); } catch (e) { db = getFirestore(_app); }

const PAGE_ID = window.__PAGE_ID || 'latest-alerts';
const cfg = SEO_PAGES[PAGE_ID] || { catIds: [], noticeTypes: [] };

function catMatch(it) {
  const hasC = cfg.catIds && cfg.catIds.length;
  const hasN = cfg.noticeTypes && cfg.noticeTypes.length;
  if (!hasC && !hasN) return true;                       // latest-alerts = everything
  if (hasC && cfg.catIds.includes(it.catId)) return true;
  if (hasN && cfg.noticeTypes.includes(it.noticeType)) return true;
  return false;
}

const grid = document.getElementById('catList');
const countEl = document.getElementById('catCount');

(async () => {
  try {
    const { items, ok } = await Engine.fetchAlerts(db, { perCollection: 50 });
    if (ok === 0) { grid.textContent = ''; grid.appendChild(Engine.buildEmpty('डेटा लोड नहीं हो पाया, कृपया बाद में प्रयास करें')); return; }
    const subset = items.filter(catMatch);

    const controller = Engine.mountFilterBar(document.getElementById('filterBar'), {
      items: subset,
      showSearch: false,                                  // hero search drives it
      onChange: (filtered) => {
        grid.textContent = '';
        grid.appendChild(filtered.length ? Engine.buildGrid(filtered) : Engine.buildEmpty('इस फ़िल्टर से कोई सूचना नहीं मिली'));
        if (countEl) countEl.textContent = filtered.length ? ('कुल ' + filtered.length + ' सूचनाएं') : '';
      }
    });

    // wire the static hero search (if present) to the controller
    const input = document.getElementById('catSearch');
    if (input && controller && controller.setQuery) {
      let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => controller.setQuery(input.value), 250); });
    }
  } catch (e) {
    grid.textContent = '';
    grid.appendChild(Engine.buildEmpty('डेटा लोड नहीं हो पाया, कृपया बाद में प्रयास करें'));
  }
})();
