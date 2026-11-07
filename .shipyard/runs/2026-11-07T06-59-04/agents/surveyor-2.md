# Surveyor 2 notes: conventions and documentation
Target /home/claude/crate-digger (product now Frisson, scope @frisson/*). See survey-conventions-docs.json.
- Style enforced by Prettier (no semi, single quotes, 100, trailing commas) and ESLint flat config.
- API pattern: routes thin, services plain functions throwing HttpError, errorHandlerPlugin yields { statusCode, error, message, issues? }.
- Auth is one shared ADMIN_PASSWORD with signed cookie; docs match code; no future-accounts docs exist.
- Remaining crate-digger strings in DEPLOY.md (clone URL, crate.db, crate-data volume, crate-backup).
- SPEC section 8 headed "(later)" is out of date vs README Status.
