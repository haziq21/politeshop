# Brightspace Internal API

- [Response format: Siren](#response-format-siren)
- [Terminology](#terminology)
- [Enrollments](#enrollments)
- [Organizations (org units)](#organizations-org-units)
- [Sequences (module content)](#sequences-module-content)
- [Content media (content-service)](#content-media-content-service)
- [Announcements](#announcements)
- [Folio (people)](#folio-people)
- [Users](#users)
- [LTI links](#lti-links)
- [Navigation summary](#navigation-summary)
- [Reference](#reference)

POLITEMall is built on D2L Brightspace. The web client communicates with Brightspace's internal API at `*.api.brightspace.com`. This API is not publicly documented; it is Brightspace's internal service mesh shared across all tenants. This document describes the response format, object types, navigation model, and POLITEMall-specific details for the Ngee Ann Polytechnic tenant.

---

## Response format: Siren

Every response is a [Siren](https://github.com/kevinswiber/siren) entity. Siren is a hypermedia format: each response describes its own type, its relationships to other resources, and the operations available on it.

```json
{
  "class":   ["type-1", "type-2"],
  "properties": { "name": "..." },
  "entities": [ ... ],
  "links": [
    { "rel": ["relationship-name"], "href": "https://..." }
  ],
  "actions": [
    { "name": "action-name", "method": "PUT", "href": "...", "fields": [...] }
  ]
}
```

| Field | Description |
|---|---|
| `class` | Entity type. Always an array; may contain multiple values. The last class is typically the most specific. |
| `properties` | Flat key-value data specific to this entity type. |
| `entities` | Nested sub-entities. Can recurse multiple levels deep (particularly in sequences). |
| `links` | URLs to related resources. Primary navigation mechanism: follow links to discover other objects. |
| `actions` | Available operations. Each specifies an HTTP method, target URL, and form fields. |

There is no fixed, hardcodeable URL structure beyond a few entry points. Navigation proceeds by following `links` and resolving `entities[].href` values. The `class` array is the primary discriminator between entity types.

---

## Terminology

Brightspace uses its own naming conventions. POLITEMall maps them to Singapore polytechnic terms:

| Brightspace class | Polytechnic term | Example |
|---|---|---|
| `course-offering` | Module (subject) | "PROGRAMMING I" |
| `programme` | Diploma course | "Information Technology" |
| `semester` | Academic term | "24S1", "24S2" |
| `organization` | Institute / polytechnic | "Ngee Ann Polytechnic" (org id 6665) |
| `sequence` | Module content / materials | Tree of units, weeks, and topics |
| `sequenced-activity` | A content item within a module | PDF, assignment dropbox, quiz, video |

Note: collections of org units also use `"organization"` as a class (e.g. `["paged", "organization", "collection"]`). The items within the collection carry the specific classes listed above.

The rest of this document uses Brightspace terms since those are the class values returned by the API.

---

## Enrollments

**Service:** `enrollments.api.brightspace.com`

The entry point for a user. Returns all modules the user is enrolled in.

### List enrollments

```
GET /users/{userId}?pageSize=100
```

Response:

```json
{
  "class": ["enrollments", "collection"],
  "entities": [
    {
      "class": ["enrollment", "unpinned"],
      "rel": ["https://api.brightspace.com/rels/user-enrollment"],
      "href": "https://{tenantId}.enrollments.api.brightspace.com/enrolled-user/{enrolledUserId}/enrollment"
    }
  ],
  "links": [
    { "rel": ["self"], "href": "..." },
    { "rel": ["next"], "href": "..." }
  ],
  "actions": [
    { "name": "search-my-enrollments", "method": "GET" },
    { "name": "pin-course", "method": "PUT" }
  ]
}
```

Entities in a collection response are **references**: only `class`, `rel`, and `href` are present. Properties are not inlined unless `embedDepth` is set (see [Reference](#reference)).

### Enrollment detail

```
GET /enrolled-user/{enrolledUserId}/enrollment?localeId=3
```

Connects a user to a module:

```json
{
  "class": ["enrollment", "unpinned"],
  "links": [
    { "rel": ["self"], "href": "..." },
    { "rel": ["https://api.brightspace.com/rels/organization"],
      "href": "https://{tenantId}.organizations.api.brightspace.com/468253" },
    { "rel": ["https://api.brightspace.com/rels/user"], "href": "..." },
    { "rel": ["https://folio.api.brightspace.com/rels/folio"], "href": "..." }
  ],
  "actions": [
    { "name": "pin-course", "method": "PUT",
      "fields": [{ "name": "pinned", "type": "hidden", "value": true }] }
  ]
}
```

The `rels/organization` link leads to the module's org unit.

### Other enrollment endpoints

| Endpoint | Returns |
|---|---|
| `GET /users/{userId}/semesters` | Active semesters |
| `GET /users/{userId}/departments` | Diploma programmes |
| `GET /users/{userId}?search=&orgUnitTypeId=3&parentOrganizations={progId}` | Filtered module search |

Filter parameters: `search`, `parentOrganizations`, `sort`, `excludeEnded`, `excludeIndirect`, `promotePins`, `roles`.

---

## Organizations (org units)

**Service:** `organizations.api.brightspace.com`

Org units form the institutional hierarchy. Following `rels/organization` from an enrollment yields a `course-offering`.

### Module entity (course-offering)

```
GET /{orgId}
```

```json
{
  "class": [
    "named-entity", "describable-entity", "draft-published-entity",
    "published", "active", "course-offering"
  ],
  "properties": {
    "name": "PROGRAMMING I(2_PRG1_011845)",
    "code": "24S1-2_PRG1_011845",
    "startDate": null, "endDate": null,
    "isActive": true, "description": ""
  },
  "entities": [
    { "class": ["richtext", "description"], "properties": { "text": "", "html": null } },
    { "class": ["color"],                   "properties": { "hexString": "#6038ff" } },
    { "class": ["course-image"],            "href": ".../{orgId}/image" },
    { "class": ["relative-uri"],            "properties": { "path": "/d2l/home/468800" } }
  ],
  "links": [
    { "rel": ["...rels/sequence"],                        "href": "..." },
    { "rel": ["...rels/parent-semester"],                  "href": "..." },
    { "rel": ["...rels/ancestors"],                        "href": "..." },
    { "rel": ["...rels/organization-announcements"],       "href": "..." },
    { "rel": ["...folio.../rels/folio"],                   "href": "..." },
    { "rel": ["...rels/organization-activities"],          "href": "..." },
    { "rel": ["...rels/assignments"],                      "href": "..." },
    { "rel": ["...rels/files"],                            "href": "..." },
    { "rel": ["...rels/user-course-grades"],               "href": "..." }
  ]
}
```

### Class hierarchy

The first five classes (`named-entity`, `describable-entity`, `draft-published-entity`, `published`, `active`) are present on every org unit. The final class distinguishes the type:

| Final class | Meaning | Where found |
|---|---|---|
| `course-offering` | Module | Linked from an enrollment |
| `programme` | Diploma course | Departments list |
| `semester` | Academic term | Semesters list |
| `organization` | Institute | Org id 6665 (Ngee Ann Polytechnic) |

### Org tree

Org units form a hierarchy. The `ancestors` link traverses upward from any org unit to its parent chain:

```
organization (6665: "Ngee Ann Polytechnic")
├── semester (332340: "24S1")
├── semester (479297: "24S2")
├── programme (35378: "Information Technology")
│   ├── course-offering (468800: "PROGRAMMING I")
│   └── course-offering (468314: "DESIGN PRINCIPLES")
└── programme (35294: "Immersive Media")
    └── course-offering (...)
```

There is no endpoint for downward traversal (listing children of an org unit). To discover modules under a programme, use the enrollment search with the `parentOrganizations` parameter.

### Module image

`GET /{orgId}/image`

Returns a `course-image` entity with resolution-specific alternate links (`banner`, `tile`, `wide`, `narrow`) via `rels/alternate`.

---

## Sequences (module content)

**Service:** `sequences.api.brightspace.com`

The `rels/sequence` link from a module returns its content structure: a recursive tree of sequences and activities.

```
GET /{moduleId}?deepEmbedEntities=1&embedDepth=1&filterOnDatesAndDepth=0
```

The tree structure:

```
Module (sequence-description)
└── Unit (sequence-description)
    └── Week (sequence-description)
        ├── sequenced-activity (file)
        ├── sequenced-activity (assignment)
        └── sequenced-activity (quiz)
```

Each internal node has this shape:

```json
{
  "class": ["release-condition-fix", "sequence", "sequence-description"],
  "properties": {
    "title": "Learning Materials",
    "description": "<p>...</p>",
    "canDownload": true,
    "canPrint": true
  },
  "entities": [ /* children */ ]
}
```

The `release-condition-fix` class on every node is a Brightspace internal marker for content release rules. It can be ignored for navigation purposes. The meaningful distinction is `sequence` (a container) vs `sequenced-activity` (a leaf content item).

### Activity detail

```
GET /{moduleId}/activity/{activityId}?filterOnDatesAndDepth=0
```

```json
{
  "class": ["release-condition-fix", "sequenced-activity"],
  "rel": ["item"],
  "properties": {
    "title": "Week 3 slides.pdf",
    "courseName": "z_[Archived] DESIGN PRINCIPLES(2_DP_009588)",
    "canDownload": true,
    "canPrint": true,
    "dueDate": { "Year": 2025, "Month": 2, "Day": 9 },
    "overdue": true
  },
  "entities": [
    { "class": ["icon", "tier1"], "rel": ["icon"],
      "properties": { "iconSetKey": "tier1:file-document" } }
  ]
}
```

The `dueDate` and `overdue` properties are only present on assessed activities.

### Activity types

Sub-entities within an activity indicate its content type:

| Sub-entity class | Content type | Key properties |
|---|---|---|
| `file-activity` | Document / PDF | Contains a nested `file` entity with name and size |
| `assignment-activity` | Dropbox / assignment | `dueDate`, `overdue` |
| `quiz-activity` | Quiz / test | `started`, `display-in-calendar` |
| `discussion-activity` | Forum topic | None |
| `content-activity` | Generic (SCORM, HTML page) | None |

Assessed activities (assignments, quizzes) carry `dueDate` and `overdue`. Informational activities (PDFs, videos, HTML pages) do not.

For PDFs, the `file-activity` sub-entity contains a `file` entity with download links.

---

## Content media (content-service)

**Service:** `content-service.api.brightspace.com`

For video or audio topics within a module:

```
GET /topics/{moduleId}/{activityId}
```

Returns metadata. For the streaming URL:

```
GET /topics/{moduleId}/{activityId}/media
```

Response:

```json
{ "class": ["media", "video"], "properties": { "src": "https://...", "expires": "..." } }
```

The `src` URL is time-limited. Thumbnails are available via a `thumbnail` sub-entity on the topic metadata response.

---

## Announcements

**Service:** `announcements.api.brightspace.com`

List all announcements for a module:

```
GET /organizations/{moduleId}
```

Get a specific announcement:

```
GET /organizations/{moduleId}/announcements/{announcementId}
```

```json
{
  "properties": { "name": "One last lesson next week + Do your MES" },
  "entities": [
    { "class": ["richtext"], "rel": ["item"],
      "properties": { "text": "...", "html": "<p>...</p>" } },
    { "class": ["date", "start-date"], "rel": ["https://api.brightspace.com/rels/date"],
      "properties": { "date": "2025-01-31T03:45:00.000Z" } }
  ]
}
```

---

## Folio (people)

**Service:** `folio.api.brightspace.com`

Lists instructors and students for a module:

```
GET /organizations/{moduleId}
```

Returns a `folio-organization` entity containing `folio-instructor-list` and optionally `folio-student-list` sub-entities. Each person is a reference entity linking to their `enrollments.api` enrolled-user URL.

---

## Users

**Service:** `users.api.brightspace.com`

```
GET /{userId}
```

```json
{
  "class": ["user"],
  "entities": [
    { "class": ["display", "name"], "properties": { "name": "HAZIQ DANISH BIN HAIRIL RIZAL NP" } },
    { "class": ["first", "name"],  "properties": { "name": "HAZIQ DANISH BIN HAIRIL RIZAL" } },
    { "class": ["last", "name"],   "properties": { "name": "NP" } },
    { "class": ["initials"],       "properties": { "initials": "HN" } },
    { "class": ["profile"],        "properties": { "isOnline": true } }
  ]
}
```

The `NP` suffix on the display name is POLITEMall-specific and denotes the institution.

---

## LTI links

**Service:** `weblinks.api.brightspace.com`

External tools embedded in module activities:

```
GET /{moduleId}/ltilinks/{activityId}
```

```json
{
  "class": ["describable-entity", "ltilink", "external-resource"],
  "properties": { "title": "External Tool", "url": "https://..." }
}
```

---

## Navigation summary

1. `GET /users/{userId}` (enrollments) returns the user's module list.
2. Follow an entity's `href` to resolve the enrollment detail.
3. Follow `rels/organization` to the module (`course-offering`).
4. From the module, follow `rels/sequence` for the content tree.
5. Recurse into `sequenced-activity` entities for individual content items.
6. Use `embedDepth=1` on collection endpoints to inline properties and avoid extra round-trips.

There is no general-purpose search or children-listing endpoint at the organizations level. Navigation follows links from known starting points.

---

## Reference

### URL structure

```
https://{tenantId}.{service}.api.brightspace.com/{path}
```

Authentication: Bearer JWT in the `Authorization` header. The JWT is obtained from POLITEMall's Valence API at `POST /nplms.polite.edu.sg/d2l/api/lp/1.30/auth/jwt/bootstrap` using D2L session cookies.

Ngee Ann Polytechnic tenant ID: `746e9230-82d6-4d6b-bd68-5aa40aa19cce`

### All API services

| Service | Purpose |
|---|---|
| `enrollments` | User's modules, semesters, programmes |
| `organizations` | Org units (institute, programme, semester, module) |
| `sequences` | Module content tree |
| `activities` | Submission records, content completion, quiz attempts |
| `announcements` | Module announcements |
| `folio` | Instructor and student lists |
| `weblinks` | LTI external tool details |
| `content-service` | Video thumbnails, streaming URLs |
| `assignments` | Submission folders and evaluation |
| `users` | User profile (name, avatar, status) |
| `files` | Course file storage |
| `grades` | Module grades |
| `discussions` | Forum threads |
| `notifications` | User alerts |
| `checklists` | Module checklists |
| `surveys` | Module surveys |
| `completion-tracking` | Content progress |
| `outcomes` | Learning outcomes |
| `themes` | UI themes |

### Key link relationships (rels)

| Rel | Source | Target |
|---|---|---|
| `rels/user-enrollment` | Enrollment collection | Enrollment detail |
| `rels/organization` | Enrollment | Module (course-offering) |
| `rels/sequence` | Module | Content tree |
| `rels/parent-semester` | Module | Parent semester |
| `rels/ancestors` | Any org unit | Parent chain |
| `rels/organization-homepage` | Module | LMS homepage path |
| `rels/user` | Enrollment | User profile |
| `rels/departments` | User | Programmes |
| `rels/semesters` | User | Semesters |
| `rels/folio` | Module | Instructor/student list |
| `rels/organization-announcements` | Module | Announcements |
| `rels/organization-activities` | Module | Activities/submissions |
| `rels/assignments` | Module | Assignment folders |
| `rels/files` | Module | File storage |
| `rels/user-course-grades` | Module | Grades |

### Notable actions

| Action | Method | Entity | Effect |
|---|---|---|---|
| `pin-course` | PUT | Enrollment | Pin/unpin module |
| `search-my-enrollments` | GET | Enrollment collection | Filter modules |
| `search-my-semesters` | GET | Semester collection | Search semesters |

### POLITEMall-specific notes

* **Archiving**: Past-semester modules are prefixed with `z_[Archived - {semester}]` rather than deleted.
* **Org unit IDs**: Course-offering IDs are not evenly distributed. They appear in clusters of varying density:

  | Range | Course-offerings | Density |
  |---|---|---|
  | 51,394–52,284 | 891 | ~87% (scattered gaps) |
  | 80,185–80,889 | 94 | ~13% (sparse) |
  | 92,834–93,089 | 121 | ~47% |
  | 102,145–102,223 | 79 | ~100% |
  | 122,947–123,027 | 79 | ~99% |
  | 362,900–363,046 | 147 | ~100% |
  | 413,048–413,049 | 2 | negligible |
  | 468,016–468,977 | 962 | 100% |

  IDs outside these ranges return either 404 or non-course-offering org unit types (`group`, `course-template`). Within each cluster, IDs are assigned roughly alphabetically by module name.
* **`orgUnitTypeId=3`**: In the enrollment search, this filters to course-offerings (modules). The same parameter on the root organizations endpoint (`/`) has no filtering effect; that endpoint always returns semesters.
* **`embedDepth`**: Without it, collection entities are bare references (only `class` and `href`). Setting `embedDepth=1` inlines properties and some sub-entities, reducing round-trips.
