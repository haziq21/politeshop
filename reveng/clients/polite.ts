import { z } from "zod";
import * as schema from "../schema/polite";
import { defaultToBaseURL } from "../utils/url";
import { UnexpectedResponseError } from "../errors";

// TODO: /d2l/api/le/manageCourses/courses-searches/490586/BySemester

/**
 * Low-level client for the POLITE API (`*.polite.edu.sg`).
 *
 * Handles authentication via D2L session cookies and exposes one method per
 * API endpoint. All response bodies are validated with Zod schemas before
 * being returned, so callers receive fully-typed data.
 */
export class POLITE {
  #d2lSessionVal: string;
  #d2lSecureSessionVal: string;
  #domain: string;
  #abortController = new AbortController();

  constructor(config: {
    /** `d2lSessionVal` cookie value. */
    d2lSessionVal: string;
    /** `d2lSecureSessionVal` cookie value. */
    d2lSecureSessionVal: string;
    /** Subdomain of the POLITEMall site (e.g. `"nplms"`). */
    domain: string;
  }) {
    this.#domain = config.domain;
    this.#d2lSessionVal = config.d2lSessionVal;
    this.#d2lSecureSessionVal = config.d2lSecureSessionVal;
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
    const homepage = await this.#fetchText("/d2l/home");
    const xsrfToken = homepage.match(
      /\.setItem\(['"]XSRF.Token['"],\s*['"](.+?)['"]\)/,
    )?.[1];

    if (!xsrfToken) {
      throw new UnexpectedResponseError("No XSRF token found in homepage");
    }

    return this.#fetchJSON("/d2l/lp/auth/oauth2/token", {
      method: "POST",
      headers: { "X-Csrf-Token": xsrfToken },
      body: new URLSearchParams({ scope: "*:*:*" }),
      schema: schema.brightspaceToken,
    });
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  /**
   * GET /d2l/api/lp/1.0/users/whoami
   *
   * Returns basic information about the currently authenticated user.
   */
  async whoAmI(): Promise<schema.WhoAmIUser> {
    return this.#fetchJSON("/d2l/api/lp/1.0/users/whoami", {
      schema: schema.whoAmIUser,
    });
  }

  // ── Organization ────────────────────────────────────────────────────────────

  /**
   * GET /d2l/api/lp/1.46/organization/info
   *
   * Returns information about the organisation (institution).
   */
  async getOrganizationInfo(): Promise<schema.Organization> {
    return this.#fetchJSON("/d2l/api/lp/1.46/organization/info", {
      schema: schema.organization,
    });
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
    return this.#fetchJSON(
      `/d2l/api/lp/1.46/enrollments/myenrollments/${query}`,
      { schema: schema.pagedResultSet(schema.myOrgUnitInfo) },
    );
  }

  /**
   * GET /d2l/api/lp/1.46/courses/parentorgunits?orgUnitIdsCSV=…
   *
   * Returns semester/department parent information for up to 25 course-offering
   * org units at a time.
   */
  async getParentOrgUnits({
    orgUnitIdsCSV,
  }: {
    orgUnitIdsCSV: string;
  }): Promise<schema.CourseParent[]> {
    return this.#fetchJSON(
      `/d2l/api/lp/1.46/courses/parentorgunits?orgUnitIdsCSV=${encodeURIComponent(orgUnitIdsCSV)}`,
      { schema: schema.courseParent.array() },
    );
  }

  // ── Content ─────────────────────────────────────────────────────────────────

  /**
   * GET /d2l/api/le/1.75/{moduleId}/content/toc
   *
   * Returns the table of contents for a module, including all nested folders
   * (Modules) and topics (Activities).
   */
  async getModuleTOC({
    moduleId,
  }: {
    moduleId: string;
  }): Promise<schema.TableOfContents> {
    return this.#fetchJSON(`/d2l/api/le/1.75/${moduleId}/content/toc`, {
      schema: schema.tableOfContents,
    });
  }

  /**
   * Fetch a content URL as raw text (used for HTML-type activities).
   *
   * `urlOrPath` may be either an absolute URL or a path relative to
   * `this.baseURL`.
   */
  async getContentHTML({ urlOrPath }: { urlOrPath: string }): Promise<string> {
    return this.#fetchText(urlOrPath);
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
  async getDropboxFolders({
    moduleId,
  }: {
    moduleId: string;
  }): Promise<schema.DropboxFolder[]> {
    return this.#fetchJSON(`/d2l/api/le/1.75/${moduleId}/dropbox/folders/`, {
      schema: schema.dropboxFolder.array(),
    });
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
    return this.#fetchJSON(
      `/d2l/api/le/1.75/${moduleId}/dropbox/folders/${dropboxId}/submissions/`,
      { schema: schema.entityDropbox.array().max(1) },
    );
  }

  // ── Quizzes ──────────────────────────────────────────────────────────────────

  /**
   * Fetch one page of quizzes from the given URL or path.
   *
   * For the first page, pass `/d2l/api/le/1.75/{moduleId}/quizzes/`.
   * The `Next` field of the returned object is the URL for the next page
   * (or `null` if there are no more pages).
   */
  async getQuizzesPage({
    urlOrPath,
  }: {
    urlOrPath: string;
  }): Promise<schema.ObjectListPage<schema.QuizReadData>> {
    return this.#fetchJSON(urlOrPath, {
      schema: schema.objectListPage(schema.quizReadData),
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /** Abort all in-flight requests made by this client. */
  abort(): void {
    this.#abortController.abort();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  async #fetchJSON<T extends z.ZodTypeAny>(
    input: string | URL,
    init: RequestInit & { schema: T },
  ): Promise<z.infer<T>>;
  async #fetchJSON<T extends z.ZodTypeAny>(
    input: string | URL,
    init?: RequestInit,
  ): Promise<any>;
  async #fetchJSON<T extends z.ZodTypeAny>(
    input: string | URL,
    init?: RequestInit & { schema?: T },
  ): Promise<any> {
    const res = await this.#fetch(input, init);

    if (!res.ok) {
      throw new UnexpectedResponseError(
        `Received ${res.status} for ${defaultToBaseURL(input, this.baseURL)}`,
        { response: res },
      );
    }

    const data = await res.json();
    if (init?.schema) {
      return init.schema.parse(data);
    }
    return data;
  }

  async #fetchText(urlOrPath: string): Promise<string> {
    const res = await this.#fetch(urlOrPath);
    if (!res.ok) {
      throw new Error(`POLITE API error ${res.status} at ${urlOrPath}`);
    }
    return res.text();
  }

  /**
   * {@link fetch} wrapper that:
   * - Defaults to {@link baseURL} as the base URL.
   * - Adds authentication cookies.
   */
  async #fetch(input: string | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set(
      "Cookie",
      `d2lSessionVal=${this.#d2lSessionVal}; d2lSecureSessionVal=${this.#d2lSecureSessionVal}`,
    );

    return fetch(defaultToBaseURL(input, this.baseURL), {
      ...init,
      headers,
      signal: this.#abortController.signal,
    });
  }
}
