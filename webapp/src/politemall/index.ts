import type { Result } from "../../../shared";
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
  Organization,
  SubmissionActivity,
  UserSubmission,
  User,
  QuizActivity,
  SubmissionDropbox,
  Quiz,
} from "../db";
import * as jose from "jose";
import { dataResult, errorResult, unwrapResults } from "../../../shared";
import { getLinkWithClass, getSubEntWithClass, lastPathComponent } from "./utils";
import { parse as parseDate, addSeconds } from "date-fns";
import { z } from "zod";
import { logger } from "../utils/logging";

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
  d2lFetchToken: string;

  /** Subdomain of the POLITEMall site used (e.g. "nplms" for `nplms.polite.edu.sg`). */
  domain: string;

  /**
   * ID of the user, shared by both `*.polite.edu.sg` and `*.api.brightspace.com` APIs.
   */
  userId: string;

  /** ID of the Brightspace tenant, used by both `*.polite.edu.sg` and `*.api.brightspace.com` APIs. */
  tenantId: string;

  /** `AbortController` for all fetch requests made by the client. */
  abortController = new AbortController();

  /**
   * Construct a new POLITEMallClient. The `sub` claim of the `brightspaceJWT`
   * is used as the client's `userId` if `userId` is not specified.
   */
  constructor(config: {
    d2lSessionVal: string;
    d2lSecureSessionVal: string;
    d2lFetchToken: string;
    domain: string;
    userId?: string;
  }) {
    // TODO: Maybe verify cookie format
    this.d2lSessionVal = config.d2lSessionVal;
    this.d2lSecureSessionVal = config.d2lSecureSessionVal;
    this.d2lFetchToken = config.d2lFetchToken;
    this.domain = config.domain;

    // Extract the tenant and user IDs from brightspaceJWT
    const res = schema.brightspaceJWTBody.safeParse(jose.decodeJwt(config.d2lFetchToken));
    if (!res.success) throw new Error("Malformed Brightspace JWT");

    this.tenantId = res.data.tenantid;
    this.userId = config.userId || res.data.sub;
  }

  /** Get a new JWT for authentication to Brightspace APIs. */
  async getNewD2lFetchToken(): Promise<Result<string>> {
    const { data, error } = await this.#fetchFromTenant("/d2l/lp/auth/oauth2/token", {
      schema: schema.brightspaceToken,
    });
    if (error) return errorResult(error);
    return dataResult(data.access_token);
  }

  static getUserIdFromBrightspaceJWT(brightspaceJWT: string): Result<string> {
    try {
      return dataResult(schema.brightspaceJWTBody.parse(jose.decodeJwt(brightspaceJWT)).sub);
    } catch (e) {
      return errorResult({ msg: "Malformed Brightspace JWT" });
    }
  }

  /** Fetch the user's name and ID from the POLITEMall API. */
  async fetchPartialUser(): Promise<Result<Pick<User, "id" | "name">>> {
    const { data, error } = await this.#fetchFromTenant(`/d2l/api/lp/1.0/users/whoami`, { schema: schema.whoAmIUser });
    if (error) return errorResult(error);

    return dataResult({ id: data.Identifier, name: data.FirstName });
  }

  /** Get the user's organization from the Brightspace API. */
  async fetchOrganization(): Promise<Result<Organization>> {
    const { data, error } = await this.#fetchFromTenant("/d2l/api/lp/1.46/organization/info", {
      schema: schema.organization,
    });
    if (error) return errorResult(error);

    return dataResult<Organization>({
      id: data.Identifier,
      name: data.Name,
      bannerImageURL: this.getImageURL(data.Identifier, { width: 1500, height: 240 }),
    });
  }

  /** Get the user's modules and their semesters from the Brightspace API. */
  async fetchModulesAndSemesters(): Promise<Result<{ modules: Module[]; semesters: Semester[] }>> {
    const rawModules: schema.MyOrgUnitInfo[] = [];
    let hasMoreItems = true;
    let bookmark: string | null = null;

    // Fetch all modules from the paginated API
    do {
      const query: string = bookmark ? `?bookmark=${bookmark}` : "";
      const { data, error } = await this.#fetchFromTenant(`/d2l/api/lp/1.46/enrollments/myenrollments/${query}`, {
        schema: schema.pagedResultSet(schema.myOrgUnitInfo),
      });
      if (error) return errorResult(error);

      // Filter for modules only
      rawModules.push(...data.Items.filter((org) => org.OrgUnit.Type.Id === 3));

      hasMoreItems = data.PagingInfo.HasMoreItems;
      bookmark = data.PagingInfo.Bookmark;
    } while (hasMoreItems);

    const { data: rawModuleParents, error } = await this.#fetchFromTenant(
      `/d2l/api/lp/1.46/courses/parentorgunits?orgUnitIdsCSV=${rawModules.map((m) => m.OrgUnit.Id).join(",")}`,
      { schema: schema.courseParent.array() }
    );
    if (error) return errorResult(error);

    const modules: Module[] = [];
    const semestersMap = new Map<string, Semester>();

    for (const { OrgUnit } of rawModules) {
      const parent = rawModuleParents.find((p) => p.CourseOfferingId === OrgUnit.Id.toString());
      if (!parent) return errorResult({ msg: "Failed to find parent for module", data: OrgUnit });

      modules.push({
        id: OrgUnit.Id.toString(),
        name: OrgUnit.Name,
        code: OrgUnit.Code || OrgUnit.Name,
        semesterId: parent.Semester.Identifier,
        imageIconURL: this.getImageURL(OrgUnit.Id.toString(), { width: 50, height: 50 }),
      });

      semestersMap.set(parent.Semester.Identifier, {
        id: parent.Semester.Identifier,
        name: parent.Semester.Name.trim(),
      });
    }

    return dataResult({ modules, semesters: semestersMap.values().toArray() });
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
    folder: schema.TOCModule,
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

  /**
   * Parse what Brightspace calls "Topics", but we call activities.
   * This may require additional fetch requests, depending on the activity.
   */
  async parseActivity(activity: schema.TOCTopic, moduleId: string, folderId: string): Promise<Result<AnyActivity>> {
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
        `/${moduleId}/activity/${activity.TopicId}?filterOnDatesAndDepth=0`,
        { api: "sequences" }
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
      return dataResult<WebEmbedActivity>({ ...baseActivity, type: "web_embed", name, url: activity.Url });
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
          closesAt: d.Availability?.EndDate,
        })
      )
    );
  }

  /**
   * Fetch the user's submissions for an assignment activity.
   */
  async fetchUserSubmissions(
    moduleId: string,
    dropboxId: string,
    config?: { dropboxIsClosed: boolean; organizationId: string }
  ): Promise<Result<UserSubmission[]>> {
    // There are two ways of fetching user submissions: using either the `*.polite.edu.sg` or
    // `*.api.brightspace.com` API. When a dropbox is closed (i.e. it's past its availability
    // end date), the `*.polite.edu.sg` API returns 403 (???), but the `*.api.brightspace.com`
    // API still works. This method prefers to use the `*.polite.edu.sg` API whenever possible
    // because it only requires one request per dropbox, while the `*.api.brightspace.com` API
    // additionally requires one request per submission.

    if (!config?.dropboxIsClosed) {
      const { data, error: fetchError } = await this.#fetchFromTenant(
        `/d2l/api/le/1.75/${moduleId}/dropbox/folders/${dropboxId}/submissions/`,
        { schema: schema.entityDropbox.array().max(1) }
      );
      if (fetchError) return errorResult(fetchError);

      if (data.length === 0) return dataResult([]);

      const submissions = data[0].Submissions.map(
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

    const { data: ent, error } = await this.#fetchFromBrightspace(
      `/old/activities/${config.organizationId}_2000_${dropboxId}/usages/${moduleId}/users/${this.userId}`,
      { api: "activities" }
    );
    if (error) return errorResult(error);

    const assignmentSubmissionList = getSubEntWithClass(["assignment-submission-list"], ent);
    if (!assignmentSubmissionList) return errorResult({ msg: "Missing assignment-submission-list entity" });
    if (!assignmentSubmissionList.links) return dataResult([]);

    const results = assignmentSubmissionList.links.map(async (l): Promise<Result<UserSubmission>> => {
      const { data: ent, error } = await this.#fetchFromBrightspace(l.href);
      if (error) return errorResult(error);

      const submittedAtEnt = getSubEntWithClass("submission-date", ent);
      const submittedAt = new Date(submittedAtEnt?.properties?.date);

      const commentEnt = getSubEntWithClass("submission-comment", ent);
      const comment = commentEnt?.properties?.html;
      if (comment !== undefined && typeof comment !== "string")
        return errorResult({ msg: "Unexpected comment type", data: commentEnt });

      return dataResult<UserSubmission>({
        id: lastPathComponent(l.href),
        userId: this.userId,
        dropboxId,
        submittedAt,
        comment,
      });
    });

    return await unwrapResults(results);
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
    const { data: ent, error } = await this.#fetchFromBrightspace(`/topics/${moduleId}/${activityId}`, {
      api: "content-service",
    });
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
    const { data, error } = await this.#fetchFromBrightspace(`/topics/${moduleId}/${activityId}/media`, {
      api: "content-service",
    });
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

  /** Return the URL for the specified `moduleOrOrganizationId`. */
  getImageURL(moduleOrOrganizationId: string, dim?: { width: number; height: number }): string {
    const query = dim ? `?width=${dim.width}&height=${dim.height}` : "";
    return `https://${this.domain}.polite.edu.sg/d2l/api/lp/1.46/courses/${moduleOrOrganizationId}/image${query}`;
  }

  /**
   * Fetch from `*.polite.edu.sg`, validating the response with the
   * provided schema (if any). `url` can either be a full URL or a path.
   */
  async #fetchFromTenant(url: string | URL, config?: RequestInit): Promise<Result<string>>;
  async #fetchFromTenant<T extends z.Schema>(
    url: string | URL,
    config: RequestInit & { schema: T }
  ): Promise<Result<z.infer<T>>>;
  async #fetchFromTenant<T extends z.Schema>(
    url: string | URL,
    config: RequestInit & { schema?: T } = {}
  ): Promise<Result<any>> {
    // Add D2L cookies to the request headers
    const d2lCookies = `d2lSessionVal=${this.d2lSessionVal}; d2lSecureSessionVal=${this.d2lSecureSessionVal}`;
    const { schema: _schema, ...init } = config || {};
    this.#setReqInitHeader(init, "Cookie", d2lCookies);

    const fullURL = new URL(url, `https://${this.domain}.polite.edu.sg`);

    // Attempt to fetch
    let res: Response;
    try {
      res = await this.#fetch(fullURL, { ...init, signal: this.abortController.signal });
    } catch (e) {
      return errorResult({ msg: `Failed to fetch ${fullURL}`, data: e });
    }
    if (!res.ok)
      return errorResult({
        msg: `Received status ${res.status} for ${fullURL}`,
        data: res.headers.get("content-type") === "application/json" ? await res.json() : await res.text(),
      });

    // Return the response as a string if no schema was provided
    if (!_schema) return dataResult(await res.text());

    // Attempt to parse the response using the provided schema
    const parseRes = _schema.safeParse(await res.json());
    if (parseRes.success) return dataResult(parseRes.data);
    return errorResult({ msg: `Failed to parse response from ${fullURL}`, data: parseRes.error.issues });
  }

  /** Fetch a Siren entity from the specified Brightspace API. `url` can either be a full URL or a path. */
  async #fetchFromBrightspace(fullURL: string | URL, config?: RequestInit): Promise<Result<schema.SirenEntity>>;
  async #fetchFromBrightspace(path: string, config: RequestInit & { api: string }): Promise<Result<schema.SirenEntity>>;
  async #fetchFromBrightspace(
    url: string | URL,
    config?: RequestInit & { api?: string }
  ): Promise<Result<schema.SirenEntity>> {
    // Compute the full URL and add the Brightspace JWT to the request headers
    const { api, ...init } = config || {};
    if (api) url = new URL(url, `https://${this.tenantId}.${api}.api.brightspace.com`);
    this.#setReqInitHeader(init, "Authorization", `Bearer ${this.d2lFetchToken}`);

    // Attempt to fetch
    let res: Response;
    try {
      res = await this.#fetch(url, init);
    } catch (e) {
      return errorResult({ msg: `Failed to fetch ${url}`, data: e });
    }
    if (!res.ok)
      return errorResult({
        msg: `Failed to fetch ${url} (${res.status})`,
        data: res.headers.get("content-type") === "application/json" ? await res.json() : await res.text(),
      });

    // Parse the response as a Siren entity
    let json;
    try {
      json = await res.json();
    } catch (e) {
      return errorResult({ msg: `Failed to parse ${url} response as JSON`, data: e });
    }

    const parseRes = schema.sirenEntity.safeParse(json);
    if (!parseRes.success) return errorResult({ msg: `Unexpected ${url} response`, data: parseRes.error.issues });
    return dataResult(parseRes.data);
  }

  async #fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const start = Date.now();

    const res = await fetch(input, {
      ...init,
      signal: this.abortController.signal,
    });

    logger.debug(
      { waitMs: Date.now() - start, sizeKB: +(res.headers.get("content-length") ?? 0) / 1000 },
      `Fetched ${input instanceof Request ? input.url : input}`
    );

    return res;
  }

  /** Add a header to a `RequestInit` and return it. */
  #setReqInitHeader(init: RequestInit, name: string, value: string): RequestInit {
    if (!init.headers) init.headers = new Headers();
    if (init.headers instanceof Headers) init.headers.set(name, value);
    else if (Array.isArray(init.headers)) init.headers.push([name, value]);
    else init.headers[name] = value;
    return init;
  }

  /** Abort all fetch requests made by the client. */
  abort() {
    this.abortController.abort();
  }
}
