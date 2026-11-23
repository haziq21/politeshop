# @politeshop/lib

## 4.0.0

### Major Changes

- 81ced6c: `POLITELib`, `POLITE` and `Brightspace` no longer have `abort()`. Pass an `AbortSignal` as `signal` in their config instead; `POLITELib` shares it with both of its clients, including a Brightspace client created after a token refresh.

### Minor Changes

- b6db4c8: Accept an optional `fetch` in the `POLITELib`, `POLITE` and `Brightspace` configs.

### Patch Changes

- 903ecf5: Find a document's file entity whatever other state classes it has (e.g. `processing`). Previously `getModuleActivities` threw for any module containing a document still being converted.
- 81ced6c: A failed request to POLITE or Brightspace now always throws an `HTTPError` with the status and URL, instead of a mix of errors, one of which carried the whole `Response` and flooded logs.
- 14fc419: Accept quizzes with no start or end date, which previously made `getQuizzes` throw for any module containing one.
- 81ced6c: Session cookies and tokens are only sent to requests on the origin of the API they belong to, so a URL taken from a response can't carry them to another host. A Brightspace token whose tenant or user claim could change where requests go is rejected.
- 5e86ddf: `getSubmissions` falls back to Brightspace only when POLITE refuses a closed dropbox with a 403. Other failures, such as a network error or a 500, are thrown as they are instead of triggering a confusing second request.

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
