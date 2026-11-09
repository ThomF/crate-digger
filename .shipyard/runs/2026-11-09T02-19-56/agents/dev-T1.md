# dev-T1 report (saved by the harbormaster from the agent's final message)

T1 is done and committed as f5f99b5. It touches only the two owned files. The dev did not write this file, citing a standing rule against report files, so the harbormaster saved its message.

- Fix: In apps/web/src/components/crate/CrateBox.vue, the :style object on div.sleeve now has `pointerEvents: offset < 0 ? 'none' : undefined`, with a comment saying why. Nothing else changed, so onSleeveClick, crateLayout.ts, useCrateFlip.ts and the front panel are untouched.
- Test: In apps/web/src/components/crate/CrateBox.test.ts the dev added 'keeps flipped sleeves drawn for the flip-out animation, without catching clicks'. At index 2 it checks the two flipped sleeves keep transform translateZ(40px) rotateX(-55deg) and opacity 0. It also checks they have pointerEvents none and that the current sleeve does not. The existing back-click test is unmodified.
- Checks: npm test --workspace apps/web, npm test, npm run typecheck, npm run lint and npm run format:check all exited 0.
- Not verified: The fix is not checked with real mouse or touch input. That is left to the browser tester.
