# js/shared/ — VENDORED — DO NOT HAND-EDIT

Every file in this directory is **copied verbatim** from
`Hevolve_React_Native/` (the Android sibling). Edits to files here
get clobbered the next time someone runs `yarn sync`.

## To update from Android source

```bash
yarn sync                  # apply latest from Android repo
yarn sync:dry              # preview what would change
yarn sync:check            # CI: exit non-zero on drift
```

## To add a new file to the shared set

1. Add the relative path to `docs/SHARED_JS_MANIFEST.json` (in the
   correct `groups[].files` array).
2. Run `yarn sync`.
3. Commit the manifest change + the new vendored file in one commit.

## To make iOS-specific JS

Don't edit files in this directory. Instead, **copy the file out** to
`js/ios/` (or another iOS-only location) and edit it there. Update
imports in any consuming file to point at the iOS-specific copy.

## Why this layout

The Android repo has ~1800 jest tests and battle-tested business
logic in stores + services. Re-implementing them on iOS would
duplicate work and create drift. By vendoring, both apps stay
behaviorally equivalent for shared logic, while each owns its
platform-specific native modules.

A future migration extracts this directory into a published npm
package (`@hevolve/core`) so the manifest goes away and `yarn add`
takes over. Until then, vendoring + a sync script is the
minimum-infrastructure path.

See `docs/SHARED_JS_MANIFEST.json` for the source-of-truth file list.
