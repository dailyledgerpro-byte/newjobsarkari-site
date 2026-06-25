# Authorized normalization write plan

This phase performs no Firestore write. The public Firestore client returned 403 during the previous attempt and must not be retried for migration writes.

## Recommended method

Use a local Firebase Admin SDK runner with already configured secure credentials. It keeps the migration operator-controlled, avoids adding a public endpoint, and can be run once with explicit approval. Do not print, paste, create, or request credentials in chat.

## Alternative method

A temporary callable Cloud Function restricted to super-admins can be used only if a local authenticated runner is unavailable. It must be disabled or removed after the approved migration.

## Required controls

- Regenerate and validate the clean payload report immediately before the run.
- Use only approved collections; never include `alerts`.
- Create a document backup before each batch.
- Use merge-style dotted field paths only.
- Never replace a whole document or a whole nested map.
- Abort before the first write if a field is not allowlisted, malformed, inferred, or already structured.
- Use a small batch first and stop on the first error.
- Read back every successful document and verify only planned fields changed.
- Do not alter public files, deploy, or change security rules as part of the migration.
