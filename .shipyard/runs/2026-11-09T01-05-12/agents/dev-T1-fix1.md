# dev-T1-fix1
Changed apps/web/src/components/crate/CrateBox.vue CSS: `.crate { pointer-events: none }` plus `.crate > * { pointer-events: auto }`, with comment. Handlers are on .scene (ancestor), unaffected.
Results: npm test 326 pass; typecheck, lint, format:check clean. No test added (no hit testing in happy-dom). Not verified in a real browser.
Unsure: the front panel child gets pointer-events auto and may still cover the lower sleeve; tester should check the click across the art.
