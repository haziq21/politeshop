import type { Result } from "../types";
import { brightspaceJWTBody, whoamiRes, sirenEntity, type SirenEntity } from "./schema";
import { school } from "../db";
import * as jose from "jose";

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
    if (!res.ok)
      return {
        data: null,
        error: { msg: "Failed to fetch whoami", data: await res.text() },
      };

    const parseRes = whoamiRes.safeParse(await res.json());
    if (!parseRes.success)
      return {
        data: null,
        error: { msg: "Unexpected whoami response from POLITEMall API", data: parseRes.error.issues },
      };

    return { data: { id: parseRes.data.Identifier, name: parseRes.data.FirstName }, error: null };
  }

  /** Get the user's school from the Brightspace API. */
  async fetchSchool(): Promise<Result<typeof school.$inferInsert>> {
    const { data: enrollmentData, error: enrollmentError } = await this.#fetchBrightspaceEntity(
      "enrollments",
      `/users/${this.userId}`
    );
    if (enrollmentError) return { data: null, error: enrollmentError };

    // Find the link to the organization entity
    const orgLink = enrollmentData.links?.find((l) => l.rel.includes("https://api.brightspace.com/rels/organization"));
    if (!orgLink) return { data: null, error: { msg: "Missing organization link in user entity" } };

    // Fetch the organization entity (this describes the school)
    const { data: orgData, error: orgError } = await this.#fetchBrightspaceEntity(orgLink.href);
    if (orgError) return { data: null, error: orgError };

    const parseRes = this.parseSchool(orgData);
    if (parseRes.error) return { data: null, error: parseRes.error };

    return { data: parseRes.data, error: null };
  }

  /** Parse an organization entity into a school. */
  parseSchool(ent: SirenEntity): Result<typeof school.$inferInsert> {
    // TODO: Maybe use Zod for this
    const name = ent.properties?.name;
    if (typeof name !== "string")
      return { data: null, error: { msg: `Unexpected type for school name: ${typeof name}`, data: name } };

    // Find the self link to extract the school ID from
    const selfLink = ent.links?.find((l) => l.rel.includes("self"));
    if (!selfLink) return { data: null, error: { msg: "Missing self link in school entity" } };

    // This won't be undefined because URL.pathname contains at least one "/"
    const id = new URL(selfLink.href).pathname.split("/").at(-1)!;

    return { data: { id, name }, error: null };
  }

  /** Fetch a Siren entity from the specified Brightspace API. */
  #fetchBrightspaceEntity(apiSubdomain: string, path: string): Promise<Result<SirenEntity>>;
  /** Fetch a Siren entity from the specified Brightspace URL. */
  #fetchBrightspaceEntity(url: string): Promise<Result<SirenEntity>>;
  async #fetchBrightspaceEntity(subdomainOrFullUrl: string, path?: string): Promise<Result<SirenEntity>> {
    let url = path ? `https://${this.tenantId}.${subdomainOrFullUrl}.api.brightspace.com${path}` : subdomainOrFullUrl;
    const res = await fetch(url, {
      headers: this.apiRequestHeaders,
    });

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
