import type {
  ActivityFolder,
  Institution,
  Module,
  Quiz,
  Semester,
  Submission,
  SubmissionDropbox,
  User,
} from "@politeshop/lib";

import { POLITELib } from "@politeshop/lib";

/**
 * Using this subdomain with {@link MockPOLITELib} simulates an expired
 * POLITEMall session: {@link MockPOLITELib.getUser} throws, which is what a
 * real `POLITELib` does when the session cookies are no longer valid.
 */
export const MOCK_EXPIRED_SESSION_SUBDOMAIN = "e2e-expired";

/**
 * Fixture data returned by a {@link MockPOLITELib} constructed with a given
 * `domain`. Every ID is namespaced by the domain so that e2e tests running
 * with different subdomains never collide in the database.
 */
function fixtureFor(domain: string) {
  return {
    user: { id: `${domain}-user`, name: "Test Student" } satisfies User,
    institution: { id: `${domain}-org`, name: "POLITEShop E2E Institute" } satisfies Institution,
    semester: { id: `${domain}-sem-1`, name: "AY2025/2026 Semester 2" } satisfies Semester,
    module: { id: `${domain}-module-1`, name: "Introduction to Testing", code: "IT101" } satisfies Module,
  };
}

/**
 * Stand-in for {@link POLITELib} used in e2e tests (enabled by setting
 * `MOCK_POLITELIB=1`, see `hooks.server.ts`). Real `POLITELib` talks to
 * POLITEMall / Brightspace over the network, which e2e tests can't do
 * without a real student's session credentials, so this returns fixture
 * data instead.
 *
 * Fixture content is deterministic and derived only from `domain` (the
 * site subdomain), so parallel test runs stay isolated from each other in
 * the database as long as they use distinct subdomains.
 */
export class MockPOLITELib extends POLITELib {
  #domain: string;

  constructor(config: { d2lSessionVal: string; d2lSecureSessionVal: string; domain: string; d2lFetchToken?: string }) {
    super(config);
    this.#domain = config.domain;
  }

  override async getUser(): Promise<User> {
    if (this.#domain === MOCK_EXPIRED_SESSION_SUBDOMAIN) {
      throw new Error("MockPOLITELib: simulated expired session");
    }
    return fixtureFor(this.#domain).user;
  }

  override async getInstitution(): Promise<Institution> {
    return fixtureFor(this.#domain).institution;
  }

  override getInstitutionImageURL(config: { width: number; height: number }): Promise<string>;
  override getInstitutionImageURL(config: { width: number; height: number; institutionId: string }): string;
  override getInstitutionImageURL(config: {
    width: number;
    height: number;
    institutionId?: string;
  }): Promise<string> | string {
    const url = "https://placehold.co/60x60";
    return config.institutionId ? url : Promise.resolve(url);
  }

  override async getModulesAndSemesters(): Promise<{
    modules: (Module & { semesterId: string })[];
    semesters: Semester[];
  }> {
    const { module, semester } = fixtureFor(this.#domain);
    return {
      modules: [{ ...module, semesterId: semester.id }],
      semesters: [semester],
    };
  }

  override async getModuleContent(): Promise<ActivityFolder[]> {
    return [];
  }

  override async getQuizzes(): Promise<Quiz[]> {
    return [];
  }

  override async getSubmissionDropboxes(): Promise<SubmissionDropbox[]> {
    return [];
  }

  override async getSubmissions(): Promise<Submission[]> {
    return [];
  }

  override abort(): void {}
}
