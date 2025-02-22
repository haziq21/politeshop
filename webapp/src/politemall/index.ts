import type { Result } from "../types";
import { brightspaceJWTBody, whoamiRes, sirenEntity, type SirenEntity } from "./schema";
import { school, semester, module, activityFolder, activity, htmlActivity, fileActivity } from "../db";
import * as jose from "jose";
import { arrEq, dataResult, errorResult } from "../helpers";
import { getLinkWithRel, lastPathComponent } from "./helpers";
import { extractTablesRelationalConfig } from "drizzle-orm";

/**
 * Client for interacting with POLITEMall. This client calls both `*.polite.edu.sg`
 * and `*.api.brightspace.com` APIs.
 */
export class POLITEMallClient {
  /** Cookie for authentication to POLITEMall APIs (`*.polite.edu.sg`). */
  d2lSessionVal: string;

  /** Cookie for authentication to POLITEMall APIs (`*.polite.edu.sg`). */
  d2lSecureSessionVal: string;

  /** JWT used for authentication to Brightspace APIs (`*.api.brightspace.com`). */
  brightspaceJWT: string;

  /** Subdomain of the POLITEMall site used (e.g. "nplms" for `nplms.polite.edu.sg`). */
  domain: string;

  /**
   * ID of the user, shared by both `*.polite.edu.sg` and `*.api.brightspace.com` APIs.
   */
  userId: string;

  /** ID of the Brightspace tenant, used by both `*.polite.edu.sg` and `*.api.brightspace.com` APIs. */
  tenantId: string;

  get basePOLITEMallURL() {
    return `https://${this.domain}.polite.edu.sg`;
  }

  get apiRequestHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.brightspaceJWT}`,
      Cookie: `d2lSessionVal=${this.d2lSessionVal}; d2lSecureSessionVal=${this.d2lSecureSessionVal}`,
    };
  }

  /**
   * Construct a new POLITEMallClient. The `sub` claim of the `brightspaceJWT`
   * is used as the client's `userId` if `userId` is not specified.
   */
  constructor(config: {
    d2lSessionVal: string;
    d2lSecureSessionVal: string;
    brightspaceJWT: string;
    domain: string;
    userId?: string;
  }) {
    // TODO: Maybe verify cookie format
    this.d2lSessionVal = config.d2lSessionVal;
    this.d2lSecureSessionVal = config.d2lSecureSessionVal;
    this.brightspaceJWT = config.brightspaceJWT;
    this.domain = config.domain;

    // Extract the tenant and user IDs from brightspaceJWT
    const res = brightspaceJWTBody.safeParse(jose.decodeJwt(config.brightspaceJWT));
    if (!res.success) throw new Error("Malformed Brightspace JWT");

    this.tenantId = res.data.tenantid;
    this.userId = config.userId || res.data.sub;
  }

  /** Fetch the user's name and ID from the POLITEMall API. */
  async fetchPartialUser(): Promise<Result<{ id: string; name: string }>> {
    const res = await fetch(`${this.basePOLITEMallURL}/d2l/api/lp/1.0/users/whoami`, {
      headers: this.apiRequestHeaders,
    });
    if (!res.ok) return errorResult({ msg: "Failed to fetch whoami", data: await res.text() });

    const parseRes = whoamiRes.safeParse(await res.json());
    if (!parseRes.success)
      return errorResult({ msg: "Unexpected whoami response from POLITEMall API", data: parseRes.error.issues });

    return dataResult({ id: parseRes.data.Identifier, name: parseRes.data.FirstName });
  }

  /** Get the user's school from the Brightspace API. */
  async fetchSchool(): Promise<Result<typeof school.$inferInsert>> {
    const { data: enrollmentData, error: enrollmentError } = await this.#fetchBrightspaceEntity(
      "enrollments",
      `/users/${this.userId}`
    );
    if (enrollmentError) return errorResult(enrollmentError);

    // Find the link to the organization entity
    const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", enrollmentData);
    if (!orgLink) return errorResult({ msg: "Missing organization link in user entity" });

    // Fetch the organization entity (this describes the school)
    const { data: orgData, error: orgError } = await this.#fetchBrightspaceEntity(orgLink.href);
    if (orgError) return errorResult(orgError);

    const parseRes = this.parseSchool(orgData);
    if (parseRes.error) return errorResult(parseRes.error);

    return dataResult(parseRes.data);
  }

  /** Parse an organization entity into a school. */
  parseSchool(ent: SirenEntity): Result<typeof school.$inferInsert> {
    const name = ent.properties?.name;
    if (typeof name !== "string")
      return errorResult({ msg: `Unexpected type for school name: ${typeof name}`, data: name });

    // Find the self link to extract the school ID from
    const selfLink = getLinkWithRel("self", ent);
    if (!selfLink) return errorResult({ msg: "Missing self link in school entity" });

    const id = lastPathComponent(selfLink.href);

    return dataResult({ id, name });
  }

  async fetchSemesters(): Promise<Result<(typeof semester.$inferInsert)[]>> {
    const url = `${this.basePOLITEMallURL}/d2l/api/le/manageCourses/courses-searches/${this.userId}/BySemester?desc=1`;
    const { data, error } = await this.#fetchBrightspaceEntity(url);
    if (error) return errorResult(error);

    // Semester data is in the entity's actions
    if (!data.actions) return errorResult({ msg: "Missing actions in semester entity" });

    const semesters: (typeof semester.$inferInsert)[] = [];
    for (const action of data.actions) {
      if (!action.name || !action.title) return errorResult({ msg: "Missing name in semester action" });
      // Trim the name because sometimes it has leading spaces...
      semesters.push({ id: action.name, name: action.title.trim() });
    }

    return dataResult(semesters);
  }

  async fetchModules(): Promise<Result<(typeof module.$inferInsert)[]>> {
    const { data, error } = await this.#fetchBrightspaceEntity("enrollments", `/users/${this.userId}`);
    if (error) return errorResult(error);
    if (!data.entities) return errorResult({ msg: "Missing entities in user enrollments" });

    // Fetch all the modules in parallel
    // TODO: Maybe use errors to reject the promise early
    const moduleResults = await Promise.all(
      data.entities.map(async (ent): Promise<Result<typeof module.$inferInsert>> => {
        if (!ent.href) return errorResult({ msg: "Missing href in enrollment entity" });

        // This entity only contains links to other entities (one of them containing the data we need)
        const { data: enrollmentData, error: enrollmentError } = await this.#fetchBrightspaceEntity(ent.href);
        if (enrollmentError) return errorResult(enrollmentError);

        // The href of this link contains the module's ID
        const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", enrollmentData);
        if (!orgLink) return errorResult({ msg: "Missing organization link in enrollment entity" });

        // This entity contains the module's name and code
        const { data: orgData, error: orgError } = await this.#fetchBrightspaceEntity(orgLink.href);
        if (orgError) return errorResult(orgError);
        if (!orgData.properties?.name || !orgData.properties?.code)
          return errorResult({ msg: "Missing name or code in module entity" });

        // The href of the parent-semester link contains the module's semester ID
        const semLink = getLinkWithRel("https://api.brightspace.com/rels/parent-semester", orgData);
        if (!semLink) return errorResult({ msg: "Missing parent semester link in organization entity" });

        return dataResult({
          name: orgData.properties.name,
          code: orgData.properties.code,
          // The URLs should look like https://<tenantId>.organizations.api.brightspace.com/<entityId>?localeId=...
          id: lastPathComponent(orgLink.href),
          semesterId: lastPathComponent(semLink.href),
        });
      })
    );

    if (moduleResults.some((res) => res.error))
      return errorResult({ msg: "Failed to fetch some modules", data: moduleResults });
    return dataResult(moduleResults.map((res) => res.data!));
  }

  async fetchModuleContent(moduleId: string): Promise<
    Result<{
      activityFolders: (typeof activityFolder.$inferInsert)[];
      activities: (typeof activity.$inferInsert)[];
      htmlActivities: (typeof htmlActivity.$inferInsert)[];
      fileActivities: (typeof fileActivity.$inferInsert)[];
    }>
  > {
    // This entity contains the entire tree of activities and folders in the module
    const { data, error: entityFetchError } = await this.#fetchBrightspaceEntity(
      "sequences",
      `/${moduleId}?deepEmbedEntities=1&embedDepth=1&filterOnDatesAndDepth=0`
    );
    if (entityFetchError) return errorResult(entityFetchError);

    const { data: parseData, error: parseError } = this.parseFolderContents(data.entities ?? []);
    if (parseError) return errorResult(parseError);

    return dataResult({
      activityFolders: parseData.folders,
      activities: parseData.activities,
      htmlActivities: [],
      fileActivities: [],
    });
  }

  /** Recursively parse an array of folder entities. */
  parseFolderContents(
    entities: SirenEntity[]
  ): Result<{ folders: (typeof activityFolder.$inferInsert)[]; activities: (typeof activity.$inferInsert)[] }> {
    const folders: (typeof activityFolder.$inferInsert)[] = [];
    const activities: (typeof activity.$inferInsert)[] = [];

    for (const ent of entities) {
      // Parse activities in the folder
      if (arrEq(ent.class, ["release-condition-fix", "sequenced-activity"])) {
        const { data: activity, error } = this.parseActivity(ent);
        if (error) return errorResult(error);
        activities.push(activity);
        continue;
      }

      // Skip if `ent` isn't a folder entity
      if (!arrEq(ent.class, ["release-condition-fix", "sequence", "sequence-description"])) continue;

      // Get the title and description (may be undefined) of the folder
      const title = ent.properties?.title;
      const description = ent.properties?.description;
      if (typeof title !== "string")
        return errorResult({ msg: `Unexpected sequence entity title type: ${typeof title}` });
      if (typeof description !== "undefined" && typeof description !== "string")
        return errorResult({
          msg: `Unexpected sequence entity description type: ${typeof description}`,
        });

      // The self link contains the folder's ID
      // (https://<tenantId>.sequences.api.brightspace.com/<moduleId>/activity/<folderId>?filterOnDatesAndDepth=0)
      const selfLink = getLinkWithRel("self", ent);
      if (!selfLink) return errorResult({ msg: "Missing self link in sequence entity" });

      // The organization link contains the module's ID
      // (https://<tenantId>.organizations.api.brightspace.com/<moduleId>)
      const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", ent);
      if (!orgLink) return errorResult({ msg: "Missing organization link in sequence entity" });

      // The up link contains the parent folder's ID if there is one
      // (https://<tenantId>.sequences.api.brightspace.com/<moduleId>/activity/<folderId>?filterOnDatesAndDepth=0)
      const upLink = getLinkWithRel("up", ent);
      if (!upLink) return errorResult({ msg: "Missing up link in sequence entity" });
      const upLinkHref = new URL(upLink.href);

      folders.push({
        id: lastPathComponent(selfLink.href),
        name: title,
        description: description,
        moduleId: lastPathComponent(orgLink.href),
        // If the path isn't "/<moduleId>/activity/<folderId>", then the parent is the module
        parentId: /^\/.+\/activity\/.+$/.test(upLinkHref.pathname) ? lastPathComponent(upLinkHref) : undefined,
      });

      // Recursively parse child folders
      const { data: chilData, error } = this.parseFolderContents(ent.entities ?? []);
      if (error) return errorResult(error);
      folders.push(...chilData.folders);
      activities.push(...chilData.activities);
    }

    return dataResult({ folders, activities });
  }

  parseActivity(ent: SirenEntity): Result<typeof activity.$inferInsert> {
    const title = ent.properties?.title;
    if (typeof title !== "string")
      return errorResult({ msg: `Unexpected activity title type: ${typeof title}`, data: title });

    // The self link contains the activity's ID
    const selfLink = getLinkWithRel("self", ent);
    if (!selfLink) return errorResult({ msg: "Missing self link in activity entity" });

    // The up link contains the folder's ID
    const upLink = getLinkWithRel("up", ent);
    if (!upLink) return errorResult({ msg: "Missing up link in activity entity" });

    // This should be undefined here once all the activity types are implemented
    let type: "file" | "html" = "file";

    // Activities with the class ["activity", "file-activity"] can be embedded files or HTML
    const fileOrHtmlActivity = ent.entities?.find((e) => arrEq(e.class ?? [], ["activity", "file-activity"]));
    if (fileOrHtmlActivity) {
      const fileEnt = fileOrHtmlActivity.entities?.find((e) => arrEq(e.class ?? [], ["file"]));
      if (!fileEnt) return errorResult({ msg: "Missing file entity in file activity" });

      const fileType = fileEnt.properties?.type;
      if (fileType === "text/html") type = "html";
      else type = "file";
    }

    return dataResult({
      id: lastPathComponent(selfLink.href),
      folderId: lastPathComponent(upLink.href),
      name: title,
      type,
    });
  }

  /** Fetch a Siren entity from the specified Brightspace API. */
  #fetchBrightspaceEntity(apiSubdomain: string, path: string): Promise<Result<SirenEntity>>;
  /** Fetch a Siren entity from the specified Brightspace URL. */
  #fetchBrightspaceEntity(url: string): Promise<Result<SirenEntity>>;
  async #fetchBrightspaceEntity(subdomainOrFullUrl: string, path?: string): Promise<Result<SirenEntity>> {
    let url = path ? `https://${this.tenantId}.${subdomainOrFullUrl}.api.brightspace.com${path}` : subdomainOrFullUrl;
    const res = await fetch(url, { headers: this.apiRequestHeaders });

    if (!res.ok)
      return {
        data: null,
        error: { msg: `Failed to fetch ${subdomainOrFullUrl} entity ${path} (${res.status})`, data: await res.text() },
      };

    const parseRes = sirenEntity.safeParse(await res.json());
    if (!parseRes.success)
      return {
        data: null,
        error: { msg: `Unexpected ${subdomainOrFullUrl} entity response`, data: parseRes.error.issues },
      };

    return { data: parseRes.data, error: null };
  }
}
