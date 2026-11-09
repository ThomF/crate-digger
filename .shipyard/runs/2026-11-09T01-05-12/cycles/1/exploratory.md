# Exploratory pass, cycle 1

Built HEAD (2e015fc) and 24dcabd into temp dirs and ran each on a temp DB with demo content: HEAD on 127.0.0.1:4331, 24dcabd on 4332. The API code is the same at both commits. Ports 3000 and 5173 and the owner's data were not touched. Added a test user and an empty crate (id 10) through the API. Driven by headless Playwright scripts piped to node, plus one real click in the Claude browser pane (Chrome 152). Servers stopped, temp files removed. Only Chromium was tested; no Firefox or Safari is installed for Playwright.

## The change itself: works

- Home card to /crates/:id: one h1, no tabs, at 1280, 390 and 320, signed out and signed in.
- Profile card to /crates/:id works.
- Wheel, drag, arrows, Enter, the Pull it out button and the title link all work.
- Back from an album restores the position (3 / 4, same record).
- Toolbar Crates goes to /shelf with the same crate pressed.
- /shelf tab clicks stay on /shelf and add no history entry: Back from /shelf goes to the previous /crates/3.
- Reload holds on every route. /shelf reload returns to the first crate (accepted in the spec).
- /crates/9999, /0 and a 20-digit id show "Crate not found" with a Browse link. /abc, /1e3, /1.5 and /-1 show the not-found page.
- No horizontal overflow at any width.
- Empty crate: h1 shown, keys do nothing, owner sees Add a record.
- No page errors. The only console error is the 401 from /api/auth/me when signed out.

## Sleeve click: reproduces, and is not caused by this change

Clicking the record does nothing for a user.

| 1280px, /crates/2, at rest | HEAD | 24dcabd |
|---|---|---|
| y-range at centre x that opens the album | 466-470 (5px) | 604-609 (6px) |
| Sleeve box top / crate panel top (visible art) | 466.5 / 667.7 | 605.3 / 806.5 |
| Element hit below the strip | .crate | .crate |
| Grid sample of visible art that hits the sleeve | 4% | 4% |
| Real click at top+8, 25%, 50%, 75% of art | stays on /crates/1 | stays on /crates/1 |
| Real click in the middle of the strip | /albums/5 | /albums/5 |

- At 390px: HEAD strip 443-446 (4px), 2% of the art. A touch tap on mid-art does nothing on either commit. A tap at top+6 also misses.
- Real click in the browser pane at (400, 230), mid-art: elementFromPoint returned `crate` and the URL stayed /crates/2.
- At rest the strip is about 5px, not 16px. The first tester's 16px (box 430-694, height 264, against 277 at rest) was measured right after ArrowUp, during the 0.45s transition.
- browser.mjs part (b) clicks that strip, so its "front sleeve click opens" pass does not show that a user can click the record. It is also timing-sensitive.

**24dcabd.** The CrateBox.vue diff adds only `max-width` and `overflow-wrap` to `.crate-label`, which cannot change hit testing, and the run above measures the same failure at 24dcabd. So it predates this change. `transform-style: preserve-3d` goes back to at least 4ab0f2f (2026-10-12); I did not test commits older than 24dcabd, so when it began is unknown.

**Likely cause.** The front sleeve is rotated `rotateX(8deg)` around its bottom edge, so everything above that edge sits behind z=0, where `.crate` is a transparent flat plane that takes the hit. Injecting `.crate{pointer-events:none}.crate>*{pointer-events:auto}` into the live test page gave hit range 466-666 (the whole art) and a mid-art click opened /albums/5, at both commits. Nothing in the source was changed.

The hint under the crate still says "Enter or click to pull out". The cursor is `grab` over the art, with no pointer. The Pull it out button, Enter and the title link are the working routes.

## Findings

**High: record art does not respond to click or tap** (above). Pre-existing, but it is the main action on this page, and the page's own hint promises it.

**Medium: invisible flipped sleeve catches clicks on the crate front.** After flipping once, the previous sleeve (`opacity: 0`, z-index 101, tipped forward) sits over the lower crate panel. Clicking the crate's tape label moves back a record: 2 / 4 to 1 / 4 at both commits, at 1280 and 390. From 697px down the hit element is the opacity-0 sleeve. `onSleeveClick` treats it as a click on a record further back. Pre-existing.

**Medium: on a phone the crate traps scrolling, and the controls are below the fold.** At 390x740, /crates/1 has the scene at 345-720 and Pull it out at 848. `.scene` is full width with `touch-action: none`, so a swipe on it, or in its side margin (x=10), never scrolls (scrollY stayed 0 or unchanged). Only a swipe starting above the scene scrolled (scrollY 281). Combined with the dead tap, a phone user sees no working way to open a record without finding that. A 150px swipe down also jumped from 1 / 4 to 4 / 4, which feels fast. Pre-existing CSS, and this change improves it: at 24dcabd the 10 tabs pushed the sleeve to y=865.

**Low: empty crate looks broken.** "Empty crate" is `rgb(107,90,72)` on the dark back panel and is effectively unreadable. The back and front panels float apart with a gap between them. Below, the page still shows "Scroll, drag down, or use the arrow keys to flip. Enter or click to pull out", with nothing to flip. On /crates/10 the name also appears twice, h1 and tape. Pre-existing except the h1.

**Low: crate name is lost when a label exists.** A Home card shows "PSYCH / DOLLAR BIN | Thrift Bin Psych". The crate page shows the label twice (h1 and tape) and never "Thrift Bin Psych". This matches the spec's `label ?? name`. browser.mjs nulled the label on its long crate, so only the normal crates exercised this.

**Low: picker returns from the album page.** "← Back to the crates" goes to /shelf with tabs from a /crates/2 visit. Known follow-up in the spec. Crate-page title stays generic, also per spec.

**Low: not-found and shelf pages have no h1.** /crates/9999 has no h1 and keeps the title "Crates · Frisson". /shelf and /list have no h1 (/list title is just "Frisson"). /shelf is per spec.

**Low: /shelf at phone width.** With 10 crates the tabs fill 274-737 of a 740px viewport, so the crate starts at 767, off screen. Known in the spec.

**Low: focus after Back.** After Back from an album, focus is on BODY, not the crate, so arrow keys need a click or Tab first. I did not check whether arrows work without it.

## Not tested

Firefox and Safari; the edit crate flow; following someone with crates (Following card); error state with Try again; login through the UI (signed-in runs used a session cookie from the API).
