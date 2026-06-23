#!/usr/bin/env node
/**
 * Read-only Firestore migration preview.
 *
 * Produces field-path merge payloads only. This script has no Firebase SDK,
 * no admin credentials, and no Firestore write operation.
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

function isUrlLike(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
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

function existingNested(doc, parent, key) {
  const value = doc[parent];
  return value && typeof value === 'object' && !Array.isArray(value) ? value[key] : null;
}

function addIfMissing(payload, doc, fieldPath, value) {
  if (!hasValue(value)) return;
  const [parent, key] = fieldPath.split('.');
  const current = key ? existingNested(doc, parent, key) : doc[parent];
  if (!hasValue(current)) payload[fieldPath] = value;
}

function exactWebsiteUrl(doc, links) {
  const candidate = first(links, ['officialWebsite', 'website']) || first(doc, ['officialWebsite', 'website', 'url', 'officialUrl', 'official_url']);
  return isUrlLike(candidate) ? candidate : null;
}

function buildPayload(doc, collection) {
  const { postType, basis } = classifyPostType(doc, collection);
  const links = doc.importantLinks && typeof doc.importantLinks === 'object' ? doc.importantLinks : {};
  const dates = doc.importantDates && typeof doc.importantDates === 'object' ? doc.importantDates : {};
  const payload = {};

  addIfMissing(payload, doc, 'title', first(doc, ['post_name', 'scheme_name', 'job_title', 'exam_name', 'name', 'notice_label']));
  addIfMissing(payload, doc, 'department', first(doc, ['dept', 'organization', 'portal_name', 'apply_portal', 'source']));
  addIfMissing(payload, doc, 'sourceLabel', first(doc, ['sourceHindiName', 'source', 'organization', 'portal_name']));
  addIfMissing(payload, doc, 'postType', postType);
  addIfMissing(payload, doc, 'publishedDate', first(doc, ['publishedAt', 'published_at', 'date', 'createdAt']));
  addIfMissing(payload, doc, 'updatedDate', first(doc, ['updatedAt', 'updated_at', 'lastVerifiedAt']));
  addIfMissing(payload, doc, 'summary', first(doc, ['description', 'ai_summary']));
  addIfMissing(payload, doc, 'officialPdfUrl', first(doc, ['officialPdf', 'official_pdf', 'pdf', 'pdf_url', 'notification_pdf']));
  addIfMissing(payload, doc, 'officialSourceUrl', exactWebsiteUrl(doc, links));
  addIfMissing(payload, doc, 'totalPosts', first(doc, ['total_posts']));

  addIfMissing(payload, doc, 'importantLinks.officialNotificationPdf', first(links, ['officialNotificationPdf', 'notification', 'pdf']) || first(doc, ['officialPdfUrl', 'officialPdf', 'official_pdf', 'pdf', 'pdf_url', 'notification_pdf']));
  addIfMissing(payload, doc, 'importantLinks.officialWebsite', exactWebsiteUrl(doc, links));
  addIfMissing(payload, doc, 'importantLinks.applyOnline', first(links, ['applyOnline', 'apply']) || first(doc, ['apply_link', 'applyUrl']));
  addIfMissing(payload, doc, 'importantLinks.result', first(links, ['result', 'resultPdf', 'result_pdf']) || first(doc, ['result_link', 'resultUrl', 'result_pdf', 'resultPdf']));
  addIfMissing(payload, doc, 'importantLinks.answerKey', first(links, ['answerKey']) || first(doc, ['answer_key_link']));
  addIfMissing(payload, doc, 'importantLinks.admitCard', first(links, ['admitCard']) || first(doc, ['admit_card_link']));

  const safeDates = {
    startDate: first(dates, ['startDate']) || first(doc, ['start_date', 'form_start_date']),
    lastDate: first(dates, ['lastDate']) || first(doc, ['last_date']),
    examDate: first(dates, ['examDate']) || first(doc, ['exam_date']),
    resultDate: first(dates, ['resultDate']) || first(doc, ['result_date']),
    admitCardDate: first(dates, ['admitCardDate']) || first(doc, ['admit_card_date']),
    answerKeyDate: first(dates, ['answerKeyDate']) || first(doc, ['answer_key_date']),
    correctionDate: first(dates, ['correctionDate']) || first(doc, ['correction_date', 'objection_last_date'])
  };
  for (const [key, value] of Object.entries(safeDates)) addIfMissing(payload, doc, `importantDates.${key}`, value);

  return { postType, basis, payload };
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

function addCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

async function main() {
  const page = await readFile('public/alert-detail.html', 'utf8');
  const projectId = (page.match(/projectId:'([^']+)'/) || [])[1];
  const apiKey = (page.match(/apiKey:'([^']+)'/) || [])[1];
  if (!projectId || !apiKey) throw new Error('Firestore configuration is unavailable');

  const summary = {
    mode: 'read-only migration preview',
    collections: {},
    totals: { scanned: 0, proposedUpdates: 0, skippedNoSafeUpdate: 0 },
    proposedFieldsByPostType: {},
    intentionallyNotMigrated: [
      'applicationFee, ageLimit, vacancyDetails, eligibility, selectionProcess, requiredDocuments, howToApply, faqs, aiConfidence, and verificationStatus require existing structured data or future review.',
      'objection_start_date is not mapped as answerKeyDate because it describes a different event.',
      'source labels such as ssc.gov.in are not converted into URLs unless an explicit URL field is already URL-like.',
      'No title or summary text is parsed for dates or other structured values.'
    ],
    alerts: { status: 'not_attempted' }
  };
  const payloads = { mode: 'read-only migration preview', payloads: [], samples: {} };

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

    const collectionSummary = { status: 'readable', scanned: documents.length, proposedUpdates: 0, skippedNoSafeUpdate: 0, proposedFields: {}, proposedPostTypes: {} };
    summary.collections[collection] = collectionSummary;

    for (const raw of documents) {
      const doc = decodeDocument(raw);
      const id = raw.name.split('/').pop();
      const { postType, basis, payload } = buildPayload(doc, collection);
      const fields = Object.keys(payload);
      summary.totals.scanned += 1;

      if (!fields.length) {
        summary.totals.skippedNoSafeUpdate += 1;
        collectionSummary.skippedNoSafeUpdate += 1;
        continue;
      }

      summary.totals.proposedUpdates += 1;
      collectionSummary.proposedUpdates += 1;
      addCount(collectionSummary.proposedPostTypes, postType);
      const postTypeSummary = summary.proposedFieldsByPostType[postType] ||= { documents: 0, fields: {} };
      postTypeSummary.documents += 1;
      for (const field of fields) {
        addCount(collectionSummary.proposedFields, field);
        addCount(postTypeSummary.fields, field);
      }

      const item = { collection, id, postType, detectionBasis: basis, merge: true, updateFields: payload };
      payloads.payloads.push(item);
      if (SAMPLE_TYPES.includes(postType) && !payloads.samples[postType]) payloads.samples[postType] = item;
    }
  }

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(`${REPORT_DIR}/normalization-migration-preview-summary.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(`${REPORT_DIR}/normalization-migration-payloads.json`, `${JSON.stringify(payloads, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    scanned: summary.totals.scanned,
    proposedUpdates: summary.totals.proposedUpdates,
    skippedNoSafeUpdate: summary.totals.skippedNoSafeUpdate,
    alerts: summary.alerts,
    sampleTypes: Object.keys(payloads.samples)
  }, null, 2));
}

main().catch(error => {
  console.error(`MIGRATION_PREVIEW_ERROR ${error.message}`);
  process.exitCode = 1;
});
