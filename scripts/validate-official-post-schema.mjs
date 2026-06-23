/* ============================================================================
   Official Post schema validator — pure Node (no external dependency).
   Validates samples/official-post/*.sample.json against the canonical schema +
   the business rules (summary words, FAQ count, confidence range, manual-review
   rule, URL-like links). READ-ONLY. No AI, no network, no Firestore.
   Run:  node scripts/validate-official-post-schema.mjs
   ============================================================================ */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'schemas/official-post.schema.json'), 'utf8'));
const SAMPLE_DIR = join(ROOT, 'samples/official-post');
const POST_TYPES = SCHEMA.properties.postType.enum;
const REQUIRED = SCHEMA.required;
const VERIF_ENUM = SCHEMA.properties.verificationStatus.enum;

function isUrlLike(v) { return typeof v === 'string' && /^https?:\/\/[^\s]+$/i.test(v); }
function words(s) { return String(s || '').trim() ? String(s).trim().split(/\s+/).length : 0; }

function validate(name, d) {
  const errs = [], warns = [];

  // 3. required fields
  for (const k of REQUIRED) if (d[k] === undefined || d[k] === null || d[k] === '') errs.push(`missing required field: ${k}`);
  // schemaVersion
  if (d.schemaVersion !== '1.0') errs.push(`schemaVersion must be "1.0" (got ${JSON.stringify(d.schemaVersion)})`);
  // 4. postType enum
  if (d.postType && !POST_TYPES.includes(d.postType)) errs.push(`postType "${d.postType}" not in enum`);
  // verificationStatus enum (if present)
  if (d.verificationStatus && !VERIF_ENUM.includes(d.verificationStatus)) errs.push(`verificationStatus "${d.verificationStatus}" not in enum`);
  // 5. summary <= 150 words
  if (d.summary != null && words(d.summary) > 150) errs.push(`summary too long: ${words(d.summary)} words (max 150)`);
  // 6. FAQ count <= 5
  if (Array.isArray(d.faqs) && d.faqs.length > 5) errs.push(`faqs > 5 (got ${d.faqs.length})`);
  if (Array.isArray(d.faqs)) d.faqs.forEach((f, i) => { if (!f || !f.question || !f.answer) errs.push(`faqs[${i}] missing question/answer`); });
  // 7. aiConfidence 0..100
  if (d.aiConfidence != null) {
    if (typeof d.aiConfidence !== 'number' || d.aiConfidence < 0 || d.aiConfidence > 100) errs.push(`aiConfidence out of range 0..100 (got ${d.aiConfidence})`);
    // 8. manualReviewRequired must be true if aiConfidence < 90
    else if (d.aiConfidence < 90 && d.manualReviewRequired !== true) errs.push(`aiConfidence ${d.aiConfidence} < 90 but manualReviewRequired is not true`);
  }
  // 9. importantLinks URL-like if present
  if (d.importantLinks && typeof d.importantLinks === 'object') {
    for (const [k, v] of Object.entries(d.importantLinks)) {
      if (k === 'otherOfficialLinks') { (v || []).forEach((o, i) => { if (o && o.url && !isUrlLike(o.url)) errs.push(`importantLinks.otherOfficialLinks[${i}].url not URL-like`); }); continue; }
      if (v != null && v !== '' && !isUrlLike(v)) errs.push(`importantLinks.${k} not URL-like: ${v}`);
    }
  }
  // top-level official URLs
  for (const k of ['officialSourceUrl', 'officialPdfUrl']) if (d[k] != null && d[k] !== '' && !isUrlLike(d[k])) errs.push(`${k} not URL-like`);

  // soft warnings (no public exposure of internal fields is enforced by renderer, not here)
  if (Array.isArray(d.requiredDocuments) && d.requiredDocuments.length === 0) warns.push('requiredDocuments empty -> renderer shows official fallback message');
  if (d.howToApply == null || (d.howToApply && !d.howToApply.officialProcedureText && !(d.howToApply.steps || []).length)) warns.push('howToApply empty -> renderer shows official fallback message');

  return { errs, warns };
}

const files = readdirSync(SAMPLE_DIR).filter(f => f.endsWith('.sample.json'));
let pass = 0, fail = 0;
console.log('================ Official Post Schema Validation ================');
console.log('schema:', 'schemas/official-post.schema.json', '| postTypes:', POST_TYPES.join(', '));
console.log('samples:', files.length, '\n');
for (const f of files) {
  let d;
  try { d = JSON.parse(readFileSync(join(SAMPLE_DIR, f), 'utf8')); }
  catch (e) { console.log(`  FAIL  ${f}  -> invalid JSON: ${e.message}`); fail++; continue; }
  const { errs, warns } = validate(f, d);
  if (errs.length) { console.log(`  FAIL  ${f}  [postType=${d.postType}]`); errs.forEach(e => console.log(`         - ${e}`)); fail++; }
  else { console.log(`  PASS  ${f}  [postType=${d.postType}, aiConfidence=${d.aiConfidence}, manualReview=${d.manualReviewRequired}]`); pass++; }
  warns.forEach(w => console.log(`         ~ note: ${w}`));
}
console.log(`\nRESULT: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
