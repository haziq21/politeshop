import { decodeJwt } from "jose";
import z from "zod";

import { sirenEntity, type SirenEntity } from "../schema/siren";
import { createFetch } from "../utils/fetch";

/** Fetches a path or URL from one Brightspace API, and returns the Siren entity it responds with. */
type SirenFetch = (url: string) => Promise<SirenEntity>;

/**
 * Client for `*.api.brightspace.com`.
 */
export class Brightspace {
  userId: string;

  /** The Brightspace tenant ID (a UUID). */
  tenantId: string;

  /** The expiration date of the current `d2lFetchToken`. */
  tokenExpiry: Temporal.Instant;

  #sequences: SirenFetch;
  #activities: SirenFetch;
  #contentService: SirenFetch;
  #assignments: SirenFetch;

  constructor(config: {
    /** Short-lived JWT for Brightspace API authentication. */
    d2lFetchToken: string;
    signal?: AbortSignal;
    fetch?: typeof fetch;
  }) {
    // The token is unverified and both claims end up in request URLs, so only accept values that can't change the host or path
    const { sub, exp, tenantid } = z
      .object({
        tenantid: z.string().uuid(),
        sub: z.string().regex(/^\d+$/),
        exp: z.number().transform((seconds) => Temporal.Instant.fromEpochMilliseconds(seconds * 1000)),
      })
      .parse(decodeJwt(config.d2lFetchToken));
    this.userId = sub;
    this.tokenExpiry = exp;
    this.tenantId = tenantid;

    const sirenFetch = (api: string): SirenFetch => {
      const apiFetch = createFetch({
        baseURL: `https://${tenantid}.${api}.api.brightspace.com`,
        headers: { Authorization: `Bearer ${config.d2lFetchToken}` },
        signal: config.signal,
        fetch: config.fetch,
      });
      return async (url) => sirenEntity.parse(await (await apiFetch(url)).json());
    };
    this.#sequences = sirenFetch("sequences");
    this.#activities = sirenFetch("activities");
    this.#contentService = sirenFetch("content-service");
    this.#assignments = sirenFetch("assignments");
  }

  // ── Sequences API (sequences.api.brightspace.com) ────────────────────────────

  /**
   * GET /{moduleId}/activity/{topicId}?filterOnDatesAndDepth=0
   *
   * Fetches a Siren entity representing a single activity (topic) in a module.
   * Used for document-embed activities to discover the preview PDF URL.
   */
  async getActivity({ moduleId, topicId }: { moduleId: string; topicId: string | number }): Promise<SirenEntity> {
    return this.#sequences(`/${moduleId}/activity/${topicId}?filterOnDatesAndDepth=0`);
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
    return this.#activities(`/old/activities/${orgId}_2000_${dropboxId}/usages/${moduleId}/users/${this.userId}`);
  }

  /**
   * Fetch a submission entity from an **absolute** Brightspace URL.
   *
   * The href values surfaced by {@link getClosedDropboxSubmissions} point to
   * the tenant's `assignments.api.brightspace.com` host. Pass them here
   * directly without modification.
   */
  async getSubmissionDetails({ href }: { href: string }): Promise<SirenEntity> {
    return this.#assignments(href);
  }

  // ── Content Service API (content-service.api.brightspace.com) ────────────────

  /**
   * GET /topics/{moduleId}/{activityId}
   *
   * Fetches thumbnail metadata for a ContentService topic (typically a video).
   * The returned entity contains a `thumbnail` sub-entity whose `properties.src`
   * is a time-limited thumbnail image URL.
   */
  async getTopicThumbnail({ moduleId, activityId }: { moduleId: string; activityId: string }): Promise<SirenEntity> {
    return this.#contentService(`/topics/${moduleId}/${activityId}`);
  }

  /**
   * GET /topics/{moduleId}/{activityId}/media
   *
   * Fetches media metadata for a ContentService topic (typically a video).
   * The returned entity's `properties.src` is a time-limited URL for the
   * video file itself.
   */
  async getTopicMedia({ moduleId, activityId }: { moduleId: string; activityId: string }): Promise<SirenEntity> {
    return this.#contentService(`/topics/${moduleId}/${activityId}/media`);
  }
}
