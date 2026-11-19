---
"@politeshop/lib": major
---

Model folders as an activity type. `ActivityFolder` is replaced by `FolderActivity` (`type: "folder"`, with `description`), which is now part of `AnyActivity`. Every activity has a `parentId` naming its folder (`null` for top-level folders). `getModuleContent` is renamed `getModuleActivities` and returns a flat `AnyActivity[]`, each folder before its children, instead of a tree.
