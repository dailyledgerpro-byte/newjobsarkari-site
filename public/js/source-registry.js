/* ============================================================================
   Rajasthan All-Department Source Registry (foundation, READ-ONLY).
   Pure config + helpers — NO Firestore, NO writes, NO DOM side effects.
   Add a new department later by adding ONE entry to SOURCE_REGISTRY.
   Based on the verified Source Registry Audit (June 2026).
   ============================================================================ */

/* ----- Central content-category map (reusable by home/listing/detail) ----- */
export const CONTENT_CATEGORIES = {
  RECRUITMENT:    { hi:'भर्ती',           color:'#1d4ed8' },
  RESULT:         { hi:'परिणाम',          color:'#ea580c' },
  ADMIT_CARD:     { hi:'एडमिट कार्ड',     color:'#7c3aed' },
  ANSWER_KEY:     { hi:'आंसर की',         color:'#0d9488' },
  DATE_EXTENSION: { hi:'तारीख परिवर्तन',  color:'#b45309' },
  SCHOLARSHIP:    { hi:'छात्रवृत्ति',      color:'#db2777' },
  SCHEME:         { hi:'योजना',           color:'#16a34a' },
  FARMER_HELP:    { hi:'किसान सहायता',    color:'#65a30d' },
  WOMEN_HELP:     { hi:'महिला सहायता',    color:'#c026d3' },
  ANIMAL_HELP:    { hi:'पशुपालन सहायता',  color:'#9a3412' },
  STUDENT_HELP:   { hi:'विद्यार्थी सहायता',color:'#2563eb' },
  LABOUR_HELP:    { hi:'श्रमिक सहायता',    color:'#0891b2' },
  SOCIAL_SECURITY:{ hi:'सामाजिक सुरक्षा',  color:'#4f46e5' },
  PUBLIC_NOTICE:  { hi:'सामान्य सूचना',    color:'#475569' },
  TENDER:         { hi:'निविदा',           color:'#7c2d12' }
};

export const SOURCE_TYPES = {
  commission:        'आयोग',
  board:             'बोर्ड',
  recruitment_portal:'भर्ती पोर्टल',
  scheme_portal:     'योजना पोर्टल',
  department:        'विभाग',
  citizen_service:   'नागरिक सेवा',
  education_board:   'शिक्षा बोर्ड'
};

export const BENEFICIARIES = {
  all:'सभी', student:'विद्यार्थी', graduate:'स्नातक', farmer:'किसान', women:'महिला',
  labour:'श्रमिक', senior_citizen:'वरिष्ठ नागरिक', animal_owner:'पशुपालक',
  youth:'युवा', business:'व्यापार', general:'सामान्य'
};

export const PHASES = {
  P0:{ hi:'P0 — लाइव आधार',     color:'#16a34a' },
  P1:{ hi:'P1 — अगला उच्च-मूल्य', color:'#1d4ed8' },
  P2:{ hi:'P2 — नागरिक विभाग',   color:'#7c3aed' },
  P3:{ hi:'P3 — शेष विभाग',      color:'#64748b' }
};

export const STATUS = {
  LIVE:          { hi:'लाइव',            color:'#16a34a' },
  PARKED:        { hi:'रोका गया',        color:'#b45309' },
  PLANNED:       { hi:'प्रस्तावित',       color:'#1d4ed8' },
  REVIEW_NEEDED: { hi:'सत्यापन आवश्यक',  color:'#64748b' }
};

/* notice→content-category mapping seam (re-uses CONTENT_CATEGORIES keys) */
export const NOTICE_TYPE_TO_CONTENT = {
  RECRUITMENT:'RECRUITMENT', JOB:'RECRUITMENT', VACANCY:'RECRUITMENT', NEW_APPLICATION:'SCHOLARSHIP',
  RESULT:'RESULT', ADMIT_CARD:'ADMIT_CARD', ANSWER_KEY:'ANSWER_KEY', EXAM_SCHEDULE:'PUBLIC_NOTICE',
  DATE_EXTENSION:'DATE_EXTENSION', CORRECTION:'PUBLIC_NOTICE', SCHOLARSHIP:'SCHOLARSHIP',
  SCHEME:'SCHEME', GENERAL:'PUBLIC_NOTICE', OTHER:'PUBLIC_NOTICE', TENDER:'TENDER'
};

/* ============================================================================
   SOURCE_REGISTRY
   - `collection` is set only for P0 sources that already have live Firestore data.
   - `urlVerified:true` => officialWebsite confirmed during the June-2026 audit.
     urlVerified:false  => plausible official URL; CONFIRM before any bot work.
   ============================================================================ */
export const SOURCE_REGISTRY = [
  /* ---------------- P0 — live foundation (do not disturb the bots) ---------------- */
  { id:'ssc', hindiName:'कर्मचारी चयन आयोग', englishName:'Staff Selection Commission', shortName:'SSC',
    sourceType:'commission', phase:'P0', priority:'HIGH', officialWebsite:'https://ssc.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','RESULT','ADMIT_CARD','ANSWER_KEY','PUBLIC_NOTICE'], beneficiaries:['youth','graduate','general'],
    recommendedIngestion:'bot', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'LIVE', collection:'ssc_jobs', urlVerified:true,
    note:'केंद्रीय आयोग — पहले से लाइव बॉट।' },

  { id:'rsmssb', hindiName:'राजस्थान अधीनस्थ एवं मंत्रालयिक सेवा चयन बोर्ड', englishName:'Rajasthan Subordinate & Ministerial Services Selection Board', shortName:'RSMSSB',
    sourceType:'board', phase:'P0', priority:'HIGH', officialWebsite:'https://rsmssb.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','RESULT','ADMIT_CARD','ANSWER_KEY','PUBLIC_NOTICE'], beneficiaries:['youth','general'],
    recommendedIngestion:'bot', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'LIVE', collection:'rsmssb_jobs', urlVerified:true,
    note:'2024 में RSSB नाम मिला; RSSB के साथ संभावित overlap — dedupe ध्यान रखें।' },

  { id:'rssb', hindiName:'राजस्थान कर्मचारी चयन बोर्ड', englishName:'Rajasthan Staff Selection Board', shortName:'RSSB',
    sourceType:'board', phase:'P0', priority:'HIGH', officialWebsite:'https://rssb.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','RESULT','ADMIT_CARD','ANSWER_KEY','PUBLIC_NOTICE'], beneficiaries:['youth','general'],
    recommendedIngestion:'bot', scrapeDifficulty:'HIGH', risk:'MEDIUM', status:'PARKED', collection:'rssb_jobs', urlVerified:true,
    note:'GitHub-hosted runner से अगम्य — India self-hosted runner पर ही चलाएँ।' },

  { id:'scholarship', hindiName:'सामाजिक न्याय एवं अधिकारिता — छात्रवृत्ति', englishName:'SJE — Scholarships', shortName:'Scholarship',
    sourceType:'scheme_portal', phase:'P0', priority:'HIGH', officialWebsite:'https://sje.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['SCHOLARSHIP','SCHEME','DATE_EXTENSION','SOCIAL_SECURITY'], beneficiaries:['student','senior_citizen','general'],
    recommendedIngestion:'bot', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'LIVE', collection:'scholarship_notices', urlVerified:true,
    note:'SJE/HTE/SJMS पोर्टल — पहले से लाइव बॉट।' },

  /* ---------------- P1 — high-value next ---------------- */
  { id:'rpsc', hindiName:'राजस्थान लोक सेवा आयोग', englishName:'Rajasthan Public Service Commission', shortName:'RPSC',
    sourceType:'commission', phase:'P1', priority:'HIGH', officialWebsite:'https://rpsc.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','RESULT','ADMIT_CARD','ANSWER_KEY','PUBLIC_NOTICE'], beneficiaries:['youth','graduate','general'],
    recommendedIngestion:'bot_after_probe', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'PLANNED', urlVerified:true,
    note:'अगला अनुशंसित बॉट — RSMSSB जैसा PDF/नोटिस ढांचा।' },

  { id:'raj_recruitment', hindiName:'राजस्थान भर्ती पोर्टल', englishName:'Rajasthan Recruitment Portal', shortName:'Recruitment',
    sourceType:'recruitment_portal', phase:'P1', priority:'HIGH', officialWebsite:'https://recruitment.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','ADMIT_CARD','PUBLIC_NOTICE'], beneficiaries:['youth','general'],
    recommendedIngestion:'api_if_available', scrapeDifficulty:'HIGH', risk:'MEDIUM', status:'PLANNED', urlVerified:true,
    note:'Servlet/सेशन-आधारित — पहले API/संरचना जाँचें।' },

  { id:'jansoochna_scheme', hindiName:'जन सूचना पोर्टल — योजनाएं', englishName:'Jan Soochna — Schemes', shortName:'Jan Soochna',
    sourceType:'scheme_portal', phase:'P1', priority:'HIGH', officialWebsite:'https://jansoochna.rajasthan.gov.in/Scheme', notificationPage:'',
    contentTypes:['SCHEME','SCHOLARSHIP','FARMER_HELP','WOMEN_HELP','SOCIAL_SECURITY'], beneficiaries:['all','farmer','women','student'],
    recommendedIngestion:'api_if_available', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'PLANNED', urlVerified:true,
    note:'150+ योजनाएं; encrypted query params — review_queue पहले।' },

  { id:'raj_dept_portal', hindiName:'राजस्थान विभाग पोर्टल', englishName:'Rajasthan Department Portal', shortName:'Dept Portal',
    sourceType:'department', phase:'P1', priority:'MEDIUM', officialWebsite:'https://department.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['SCHEME','PUBLIC_NOTICE'], beneficiaries:['general'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'PLANNED', urlVerified:true,
    note:'योजनाओं/सेवाओं का केंद्रीय पोर्टल।' },

  { id:'dop', hindiName:'कार्मिक विभाग', englishName:'Department of Personnel', shortName:'DOP',
    sourceType:'department', phase:'P1', priority:'MEDIUM', officialWebsite:'https://dop.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','PUBLIC_NOTICE'], beneficiaries:['youth','general'],
    recommendedIngestion:'review_queue', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false,
    note:'URL/अधिसूचना पेज सत्यापित करें।' },

  /* ---------------- P2 — citizen / scheme departments ---------------- */
  { id:'agriculture', hindiName:'कृषि विभाग', englishName:'Agriculture Department', shortName:'Agriculture',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://agriculture.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['FARMER_HELP','SCHEME','PUBLIC_NOTICE'], beneficiaries:['farmer'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false },

  { id:'animal_husbandry', hindiName:'पशुपालन विभाग', englishName:'Animal Husbandry Department', shortName:'Animal Husbandry',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://animalhusbandry.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['ANIMAL_HELP','SCHEME','RECRUITMENT'], beneficiaries:['animal_owner','farmer'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:true },

  { id:'wcd', hindiName:'महिला एवं बाल विकास विभाग', englishName:'Women & Child Development', shortName:'WCD',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://wcd.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['WOMEN_HELP','SCHEME','SOCIAL_SECURITY'], beneficiaries:['women'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false },

  { id:'sje_dept', hindiName:'सामाजिक न्याय एवं अधिकारिता विभाग', englishName:'Social Justice & Empowerment', shortName:'SJE Dept',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://sje.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['SOCIAL_SECURITY','SCHEME','SCHOLARSHIP'], beneficiaries:['senior_citizen','general'],
    recommendedIngestion:'bot_after_probe', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'PLANNED', urlVerified:true,
    note:'मौजूदा छात्रवृत्ति बॉट का विस्तार।' },

  { id:'labour', hindiName:'श्रम विभाग', englishName:'Labour Department', shortName:'Labour',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://labour.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['LABOUR_HELP','SCHEME','SOCIAL_SECURITY'], beneficiaries:['labour'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false },

  { id:'food', hindiName:'खाद्य एवं नागरिक आपूर्ति विभाग', englishName:'Food & Civil Supplies', shortName:'Food',
    sourceType:'department', phase:'P2', priority:'LOW', officialWebsite:'https://food.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['PUBLIC_NOTICE','SCHEME'], beneficiaries:['general'],
    recommendedIngestion:'review_queue', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false },

  { id:'medical_health', hindiName:'चिकित्सा एवं स्वास्थ्य विभाग', englishName:'Medical & Health', shortName:'Health',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'', notificationPage:'',
    contentTypes:['RECRUITMENT','PUBLIC_NOTICE','SCHEME'], beneficiaries:['all'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'REVIEW_NEEDED', urlVerified:false,
    note:'कई उप-पोर्टल — आधिकारिक URL सत्यापित करें।' },

  { id:'school_edu', hindiName:'स्कूल शिक्षा विभाग', englishName:'School Education', shortName:'School Edu',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://education.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['STUDENT_HELP','RECRUITMENT','RESULT','PUBLIC_NOTICE'], beneficiaries:['student'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false,
    note:'Shala Darpan भी देखें।' },

  { id:'college_edu', hindiName:'कॉलेज शिक्षा विभाग', englishName:'College Education', shortName:'College Edu',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://hte.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['STUDENT_HELP','RECRUITMENT','SCHOLARSHIP'], beneficiaries:['student'],
    recommendedIngestion:'manual_admin', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false },

  { id:'cooperative', hindiName:'सहकारिता विभाग', englishName:'Cooperative Department', shortName:'Cooperative',
    sourceType:'department', phase:'P2', priority:'LOW', officialWebsite:'https://cooperative.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','SCHEME'], beneficiaries:['farmer','general'],
    recommendedIngestion:'review_queue', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false },

  { id:'revenue_bor', hindiName:'राजस्व मंडल', englishName:'Board of Revenue', shortName:'BOR',
    sourceType:'board', phase:'P2', priority:'LOW', officialWebsite:'', notificationPage:'',
    contentTypes:['PUBLIC_NOTICE','RECRUITMENT'], beneficiaries:['general'],
    recommendedIngestion:'review_queue', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'REVIEW_NEEDED', urlVerified:false,
    note:'आधिकारिक URL सत्यापित करें।' },

  { id:'panchayati_raj', hindiName:'पंचायती राज विभाग', englishName:'Panchayati Raj', shortName:'Panchayati Raj',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'https://rajpanchayat.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RECRUITMENT','SCHEME','PUBLIC_NOTICE'], beneficiaries:['general'],
    recommendedIngestion:'review_queue', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'PLANNED', urlVerified:false },

  { id:'rural_dev', hindiName:'ग्रामीण विकास विभाग', englishName:'Rural Development', shortName:'Rural Dev',
    sourceType:'department', phase:'P2', priority:'MEDIUM', officialWebsite:'', notificationPage:'',
    contentTypes:['SCHEME','LABOUR_HELP','PUBLIC_NOTICE'], beneficiaries:['labour','general'],
    recommendedIngestion:'review_queue', scrapeDifficulty:'UNKNOWN', risk:'LOW', status:'REVIEW_NEEDED', urlVerified:false,
    note:'MGNREGA आदि; आधिकारिक URL सत्यापित करें।' },

  { id:'rbse', hindiName:'माध्यमिक शिक्षा बोर्ड, अजमेर', englishName:'Board of Secondary Education (RBSE)', shortName:'RBSE',
    sourceType:'education_board', phase:'P2', priority:'HIGH', officialWebsite:'https://rajeduboard.rajasthan.gov.in/', notificationPage:'',
    contentTypes:['RESULT','ADMIT_CARD','STUDENT_HELP','PUBLIC_NOTICE'], beneficiaries:['student'],
    recommendedIngestion:'bot_after_probe', scrapeDifficulty:'MEDIUM', risk:'LOW', status:'PLANNED', urlVerified:false,
    note:'10वीं/12वीं परिणाम — उच्च traffic; URL सत्यापित करें।' },

  /* ---------------- P3 — long-tail (REVIEW_NEEDED; URLs unverified) ---------------- */
  ...[
    ['forest','वन विभाग','Forest Department'],
    ['phed','जन स्वास्थ्य अभियांत्रिकी (PHED)','Public Health Engineering'],
    ['energy','ऊर्जा विभाग / डिस्कॉम','Energy / Discom'],
    ['transport','परिवहन विभाग','Transport Department'],
    ['industries','उद्योग विभाग','Industries Department'],
    ['tourism','पर्यटन विभाग','Tourism Department'],
    ['mines','खान एवं भूविज्ञान विभाग','Mines & Geology'],
    ['tad','जनजाति क्षेत्रीय विकास (TAD)','Tribal Area Development'],
    ['minority','अल्पसंख्यक मामलात विभाग','Minority Affairs'],
    ['sainik','सैनिक कल्याण विभाग','Sainik Welfare'],
    ['khadi','खादी एवं ग्रामोद्योग बोर्ड','Khadi & Village Industries Board'],
    ['riico','रीको','RIICO'],
    ['ayurveda','आयुर्वेद विभाग','Ayurveda Department'],
    ['sanskrit_edu','संस्कृत शिक्षा विभाग','Sanskrit Education'],
    ['technical_edu','तकनीकी शिक्षा (BTER)','Technical Education'],
    ['devasthan','देवस्थान विभाग','Devasthan Department']
  ].map(([id,hi,en])=>({
    id, hindiName:hi, englishName:en, shortName:en, sourceType:'department', phase:'P3', priority:'LOW',
    officialWebsite:'', notificationPage:'', contentTypes:['PUBLIC_NOTICE','SCHEME','RECRUITMENT'],
    beneficiaries:['general'], recommendedIngestion:'review_queue', scrapeDifficulty:'UNKNOWN', risk:'LOW',
    status:'REVIEW_NEEDED', urlVerified:false, note:'दीर्घ-पुच्छ स्रोत — आधिकारिक URL व अधिसूचना पेज सत्यापन आवश्यक।'
  }))
];

/* ===================== HELPERS (pure) ===================== */
export function isValidUrl(u){
  if(typeof u!=='string' || !u.trim()) return false;
  try{ const x=new URL(u.trim()); return x.protocol==='http:'||x.protocol==='https:'; }catch(e){ return false; }
}
export function contentLabel(code){ return (CONTENT_CATEGORIES[code]||{}).hi || code; }
export function contentColor(code){ return (CONTENT_CATEGORIES[code]||{}).color || '#475569'; }
export function sourceTypeLabel(code){ return SOURCE_TYPES[code] || code; }
export function beneficiaryLabel(code){ return BENEFICIARIES[code] || code; }
export function phaseMeta(code){ return PHASES[code] || { hi:code, color:'#64748b' }; }
export function statusMeta(code){ return STATUS[code] || { hi:code, color:'#64748b' }; }

// distinct option lists for filters — built from the registry (future entries auto-appear)
export function buildRegistryFilters(){
  const types=new Set(), contents=new Set(), benes=new Set(), phases=new Set(), statuses=new Set();
  SOURCE_REGISTRY.forEach(s=>{
    types.add(s.sourceType); phases.add(s.phase); statuses.add(s.status);
    (s.contentTypes||[]).forEach(c=>contents.add(c));
    (s.beneficiaries||[]).forEach(b=>benes.add(b));
  });
  return {
    sourceTypes:[...types], contentTypes:[...contents], beneficiaries:[...benes],
    phases:['P0','P1','P2','P3'].filter(p=>phases.has(p)), statuses:[...statuses]
  };
}

// pure filter — used by departments.html (and reusable elsewhere)
export function filterSources(state={}){
  const q=(state.q||'').trim().toLowerCase();
  return SOURCE_REGISTRY.filter(s=>{
    if(state.phase && state.phase!=='all' && s.phase!==state.phase) return false;
    if(state.sourceType && state.sourceType!=='all' && s.sourceType!==state.sourceType) return false;
    if(state.contentType && state.contentType!=='all' && !(s.contentTypes||[]).includes(state.contentType)) return false;
    if(state.beneficiary && state.beneficiary!=='all' && !(s.beneficiaries||[]).includes(state.beneficiary)) return false;
    if(state.status && state.status!=='all' && s.status!==state.status) return false;
    if(q){
      const hay=`${s.hindiName} ${s.englishName} ${s.shortName} ${s.id}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

// live sources that already have a Firestore collection (for future home/listing merge)
export function liveSources(){ return SOURCE_REGISTRY.filter(s=>s.collection && s.status==='LIVE'); }
