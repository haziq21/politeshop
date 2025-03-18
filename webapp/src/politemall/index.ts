import fs from "fs";
import type { Result } from "../types";
import { brightspaceJWTBody, whoamiRes, sirenEntity, type SirenEntity, dueDateSchema } from "./schema";
import * as schema from "./schema";
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
  User,
  QuizActivity,
  SubmissionDropbox,
  submissionDropbox,
  Quiz,
} from "../db";
import * as jose from "jose";
import { arrEq, dataResult, errorResult, unwrapResults } from "../helpers";
import { getLinkWithClass, getLinkWithRel, getSubEntWithClass, getSubEntWithRel, lastPathComponent } from "./helpers";
import { parse as parseDate, addSeconds } from "date-fns";
import { z } from "zod";

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

  get d2lCookies(): string {
    return `d2lSessionVal=${this.d2lSessionVal}; d2lSecureSessionVal=${this.d2lSecureSessionVal}`;
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
    const { data: enrollmentData, error: enrollmentError } = await this.#fetchFromBrightspace(
      "enrollments",
      `/users/${this.userId}`
    );
    if (enrollmentError) return errorResult(enrollmentError);

    // Find the link to the organization entity
    const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", enrollmentData);
    if (!orgLink) return errorResult({ msg: "Missing organization link in user entity" });

    // Fetch the organization entity (this describes the school)
    const { data: orgData, error: orgError } = await this.#fetchFromBrightspace(orgLink.href);
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
    const { data: imageData, error: imageError } = await this.#fetchFromBrightspace("organizations", `/${id}/image`);
    if (imageError) return errorResult(imageError);
    const bannerImageURL = getLinkWithClass(["banner", "wide", "max"], imageData)?.href;

    return dataResult({ id, name, bannerImageURL });
  }

  async fetchSemesters(): Promise<Result<Semester[]>> {
    const url = `${this.basePOLITEMallURL}/d2l/api/le/manageCourses/courses-searches/${this.userId}/BySemester?desc=1`;
    const { data, error } = await this.#fetchFromBrightspace(url);
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
    const { data, error } = await this.#fetchFromBrightspace("enrollments", `/users/${this.userId}?pageSize=100`);
    if (error) return errorResult(error);
    if (!data.entities) return errorResult({ msg: "Missing entities in user enrollments" });

    // Fetch all the modules in parallel
    // TODO: Maybe use errors to reject the promise early
    const moduleResults = await Promise.all(
      data.entities.map(async (ent): Promise<Result<Module>> => {
        if (!ent.href) return errorResult({ msg: "Missing href in enrollment entity" });

        // This entity only contains links to other entities (one of them containing the data we need)
        const { data: enrollmentEnt, error: enrollmentError } = await this.#fetchFromBrightspace(ent.href);
        if (enrollmentError) return errorResult(enrollmentError);

        // The href of this link contains the module's ID
        const orgLink = getLinkWithRel("https://api.brightspace.com/rels/organization", enrollmentEnt);
        if (!orgLink) return errorResult({ msg: "Missing organization link in enrollment entity" });
        // The URL should look like https://<tenantId>.organizations.api.brightspace.com/<moduleId>
        const id = lastPathComponent(orgLink.href);

        // This entity contains the module's name and code
        const { data: orgEnt, error: orgError } = await this.#fetchFromBrightspace(orgLink.href);
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
        const { data: imageData, error: imageError } = await this.#fetchFromBrightspace(
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

  async fetchModuleContent(moduleId: string): Promise<
    Result<{
      activityFolders: ActivityFolder[];
      activities: AnyActivity[];
    }>
  > {
    // Fetch the module's "table of contents" (which contains basic info about all the folders and activities)
    const { data: toc, error: fetchError } = await this.#fetchFromTenant(`/d2l/api/le/1.75/${moduleId}/content/toc`, {
      schema: schema.tableOfContents,
    });
    if (fetchError) return errorResult(fetchError);

    // Parse all the folders and activities in parallel
    const { data: parseData, error: parseError } = await unwrapResults(
      toc.Modules.map(async (m) => await this.parseActivityFolder(m, moduleId, null))
    );
    if (parseError) return errorResult(parseError);

    return dataResult({
      activities: parseData.flatMap((d) => d.activities),
      activityFolders: parseData.flatMap((d) => d.activityFolders),
    });
  }

  /** Parse what Brightspace calls "Modules", but we call activity folders. */
  async parseActivityFolder(
    folder: z.infer<typeof schema.module>,
    moduleId: string,
    parentId: string | null
  ): Promise<Result<{ activityFolders: ActivityFolder[]; activities: AnyActivity[] }>> {
    const folderId = folder.ModuleId.toString();

    // Parse activities in the folder
    const childActivitiesResultPromise = unwrapResults(
      folder.Topics.filter((t) => !t.IsBroken).map(async (t) => await this.parseActivity(t, moduleId, folderId))
    );

    // Parse subfolders
    const subfoldersResultPromise = unwrapResults(
      folder.Modules.map(async (m) => await this.parseActivityFolder(m, moduleId, folderId))
    );

    // Await both promises in parallel
    const { data, error } = await unwrapResults([childActivitiesResultPromise, subfoldersResultPromise]);
    if (error) return errorResult(error);
    const [childActivities, subfolders] = data;

    const activityFolders: ActivityFolder[] = [
      // Parse the folder itself
      {
        id: folderId,
        name: folder.Title,
        moduleId,
        parentId,
        description: folder.Description.Html,
        sortOrder: folder.SortOrder,
      },
      // Include all the parsed subfolders
      ...subfolders.flatMap((f) => f.activityFolders),
    ];

    // Combine the activities in this folder with the activities in all its subfolders
    const activities: AnyActivity[] = [...childActivities, ...subfolders.flatMap((f) => f.activities)];

    return dataResult({ activityFolders, activities });
  }

  /** Parse what Brightspace calls "Topics", but we call activities. */
  async parseActivity(
    activity: z.infer<typeof schema.topic>,
    moduleId: string,
    folderId: string
  ): Promise<Result<AnyActivity>> {
    if (activity.IsBroken) return errorResult({ msg: "parseActivity() can't handle broken activities" });

    const baseActivity = {
      id: activity.Identifier,
      folderId,
      sortOrder: activity.SortOrder,
    };
    const name = activity.Title;

    // These are HTML activities
    if (activity.ActivityType === 1 && activity.TypeIdentifier === "File" && activity.Url.endsWith(".html")) {
      const { data, error } = await this.#fetchFromTenant(activity.Url);
      if (error) return errorResult(error);
      return dataResult<HTMLActivity>({ ...baseActivity, type: "html", name, content: data });
    }

    // These are document embed activities
    if (activity.ActivityType === 1 && activity.TypeIdentifier === "File") {
      const { data: activityEnt, error } = await this.#fetchFromBrightspace(
        "sequences",
        `/${moduleId}/activity/${activity.TopicId}?filterOnDatesAndDepth=0`
      );
      if (error) return errorResult(error);

      const fileActivityEnt = getSubEntWithClass(["activity", "file-activity"], activityEnt);
      if (!fileActivityEnt) return errorResult({ msg: "Missing file-activity sub-entity in activity entity" });

      // Get the preview URL of the document (.pptx and .docx files have generated PDF versions for previewing)
      const fileEnt = getSubEntWithClass(["file"], fileActivityEnt);
      if (!fileEnt) return errorResult({ msg: "Missing file sub-entity in file activity" });
      const previewURL = getLinkWithClass(["pdf", "d2l-converted-doc"], fileEnt)?.href;
      // The preview PDFs are hosted on AWS and their URLs expire
      const previewURLExpiry = previewURL ? this.getURLExpiry(previewURL) : undefined;

      return dataResult<DocEmbedActivity>({
        ...baseActivity,
        type: "doc_embed",
        name,
        sourceURL: activity.Url,
        previewURL,
        previewURLExpiry,
      });
    }

    // These are video embed activities
    if (activity.ActivityType === 1 && activity.TypeIdentifier === "ContentService") {
      const { data, error } = await unwrapResults([
        this.fetchContentServiceMediaURL(moduleId, activity.Identifier),
        this.fetchContentServiceResourceThumbnailURL(moduleId, activity.Identifier),
      ]);
      if (error) return errorResult(error);
      const [source, thumbnail] = data;

      return dataResult<VideoEmbedActivity>({
        ...baseActivity,
        type: "video_embed",
        name,
        sourceURL: source.url,
        sourceURLExpiry: source.urlExpiry,
        thumbnailURL: thumbnail.url,
        thumbnailURLExpiry: thumbnail.urlExpiry,
      });
    }

    // These are web embed activities
    if (activity.ActivityType === 2) {
      return dataResult<WebEmbedActivity>({ ...baseActivity, type: "web_embed", name, embedURL: activity.Url });
    }

    // These are submission activities
    if (activity.ActivityType === 3) {
      if (!activity.ToolItemId) return errorResult({ msg: "Missing ToolItemId in submission activity" });
      return dataResult<SubmissionActivity>({
        ...baseActivity,
        type: "submission",
        dropboxId: activity.ToolItemId.toString(),
      });
    }

    // These are quiz activities
    if (activity.ActivityType === 4) {
      if (!activity.ToolItemId) return errorResult({ msg: "Missing ToolItemId in quiz activity" });
      return dataResult<QuizActivity>({ ...baseActivity, type: "quiz", quizId: activity.ToolItemId.toString() });
    }

    return dataResult<UnknownActivity>({ ...baseActivity, type: "unknown" });
  }

  /** Fetch submission dropboxes in a module. */
  async fetchSubmissionDropboxes(moduleId: string): Promise<Result<SubmissionDropbox[]>> {
    const { data, error } = await this.#fetchFromTenant(`/d2l/api/le/1.75/${moduleId}/dropbox/folders/`, {
      schema: schema.dropboxFolder.array(),
    });
    if (error) return errorResult(error);

    return dataResult(
      data.map(
        (d): SubmissionDropbox => ({
          id: d.Id.toString(),
          name: d.Name,
          moduleId,
          description: d.CustomInstructions.Html,
          dueAt: d.DueDate,
        })
      )
    );
  }

  /**
   * Fetch the user's submissions for an assignment activity.
   */
  async fetchUserSubmissions(moduleId: string, dropboxId: string): Promise<Result<UserSubmission[]>> {
    const { data, error: fetchError } = await this.#fetchFromTenant(
      // POLITEMall/Brightspace needs the trailing / or else it returns 404...
      `/d2l/api/le/1.75/${moduleId}/dropbox/folders/${dropboxId}/submissions/`,
      { schema: schema.entityDropbox }
    );
    if (fetchError) return errorResult(fetchError);

    const submissions = data.Submissions.map(
      (sub): UserSubmission => ({
        id: sub.Id.toString(),
        userId: this.userId,
        dropboxId,
        submittedAt: sub.SubmissionDate,
        comment: sub.Comment.Html,
      })
    );

    return dataResult(submissions);
  }

  /** Fetch quizzes in a module. */
  async fetchQuizzes(moduleId: string): Promise<Result<Quiz[]>> {
    const quizzes: Quiz[] = [];
    let nextURL: string | null = `/d2l/api/le/1.75/${moduleId}/quizzes/`;

    do {
      // Fetch one page (20 objects) of quizzes
      const url: string = nextURL!;
      const { data, error } = await this.#fetchFromTenant(url, {
        schema: schema.objectListPage(schema.quizReadData),
      });
      if (error) return errorResult(error);
      nextURL = data.Next;

      quizzes.push(
        ...data.Objects.map(
          (d): Quiz => ({
            id: d.QuizId.toString(),
            moduleId,
            name: d.Name,
            description: d.Description.Text.Html,
            dueAt: d.DueDate,
          })
        )
      );
    } while (nextURL);

    return dataResult(quizzes);
  }

  /** Fetch the thumbnail URL of a resource on Brightspace's Content Service API. */
  async fetchContentServiceResourceThumbnailURL(
    moduleId: string,
    activityId: string
  ): Promise<Result<{ url: string; urlExpiry: Date | undefined }>> {
    const { data: ent, error } = await this.#fetchFromBrightspace(
      "content-service",
      `/topics/${moduleId}/${activityId}`
    );
    if (error) return errorResult(error);

    const thumbnailProperties = getSubEntWithClass(["thumbnail"], ent)?.properties;
    const url = thumbnailProperties?.src;
    if (typeof url !== "string") return errorResult({ msg: `Unexpected thumbnail URL type: ${typeof url}`, data: ent });

    // TODO: Is casting like this safe?
    const urlExpiry = url ? new Date(+thumbnailProperties.expires * 1000) || this.getURLExpiry(url) : undefined;
    return dataResult({ url, urlExpiry });
  }

  /** Fetch the source URL for the media of a content service entity (usually a video). */
  async fetchContentServiceMediaURL(
    moduleId: string,
    activityId: string
  ): Promise<Result<{ url: string; urlExpiry: Date | undefined }>> {
    const { data, error } = await this.#fetchFromBrightspace(
      "content-service",
      `/topics/${moduleId}/${activityId}/media`
    );
    if (error) return errorResult(error);

    const url = data.properties?.src;
    if (typeof url !== "string") return errorResult({ msg: `Unexpected video src type: ${typeof url}`, data: url });

    return dataResult({ url, urlExpiry: this.getURLExpiry(url) });
  }

  /** Return the expiry date/time of an S3 or Brightspace content service resource URL. */
  getURLExpiry(url: string): Date | undefined {
    const urlObj = new URL(url);

    if (urlObj.hostname.endsWith(".amazonaws.com")) {
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

  /**
   * Fetch from `*.polite.edu.sg`, validating the response with the provided schema.
   * `url` can either be a full URL or a path.
   */
  async #fetchFromTenant(url: string | URL, config?: { init?: RequestInit }): Promise<Result<string>>;
  async #fetchFromTenant<T extends z.Schema>(
    url: string | URL,
    config?: { schema: T; init?: RequestInit }
  ): Promise<Result<z.infer<T>>>;
  async #fetchFromTenant(url: string | URL, config?: { schema?: z.Schema; init?: RequestInit }): Promise<Result<any>> {
    // Add D2L cookies to the request headers
    if (!config) config = {};
    if (!config.init) config.init = {};
    if (!config.init.headers) config.init.headers = {};
    if (config.init.headers instanceof Headers) config.init.headers.set("Cookie", this.d2lCookies);
    else if (Array.isArray(config.init.headers)) config.init.headers.push(["Cookie", this.d2lCookies]);
    else config.init.headers.Cookie = this.d2lCookies;

    const fullURL = new URL(url, `https://${this.domain}.polite.edu.sg`);

    // Attempt to fetch
    let res: Response;
    try {
      res = await fetch(fullURL, config.init);
    } catch (e) {
      return errorResult({ msg: `Failed to fetch ${fullURL}`, data: e });
    }
    if (!res.ok) return errorResult({ msg: `Received status ${res.status} for ${fullURL}`, data: await res.text() });
    if (!config.schema) return dataResult(await res.text());

    // Attempt to parse the response
    try {
      return dataResult(config.schema.parse(await res.json()));
    } catch (e) {
      return errorResult({ msg: `Failed to parse response from ${fullURL}`, data: e });
    }
  }

  /** Fetch a Siren entity from the specified Brightspace API. */
  async #fetchFromBrightspace(apiSubdomain: string, path: string): Promise<Result<SirenEntity>>;
  /** Fetch a Siren entity from the specified Brightspace URL. */
  async #fetchFromBrightspace(url: string): Promise<Result<SirenEntity>>;
  async #fetchFromBrightspace(subdomainOrFullUrl: string, path?: string): Promise<Result<SirenEntity>> {
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
