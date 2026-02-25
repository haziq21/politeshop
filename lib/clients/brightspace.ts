import { sirenEntity, type SirenEntity } from "../schema/siren";
import { decodeJwt } from "jose";
import z from "zod";

/**
 * Client for `*.api.brightspace.com`.
 */
export class Brightspace {
  userId: string;

  /** The Brightspace tenant ID (a UUID). */
  tenantId: string;

  /** The expiration date of the current `d2lFetchToken`. */
  tokenExpiry: Date;

  #d2lFetchToken: string;
  #abortController = new AbortController();

  constructor(config: {
    /** Short-lived JWT for Brightspace API authentication. */
    d2lFetchToken: string;
  }) {
    this.#d2lFetchToken = config.d2lFetchToken;

    const { sub, exp, tenantid } = z
      .object({
        tenantid: z.string(),
        sub: z.string(),
        exp: z.date({ coerce: true }),
      })
      .parse(decodeJwt(this.#d2lFetchToken));
    this.userId = sub;
    this.tokenExpiry = exp;
    this.tenantId = tenantid;
  }

  // ── Sequences API (sequences.api.brightspace.com) ────────────────────────────

  /**
   * GET /{moduleId}/activity/{topicId}?filterOnDatesAndDepth=0
   *
   * Fetches a Siren entity representing a single activity (topic) in a module.
   * Used for document-embed activities to discover the preview PDF URL.
   */
  async getActivity({
    moduleId,
    topicId,
  }: {
    moduleId: string;
    topicId: string | number;
  }): Promise<SirenEntity> {
    return this.#fetchSiren(
      `/${moduleId}/activity/${topicId}?filterOnDatesAndDepth=0`,
      "sequences",
    );
  }

  // ── Activities API (activities.api.brightspace.com) ──────────────────────────

  /**
   * GET /old/activities/{orgId}_2000_{dropboxId}/usages/{moduleId}/users/{userId}
   *
   * Fetches submission information for a dropbox that is **closed** (past its
   * availability end date). The POLITE API returns HTTP 403 for closed
   * dropboxes, so this endpoint is used as a fallback.
   *
   * The constant `2000` in the path is the tool ID for dropbox activities.
   */
  async getClosedDropboxSubmissions({
    orgId,
    dropboxId,
    moduleId,
  }: {
    orgId: string;
    dropboxId: string;
    moduleId: string;
  }): Promise<SirenEntity> {
    return this.#fetchSiren(
      `/old/activities/${orgId}_2000_${dropboxId}/usages/${moduleId}/users/${this.userId}`,
      "activities",
    );
  }

  /**
   * Fetch a submission entity from an **absolute** Brightspace URL.
   *
   * The href values surfaced by {@link getClosedDropboxSubmissions} point to
   * the `assignments.api.brightspace.com` subdomain (or similar). Pass them
   * here directly without modification.
   */
  async getSubmissionDetails({ href }: { href: string }): Promise<SirenEntity> {
    return this.#fetchSiren(href);
  }

  // ── Content Service API (content-service.api.brightspace.com) ────────────────

  /**
   * GET /topics/{moduleId}/{activityId}
   *
   * Fetches thumbnail metadata for a ContentService topic (typically a video).
   * The returned entity contains a `thumbnail` sub-entity whose `properties.src`
   * is a time-limited thumbnail image URL.
   */
  async getTopicThumbnail({
    moduleId,
    activityId,
  }: {
    moduleId: string;
    activityId: string;
  }): Promise<SirenEntity> {
    return this.#fetchSiren(
      `/topics/${moduleId}/${activityId}`,
      "content-service",
    );
  }

  /**
   * GET /topics/{moduleId}/{activityId}/media
   *
   * Fetches media metadata for a ContentService topic (typically a video).
   * The returned entity's `properties.src` is a time-limited URL for the
   * video file itself.
   */
  async getTopicMedia({
    moduleId,
    activityId,
  }: {
    moduleId: string;
    activityId: string;
  }): Promise<SirenEntity> {
    return this.#fetchSiren(
      `/topics/${moduleId}/${activityId}/media`,
      "content-service",
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  /** Abort all in-flight requests made by this client. */
  abort(): void {
    this.#abortController.abort();
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  /**
   * Fetch and parse a Siren entity.
   *
   * When `api` is provided the URL is constructed as
   * `https://{tenantId}.{api}.api.brightspace.com{path}`.
   * When `api` is omitted `pathOrURL` must be an absolute URL
   * (e.g. a href extracted from a previously-fetched Siren entity).
   */
  async #fetchSiren(path: string, api: string): Promise<SirenEntity>;
  async #fetchSiren(absoluteURL: string): Promise<SirenEntity>;
  async #fetchSiren(pathOrURL: string, api?: string): Promise<SirenEntity> {
    const url = api
      ? new URL(
          pathOrURL,
          `https://${this.tenantId}.${api}.api.brightspace.com`,
        )
      : new URL(pathOrURL);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.#d2lFetchToken}` },
      signal: this.#abortController.signal,
    });

    if (!res.ok) {
      const body = res.headers.get("content-type")?.includes("json")
        ? JSON.stringify(await res.json())
        : await res.text();
      throw new Error(`Brightspace API error ${res.status} at ${url}: ${body}`);
    }

    return sirenEntity.parse(await res.json());
  }
}
