/* ============================================================================
   Laxmi Job Alert — shared portal engine (READ-ONLY frontend).
   Future-proof: add a department by adding ONE entry to SOURCE_REGISTRY.
   Used by index.html (homepage) and sarkari-jobs.html (listing).
   Security: no innerHTML with data, no eval/Function/document.write,
   no Firestore writes. All cards built via createElement + textContent.
   ============================================================================ */
import { collection, getDocs, query, limit }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/* ----- ONE config per collection. Add a new source here only. ----- */
export const SOURCE_REGISTRY = [
  { id:'ssc',         label:'SSC',         collection:'ssc_jobs',            color:'#1d4ed8', icon:'🏛️' },
  { id:'rsmssb',      label:'RSMSSB',      collection:'rsmssb_jobs',         color:'#7c3aed', icon:'⭐' },
  { id:'rssb',        label:'RSSB',        collection:'rssb_jobs',           color:'#16a34a', icon:'🛡️' },
  { id:'scholarship', label:'Scholarship', collection:'scholarship_notices', color:'#ea580c', icon:'🎓' }
];

/* ----- Homepage/listing categories (render + chip order). ----- */
export const CATEGORIES = [
  { id:'jobs',        icon:'🔥', hi:'नई भर्तियां',    en:'Latest Jobs',    dateLabel:'अंतिम तिथि',        dateFields:['last_date','application_end_date','form_start_date'],            viewAll:'sarkari-jobs.html?type=RECRUITMENT' },
  { id:'result',      icon:'🏆', hi:'परिणाम',         en:'Results',        dateLabel:'परिणाम तिथि',       dateFields:['result_date','resultDate','published_at'],                       viewAll:'sarkari-jobs.html?type=RESULT' },
  { id:'admit',       icon:'🪪', hi:'एडमिट कार्ड',    en:'Admit Cards',    dateLabel:'परीक्षा तिथि',      dateFields:['exam_date','examDate','admit_card_available_from'],              viewAll:'sarkari-jobs.html?type=ADMIT_CARD' },
  { id:'answer',      icon:'🔑', hi:'आंसर की',        en:'Answer Key',     dateLabel:'आपत्ति अंतिम तिथि', dateFields:['objection_end_date','objectionEndDate','objection_start_date'],  viewAll:'sarkari-jobs.html?type=ANSWER_KEY' },
  { id:'extension',   icon:'⏳', hi:'तारीख परिवर्तन',  en:'Date Extension', dateLabel:'नई अंतिम तिथि',     dateFields:['correction_end_date','last_date','document_last_date'],          viewAll:'sarkari-jobs.html?type=DATE_EXTENSION' },
  { id:'scholarship', icon:'🎓', hi:'छात्रवृत्ति',     en:'Scholarship',    dateLabel:'अंतिम तिथि',        dateFields:['last_date','document_last_date','form_start_date'],              viewAll:'scholarship.html' },
  { id:'exam',        icon:'📅', hi:'परीक्षा तिथि',    en:'Exam Schedule',  dateLabel:'परीक्षा तिथि',      dateFields:['exam_date','exam_start_date'],                                   viewAll:'sarkari-jobs.html?type=EXAM_SCHEDULE' },
  { id:'other',       icon:'📋', hi:'अन्य सूचना',     en:'Notices',        dateLabel:'दिनांक',            dateFields:['published_at'],                                                  viewAll:'sarkari-jobs.html?src=all' }
];
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));

/* notice_type -> category. Extend by adding one line. */
const TYPE_CATEGORY = {
  RECRUITMENT:'jobs', JOB:'jobs', VACANCY:'jobs', NEW_APPLICATION:'jobs', NOTIFICATION:'jobs',
  RESULT:'result',
  ADMIT_CARD:'admit',
  ANSWER_KEY:'answer',
  DATE_EXTENSION:'extension',
  SCHOLARSHIP:'scholarship',
  EXAM_SCHEDULE:'exam',
  CORRECTION:'other', GENERAL:'other', OTHER:'other'
};

/* ===================== SAFE HELPERS ===================== */
const MISSING = new Set(['','-','—','n/a','na','null','undefined','not available','उपलब्ध नहीं','available नहीं','nil']);
export function clean(v){ if(v==null) return ''; const s=String(v).trim(); return MISSING.has(s.toLowerCase()) ? '' : s; }
export function firstNonEmpty(){ for(const a of arguments){ const c=clean(a); if(c) return c; } return ''; }
export function toMillis(ts){ if(!ts) return 0; if(typeof ts.toMillis==='function') return ts.toMillis(); if(typeof ts.seconds==='number') return ts.seconds*1000; if(typeof ts==='number') return ts; const t=Date.parse(ts); return isNaN(t)?0:t; }
export function fmtDate(ms){ if(!ms) return ''; const d=new Date(ms); if(isNaN(d)) return ''; const p=n=>String(n).padStart(2,'0'); return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()}`; }
export function parseDate(v){ const s=clean(v); if(!s) return null;
  let m=s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if(m){ const d=new Date(+m[3],+m[2]-1,+m[1]); return isNaN(d)?null:d; }
  m=s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/); if(m){ const d=new Date(+m[1],+m[2]-1,+m[3]); return isNaN(d)?null:d; }
  const t=Date.parse(s); return isNaN(t)?null:new Date(t); }
export function safeUrl(u){ const c=clean(u); if(!c) return null; try{ const x=new URL(c, location.href); return (x.protocol==='http:'||x.protocol==='https:') ? x.href : null; }catch(e){ return null; } }
export function sanitizeParam(v){ return clean(v).replace(/[^\wऀ-ॿ .,&()/-]/g,'').slice(0,80); }
export function srcMeta(col){ return SOURCE_REGISTRY.find(s=>s.collection===col) || {id:'other',label:'सरकारी',color:'#475569',icon:'🏢'}; }
function startOfToday(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function el(tag, cls, txt){ const n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; }
function icon(name){ const i=document.createElement('i'); i.className=name; return i; }

/* ===================== NORMALIZE + CLASSIFY ===================== */
export function classifyNotice(noticeType, col){
  const t = String(noticeType||'').toUpperCase();
  if(col==='scholarship_notices') return (t==='DATE_EXTENSION') ? 'extension' : 'scholarship';
  return TYPE_CATEGORY[t] || 'other';
}
// accepts a plain object that has _id/id, _col/col and raw fields
export function normalizeDoc(raw, col){
  const sm = srcMeta(col);
  const item = {
    id: raw._id || raw.id,
    col,
    sourceId: sm.id, sourceLabel: sm.label, sourceColor: sm.color, sourceIcon: sm.icon,
    title: firstNonEmpty(raw.post_name, raw.scheme_name, raw.title, raw.job_title, raw.exam_name, raw.name, raw.notice_label),
    noticeType: firstNonEmpty(raw.notice_type, raw.type, raw.category).toUpperCase(),
    dept: firstNonEmpty(raw.department, raw.source, raw.organization, raw.portal_name, raw.apply_portal),
    qualification: firstNonEmpty(raw.qualification, raw.eligibility),
    ts: toMillis(raw.published_at || raw.createdAt || raw.updatedAt),
    pdf: safeUrl(firstNonEmpty(raw.official_pdf, raw.pdf_url, raw.pdfUrl, raw.official_url, raw.detailUrl, raw.apply_link)),
    raw
  };
  item.catId = classifyNotice(item.noticeType, col);
  return item;
}
function pickDate(item, cat){
  for(const f of cat.dateFields){
    if(f==='published_at'){ const d=fmtDate(item.ts); if(d) return d; continue; }
    const v=clean(item.raw[f]); if(v) return v;
  }
  return '';
}
function lastDateOf(item){ return parseDate(firstNonEmpty(item.raw.last_date, item.raw.lastDate, item.raw.application_end_date, item.raw.correction_end_date, item.raw.document_last_date)); }

/* ===================== FETCH (read-only, capped, cached, resilient) ==========
   SDK first (timed); if the WebChannel/Listen transport fails OR resolves from
   an empty offline cache, fall back to the public Firestore REST API (plain
   HTTPS, rules still enforced, public web key only — NO secret/service account).
   ============================================================================= */
const _mem = new Map(); // collection -> normalized[]
function _cacheGet(col){ try{ const r=sessionStorage.getItem('lja_pe_'+col); if(!r) return null; const {data,ts}=JSON.parse(r); if(Date.now()-ts<5*60*1000 && Array.isArray(data)) return data; }catch(e){} return null; }
function _cacheSet(col, rawLite){ try{ sessionStorage.setItem('lja_pe_'+col, JSON.stringify({data:rawLite, ts:Date.now()})); }catch(e){} }

const _FS_PROJECT='newjobsarkari';
const _FS_KEY='AIzaSyD6fwR3EsspTbw7YJPQiSEGChdLBcOCEU8'; // public web API key (already in frontend)
const _FS_BASE=`https://firestore.googleapis.com/v1/projects/${_FS_PROJECT}/databases/(default)/documents`;
const _SDK_TIMEOUT_MS=6000;
function _withTimeout(p,ms){ return Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('sdk-timeout')),ms))]); }
function _fromRestValue(v){
  if(v==null) return null;
  if('stringValue' in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue' in v) return v.doubleValue;
  if('booleanValue' in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;     // ISO string; toMillis() parses it
  if('nullValue' in v) return null;
  if('arrayValue' in v) return (v.arrayValue.values||[]).map(_fromRestValue);
  if('mapValue' in v){ const o={}; const f=v.mapValue.fields||{}; for(const k in f) o[k]=_fromRestValue(f[k]); return o; }
  return null;
}
function _restDocToObj(d){ const o={_id:(d.name||'').split('/').pop()}; const f=d.fields||{}; for(const k in f) o[k]=_fromRestValue(f[k]); return o; }
async function _restReadCollection(col, perCollection){
  const r=await fetch(`${_FS_BASE}/${encodeURIComponent(col)}?pageSize=${perCollection}&key=${_FS_KEY}`);
  if(!r.ok) throw new Error('REST '+r.status);
  const j=await r.json();
  return (j.documents||[]).map(_restDocToObj);
}
async function _readResilient(db, col, perCollection){
  try{
    const snap=await _withTimeout(getDocs(query(collection(db,col), limit(perCollection))), _SDK_TIMEOUT_MS);
    const rawLite=[]; snap.forEach(d=>{ let data=d.data()||{}; if(data.published_at && data.published_at.seconds!=null) data={...data, published_at:{seconds:data.published_at.seconds}}; rawLite.push({ _id:d.id, ...data }); });
    if(rawLite.length>0) return rawLite;
    try{ const r=await _restReadCollection(col, perCollection); return r.length>rawLite.length ? r : rawLite; }catch(e){ return rawLite; }
  }catch(e){
    return await _restReadCollection(col, perCollection);
  }
}

export async function fetchSources(db, { sources, perCollection=20 } = {}){
  const cols = (sources && sources.length)
    ? sources.map(id=>{ const s=SOURCE_REGISTRY.find(x=>x.id===id); return s?s.collection:null; }).filter(Boolean)
    : SOURCE_REGISTRY.map(s=>s.collection);

  const settled = await Promise.allSettled(cols.map(async col=>{
    if(_mem.has(col)) return _mem.get(col);
    const cached=_cacheGet(col);
    if(cached){ const norm=cached.map(r=>normalizeDoc(r,col)); _mem.set(col,norm); return norm; }
    const rawLite = await _readResilient(db, col, perCollection);   // SDK -> REST
    _cacheSet(col, rawLite);
    const norm=rawLite.map(r=>normalizeDoc(r,col));
    _mem.set(col,norm);
    return norm;
  }));

  let ok=0, failed=0, items=[];
  settled.forEach(r=>{ if(r.status==='fulfilled'){ ok++; items.push(...r.value); } else { failed++; } });
  items.sort((a,b)=>b.ts-a.ts);
  return { items, ok, failed, total: cols.length };
}

/* ===================== FILTER OPTIONS (dynamic) ===================== */
const QUAL_BUCKETS = [
  { id:'10th',     label:'10वीं पास',  re:/10th|10\s*वीं|मैट्रिक|matric/i },
  { id:'12th',     label:'12वीं पास',  re:/12th|12\s*वीं|सीनियर|senior secondary|intermediate|10\+2/i },
  { id:'iti',      label:'ITI',        re:/\biti\b|आईटीआई/i },
  { id:'diploma',  label:'डिप्लोमा',   re:/diploma|डिप्लोमा/i },
  { id:'graduate', label:'स्नातक',     re:/graduat|स्नातक|bachelor|degree|b\.?a\b|b\.?sc|b\.?com|b\.?e\b|b\.?tech/i },
  { id:'pg',       label:'परास्नातक',  re:/post.?graduat|master|m\.?a\b|m\.?sc|m\.?com|पीजी|परास्नातक/i }
];
function qualBucketsOf(item){ const q=(item.qualification||'').toLowerCase(); if(!q) return []; const out=[]; QUAL_BUCKETS.forEach(b=>{ if(b.re.test(q)) out.push(b.id); }); if(!out.length) out.push('other'); return out; }

export function buildFilterOptions(items){
  const typeCount={}, srcMap=new Map();
  let qualPresent=false; const qualSet=new Set();
  items.forEach(it=>{
    typeCount[it.catId]=(typeCount[it.catId]||0)+1;
    if(!srcMap.has(it.sourceId)) srcMap.set(it.sourceId,{ id:it.sourceId, label:it.sourceLabel, color:it.sourceColor, count:0 });
    srcMap.get(it.sourceId).count++;
    if(it.qualification){ qualPresent=true; qualBucketsOf(it).forEach(b=>qualSet.add(b)); }
  });
  const types = CATEGORIES.filter(c=>typeCount[c.id]>0).map(c=>({ id:c.id, label:c.hi, count:typeCount[c.id] }));
  const sources = [...srcMap.values()].sort((a,b)=>b.count-a.count);
  const qualifications = QUAL_BUCKETS.filter(b=>qualSet.has(b.id)).map(b=>({id:b.id,label:b.label}));
  if(qualSet.has('other')) qualifications.push({id:'other',label:'अन्य'});
  return { types, sources, total: items.length, hasQualification: qualPresent, qualifications };
}

/* ===================== APPLY FILTERS + SORT ===================== */
function statusMatch(item, status){
  if(!status || status==='all') return true;
  const today=startOfToday();
  const last=lastDateOf(item);
  const ageDays=item.ts ? (Date.now()-item.ts)/86400000 : Infinity;
  switch(status){
    case 'active':   return !!last && last>=today;
    case 'today':    return !!last && last.getTime()===today.getTime();
    case 'closing7': return !!last && last>=today && (last-today)/86400000<=7;
    case 'expired':  return !!last && last<today;
    case 'nolast':   return !last;
    case 'new7':     return ageDays<=7;
    case 'd30':      return ageDays<=30;
    case 'old':      return ageDays>30;
    default:         return true;
  }
}
export function defaultSort(type){ return type==='jobs' ? 'active_first' : 'newest'; }
function sortItems(arr, sort, type){
  const s = sort || defaultSort(type);
  const today=startOfToday();
  const out=arr.slice();
  if(s==='newest')   return out.sort((a,b)=>b.ts-a.ts);
  if(s==='title_az') return out.sort((a,b)=>(a.title||'').localeCompare(b.title||'','hi'));
  if(s==='dept_az')  return out.sort((a,b)=>(a.sourceLabel+' '+a.dept).localeCompare(b.sourceLabel+' '+b.dept,'hi'));
  if(s==='last_near'||s==='last_far'){
    const w=[],wo=[]; out.forEach(it=>{ (lastDateOf(it)?w:wo).push(it); });
    w.sort((a,b)=> s==='last_near' ? lastDateOf(a)-lastDateOf(b) : lastDateOf(b)-lastDateOf(a));
    wo.sort((a,b)=>b.ts-a.ts);
    return [...w, ...wo];
  }
  if(s==='active_first'){
    return out.sort((a,b)=>{
      const la=lastDateOf(a), lb=lastDateOf(b);
      const aa=(la&&la>=today)?0:1, ab=(lb&&lb>=today)?0:1;
      if(aa!==ab) return aa-ab;
      if(la&&lb&&la>=today&&lb>=today) return la-lb;
      return b.ts-a.ts;
    });
  }
  return out.sort((a,b)=>b.ts-a.ts);
}
export function applyFilters(items, state={}){
  let r=items;
  const q=clean(state.q).toLowerCase();
  if(q) r=r.filter(it=>{
    const cat=CAT_BY_ID[it.catId]||CAT_BY_ID.other;
    const hay=`${it.title} ${it.dept} ${it.noticeType} ${cat.hi} ${cat.en} ${it.sourceLabel} ${(it.raw.tags||[]).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  if(state.type && state.type!=='all')     r=r.filter(it=>it.catId===state.type);
  if(state.source && state.source!=='all') r=r.filter(it=>it.sourceId===state.source);
  if(state.status && state.status!=='all') r=r.filter(it=>statusMatch(it,state.status));
  if(state.qual && state.qual!=='all')     r=r.filter(it=>qualBucketsOf(it).includes(state.qual));
  return sortItems(r, state.sort, state.type);
}
export function isDefaultState(s={}){
  return !clean(s.q) && (!s.type||s.type==='all') && (!s.source||s.source==='all')
      && (!s.status||s.status==='all') && (!s.qual||s.qual==='all') && (!s.sort||s.sort==='');
}

/* ===================== RENDER (safe DOM) ===================== */
export function buildCard(item){
  const cat = CAT_BY_ID[item.catId] || CAT_BY_ID.other;
  const card = el('article','pe-card');

  const top = el('div','pe-card-top');
  const sb = el('span','pe-src', item.sourceLabel); sb.style.background=item.sourceColor;
  top.appendChild(sb);
  top.appendChild(el('span','pe-cat', cat.hi));
  card.appendChild(top);

  card.appendChild(el('div','pe-title', item.title || 'सूचना देखें'));

  if(item.dept){
    const dp=el('div','pe-dept'); dp.appendChild(icon('fas fa-building')); dp.appendChild(el('span',null,item.dept));
    card.appendChild(dp);
  }

  const dateVal=pickDate(item,cat);
  const dl=el('div','pe-date'); dl.appendChild(icon('fas fa-calendar-day'));
  dl.appendChild(el('span',null, cat.dateLabel+':'));
  dl.appendChild(el('b',null, dateVal || 'देखें'));
  card.appendChild(dl);

  const foot=el('div','pe-foot');
  const d=el('a','pe-btn','विवरण देखें');
  d.setAttribute('href', `alert-detail.html?id=${encodeURIComponent(item.id)}&src=${encodeURIComponent(item.col)}`);
  foot.appendChild(d);
  if(item.pdf){
    const p=el('a','pe-pdf'); p.setAttribute('href',item.pdf); p.setAttribute('target','_blank'); p.setAttribute('rel','noopener noreferrer');
    p.appendChild(icon('fas fa-file-pdf')); foot.appendChild(p);
  }
  card.appendChild(foot);
  return card;
}
export function buildGrid(items){
  const g=el('div','pe-cards');
  items.forEach(it=>g.appendChild(buildCard(it)));
  return g;
}
export function buildEmpty(msg){
  const e=el('div','pe-empty'); e.appendChild(icon('fas fa-inbox')); e.appendChild(el('p',null, msg||'अभी कोई सूचना उपलब्ध नहीं है')); return e;
}
export function buildSection(cat, items, alt){
  const sec=el('section','pe-section'+(alt?' alt':''));
  const inner=el('div','pe-inner');
  const head=el('div','pe-head');
  const h2=el('h2','pe-h2'); h2.appendChild(el('span','pe-ico',cat.icon)); h2.appendChild(el('span',null,cat.hi)); h2.appendChild(el('small',null,cat.en));
  head.appendChild(h2);
  const all=el('a','pe-seeall','सभी देखें'); all.setAttribute('href',cat.viewAll); all.appendChild(icon('fas fa-arrow-right')); head.appendChild(all);
  inner.appendChild(head);
  inner.appendChild(items.length ? buildGrid(items) : buildEmpty());
  sec.appendChild(inner);
  return sec;
}

/* ===================== FILTER BAR (UI factory) ===================== */
const STATUS_OPTS = [
  { label:'भर्ती स्थिति', group:[
    {v:'active',label:'सक्रिय (अंतिम तिथि बाकी)'},
    {v:'today',label:'आज अंतिम तिथि'},
    {v:'closing7',label:'7 दिन में बंद'},
    {v:'expired',label:'समाप्त'},
    {v:'nolast',label:'बिना अंतिम तिथि'}
  ]},
  { label:'सूचना तिथि', group:[
    {v:'new7',label:'नई (7 दिन)'},
    {v:'d30',label:'पिछले 30 दिन'},
    {v:'old',label:'पुरानी (30+ दिन)'}
  ]}
];
const SORT_OPTS = [
  {v:'',label:'डिफ़ॉल्ट (स्मार्ट)'},
  {v:'newest',label:'नई पहले'},
  {v:'last_near',label:'अंतिम तिथि नज़दीक'},
  {v:'last_far',label:'अंतिम तिथि दूर'},
  {v:'dept_az',label:'विभाग A-Z'},
  {v:'title_az',label:'शीर्षक A-Z'}
];
function debounce(fn,ms){ let t; return function(){ clearTimeout(t); const a=arguments,c=this; t=setTimeout(()=>fn.apply(c,a),ms); }; }

/* host: element to mount into. opts.items, opts.initial, opts.onChange(filtered,state,isDefault) */
export function mountFilterBar(host, opts){
  const items=opts.items||[];
  const state=Object.assign({q:'',type:'all',source:'all',status:'all',sort:'',qual:'all'}, opts.initial||{});
  const meta=buildFilterOptions(items);

  host.textContent='';
  const bar=el('div','pe-filter');
  const showSearch = opts.showSearch !== false;

  // search (optional — homepage drives via its hero search instead)
  let inp=document.createElement('input');
  if(showSearch){
    const sRow=el('div','pe-search');
    sRow.appendChild(icon('fas fa-search'));
    inp.type='text'; inp.placeholder='पोस्ट नाम, विभाग, सूचना खोजें...'; inp.setAttribute('aria-label','खोजें'); inp.value=state.q;
    sRow.appendChild(inp);
    bar.appendChild(sRow);
  }

  // type chips
  const chips=el('div','pe-chips');
  function chip(id,label,count){
    const b=el('button','pe-chip'+(state.type===id?' active':''));
    b.appendChild(el('span',null,label));
    if(count!=null){ b.appendChild(el('span','pe-chip-n',String(count))); }
    b.addEventListener('click',()=>{ state.type=id; [...chips.children].forEach(c=>c.classList.remove('active')); b.classList.add('active'); update(); });
    return b;
  }
  chips.appendChild(chip('all','सभी', meta.total));
  meta.types.forEach(t=>chips.appendChild(chip(t.id,(CAT_BY_ID[t.id]||{}).hi||t.label,t.count)));
  bar.appendChild(chips);

  // controls row (selects + clear)
  const ctr=el('div','pe-controls');
  function select(opts2, val, withGroups){
    const sel=document.createElement('select'); sel.className='pe-select';
    if(withGroups){
      const a=document.createElement('option'); a.value='all'; a.textContent='सभी स्थिति/तिथि'; sel.appendChild(a);
      opts2.forEach(g=>{ const og=document.createElement('optgroup'); og.label=g.label; g.group.forEach(o=>{ const op=document.createElement('option'); op.value=o.v; op.textContent=o.label; og.appendChild(op); }); sel.appendChild(og); });
    } else {
      opts2.forEach(o=>{ const op=document.createElement('option'); op.value=o.v; op.textContent=o.label; sel.appendChild(op); });
    }
    sel.value=val;
    return sel;
  }
  // source select (dynamic)
  const srcSel=document.createElement('select'); srcSel.className='pe-select';
  const allSrc=document.createElement('option'); allSrc.value='all'; allSrc.textContent='सभी विभाग'; srcSel.appendChild(allSrc);
  meta.sources.forEach(s=>{ const o=document.createElement('option'); o.value=s.id; o.textContent=`${s.label} (${s.count})`; srcSel.appendChild(o); });
  srcSel.value=state.source;
  srcSel.addEventListener('change',()=>{ state.source=srcSel.value; update(); });
  ctr.appendChild(srcSel);

  // status select
  const statSel=select(STATUS_OPTS, state.status, true);
  statSel.addEventListener('change',()=>{ state.status=statSel.value; update(); });
  ctr.appendChild(statSel);

  // sort select
  const sortSel=select(SORT_OPTS, state.sort, false);
  sortSel.addEventListener('change',()=>{ state.sort=sortSel.value; update(); });
  ctr.appendChild(sortSel);

  // qualification (only if data has it)
  let qualSel=null;
  if(meta.hasQualification && meta.qualifications.length){
    qualSel=select([{v:'all',label:'सभी योग्यता'}, ...meta.qualifications.map(q=>({v:q.id,label:q.label}))], state.qual, false);
    qualSel.addEventListener('change',()=>{ state.qual=qualSel.value; update(); });
    ctr.appendChild(qualSel);
  }

  // clear
  const clr=el('button','pe-clear'); clr.appendChild(icon('fas fa-rotate-left')); clr.appendChild(el('span',null,'फ़िल्टर साफ़ करें'));
  clr.addEventListener('click',()=>{
    state.q=''; state.type='all'; state.source='all'; state.status='all'; state.sort=''; state.qual='all';
    inp.value=''; srcSel.value='all'; statSel.value='all'; sortSel.value=''; if(qualSel) qualSel.value='all';
    [...chips.children].forEach((c,i)=>c.classList.toggle('active',i===0));
    update();
  });
  ctr.appendChild(clr);
  bar.appendChild(ctr);

  // count
  const count=el('div','pe-count');
  bar.appendChild(count);
  host.appendChild(bar);

  if(showSearch) inp.addEventListener('input', debounce(()=>{ state.q=inp.value; update(); }, 250));

  function update(){
    const filtered=applyFilters(items, state);
    const def=isDefaultState(state);
    count.textContent = def ? '' : `कुल ${filtered.length} सूचनाएं मिलीं`;
    if(typeof opts.onChange==='function') opts.onChange(filtered, state, def);
  }
  update();
  return {
    state, update,
    getFiltered:()=>applyFilters(items,state),
    setQuery(q){ state.q=q; if(showSearch) inp.value=q; update(); }
  };
}

/* ===================== STYLES (injected once) ===================== */
(function injectStyles(){
  if(document.getElementById('pe-styles')) return;
  const css = `
  .pe-filter{max-width:1200px;margin:0 auto;padding:0 4px;display:flex;flex-direction:column;gap:12px;}
  .pe-search{background:#fff;border:1.5px solid var(--gray-200,#e2e8f0);border-radius:12px;display:flex;align-items:center;gap:10px;padding:11px 16px;box-shadow:0 2px 12px rgba(15,23,42,.05);}
  .pe-search i{color:var(--gray-400,#94a3b8);}
  .pe-search input{flex:1;border:none;outline:none;font-size:14.5px;font-family:var(--font-hi,sans-serif);background:transparent;color:var(--text,#0f172a);min-width:0;}
  .pe-chips{display:flex;gap:8px;overflow-x:auto;padding:2px;scrollbar-width:thin;-webkit-overflow-scrolling:touch;}
  .pe-chips::-webkit-scrollbar{height:5px;} .pe-chips::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:5px;}
  .pe-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;background:#fff;border:1.5px solid var(--gray-200,#e2e8f0);color:var(--gray-600,#475569);padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:700;font-family:var(--font-hi,sans-serif);white-space:nowrap;transition:.18s;}
  .pe-chip:hover{border-color:#93c5fd;}
  .pe-chip.active{background:var(--blue,#1d4ed8);border-color:var(--blue,#1d4ed8);color:#fff;}
  .pe-chip-n{background:rgba(15,23,42,.08);color:inherit;font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px;}
  .pe-chip.active .pe-chip-n{background:rgba(255,255,255,.25);}
  .pe-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
  .pe-select{appearance:none;-webkit-appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;border:1.5px solid var(--gray-200,#e2e8f0);border-radius:10px;padding:9px 30px 9px 13px;font-size:12.5px;font-weight:600;font-family:var(--font-hi,sans-serif);color:var(--text,#0f172a);cursor:pointer;min-width:140px;}
  .pe-select:focus{outline:none;border-color:var(--blue,#1d4ed8);}
  .pe-clear{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1.5px solid #fecaca;color:#dc2626;padding:9px 14px;border-radius:10px;font-size:12.5px;font-weight:700;font-family:var(--font-hi,sans-serif);margin-left:auto;}
  .pe-clear:hover{background:#fef2f2;}
  .pe-count{font-size:13px;font-weight:700;color:var(--gray-600,#475569);font-family:var(--font-hi,sans-serif);}
  .pe-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;}
  .pe-card{background:#fff;border:1px solid var(--gray-200,#e2e8f0);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:9px;box-shadow:0 4px 20px rgba(15,23,42,.06);transition:transform .2s,box-shadow .2s,border-color .2s;}
  .pe-card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(15,23,42,.12);border-color:#c7d2fe;}
  .pe-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .pe-src{font-size:11px;font-weight:800;padding:3px 11px;border-radius:999px;color:#fff;}
  .pe-cat{font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-family:var(--font-hi,sans-serif);}
  .pe-title{font-size:14px;font-weight:700;line-height:1.45;color:var(--text,#0f172a);font-family:var(--font-hi,sans-serif);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:2.9em;}
  .pe-dept{font-size:11.5px;color:var(--gray-600,#475569);font-family:var(--font-hi,sans-serif);display:flex;align-items:center;gap:6px;}
  .pe-dept i{color:var(--gray-400,#94a3b8);font-size:11px;}
  .pe-date{font-size:12.5px;font-weight:600;color:#1e293b;font-family:var(--font-hi,sans-serif);display:flex;align-items:center;gap:6px;background:var(--gray-50,#f8fafc);border-radius:8px;padding:7px 11px;}
  .pe-date i{color:var(--gray-400,#94a3b8);font-size:12px;}
  .pe-date b{color:#dc2626;font-weight:800;margin-left:auto;}
  .pe-foot{display:flex;gap:8px;margin-top:2px;}
  .pe-btn{flex:1;text-align:center;background:var(--blue,#1d4ed8);color:#fff;padding:9px;border-radius:9px;font-size:12.5px;font-weight:700;font-family:var(--font-hi,sans-serif);transition:background .2s;}
  .pe-btn:hover{background:var(--blue-dark,#1e3a8a);}
  .pe-pdf{width:42px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--gray-200,#e2e8f0);border-radius:9px;color:var(--gray-600,#475569);transition:.2s;}
  .pe-pdf:hover{border-color:var(--blue,#1d4ed8);color:var(--blue,#1d4ed8);}
  .pe-empty{text-align:center;padding:34px 20px;color:var(--gray-400,#94a3b8);display:flex;flex-direction:column;align-items:center;gap:10px;background:#fff;border:1px dashed var(--gray-200,#e2e8f0);border-radius:14px;}
  .pe-empty i{font-size:34px;color:var(--gray-200,#e2e8f0);}
  .pe-empty p{font-size:13.5px;font-family:var(--font-hi,sans-serif);}
  .pe-section{padding:30px 20px;} .pe-section.alt{background:#fff;}
  .pe-inner{max-width:1200px;margin:0 auto;}
  .pe-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:12px;}
  .pe-h2{font-size:clamp(17px,3vw,22px);font-weight:800;color:var(--text,#0f172a);display:flex;align-items:center;gap:9px;font-family:var(--font-hi,sans-serif);}
  .pe-h2 small{font-size:.62em;font-weight:600;color:var(--gray-400,#94a3b8);font-family:var(--font-en,sans-serif);}
  .pe-seeall{display:inline-flex;align-items:center;gap:6px;color:var(--blue,#1d4ed8);font-size:12.5px;font-weight:700;padding:7px 16px;border-radius:999px;border:1.5px solid var(--blue,#1d4ed8);transition:.2s;font-family:var(--font-hi,sans-serif);}
  .pe-seeall:hover{background:var(--blue,#1d4ed8);color:#fff;}
  @media(max-width:600px){ .pe-cards{grid-template-columns:1fr;} .pe-clear{margin-left:0;} .pe-select{flex:1;min-width:0;} .pe-section{padding:24px 16px;} }
  `;
  const st=document.createElement('style'); st.id='pe-styles'; st.textContent=css; document.head.appendChild(st);
})();
