import { z } from "zod";
import type { TOCModule, TOCTopic } from "../schema/polite";
import type {
  AnyActivity,
  ActivityFolder,
  Module,
  Institution,
  Quiz,
  Semester,
  SubmissionDropbox,
  User,
  Submission,
} from "../types";
import { getURLExpiry, lastPathComponent } from "../utils/url";
import { chunk } from "../utils/array";
import { Brightspace } from "./brightspace";
import { POLITE } from "./polite";
import { SirenEntity } from "../schema/siren";

/**
 * High-level POLITEMall client.
 *
 * Composes {@link POLITE} (for `*.polite.edu.sg` APIs) and {@link Brightspace}
 * (for `*.api.brightspace.com` APIs) into a single, convenient interface.
 *
 * Both lower-level clients are accessible so callers can reach endpoints not
 * covered by the high-level methods.
 */
export class POLITEShop {
  /** Client for `*.polite.edu.sg` APIs. */
  readonly polite: POLITE;

  #brightspaceInstance: Brightspace | null = null;

  /**
   * Initialize the underlying {@link POLITE} client. If `d2lFetchToken` is
   * provided, the {@link Brightspace} client is also initialized immediately.
   * Otherwise, it is initialized lazily via the {@link brightspace} getter.
   */
  constructor(config: {
    /** `d2lSessionVal` cookie value. */
    d2lSessionVal: string;
    /** `d2lSecureSessionVal` cookie value. */
    d2lSecureSessionVal: string;
    /** Subdomain of the POLITEMall site (e.g. `"nplms"`). */
    domain: string;
    /**
     * Brightspace JWT found in localStorage. If not provided,
     * it will be fetched automatically the first time it is needed.
     */
    d2lFetchToken?: string;
  }) {
    this.polite = new POLITE({
      d2lSessionVal: config.d2lSessionVal,
      d2lSecureSessionVal: config.d2lSecureSessionVal,
      domain: config.domain,
    });

    if (config.d2lFetchToken) {
      this.#brightspaceInstance = new Brightspace({
        d2lFetchToken: config.d2lFetchToken,
      });
    }
  }

  /**
   * Returns the initialized {@link Brightspace} client, fetching or refreshing
   * the `d2lFetchToken` automatically when needed.
   *
   * Implemented as a Promise-returning getter rather than a plain `Brightspace`
   * property because the token may be unavailable or expired at access time,
   * requiring an asynchronous network request to obtain a fresh one.
   */
  get brightspace(): Promise<Brightspace> {
    if (
      this.#brightspaceInstance !== null &&
      this.#brightspaceInstance.tokenExpiry > new Date()
    ) {
      return Promise.resolve(this.#brightspaceInstance);
    }
    return this.polite.getNewFetchToken().then(({ access_token }) => {
      this.#brightspaceInstance = new Brightspace({
        d2lFetchToken: access_token,
      });
      return this.#brightspaceInstance;
    });
  }

  // ── User & Organisation ───────────────────────────────────────────────────────

  /** Fetch the user's ID and display name. */
  async getUser(): Promise<User> {
    const data = await this.polite.whoAmI();
    return { id: data.Identifier, name: data.FirstName };
  }

  /** Fetch information about the educational institution the user is in. */
  async getInstitution(): Promise<Institution> {
    const data = await this.polite.getOrganizationInfo();
    return {
      id: data.Identifier,
      name: data.Name,
    };
  }

  /**
   * Return the URL of the institution's image. The institution's ID is needed to
   * construct the URL, so if not provided, this calls {@link getInstitution}.
   * The URL construction itself is synchronous. */
  getInstitutionImageURL(config: {
    width: number;
    height: number;
  }): Promise<string>;
  getInstitutionImageURL(config: {
    width: number;
    height: number;
    institutionId: string;
  }): string;
  getInstitutionImageURL(config: {
    width: number;
    height: number;
    institutionId?: string;
  }): Promise<string> | string {
    if (config.institutionId) {
      return this.polite.getImageURL(config.institutionId, config);
    }

    return this.getInstitution().then(({ id }) =>
      this.polite.getImageURL(id, config),
    );
  }

  // ── Modules & Semesters ───────────────────────────────────────────────────────

  /**
   * Fetch the modules the user is enrolled in.
   */
  async getModules(): Promise<Module[]> {
    const modules: Module[] = [];
    let bookmark: string | undefined;

    do {
      const page = await this.polite.getMyEnrollments({ bookmark });

      // Modules ("course offerings") are those with OrgUnit.Type.Id === 3
      modules.push(
        ...page.Items.filter((item) => item.OrgUnit.Type.Id === 3).map(
          (item) => ({
            id: item.OrgUnit.Id.toString(),
            name: item.OrgUnit.Name,
            code: item.OrgUnit.Code ?? "",
          }),
        ),
      );

      bookmark = page.PagingInfo.HasMoreItems
        ? page.PagingInfo.Bookmark
        : undefined;
    } while (bookmark !== undefined);

    return modules;
  }

  /**
   * Fetch all modules the user is enrolled in, together with the associated semesters.
   */
  async getModulesAndSemesters(): Promise<{
    modules: (Module & { semesterId: string })[];
    semesters: Semester[];
  }> {
    const modules = await this.getModules();
    const semesters = await this.#getSemestersBatched({
      moduleIds: modules.map((m) => m.id),
    });

    // Deduplicate semesters
    const semestersUnique: typeof semesters = [];
    const seenSemesters = new Set<string>();

    for (const sem of semesters) {
      if (!seenSemesters.has(sem.id)) {
        semestersUnique.push(sem);
        seenSemesters.add(sem.id);
      }
    }

    return {
      modules: modules.map((m, i) => ({
        ...m,
        semesterId: semesters[i]!.id,
      })),
      semesters: semestersUnique,
    };
  }

  /**
   * Return the associated semesters for the given modules. The semester at each
   * index corresponds to the module at the same index (i.e. `moduleIds[i]`'s
   * semester is `semesters[i]`).
   */
  async #getSemestersBatched({
    moduleIds,
  }: {
    moduleIds: string[];
  }): Promise<Semester[]> {
    // Fetch batches of parentOrgUnits in parallel
    // (they contain semester information)
    return await Promise.all(
      chunk(moduleIds, 25).map((c) => {
        const csv = c.join(",");
        return this.polite.getParentOrgUnits({ orgUnitIdsCSV: csv });
      }),
    ).then((c) =>
      c.flat().map((o) => ({
        id: o.Semester.Identifier,
        name: o.Semester.Name.trim(),
      })),
    );
  }

  // ── Module Content ────────────────────────────────────────────────────────────

  /**
   * Fetch all activity folders and activities for a module.
   *
   * Retrieves the table of contents then recursively parses every folder and
   * topic, making additional requests as needed to resolve activity details.
   */
  async getModuleContent({
    moduleId,
  }: {
    moduleId: string;
  }): Promise<ActivityFolder[]> {
    const toc = await this.polite.getModuleTOC({ moduleId });

    return Promise.all(
      toc.Modules.map((m: TOCModule) =>
        this.#parseActivityFolder({ folder: m, moduleId }),
      ),
    );
  }

  /**
   * Parse a Brightspace "Module" (what POLITEShop calls an activity folder)
   * and all of its children recursively.
   *
   * This may issue additional network requests for nested folders and topics.
   */
  async #parseActivityFolder({
    folder,
    moduleId,
  }: {
    folder: TOCModule;
    moduleId: string;
  }): Promise<ActivityFolder> {
    const folderId = folder.ModuleId.toString();

    // Parse activities and sub-folders in parallel.
    const [activities, activityFolders] = await Promise.all([
      Promise.all(
        folder.Topics.filter((t: TOCTopic) => !t.IsBroken).map((t: TOCTopic) =>
          this.#parseActivity({ activity: t, moduleId }),
        ),
      ),
      Promise.all(
        folder.Modules.map((m: TOCModule) =>
          this.#parseActivityFolder({ folder: m, moduleId }),
        ),
      ),
    ]);

    return {
      type: "folder",
      id: folderId,
      name: folder.Title,
      description: folder.Description.Html,
      sortOrder: folder.SortOrder,
      contents: [...activities, ...activityFolders].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    };
  }

  /**
   * Parse a Brightspace "Topic" (what POLITEShop calls an activity).
   *
   * This may issue additional network requests to the POLITE or Brightspace
   * APIs depending on the activity type.
   *
   * @throws if `activity.IsBroken` is `true`.
   */
  async #parseActivity({
    activity,
    moduleId,
  }: {
    activity: TOCTopic;
    moduleId: string;
  }): Promise<AnyActivity> {
    if (activity.IsBroken)
      throw new Error("parseActivity() cannot handle broken activities");

    const base = {
      id: activity.Identifier,
      sortOrder: activity.SortOrder,
    };
    const name = activity.Title;

    // ── HTML activity (ActivityType 1, File, *.html) ──────────────────────────
    if (
      activity.ActivityType === 1 &&
      activity.TypeIdentifier === "File" &&
      activity.Url.endsWith(".html")
    ) {
      const content = await this.polite.getContentHTML({
        urlOrPath: activity.Url,
      });
      return { ...base, type: "html", name, content };
    }

    // ── Document embed (ActivityType 1, File, non-HTML) ───────────────────────
    if (activity.ActivityType === 1 && activity.TypeIdentifier === "File") {
      const activityEnt = await (
        await this.brightspace
      ).getActivity({
        moduleId,
        topicId: activity.TopicId,
      });

      const fileActivityEnt = activityEnt.getChild({
        class: ["activity", "file-activity"],
      });

      const fileEnt = fileActivityEnt.getChild({ class: ["file"] });

      const previewURL = fileEnt.findLink({
        class: ["pdf", "d2l-converted-doc"],
      })?.href;
      const previewURLExpiry = previewURL
        ? getURLExpiry(previewURL)
        : undefined;

      return {
        ...base,
        type: "doc_embed",
        name,
        sourceURL: activity.Url,
        previewURL,
        previewURLExpiry,
      };
    }

    // ── Video embed (ActivityType 1, ContentService) ──────────────────────────
    if (
      activity.ActivityType === 1 &&
      activity.TypeIdentifier === "ContentService"
    ) {
      const [source, thumbnail] = await Promise.all([
        this.#getContentServiceMediaURL({
          moduleId,
          activityId: activity.Identifier,
        }),
        this.#getContentServiceThumbnailURL({
          moduleId,
          activityId: activity.Identifier,
        }),
      ]);

      return {
        ...base,
        type: "video_embed",
        name,
        sourceURL: source.url,
        sourceURLExpiry: source.urlExpiry,
        thumbnailURL: thumbnail.url,
        thumbnailURLExpiry: thumbnail.urlExpiry,
      };
    }

    // ── Web embed (ActivityType 2) ────────────────────────────────────────────
    if (activity.ActivityType === 2) {
      return { ...base, type: "web_embed", name, url: activity.Url };
    }

    // ── Submission activity (ActivityType 3) ──────────────────────────────────
    if (activity.ActivityType === 3) {
      if (!activity.ToolItemId)
        throw new Error("Missing ToolItemId in submission activity");
      return {
        ...base,
        type: "submission",
        dropboxId: activity.ToolItemId.toString(),
      };
    }

    // ── Quiz activity (ActivityType 4) ────────────────────────────────────────
    if (activity.ActivityType === 4) {
      if (!activity.ToolItemId)
        throw new Error("Missing ToolItemId in quiz activity");
      return { ...base, type: "quiz", quizId: activity.ToolItemId.toString() };
    }

    return { ...base, type: "unknown" };
  }

  // ── Dropboxes & Submissions ───────────────────────────────────────────────────

  /** Fetch all submission dropbox folders in a module. */
  async getSubmissionDropboxes({
    moduleId,
  }: {
    moduleId: string;
  }): Promise<SubmissionDropbox[]> {
    const data = await this.polite.getDropboxFolders({ moduleId });
    return data.map((d) => ({
      id: d.Id.toString(),
      name: d.Name,
      moduleId,
      description: d.CustomInstructions.Html,
      dueAt: d.DueDate,
      opensAt: d.Availability?.StartDate,
      closesAt: d.Availability?.EndDate,
    }));
  }

  /**
   * Fetch the authenticated user's submissions for a given dropbox.
   *
   * Two strategies are attempted in order:
   *
   * 1. **POLITE API** — A single request returns all submissions. This is the
   *    preferred path but returns HTTP 403 for dropboxes whose availability
   *    window has closed.
   * 2. **Brightspace Activities API** — Used as a fallback when the POLITE API
   *    fails. Requires one additional request per submission. If `organizationId`
   *    is not provided, it is fetched automatically via {@link getInstitution}.
   *
   * @param params.moduleId - The module (course offering) ID.
   * @param params.dropboxId - The dropbox folder ID.
   * @param params.organizationId - The organisation ID, used by the Brightspace
   *   Activities API path. If omitted and the fallback is needed, it is fetched
   *   automatically via {@link getInstitution}.
   */
  async getSubmissions({
    moduleId,
    dropboxId,
    organizationId,
  }: {
    moduleId: string;
    dropboxId: string;
    organizationId?: string;
  }): Promise<Submission[]> {
    // Try POLITE API first
    try {
      const data = await this.polite.getDropboxSubmissions({
        moduleId,
        dropboxId,
      });
      if (data.length === 0) return [];

      return data[0]!.Submissions.map((sub) => ({
        id: sub.Id.toString(),
        dropboxId,
        submittedAt: sub.SubmissionDate,
        comment: sub.Comment.Html,
      }));
    } catch {}

    // If POLITE API fails, try Brightspace API instead

    const bs = await this.brightspace;
    const ent = await bs.getClosedDropboxSubmissions({
      orgId: organizationId ?? (await this.getInstitution()).id,
      dropboxId,
      moduleId,
    });
    const submissionLinks = ent.getChild({
      class: ["assignment-submission-list"],
    }).links;
    if (!submissionLinks) return [];

    return Promise.all(
      submissionLinks.map(async (link) => {
        const submissionEnt = await bs.getSubmissionDetails({
          href: link.href,
        });
        return {
          id: lastPathComponent(link.href),
          dropboxId,
          ...this.#parseSubmissionDetails(submissionEnt),
        };
      }),
    );
  }

  #parseSubmissionDetails(ent: SirenEntity): {
    submittedAt: Date;
    comment?: string;
  } {
    const submittedAt = new Date(
      ent.findChild({ class: "submission-date" })?.properties?.date,
    );

    const comment = z
      .string()
      .optional()
      .parse(ent.findChild({ class: "submission-comment" })?.properties?.html);

    return {
      submittedAt,
      comment,
    };
  }

  // ── Quizzes ───────────────────────────────────────────────────────────────────

  /**
   * Fetch all quizzes in a module.
   */
  async getQuizzes({ moduleId }: { moduleId: string }): Promise<Quiz[]> {
    const quizzes: Quiz[] = [];
    let nextURL: string | null = `/d2l/api/le/1.75/${moduleId}/quizzes/`;

    do {
      const page = await this.polite.getQuizzesPage({ urlOrPath: nextURL });
      nextURL = page.Next;

      quizzes.push(
        ...page.Objects.map((d) => ({
          id: d.QuizId.toString(),
          moduleId,
          name: d.Name,
          description: d.Description.Text.Html,
          dueAt: d.DueDate,
        })),
      );
    } while (nextURL);

    return quizzes;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  /** Abort all in-flight requests on both the POLITE and Brightspace clients. */
  abort(): void {
    this.polite.abort();
    this.#brightspaceInstance?.abort();
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  async #getContentServiceThumbnailURL({
    moduleId,
    activityId,
  }: {
    moduleId: string;
    activityId: string;
  }): Promise<{ url: string; urlExpiry: Date | undefined }> {
    const ent = await (
      await this.brightspace
    ).getTopicThumbnail({
      moduleId,
      activityId,
    });

    const thumbnailProps = z
      .object({ src: z.string(), expires: z.coerce.number().optional() })
      .parse(ent.findChild({ class: ["thumbnail"] })?.properties);

    const { src: url } = thumbnailProps;
    // The Content Service exposes the expiry as a Unix timestamp in `expires`.
    const urlExpiry: Date | undefined = thumbnailProps.expires
      ? new Date(thumbnailProps.expires * 1000)
      : getURLExpiry(url);

    return { url, urlExpiry };
  }

  async #getContentServiceMediaURL({
    moduleId,
    activityId,
  }: {
    moduleId: string;
    activityId: string;
  }): Promise<{ url: string; urlExpiry: Date | undefined }> {
    const ent = await (
      await this.brightspace
    ).getTopicMedia({
      moduleId,
      activityId,
    });

    const { src: url } = z.object({ src: z.string() }).parse(ent.properties);

    return { url, urlExpiry: getURLExpiry(url) };
  }
}

// ── Module-private utilities ──────────────────────────────────────────────────
