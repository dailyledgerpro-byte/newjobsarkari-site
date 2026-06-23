# Official Post — AI Extraction Canonical Schema (v1.0)

**Status:** design only. No AI API, no scraper, no auto-publish, no Firestore write is part of this phase.
**Schema:** [`schemas/official-post.schema.json`](../schemas/official-post.schema.json)
**Samples:** [`samples/official-post/*.sample.json`](../samples/official-post/) — *test data, never published, never in sitemap.*
**Validator:** `node scripts/validate-official-post-schema.mjs`

## Purpose
A single fixed JSON structure that a future AI extractor must emit for **every** official notification, so the existing universal renderer (`public/alert-detail.html`) can display it consistently. **Official-source-only — the extractor must never invent information.**

## Post types
`recruitment` · `result` · `admit_card` · `answer_key` · `scholarship` · `admission` · `notification` · `government_update`

## Core fields
`schemaVersion` (`"1.0"`), `postId`, `title`, `department`, `advertisementNo`, `postType`, `category`, `sourceId`, `sourceLabel`, `officialSourceUrl`, `officialPdfUrl`, `publishedDate`, `updatedDate`, `applicationMode`, `summary` (≤150 words).

## Structured blocks
| Block | Keys |
|---|---|
| `importantDates` | notificationDate, startDate, lastDate, feeLastDate, examDate, admitCardDate, answerKeyDate, resultDate, correctionDate, otherDates[] |
| `applicationFee` | general, obc, ews, sc, st, pwd, female, other, paymentMode, feeNote |
| `ageLimit` | minimumAge, maximumAge, cutoffDate, relaxation, ageNote |
| `vacancyDetails[]` | postName, totalPosts, department, payLevel, categoryWisePosts, vacancyNote |
| `eligibility` | educationQualification, experienceRequired, typingRequirement, skillRequirement, physicalStandard, eligibilityNote |
| `selectionProcess[]` | official-mentioned steps only (Written Exam, Skill Test, DV, Medical, Interview, Other) |
| `requiredDocuments[]` | only if officially listed — else empty (renderer shows the official fallback line) |
| `howToApply` | mode, officialProcedureText, steps[] — empty → renderer shows official fallback line |
| `importantLinks` | officialNotificationPdf, officialWebsite, applyOnline, login, correctionForm, admitCard, answerKey, result, syllabus, otherOfficialLinks[] |
| `faqs[]` | max 5, only if source supports — never invented |

## Verification block
`aiConfidence` (0–100), `confidenceBreakdown`, `verificationStatus` (`pending_review`/`reviewed`/`approved`/`rejected`/`auto_low_confidence`), `manualReviewRequired`, `extractionWarnings[]`, `sourceEvidence` *(internal — never rendered publicly)*, `lastVerifiedAt`, `reviewedBy`, `reviewedAt`.

### Rules (enforced by extractor + validator)
- **`aiConfidence < 90` ⇒ `manualReviewRequired = true`.**
- Conflicting/missing **critical fields** (dates, total posts, fee, age limit, eligibility, official links) ⇒ `manualReviewRequired = true`.
- **Auto-publish is NOT permitted.** All AI posts go to the admin Review Inbox (`status:"review"`); a human publishes.
- Missing data ⇒ `null` / empty array (the renderer shows the official "देखें / उपलब्ध है" fallback lines). **Never fabricate.**
- `sourceEvidence` and any internal notes are **never** exposed on the public detail page.

## Extraction → publish flow (planned)
1. AI extractor reads the official PDF/notice → emits this JSON.
2. Validator (`validate-official-post-schema.mjs`) checks structure + rules.
3. Doc is stored as `alerts` with `status:"review"` (admin-only).
4. Admin verifies in the Review Inbox and publishes — then it appears publicly via `alert-detail.html?id=&src=alerts`.

## Renderer compatibility
`public/alert-detail.html` reads all of the above (canonical keys + legacy flat keys via `firstNonEmpty` fallbacks). Backward compatible: posts that only have `title/description/pdf/url/date/source` still render with graceful fallback sections.
