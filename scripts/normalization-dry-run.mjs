#!/usr/bin/env node
/**
 * Read-only legacy-to-official-post normalization preview.
 *
 * This script never sends Firestore writes. It creates local reports only:
 *   reports/normalization-dry-run-summary.json
 *   reports/normalization-samples.json
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import https from 'node:https';

const COLLECTIONS = ['ssc_jobs', 'rsmssb_jobs', 'rssb_jobs', 'scholarship_notices', 'alerts'];
const SAMPLE_TYPES = ['recruitment', 'result', 'answer_key', 'exam_schedule', 'notification', 'scholarship', 'admit_card'];
const REPORT_DIR = 'reports';
const ORIGIN = 'http://127.0.0.1:5599';

function hasValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return typeof value !== 'object' || Object.keys(value).length > 0;
}

function first(doc, keys) {
  for (const key of keys) if (hasValue(doc[key])) return doc[key];
  return null;
}

function compact(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function decodeFirestoreValue(value) {
  if (value == null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeFirestoreValue(item)]));
  }
  return null;
}

function decodeDocument(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

function classifyPostType(doc, collection) {
  const direct = compact(first(doc, ['postType', 'notice_type']));
  const directMap = {
    recruitment: 'recruitment', job: 'recruitment', jobs: 'recruitment',
    result: 'result', admit_card: 'admit_card', admitcard: 'admit_card',
    answer_key: 'answer_key', answerkey: 'answer_key', scholarship: 'scholarship',
    admission: 'admission', notification: 'notification', government_update: 'government_update',
    govt_update: 'government_update', exam_schedule: 'exam_schedule', examschedule: 'exam_schedule',
    correction: 'correction', correction_notice: 'correction', update: 'notification', scheme: 'notification'
  };
  if (directMap[direct]) return { postType: directMap[direct], basis: 'postType/notice_type' };

  const category = compact(first(doc, ['category', 'catId']));
  const categoryMap = {
    result: 'result', admit: 'admit_card', admit_card: 'admit_card',
    answer: 'answer_key', answer_key: 'answer_key', scholarship: 'scholarship',
    admission: 'admission', exam: 'exam_schedule', exam_schedule: 'exam_schedule',
    recruitment: 'recruitment', jobs: 'recruitment', job: 'recruitment',
    notification: 'notification', government_update: 'government_update', correction: 'correction'
  };
  if (categoryMap[category]) return { postType: categoryMap[category], basis: 'category/catId' };
  if (collection === 'scholarship_notices') return { postType: 'scholarship', basis: 'source collection' };

  const title = String(first(doc, ['post_name', 'scheme_name', 'title', 'job_title', 'exam_name', 'name', 'notice_label']) || '').toLowerCase();
  if (/answer\s*key/.test(title)) return { postType: 'answer_key', basis: 'title' };
  if (/admit\s*card/.test(title)) return { postType: 'admit_card', basis: 'title' };
  if (/\bresult\b/.test(title)) return { postType: 'result', basis: 'title' };
  if (/exam\s*(date|schedule)|date\s*notice/.test(title)) return { postType: 'exam_schedule', basis: 'title' };
  if (/correction/.test(title)) return { postType: 'correction', basis: 'title' };
  if (/scholarship/.test(title)) return { postType: 'scholarship', basis: 'title' };
  if (/admission/.test(title)) return { postType: 'admission', basis: 'title' };
  if (/recruitment|vacancy|empanelment/.test(title)) return { postType: 'recruitment', basis: 'title' };
  if (/notification|notice|update|advisory/.test(title)) return { postType: 'notification', basis: 'title' };
  if (['ssc_jobs', 'rsmssb_jobs', 'rssb_jobs'].includes(collection)) return { postType: 'recruitment', basis: 'source collection fallback' };
  return { postType: 'unknown', basis: 'unknown' };
}

function setIfPresent(target, key, value) {
  if (hasValue(value)) target[key] = value;
}

function setNestedIfPresent(target, parent, key, value) {
  if (!hasValue(value)) return;
  target[parent] ||= {};
  target[parent][key] = value;
}

function normalizePreview(doc, collection) {
  const { postType, basis } = classifyPostType(doc, collection);
  const normalized = {};
  const links = doc.importantLinks && typeof doc.importantLinks === 'object' ? doc.importantLinks : {};
  const dates = doc.importantDates && typeof doc.importantDates === 'object' ? doc.importantDates : {};

  setIfPresent(normalized, 'title', first(doc, ['post_name', 'scheme_name', 'title', 'job_title', 'exam_name', 'name', 'notice_label']));
  setIfPresent(normalized, 'department', first(doc, ['department', 'dept', 'organization', 'portal_name', 'apply_portal', 'source']));
  setIfPresent(normalized, 'sourceLabel', first(doc, ['sourceLabel', 'sourceHindiName', 'source', 'organization', 'portal_name']));
  setIfPresent(normalized, 'publishedDate', first(doc, ['publishedDate', 'publishedAt', 'published_at', 'date', 'createdAt']));
  setIfPresent(normalized, 'updatedDate', first(doc, ['updatedDate', 'updatedAt', 'updated_at', 'lastVerifiedAt']));
  setIfPresent(normalized, 'summary', first(doc, ['summary', 'description', 'ai_summary']));
  setIfPresent(normalized, 'officialPdfUrl', first(doc, ['officialPdfUrl', 'officialPdf', 'official_pdf', 'pdf', 'pdf_url', 'notification_pdf']));
  setIfPresent(normalized, 'officialSourceUrl', first(doc, ['officialWebsite', 'website', 'url', 'officialUrl', 'official_url']));
  setIfPresent(normalized, 'totalPosts', first(doc, ['totalPosts', 'total_posts']));
  normalized.postType = postType;

  setNestedIfPresent(normalized, 'importantLinks', 'officialNotificationPdf', first(links, ['officialNotificationPdf', 'notification', 'pdf']) || normalized.officialPdfUrl);
  setNestedIfPresent(normalized, 'importantLinks', 'officialWebsite', first(links, ['officialWebsite', 'website']) || normalized.officialSourceUrl);
  setNestedIfPresent(normalized, 'importantLinks', 'applyOnline', first(links, ['applyOnline', 'apply']) || first(doc, ['apply_link', 'applyUrl']));
  setNestedIfPresent(normalized, 'importantLinks', 'result', first(links, ['result', 'resultPdf', 'result_pdf']) || first(doc, ['result_link', 'resultUrl', 'result_pdf', 'resultPdf']));
  setNestedIfPresent(normalized, 'importantLinks', 'answerKey', first(links, ['answerKey']) || first(doc, ['answer_key_link']));
  setNestedIfPresent(normalized, 'importantLinks', 'admitCard', first(links, ['admitCard']) || first(doc, ['admit_card_link']));

  const dateSources = {
    notificationDate: first(dates, ['notificationDate']) || first(doc, ['notification_date']),
    startDate: first(dates, ['startDate']) || first(doc, ['form_start_date', 'startDate']),
    lastDate: first(dates, ['lastDate']) || first(doc, ['last_date', 'lastDate']),
    feeLastDate: first(dates, ['feeLastDate']) || first(doc, ['fee_last_date']),
    examDate: first(dates, ['examDate']) || first(doc, ['exam_date', 'examDate', 'exam_start_date']),
    resultDate: first(dates, ['resultDate']) || first(doc, ['result_date', 'resultDate']),
    answerKeyDate: first(dates, ['answerKeyDate']) || first(doc, ['answer_key_date', 'answerKeyDate']),
    admitCardDate: first(dates, ['admitCardDate']) || first(doc, ['admit_card_date', 'admit_card_available_from', 'admitCardDate'])
  };
  for (const [key, value] of Object.entries(dateSources)) setNestedIfPresent(normalized, 'importantDates', key, value);

  return { normalized, postType, basis };
}

function requiredFields(postType, normalized) {
  const dates = normalized.importantDates || {};
  const links = normalized.importantLinks || {};
  const missing = [];
  const add = (name, value) => { if (!hasValue(value)) missing.push(name); };

  if (postType === 'recruitment') {
    add('totalPosts', normalized.totalPosts);
    add('lastDate', dates.lastDate);
    add('eligibility', null);
    add('applicationFee', null);
    add('ageLimit', null);
    add('applyOnline', links.applyOnline);
    add('officialPdfUrl', normalized.officialPdfUrl);
  } else if (postType === 'result') {
    add('resultDate', dates.resultDate);
    add('resultLink', links.result || normalized.officialPdfUrl);
    add('officialSourceUrl', normalized.officialSourceUrl);
  } else if (postType === 'admit_card') {
    add('admitCardDate', dates.admitCardDate);
    add('examDate', dates.examDate);
    add('downloadOrLoginLink', links.admitCard || links.applyOnline);
    add('officialSourceUrl', normalized.officialSourceUrl);
  } else if (postType === 'answer_key') {
    add('answerKeyDate', dates.answerKeyDate);
    add('answerKeyLink', links.answerKey);
    add('objectionCorrectionLink', null);
    add('officialPdfUrl', normalized.officialPdfUrl);
  } else if (postType === 'scholarship') {
    add('lastDate', dates.lastDate);
    add('eligibility', null);
    add('requiredDocuments', null);
    add('applyOnline', links.applyOnline);
    add('officialSourceUrl', normalized.officialSourceUrl);
  }
  return missing;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Origin: ORIGIN, Referer: `${ORIGIN}/` } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(Object.assign(new Error(`Firestore read returned ${response.statusCode}`), { statusCode: response.statusCode }));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function listCollection(projectId, apiKey, collection) {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await requestJson(url);
    documents.push(...(response.documents || []));
    pageToken = response.nextPageToken || '';
  } while (pageToken);
  return documents;
}

function addCount(target, key) { target[key] = (target[key] || 0) + 1; }

async function main() {
  const page = await readFile('public/alert-detail.html', 'utf8');
  const projectId = (page.match(/projectId:'([^']+)'/) || [])[1];
  const apiKey = (page.match(/apiKey:'([^']+)'/) || [])[1];
  if (!projectId || !apiKey) throw new Error('Firestore configuration is unavailable');

  const summary = {
    mode: 'read-only normalization preview',
    collections: {},
    totals: { processed: 0, safelyNormalizable: 0 },
    fieldsStillMissingByPostType: {},
    alerts: { status: 'not_attempted' }
  };
  const samples = {};

  for (const collection of COLLECTIONS) {
    let documents;
    try {
      documents = await listCollection(projectId, apiKey, collection);
    } catch (error) {
      if (collection === 'alerts' && error.statusCode === 403) {
        summary.alerts = { status: 'not_enumerable', reason: 'Public collection list reads are denied (403); no bypass attempted.' };
        summary.collections[collection] = { status: 'not_enumerable', total: null };
        continue;
      }
      throw error;
    }

    const collectionSummary = { status: 'readable', total: documents.length, safelyNormalizable: 0, mappedFields: {}, postTypes: {} };
    summary.collections[collection] = collectionSummary;

    for (const raw of documents) {
      const doc = decodeDocument(raw);
      const id = raw.name.split('/').pop();
      const { normalized, postType, basis } = normalizePreview(doc, collection);
      const safe = hasValue(normalized.title) && postType !== 'unknown' && (hasValue(normalized.summary) || hasValue(normalized.officialPdfUrl) || hasValue(normalized.officialSourceUrl));

      summary.totals.processed += 1;
      collectionSummary.postTypes[postType] = (collectionSummary.postTypes[postType] || 0) + 1;
      if (safe) {
        summary.totals.safelyNormalizable += 1;
        collectionSummary.safelyNormalizable += 1;
      }
      for (const [key, value] of Object.entries(normalized)) {
        if (key === 'postType' || hasValue(value)) addCount(collectionSummary.mappedFields, key);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            if (hasValue(nestedValue)) addCount(collectionSummary.mappedFields, `${key}.${nestedKey}`);
          }
        }
      }

      const missing = requiredFields(postType, normalized);
      if (missing.length) {
        const bucket = summary.fieldsStillMissingByPostType[postType] ||= { documents: 0, fields: {} };
        bucket.documents += 1;
        for (const field of missing) addCount(bucket.fields, field);
      }

      if (SAMPLE_TYPES.includes(postType) && !samples[postType]) {
        samples[postType] = {
          source: { collection, id, detectionBasis: basis },
          normalized
        };
      }
    }
  }

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(`${REPORT_DIR}/normalization-dry-run-summary.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(`${REPORT_DIR}/normalization-samples.json`, `${JSON.stringify(samples, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    processed: summary.totals.processed,
    safelyNormalizable: summary.totals.safelyNormalizable,
    collections: Object.fromEntries(Object.entries(summary.collections).map(([name, value]) => [name, { status: value.status, total: value.total, safelyNormalizable: value.safelyNormalizable }])),
    alerts: summary.alerts,
    sampleTypes: Object.keys(samples)
  }, null, 2));
}

main().catch(error => {
  console.error(`DRY_RUN_ERROR ${error.message}`);
  process.exitCode = 1;
});
