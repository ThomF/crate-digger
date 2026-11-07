# Shipyard project report

## 2026-11-07T06-38-49: rename Crate Digger to Frisson
- Verdict: shipped (12/12 criteria), 1 cycle, 1 fix round (contract wording on AC12)
- Wall clock: 17m 50s; slowest stage: build (7m 19s)
- Deaths: intake-1 (API safeguard false positive, respawned on sonnet)
- Fast paths: direct-fix, scoped-retest
- Sandbox note: npm install needs npm_config_nodedir=/opt/node22
- Merged and pushed to main at the owner's request
