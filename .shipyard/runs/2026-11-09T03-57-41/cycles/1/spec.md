# Hide crate actions on other people's crates

## What this is for

The single-crate page, `/crates/:id`, shows every signed-in viewer the same two toolbar actions: **+ Add a record** and **Edit crates**, the route to the New crate form. On a crate that belongs to someone else, these actions suggest the viewer can change something they can't. The API already rejects unauthorised writes, so this is about how the page looks, not about security. Browsing someone else's crate should look read-only, and the viewer's own crates should keep both actions.

## The rule

On `/crates/:id`, the actions render only when all of these hold:

- The viewer is signed in.
- The crate has loaded and the library store is `ready`.
- Either `crate.ownerId === user.id`, or `crate.ownerId` is null and the viewer is an admin.

In every other case they are not rendered at all: signed out, loading, error, crate not found, another user's crate. Nothing is disabled or hidden with CSS, and no replacement content is added.

The empty-crate **Add a record** link on `/crates/:id` follows the same rule, so an admin no longer sees it on another user's empty crate.

## Why this isn't `canEditCrate`

`canEditCrate` answers whether a viewer may change a crate, and admins may change any crate. It still decides spin counting, album editing and the `/list` tools, and it must stay as it is. Reusing it for the toolbar would pass for ordinary users and change nothing for an admin, and the owner may well sign in as the admin.

So `apps/web/src/utils/permissions.ts` gains a separate, narrower helper, `showsCrateActions(user, crate)`. An admin on another user's crate therefore loses the shortcuts but keeps the abilities: pulling out a record still counts a spin, and the album page still offers Edit.

## Where the change sits

CrateView serves both `/shelf` and `/crates/:id`, and LibraryToolbar is also used by `/list`, so the scoping matters.

- **`LibraryToolbar.vue`** gains an optional `hideActions` boolean prop. It stays unaware of crates and ownership. Because the prop defaults to false, `/list` needs no edit.
- **`CrateView.vue`** decides whether to hide the actions, and only when `crateId` is set, which is what distinguishes `/crates/:id` from `/shelf`.

The Crates/List nav sits outside the gated block and is unaffected.

## Two traps

**Default to hidden.** The toolbar renders above the loading state, before the crate exists. A condition like "hide if known to be someone else's" would flash the actions while another user's crate loads, so the condition has to confirm ownership before showing anything.

**Crate presence doesn't mean loaded.** The library store keeps its `crates` array during a forced reload and after a failed one. If a viewer goes to an unknown crate id, the reload fails, and they then navigate to their own crate, the crate resolves while the page body shows the error. That is why the toolbar condition checks `library.status === 'ready'` as well as ownership, and it gets its own regression test beyond the plain error case in AC6.

Reused-component navigation (`/crates/1` to `/crates/2`) needs no special handling, because `props.crateId` and the `crate` computed are reactive. AC7 tests this directly.

## What stays the same

- `/shelf` and `/list` toolbars, including `/shelf` when another user's crate is selected
- The per-crate add links and tools on `/list`
- The `/albums/:id` Edit button, `/albums/new` and `/crates`
- Spin counting
- The browsing controls, owner link and nav on `/crates/:id`

No API, schema or shared-type changes are needed. `README.md` and `docs/SPEC.md` describe who may edit, which is unchanged, so no docs need updating.

## One interpretation to check

The brief says the empty-crate link follows the same rule, but defines that rule for `/crates/:id` and says the change covers only that page. I read that as: on `/shelf`, the empty-crate link keeps its `canEditCrate` behaviour, so an admin still sees it on another user's empty crate there. A test pins this. If the owner wants the link gone on `/shelf` too, it is a one-line change.

## Testing

A new `apps/web/src/views/crateActions.test.ts` covers AC1 to AC9 with its own fixtures. Keeping them separate matters because the counts in `editControls.test.ts` depend on its shared fixture. `permissions.test.ts` gains a table of cases for the helper.

The one existing test that encodes the old behaviour, in `editControls.test.ts`, changes its Add link assertion and keeps its spin and navigation assertions. AC10 is the repo's typecheck, lint, format and test commands.

AC11 and AC12 run in a real browser on a temp DB with two ordinary users. The browser tester writes that check under `.shipyard/checks/`, in a separate file so `browser.mjs` doesn't rewrite its tracked PNGs. The owner's real DB is not touched.

## Open questions for the owner

The brief makes these assumptions and asks for confirmation. The plan follows them as written:

1. "Add to crate" means **+ Add a record**, and "new crate stuff" means the **Edit crates** link. No control on `/crates/:id` is literally labelled New crate.
2. The change covers `/crates/:id` only. `/shelf` keeps its toolbar so a new user whose selected crate is someone else's still has a way to make a crate.
3. Admins also lose these actions on other users' crates. They can still add via `/shelf` or `/list`, and can still edit records from the album page.

## Known cost

A new user who only ever reaches other users' crates through `/crates/:id` loses the shortcut on that page. The Crates and List nav still takes them to `/shelf` or `/list`, where it remains.
