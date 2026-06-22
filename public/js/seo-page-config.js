/* ============================================================================
   Shared SEO + category config. One entry per page (future pages reuse this).
   `catIds`     = portal-engine category ids to include (jobs/result/admit/answer…)
   `noticeTypes`= raw notice/alert types to include (for scheme-type pages)
   If both empty => show everything (latest-alerts).
   Static <title>/<meta>/<h1> live in each HTML file (crawlable); these fields
   are the canonical reference + future page-generation source.
   ============================================================================ */
export const SEO_PAGES = {
  'latest-alerts': {
    title: 'ताज़ा सरकारी सूचनाएँ | Laxmi Job Alert',
    description: 'राजस्थान व केंद्र की नवीनतम सरकारी भर्ती, परिणाम, एडमिट कार्ड, आंसर की, छात्रवृत्ति और योजना सूचनाएँ — एक जगह।',
    h1: 'ताज़ा सरकारी सूचनाएँ',
    intro: 'सभी विभागों की नवीनतम सरकारी सूचनाएँ एक साथ — भर्ती, परिणाम, एडमिट कार्ड, आंसर की, योजना और छात्रवृत्ति।',
    canonical: '/latest-alerts.html', catIds: [], noticeTypes: []
  },
  'jobs': {
    title: 'राजस्थान सरकारी नौकरी 2026 | Laxmi Job Alert',
    description: 'SSC, RSMSSB, RSSB व राजस्थान विभागों की नवीनतम सरकारी नौकरी भर्तियाँ — अंतिम तिथि, आधिकारिक नोटिफिकेशन व PDF लिंक के साथ।',
    h1: 'नवीनतम सरकारी भर्तियाँ',
    intro: 'राजस्थान और केंद्र सरकार की ताज़ा सरकारी नौकरी भर्तियाँ — पद, अंतिम तिथि और आधिकारिक नोटिफिकेशन।',
    canonical: '/jobs.html', catIds: ['jobs'], noticeTypes: []
  },
  'results': {
    title: 'सरकारी परिणाम / Result 2026 | Laxmi Job Alert',
    description: 'राजस्थान व केंद्र की सरकारी परीक्षा परिणाम (Result) सूचनाएँ — आधिकारिक लिंक के साथ सबसे पहले।',
    h1: 'नवीनतम परिणाम',
    intro: 'सरकारी परीक्षा परिणाम / Result — आधिकारिक स्रोत से सबसे पहले।',
    canonical: '/results.html', catIds: ['result'], noticeTypes: []
  },
  'admit-card': {
    title: 'एडमिट कार्ड / Admit Card 2026 | Laxmi Job Alert',
    description: 'राजस्थान व केंद्र की सरकारी परीक्षा एडमिट कार्ड / Admit Card सूचनाएँ — परीक्षा तिथि व आधिकारिक डाउनलोड लिंक।',
    h1: 'एडमिट कार्ड',
    intro: 'सरकारी परीक्षा एडमिट कार्ड / Admit Card — परीक्षा तिथि और आधिकारिक डाउनलोड लिंक।',
    canonical: '/admit-card.html', catIds: ['admit'], noticeTypes: []
  },
  'answer-key': {
    title: 'आंसर की / Answer Key 2026 | Laxmi Job Alert',
    description: 'सरकारी परीक्षा आंसर की / Answer Key व आपत्ति (objection) सूचनाएँ — आधिकारिक लिंक के साथ।',
    h1: 'आंसर की',
    intro: 'सरकारी परीक्षा आंसर की / Answer Key और आपत्ति की अंतिम तिथि।',
    canonical: '/answer-key.html', catIds: ['answer'], noticeTypes: []
  },
  'schemes': {
    title: 'राजस्थान सरकारी योजनाएँ | Laxmi Job Alert',
    description: 'राजस्थान की किसान, महिला, श्रमिक, पशुपालन व सामाजिक सुरक्षा सरकारी योजनाओं की सूचनाएँ — आधिकारिक लिंक के साथ।',
    h1: 'राजस्थान सरकारी योजनाएँ',
    intro: 'किसान, महिला, श्रमिक, पशुपालन और सामाजिक सुरक्षा योजनाओं की नवीनतम सूचनाएँ।',
    canonical: '/schemes.html', catIds: [],
    noticeTypes: ['SCHEME','FARMER_HELP','WOMEN_HELP','LABOUR_HELP','SOCIAL_SECURITY','ANIMAL_HELP','STUDENT_HELP']
  }
};
