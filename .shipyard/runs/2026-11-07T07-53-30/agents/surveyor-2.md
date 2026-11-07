# Surveyor 2 notes: conventions and documentation
Target /home/claude/crate-digger (Frisson). Details in survey-conventions-docs.json.
- API: routes thin, services own logic and call services/permissions.ts, errors via HttpError into {statusCode,error,message,issues?}.
- Shared zod contract in packages/shared/src/index.ts; publicUser includes email, crate carries public owner username/displayName only.
- Web: Pinia setup stores, api/client.ts request(), canEditCrate UI mirror, scoped styles on base.css tokens (cardboard/paper/ink, Courier display).
- Docs: nothing on profiles or social anywhere. SPEC data model/API predate accounts. Next ADR is 0005. README API table and Layout need updates for new routes.
