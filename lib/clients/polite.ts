import * as schema from "../schema/polite";
import { createFetch } from "../utils/fetch";

// TODO: /d2l/api/le/manageCourses/courses-searches/490586/BySemester

/**
 * Low-level client for the POLITE API (`*.polite.edu.sg`).
 *
 * Handles authentication via D2L session cookies and exposes one method per
 * API endpoint. All response bodies are validated with Zod schemas before
 * being returned, so callers receive fully-typed data.
 */
export class POLITE {
  #domain: string;
  #fetch: typeof fetch;

  constructor(config: {
    /** `d2lSessionVal` cookie value. */
    d2lSessionVal: string;
    /** `d2lSecureSessionVal` cookie value. */
    d2lSecureSessionVal: string;
    /** Subdomain of the POLITEMall site (e.g. `"nplms"`). */
    domain: string;
    signal?: AbortSignal;
    fetch?: typeof fetch;
  }) {
    this.#domain = config.domain;
    this.#fetch = createFetch({
      baseURL: this.baseURL,
      headers: { Cookie: `d2lSessionVal=${config.d2lSessionVal}; d2lSecureSessionVal=${config.d2lSecureSessionVal}` },
      signal: config.signal,
      fetch: config.fetch,
    });
  }

  get baseURL(): string {
    return `https://${this.#domain}.polite.edu.sg`;
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  /**
   * GET /d2l/lp/auth/oauth2/token
   *
   * Exchanges the current D2L session cookies for a short-lived Brightspace
   * JWT that can be used with the `*.api.brightspace.com` APIs.
   */
  async getNewFetchToken(): Promise<schema.BrightspaceToken> {
    // Fetch the homepage HTML to extract the XSRF token from it
    const homepage = await (await this.#fetch("/d2l/home")).text();
    const xsrfToken = homepage.match(/\.setItem\(['"]XSRF.Token['"],\s*['"](.+?)['"]\)/)?.[1];

    if (!xsrfToken) {
      throw new Error("No XSRF token found in homepage");
    }

    const res = await this.#fetch("/d2l/lp/auth/oauth2/token", {
      method: "POST",
      headers: { "X-Csrf-Token": xsrfToken },
      body: new URLSearchParams({ scope: "*:*:*" }),
    });
    return schema.brightspaceToken.parse(await res.json());
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  /**
   * GET /d2l/api/lp/1.0/users/whoami
   *
   * Returns basic information about the currently authenticated user.
   */
  async whoAmI(): Promise<schema.WhoAmIUser> {
    const res = await this.#fetch("/d2l/api/lp/1.0/users/whoami");
    return schema.whoAmIUser.parse(await res.json());
  }

  // ── Organization ────────────────────────────────────────────────────────────

  /**
   * GET /d2l/api/lp/1.46/organization/info
   *
   * Returns information about the organisation (institution).
   */
  async getOrganizationInfo(): Promise<schema.Organization> {
    const res = await this.#fetch("/d2l/api/lp/1.46/organization/info");
    return schema.organization.parse(await res.json());
  }

  // ── Enrollments ─────────────────────────────────────────────────────────────

  /**
   * GET /d2l/api/lp/1.46/enrollments/myenrollments/
   *
   * Returns one page of the authenticated user's org-unit enrollments.
   * Pass `bookmark` to fetch subsequent pages.
   */
  async getMyEnrollments({ bookmark }: { bookmark?: string } = {}): Promise<
    schema.PagedResultSet<schema.MyOrgUnitInfo>
  > {
    const query = bookmark ? `?bookmark=${encodeURIComponent(bookmark)}` : "";
    const res = await this.#fetch(`/d2l/api/lp/1.46/enrollments/myenrollments/${query}`);
    return schema.pagedResultSet(schema.myOrgUnitInfo).parse(await res.json());
  }

  /**
   * GET /d2l/api/lp/1.46/courses/parentorgunits?orgUnitIdsCSV=…
   *
   * Returns semester/department parent information for up to 25 course-offering
   * org units at a time.
   */
  async getParentOrgUnits({ orgUnitIdsCSV }: { orgUnitIdsCSV: string }): Promise<schema.CourseParent[]> {
    const res = await this.#fetch(
      `/d2l/api/lp/1.46/courses/parentorgunits?orgUnitIdsCSV=${encodeURIComponent(orgUnitIdsCSV)}`,
    );
    return schema.courseParent.array().parse(await res.json());
  }

  // ── Content ─────────────────────────────────────────────────────────────────

  /**
   * GET /d2l/api/le/1.75/{moduleId}/content/toc
   *
   * Returns the table of contents for a module, including all nested folders
   * (Modules) and topics (Activities).
   */
  async getModuleTOC({ moduleId }: { moduleId: string }): Promise<schema.TableOfContents> {
    const res = await this.#fetch(`/d2l/api/le/1.75/${moduleId}/content/toc`);
    return schema.tableOfContents.parse(await res.json());
  }

  /**
   * Fetch a content URL as raw text (used for HTML-type activities).
   *
   * `urlOrPath` may be either an absolute URL or a path relative to
   * `this.baseURL`.
   */
  async getContentHTML({ urlOrPath }: { urlOrPath: string }): Promise<string> {
    return (await this.#fetch(urlOrPath)).text();
  }

  /**
   * Return the image URL for a module or organisation.
   */
  getImageURL(id: string, dim?: { width: number; height: number }): string {
    const query = dim ? `?width=${dim.width}&height=${dim.height}` : "";
    return `${this.baseURL}/d2l/api/lp/1.46/courses/${id}/image${query}`;
  }

  // ── Dropbox / Submissions ────────────────────────────────────────────────────

  /**
   * GET /d2l/api/le/1.75/{moduleId}/dropbox/folders/
   *
   * Returns all submission dropbox folders in a module.
   */
  async getDropboxFolders({ moduleId }: { moduleId: string }): Promise<schema.DropboxFolder[]> {
    const res = await this.#fetch(`/d2l/api/le/1.75/${moduleId}/dropbox/folders/`);
    return schema.dropboxFolder.array().parse(await res.json());
  }

  /**
   * GET /d2l/api/le/1.75/{moduleId}/dropbox/folders/{dropboxId}/submissions/
   *
   * Returns the current user's submissions for a dropbox. Returns at most one
   * `EntityDropbox` object (the user's own entry).
   *
   * > **Note:** This endpoint returns HTTP 403 for dropboxes whose availability
   * > window has closed. In that case, use the Brightspace Activities API
   * > instead (`Brightspace.getClosedDropboxSubmissions`).
   */
  async getDropboxSubmissions({
    moduleId,
    dropboxId,
  }: {
    moduleId: string;
    dropboxId: string;
  }): Promise<schema.EntityDropbox[]> {
    const res = await this.#fetch(`/d2l/api/le/1.75/${moduleId}/dropbox/folders/${dropboxId}/submissions/`);
    return schema.entityDropbox
      .array()
      .max(1)
      .parse(await res.json());
  }

  // ── Quizzes ──────────────────────────────────────────────────────────────────

  /**
   * Fetch one page of quizzes from the given URL or path.
   *
   * For the first page, pass `/d2l/api/le/1.75/{moduleId}/quizzes/`.
   * The `Next` field of the returned object is the URL for the next page
   * (or `null` if there are no more pages).
   */
  async getQuizzesPage({ urlOrPath }: { urlOrPath: string }): Promise<schema.ObjectListPage<schema.QuizReadData>> {
    const res = await this.#fetch(urlOrPath);
    return schema.objectListPage(schema.quizReadData).parse(await res.json());
  }
}
