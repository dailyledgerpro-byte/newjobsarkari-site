#!/usr/bin/env node
/**
 * Read-only cleaner for reviewed normalization migration payloads.
 *
 * It never connects to Firestore. It preserves fully valid payloads unchanged,
 * excludes entire invalid payloads, and creates local reports only.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const INPUT = 'reports/normalization-migration-payloads.json';
const REPORT_DIR = 'reports';
const ALLOWED_COLLECTIONS = new Set(['ssc_jobs', 'rsmssb_jobs', 'rssb_jobs', 'scholarship_notices']);
const ALLOWED_FIELDS = new Set([
  'title', 'department', 'sourceLabel', 'postType', 'publishedDate', 'updatedDate', 'summary', 'officialPdfUrl', 'totalPosts',
  'importantLinks.officialNotificationPdf', 'importantLinks.applyOnline', 'importantLinks.result', 'importantLinks.answerKey', 'importantLinks.admitCard',
  'importantDates.startDate', 'importantDates.lastDate', 'importantDates.examDate', 'importantDates.resultDate', 'importantDates.admitCardDate', 'importantDates.answerKeyDate', 'importantDates.correctionDate'
]);
const DATE_FIELDS = new Set([
  'importantDates.startDate', 'importantDates.lastDate', 'importantDates.examDate', 'importantDates.resultDate',
  'importantDates.admitCardDate', 'importantDates.answerKeyDate', 'importantDates.correctionDate'
]);
const URL_FIELDS = new Set([
  'officialPdfUrl', 'importantLinks.officialNotificationPdf', 'importantLinks.applyOnline',
  'importantLinks.result', 'importantLinks.answerKey', 'importantLinks.admitCard'
]);
const POST_TYPES = new Set(['recruitment', 'result', 'admit_card', 'answer_key', 'scholarship', 'admission', 'notification', 'government_update', 'exam_schedule', 'correction']);

function placeholder(value) {
  return /^(?:\u0909\u092a\u0932\u092c\u094d\u0927\s*\u0928\u0939\u0940\u0902|n\/?a|not available|none|-|--)?$/i.test(String(value || '').trim());
}

function issueFor(field, value) {
  const text = String(value || '').trim();
  if (!ALLOWED_FIELDS.has(field)) return 'unexpected_field';
  if (placeholder(text)) return 'placeholder';
  if (DATE_FIELDS.has(field) && !/^\d{2}-\d{2}-\d{4}$/.test(text)) return 'non_date_value';
  if (URL_FIELDS.has(field) && !/^https?:\/\//i.test(text)) return 'non_url_value';
  if (field === 'totalPosts' && !/^\d+$/.test(text)) return 'non_numeric_total';
  if ((field === 'publishedDate' || field === 'updatedDate') && Number.isNaN(Date.parse(text))) return 'invalid_timestamp';
  if (field === 'postType' && !POST_TYPES.has(text)) return 'unknown_post_type';
  return null;
}

function inspectPayload(payload) {
  const issues = [];
  if (!ALLOWED_COLLECTIONS.has(payload.collection)) issues.push({ field: null, reason: 'collection_not_allowed' });
  if (payload.merge !== true) issues.push({ field: null, reason: 'not_merge_style' });
  if (!payload.updateFields || typeof payload.updateFields !== 'object' || Array.isArray(payload.updateFields)) {
    issues.push({ field: null, reason: 'invalid_update_fields' });
  } else {
    for (const [field, value] of Object.entries(payload.updateFields)) {
      const reason = issueFor(field, value);
      if (reason) issues.push({ field, reason });
    }
  }
  return issues;
}

function count(items, pick) {
  return items.reduce((result, item) => {
    const key = pick(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function authorizedWritePlan() {
  return `# Authorized normalization write plan\n\nThis phase performs no Firestore write. The public Firestore client returned 403 during the previous attempt and must not be retried for migration writes.\n\n## Recommended method\n\nUse a local Firebase Admin SDK runner with already configured secure credentials. It keeps the migration operator-controlled, avoids adding a public endpoint, and can be run once with explicit approval. Do not print, paste, create, or request credentials in chat.\n\n## Alternative method\n\nA temporary callable Cloud Function restricted to super-admins can be used only if a local authenticated runner is unavailable. It must be disabled or removed after the approved migration.\n\n## Required controls\n\n- Regenerate and validate the clean payload report immediately before the run.\n- Use only approved collections; never include \`alerts\`.\n- Create a document backup before each batch.\n- Use merge-style dotted field paths only.\n- Never replace a whole document or a whole nested map.\n- Abort before the first write if a field is not allowlisted, malformed, inferred, or already structured.\n- Use a small batch first and stop on the first error.\n- Read back every successful document and verify only planned fields changed.\n- Do not alter public files, deploy, or change security rules as part of the migration.\n`;
}

async function main() {
  const source = JSON.parse(await readFile(INPUT, 'utf8'));
  const reviewed = source.payloads || [];
  const valid = [];
  const excluded = [];

  for (const payload of reviewed) {
    const issues = inspectPayload(payload);
    if (issues.length) {
      excluded.push({
        collection: payload.collection,
        id: payload.id,
        postType: payload.postType,
        reasons: issues
      });
    } else {
      valid.push(payload);
    }
  }

  const reasonEntries = excluded.flatMap(item => item.reasons);
  const summary = {
    mode: 'read-only cleaned normalization payload review',
    totalOriginalPayloads: reviewed.length,
    validPayloads: valid.length,
    excludedPayloads: excluded.length,
    exclusionsByReason: count(reasonEntries, item => item.reason),
    exclusionsByField: count(reasonEntries.filter(item => item.field), item => item.field),
    validPayloadsByCollection: count(valid, item => item.collection),
    validPayloadsByPostType: count(valid, item => item.postType),
    firstTenValidDocumentIds: valid.slice(0, 10).map(item => ({ collection: item.collection, id: item.id, postType: item.postType })),
    alertsIncluded: false,
    payloadsModified: false,
    authorizedWritePlan: {
      publicClientWrite: 'not permitted; prior PATCH returned 403',
      recommendedOption: 'Local Firebase Admin SDK runner using already configured secure credentials',
      alternativeOption: 'Temporary super-admin-only callable Cloud Function, disabled or removed after migration'
    }
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(`${REPORT_DIR}/normalization-clean-valid-payloads.json`, `${JSON.stringify({ mode: 'read-only clean payload set', payloads: valid }, null, 2)}\n`, 'utf8');
  await writeFile(`${REPORT_DIR}/normalization-clean-excluded-payloads.json`, `${JSON.stringify({ mode: 'read-only excluded payload set', payloads: excluded }, null, 2)}\n`, 'utf8');
  await writeFile(`${REPORT_DIR}/normalization-clean-summary.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(`${REPORT_DIR}/normalization-authorized-write-plan.md`, authorizedWritePlan(), 'utf8');

  console.log(JSON.stringify({
    totalOriginalPayloads: summary.totalOriginalPayloads,
    validPayloads: summary.validPayloads,
    excludedPayloads: summary.excludedPayloads,
    exclusionsByReason: summary.exclusionsByReason,
    validPayloadsByCollection: summary.validPayloadsByCollection,
    alertsIncluded: false
  }, null, 2));
}

main().catch(error => {
  console.error(`CLEAN_PAYLOAD_REVIEW_ERROR ${error.message}`);
  process.exitCode = 1;
});
