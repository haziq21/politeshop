import fs from "fs";
import type { Result } from "../types";
import { brightspaceJWTBody, whoamiRes, sirenEntity, type SirenEntity, dueDateSchema } from "./schema";
import type {
  AnyActivity,
  DocEmbedActivity,
  HTMLActivity,
  VideoEmbedActivity,
  UnknownActivity,
  WebEmbedActivity,
  Semester,
  Module,
  ActivityFolder,
  School,
  SubmissionActivity,
  UserSubmission,
} from "../db";
import * as jose from "jose";
import { arrEq, dataResult, errorResult, unwrapResults } from "../helpers";
import { getLinkWithClass, getLinkWithRel, getSubEntWithClass, getSubEntWithRel, lastPathComponent } from "./helpers";
import { parse as parseDate, addSeconds } from "date-fns";
import { get } from "svelte/store";

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
  async fetchSchool(): Promise<Result<School>> {
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

    const parseRes = await this.parseSchool(orgData);
    if (parseRes.error) return errorResult(parseRes.error);

    return dataResult(parseRes.data);
  }

  /** Parse an organization entity into a school. */
  async parseSchool(ent: SirenEntity): Promise<Result<School>> {
    const name = ent.properties?.name;
    if (typeof name !== "string")
      return errorResult({ msg: `Unexpected type for school name: ${typeof name}`, data: name });

    // Find the self link to extract the school ID from
    const selfLink = getLinkWithRel("self", ent);
    if (!selfLink) return errorResult({ msg: "Missing self link in school entity" });
    const id = lastPathComponent(selfLink.href);

    // Get the banner image URL
    const { data: imageData, error: imageError } = await this.#fetchBrightspaceEntity("organizations", `/${id}/image`);
    if (imageError) return errorResult(imageError);
    const bannerImageURL = getLinkWithClass(["banner", "wide", "max"], imageData)?.href;

    return dataResult({ id, name, bannerImageURL });
  }

  async fetchSemesters(): Promise<Result<Semester[]>> {
    const url = `${this.basePOLITEMallURL}/d2l/api/le/manageCourses/courses-searches/${this.userId}/BySemester?desc=1`;
    const { data, error } = await this.#fetchBrightspaceEntity(url);
    if (error) return errorResult(error);

    // Semester data is in the entity's actions
    if (!data.actions) return errorResult({ msg: "Missing actions in semester entity" });

    const semesters: Semester[] = [];
    for (const action of data.actions) {
      if (!action.name || !action.title) return errorResult({ msg: "Missing name in semester action" });
      // Trim the name because sometimes it has leading spaces...
      semesters.push({ id: action.name, name: action.title.trim() });
    }

    return dataResult(semesters);
  }

  async fetchModules(): Promise<Result<Module[]>> {
    const { data, error } = await this.#fetchBrightspaceEntity("enrollments", `/users/${this.userId}?pageSize=100`);
    if (error) return errorResult(error);
    if (!data.entities) return errorResult({ msg: "Missing entities in user enrollments" });

    // Fetch all the modules in parallel
    // TODO: Maybe use errors to reject the promise early
    const moduleResults = await Promise.all(
      data.entities.map(async (ent): Promise<Result<Module>> => {
        if (!ent.href) return errorResult({ msg: "Missing href in enrollment entity" });

        // This entity only contains links to other entities (one of them containing the data we need)
        const { data: enrollmentEnt, error: enrollmentError } = await this.#fetchBrightspaceEntity(ent.href);
        if (enrollmentError) return errorResult(enrollmentError);

        // The href of this link contains the module's ID
        const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", enrollmentEnt);
        if (!orgLink) return errorResult({ msg: "Missing organization link in enrollment entity" });
        // The URL should look like https://<tenantId>.organizations.api.brightspace.com/<moduleId>
        const id = lastPathComponent(orgLink.href);

        // This entity contains the module's name and code
        const { data: orgEnt, error: orgError } = await this.#fetchBrightspaceEntity(orgLink.href);
        if (orgError) return errorResult(orgError);
        if (!orgEnt.properties?.name || !orgEnt.properties?.code)
          return errorResult({ msg: "Missing name or code in module entity" });
        const name = orgEnt.properties.name;
        const code = orgEnt.properties.code;

        // The href of the parent-semester link contains the module's semester ID
        const semLink = getLinkWithRel("https://api.brightspace.com/rels/parent-semester", orgEnt);
        if (!semLink) return errorResult({ msg: "Missing parent semester link in organization entity" });
        // The URL should look like https://<tenantId>.organizations.api.brightspace.com/<semesterId>
        const semesterId = lastPathComponent(semLink.href);

        // Get the URL of the module's banner image
        const { data: imageData, error: imageError } = await this.#fetchBrightspaceEntity(
          "organizations",
          `/${id}/image`
        );
        if (imageError) return errorResult(imageError);
        const imageIconURL =
          getLinkWithClass(["tile", "high-density", "min"], imageData)?.href ||
          getLinkWithClass(["tile", "mid"], imageData)?.href;

        return dataResult({ id, name, code, imageIconURL, semesterId });
      })
    );

    if (moduleResults.some((res) => res.error))
      return errorResult({ msg: "Failed to fetch some modules", data: moduleResults });
    return dataResult(moduleResults.map((res) => res.data!));
  }

  // TODO: Explicit folder / activity order
  async fetchModuleContent(moduleId: string): Promise<
    Result<{
      activityFolders: ActivityFolder[];
      activities: AnyActivity[];
    }>
  > {
    // This entity contains the entire tree of activities and folders in the module
    const { data, error: entityFetchError } = await this.#fetchBrightspaceEntity(
      "sequences",
      `/${moduleId}?deepEmbedEntities=1&embedDepth=1&filterOnDatesAndDepth=0`
    );
    if (entityFetchError) return errorResult(entityFetchError);

    const { data: parseData, error: parseError } = await this.parseFolderContents(data.entities ?? []);
    if (parseError) return errorResult(parseError);

    return dataResult({
      activityFolders: parseData.folders,
      activities: parseData.activities,
    });
  }

  /** Recursively parse an array of folder entities. */
  async parseFolderContents(
    entities: SirenEntity[]
  ): Promise<Result<{ folders: ActivityFolder[]; activities: AnyActivity[] }>> {
    const folders: ActivityFolder[] = [];
    const activities: AnyActivity[] = [];

    await unwrapResults();

    // TODO: Better parallelization
    for (const ent of entities) {
      // Parse activities in the folder
      if (ent.class.includes("sequenced-activity")) {
        const { data: activity, error } = await this.parseActivity(ent);
        if (error) return errorResult(error);
        activities.push(activity);
        continue;
      }

      // Skip if `ent` isn't a folder entity
      if (!arrEq(ent.class, ["release-condition-fix", "sequence", "sequence-description"])) {
        // These entities contain the same data as in ent.properties.description
        if (arrEq(ent.class, ["richtext", "description"])) continue;
        // These entities specify how many completed folders / activities
        // there are in a unit (POLITEShop treats units as folders too)
        if (ent.class.includes("completion")) continue;

        return errorResult({ msg: "Unknown entity", data: ent });
      }

      // Get the title and optional description of the folder
      const name = ent.properties?.title;
      const description = ent.properties?.description;
      if (typeof name !== "string")
        return errorResult({ msg: `Unexpected sequence entity title type: ${typeof name}` });
      if (typeof description !== "undefined" && typeof description !== "string")
        return errorResult({
          msg: `Unexpected sequence entity description type: ${typeof description}`,
        });

      // The self link contains the folder's ID
      // (https://<tenantId>.sequences.api.brightspace.com/<moduleId>/activity/<folderId>?filterOnDatesAndDepth=0)
      const selfLink = getLinkWithRel("self", ent);
      if (!selfLink) return errorResult({ msg: "Missing self link in sequence entity" });
      const id = lastPathComponent(selfLink.href);

      // The organization link contains the module's ID
      // (https://<tenantId>.organizations.api.brightspace.com/<moduleId>)
      const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", ent);
      if (!orgLink) return errorResult({ msg: "Missing organization link in sequence entity" });
      const moduleId = lastPathComponent(orgLink.href);

      // The up link contains the parent folder's ID if there is one
      // (https://<tenantId>.sequences.api.brightspace.com/<moduleId>/activity/<folderId>?filterOnDatesAndDepth=0)
      const upLink = getLinkWithRel("up", ent);
      if (!upLink) return errorResult({ msg: "Missing up link in sequence entity" });
      const upLinkHref = new URL(upLink.href);
      // If the path isn't "/<moduleId>/activity/<folderId>", then the parent is the module
      const parentId = /^\/.+\/activity\/.+$/.test(upLinkHref.pathname) ? lastPathComponent(upLinkHref) : undefined;

      folders.push({ id, name, description, moduleId, parentId });

      // Recursively parse child folders
      if (!ent.entities) continue;
      const { data: childData, error } = await this.parseFolderContents(ent.entities);
      if (error) return errorResult(error);
      folders.push(...childData.folders);
      activities.push(...childData.activities);
    }

    return dataResult({ folders, activities });
  }

  /**
   * Parse a Siren enitity into a `FullActivity`. Depending on the
   * activity type, this function may make calls to the Brightspace API.
   */
  async parseActivity(ent: SirenEntity): Promise<Result<AnyActivity>> {
    const name = ent.properties?.title;
    if (typeof name !== "string")
      return errorResult({ msg: `Unexpected activity title type: ${typeof name}`, data: name });

    // The self link contains the activity's ID
    const selfLink = getLinkWithRel("self", ent);
    if (!selfLink) return errorResult({ msg: "Missing self link in activity entity" });
    const id = lastPathComponent(selfLink.href);

    // The up link contains the folder's ID
    const upLink = getLinkWithRel("up", ent);
    if (!upLink) return errorResult({ msg: "Missing up link in activity entity" });
    const folderId = lastPathComponent(upLink.href);

    // The organization link contains the module's ID
    const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", ent);
    if (!orgLink) return errorResult({ msg: "Missing organization link in activity entity" });
    const moduleId = lastPathComponent(orgLink.href);

    const partialActivity = { id, folderId, name };
    let subEnt: SirenEntity | undefined;

    // Activities with the class ["activity", "file-activity"] can be embedded files or HTML
    if ((subEnt = getSubEntWithClass(["activity", "file-activity"], ent))) {
      const fileEnt = getSubEntWithClass(["file"], subEnt);
      if (!fileEnt) return errorResult({ msg: "Missing file entity in file activity" });

      // Source URL for the (possibly html) file
      const fileURL = `${this.basePOLITEMallURL}/d2l/api/le/1.12/${moduleId}/content/topics/${id}/file?stream=true`;

      if (fileEnt.properties?.type === "text/html") {
        // Fetch the HTML content of the file
        const res = await fetch(fileURL, { headers: this.apiRequestHeaders });
        if (!res.ok) return errorResult({ msg: "Failed to fetch html activity", data: await res.text() });
        return dataResult<HTMLActivity>({ ...partialActivity, type: "html", content: await res.text() });
      }
      // Files that aren't html are generally pdf / pptx / docx files
      else {
        // .pptx and .docx files have generated PDF versions for previewing
        const previewURL = getLinkWithClass(["pdf", "d2l-converted-doc"], fileEnt)?.href;
        // The preview PDFs are hosted on AWS and the links in the file entities have expiry times
        const previewURLExpiry = previewURL ? this.getURLExpiry(previewURL) : undefined;

        return dataResult<DocEmbedActivity>({
          ...partialActivity,
          type: "doc_embed",
          sourceURL: fileURL,
          previewURL,
          previewURLExpiry,
        });
      }
    }

    // Activities with the class ["activity", "link-activity", "link-plain"] can be submission or quiz activities
    else if ((subEnt = getSubEntWithClass(["activity", "link-activity", "link-plain"], ent))) {
      const aboutLink = getLinkWithRel("about", subEnt);
      if (!aboutLink) return errorResult({ msg: "Missing about link in activity entity" });

      const aboutType = new URL(aboutLink.href).searchParams.get("type");
      if (aboutType === "quiz") {
        // TODO
        return dataResult({ ...partialActivity, type: "quiz" });
      } else if (aboutType === "dropbox") {
        // This sub-entity contains the due date of the submission, and (if submitted) the last datetime it was submitted
        const completionEnt = getSubEntWithRel("https://api.brightspace.com/rels/completion", subEnt);

        const rawDueAt = completionEnt && getSubEntWithClass("due", completionEnt)?.properties?.date;
        if (typeof rawDueAt !== "undefined" && typeof rawDueAt !== "string")
          return errorResult({ msg: `Unexpected due date type: ${typeof rawDueAt}`, data: rawDueAt });
        // These dates seem to be in ISO 8601 format, which is parseable by Date
        const dueAt = rawDueAt ? new Date(rawDueAt) : undefined;

        const description = getSubEntWithClass(["richtext", "description"], ent)?.properties?.html;
        if (typeof description !== "undefined" && typeof description !== "string")
          return errorResult({ msg: `Unexpected description type: ${typeof description}`, data: description });

        return dataResult<SubmissionActivity>({ ...partialActivity, type: "submission", dueAt, description });
      } else return dataResult({ ...partialActivity, type: "unknown" });
    }

    // Activities with the class ["activity", "link-activity", "link-content-service"] are probably videos
    else if ((subEnt = getSubEntWithClass(["activity", "link-activity", "link-content-service"], ent))) {
      const { data, error } = await this.fetchVideoActivitySource(moduleId, id);
      if (error) return errorResult(error);

      return dataResult<VideoEmbedActivity>({
        ...partialActivity,
        type: "video_embed",
        sourceURL: data.url,
        sourceURLExpiry: data.urlExpiry,
      });
    }

    // These are link activities
    else if (
      (subEnt =
        // These are open-in-new-tab links that use POLITEMall's redirection service
        getSubEntWithClass(["activity", "link-activity", "link-plain", "open-in-new-tab"], ent) ||
        // These are open-in-new-tab links that directly link to the external site
        getSubEntWithClass(["activity", "link-activity", "link-plain", "external", "open-in-new-tab"], ent) ||
        // These are links that are directly embedded in the page
        getSubEntWithClass(["activity", "link-activity", "link-plain", "external"], ent))
    ) {
      const embedURL = getLinkWithRel(["about"], subEnt)?.href;
      if (!embedURL) return errorResult({ msg: "Missing about link in link activity", data: ent });
      return dataResult<WebEmbedActivity>({ ...partialActivity, type: "web_embed", embedURL });
    }

    // There might be more activity types
    else return dataResult<UnknownActivity>({ ...partialActivity, type: "unknown" });
  }

  /**
   * Parse the user's submissions for an assignment activity.
   */
  async fetchAssignmentSubmissions(moduleId: string, activityId: string): Promise<Result<UserSubmission[]>> {
    const { data: ent, error } = await this.#fetchBrightspaceEntity(
      "sequences",
      `/${moduleId}/activity/${activityId}?filterOnDatesAndDepth=0`
    );
    if (error) return errorResult(error);

    // This URL points to an entity that contains a sub-entity that links to each submission.
    // It looks like https://{tenantId}.activities.api.brightspace.com/old/activities/{activityUsageId}/usages/{moduleId}
    const activityUsageHref = getLinkWithRel(["https://activities.api.brightspace.com/rels/activity-usage"], ent)?.href;
    if (!activityUsageHref)
      return errorResult({
        msg: "Missing activity usage link in activity entity",
        data: { activityId },
      });

    const { data: activityUsage, error: error2 } = await this.#fetchBrightspaceEntity(activityUsageHref);
    if (error2) return errorResult({ msg: error2.msg, data: { fetch: error2.data, moduleId, activityId } });

    const submissionUsageHref = getSubEntWithRel(
      ["https://activities.api.brightspace.com/rels/child-activity-usage"],
      activityUsage
    )?.href;
    if (!submissionUsageHref)
      return errorResult({ msg: "Missing child activity usage link in activity usage entity", data: ent });

    // This URL points to an entity that links to each submission made by the user
    const userSubmissionUsageHref = `${submissionUsageHref.replace(/\/$/, "")}/users/${this.userId}`;
    const { data: childUserActivityUsage, error: error3 } = await this.#fetchBrightspaceEntity(userSubmissionUsageHref);
    if (error3) return errorResult(error3);

    // This entity links to each submission
    const submissionList = getSubEntWithClass(["assignment-submission-list"], childUserActivityUsage);
    if (!submissionList) return errorResult({ msg: "Missing assignment submission list entity" });
    if (!submissionList.links) return errorResult({ msg: "Missing links in assignment submission list entity" });

    const submissions = submissionList.links.map(async (link): Promise<Result<UserSubmission>> => {
      // The href of the link contains the submission's ID
      if (!link.href) return errorResult({ msg: "Missing href in assignment submission link" });
      const id = lastPathComponent(link.href);

      const { data: submission, error: submissionError } = await this.#fetchBrightspaceEntity(link.href);
      if (submissionError) return errorResult(submissionError);

      // Get the date/time of the submission
      const rawSubmittedAt = getSubEntWithClass(["date", "submission-date"], submission)?.properties?.date;
      if (typeof rawSubmittedAt !== "string")
        return errorResult({
          msg: `Unexpected submission date type: ${typeof rawSubmittedAt}`,
          data: rawSubmittedAt,
        });
      const submittedAt = new Date(rawSubmittedAt);

      // Get the comment of the submission, if present
      const commentEnt = getSubEntWithClass("submission-comment", submission);
      const comment = commentEnt?.properties?.html;
      if (typeof comment !== "undefined" && typeof comment !== "string")
        return errorResult({ msg: `Unexpected comment type: ${typeof comment}`, data: comment });

      return dataResult<UserSubmission>({ id, userId: this.userId, activityId, submittedAt, comment });
    });

    return await unwrapResults(submissions);
  }

  /** Fetch the source URL for the video used by a video (embed) activity. */
  async fetchVideoActivitySource(
    moduleId: string,
    activityId: string
  ): Promise<Result<{ url: string; urlExpiry: Date | undefined }>> {
    const { data: contentServiceResource, error } = await this.#fetchBrightspaceEntity(
      "content-service",
      `/topics/${moduleId}/${activityId}/media`
    );
    if (error) return errorResult(error);

    const videoSrc = contentServiceResource.properties?.src;
    if (typeof videoSrc !== "string")
      return errorResult({ msg: `Unexpected video src type: ${typeof videoSrc}`, data: videoSrc });

    return dataResult({ url: videoSrc, urlExpiry: this.getURLExpiry(videoSrc) });
  }

  /** Return the expiry date/time of an S3 or Brightspace content service resource URL. */
  getURLExpiry(url: string): Date | undefined {
    const urlObj = new URL(url);

    if (urlObj.hostname.endsWith("amazonaws.com")) {
      let expiresIn = urlObj.searchParams.get("X-Amz-Expires");
      if (!expiresIn) return undefined;

      let startDate = urlObj.searchParams.get("X-Amz-Date");
      if (!startDate) return undefined;

      return addSeconds(parseDate(startDate, "yyyyMMdd'T'HHmmssX", new Date()), +expiresIn);
    } else if (urlObj.hostname.endsWith("content-service.brightspace.com")) {
      let expires = urlObj.searchParams.get("Expires");
      if (!expires) return undefined;
      return new Date(+expires * 1000);
    }
  }

  /** Fetch a Siren entity from the specified Brightspace API. */
  async #fetchBrightspaceEntity(apiSubdomain: string, path: string): Promise<Result<SirenEntity>>;
  /** Fetch a Siren entity from the specified Brightspace URL. */
  async #fetchBrightspaceEntity(url: string): Promise<Result<SirenEntity>>;
  async #fetchBrightspaceEntity(subdomainOrFullUrl: string, path?: string): Promise<Result<SirenEntity>> {
    let url = path ? `https://${this.tenantId}.${subdomainOrFullUrl}.api.brightspace.com${path}` : subdomainOrFullUrl;
    let res: Response;

    try {
      res = await fetch(url, { headers: this.apiRequestHeaders });
    } catch (e) {
      return errorResult({
        msg: path ? `Failed to fetch ${subdomainOrFullUrl} entity ${path}` : `Failed to fetch ${subdomainOrFullUrl}`,
        data: e,
      });
    }

    if (!res.ok)
      return errorResult({
        msg: `Failed to fetch ${subdomainOrFullUrl} entity ${path} (${res.status})`,
        data: await res.text(),
      });

    const json = await res.json();
    const parseRes = sirenEntity.safeParse(json);
    if (!parseRes.success)
      return errorResult({ msg: `Unexpected ${subdomainOrFullUrl} entity response`, data: parseRes.error.issues });

    return dataResult(parseRes.data);
  }
}
