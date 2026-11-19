# @politeshop/lib

## 3.0.0

### Major Changes

- 24d69dd: Model folders as an activity type. `ActivityFolder` is replaced by `FolderActivity` (`type: "folder"`, with `description`), which is now part of `AnyActivity`. Every activity has a `parentId` naming its folder (`null` for top-level folders). `getModuleContent` is renamed `getModuleActivities` and returns a flat `AnyActivity[]`, each folder before its children, instead of a tree.

## 2.0.0

### Major Changes

- 311c0b3: Return `Temporal.Instant` instead of `Date` for every timestamp, and drop the `date-fns` dependency. Consumers need a runtime with native `Temporal` (Node 26+, Chrome 144+, Firefox 139+) and `"ESNext.Temporal"` in their TypeScript `lib`.

### Minor Changes

- 0834261: Return `name` for submission, quiz and unknown activities

## 1.0.1

### Patch Changes

- d3e82bd: Return absolute sourceURLs for doc_embed activities

## 1.0.0

### Major Changes

- f19ec59: Rename POLITEShop (politeshop) to POLITELib (@politeshop/lib)
