# Shipyard project report

## 2026-11-07T06-38-49: rename Crate Digger to Frisson
- Verdict: shipped (12/12 criteria), 1 cycle, 1 fix round (contract wording on AC12)
- Wall clock: 17m 50s; slowest stage: build (7m 19s)
- Deaths: intake-1 (API safeguard false positive, respawned on sonnet)
- Fast paths: direct-fix, scoped-retest
- Sandbox note: npm install needs npm_config_nodedir=/opt/node22
- Merged and pushed to main at the owner's request

## 2026-11-07T06-59-04: Frisson 1.0 Phase 1, user accounts and auth
- Verdict: shipped (18/18 criteria, e2e smoke on base-commit DB), 1 cycle, 0 fix rounds, 7 tasks
- Wall clock: 45m 5s; slowest stage: build (29m)
- Deaths: none. One blocker (T1 needed two web fixtures), resolved by reassigning files
- Known limits: owner_id FK has no ON DELETE SET NULL; reorder effectively admin-only; spins need edit permission
- Merged and pushed to main at the owner's request

## 2026-11-07T07-53-30: Frisson 1.0 Phase 2, profiles, avatars, social links, verified badge
- Verdict: shipped (22/22 criteria, e2e smoke on base-commit DB), 1 cycle, 0 fix rounds, 7 tasks in 3 waves
- Wall clock: 28m 7s; slowest stage: build (14m)
- Deaths: none. Blockers: none
- Known limits: 6-link cap app-enforced; no avatar cleanup on user delete; owner_id FK still lacks ON DELETE SET NULL
- Merged and pushed to main at the owner's request

## 2026-11-07T08-36-17: header account menu
- Verdict: shipped (14/14 criteria, real-Chrome checks at 1280/390/320), 1 cycle, 0 fix rounds, 2 tasks
- Wall clock: 13m 35s; slowest stage: build (6m)
- Deaths: none. Blockers: none
- Merged and pushed to main at the owner's request
