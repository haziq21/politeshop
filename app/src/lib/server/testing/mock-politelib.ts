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

export const SESSION_VALS = {
  valid: { d2lSessionVal: "valid-d2l-session-val", d2lSecureSessionVal: "valid-secure-d2l-session-val" },
  expired: {
    d2lSessionVal: "expired-d2l-session-val",
    d2lSecureSessionVal: "expired-secure-d2l-session-val",
  },
};

export function mockDataFor(domain: string) {
  return {
    user: { id: `${domain}-user`, name: "Test Student" } satisfies User,
    institution: { id: `${domain}-org`, name: "Test Polytechnic" } satisfies Institution,
    semester: { id: `${domain}-sem-1`, name: "AY2025/2026 Semester 2" } satisfies Semester,
    module: {
      id: `${domain}-module-1`,
      name: "Introduction to Testing",
      code: "IT101",
      semesterId: `${domain}-sem-1`,
    } satisfies Module & { semesterId: string },
  };
}

export class MockPOLITELib extends POLITELib {
  #domain: string;
  #sessionExpired: boolean;

  constructor(config: ConstructorParameters<typeof POLITELib>[0]) {
    super(config);
    this.#domain = config.domain;
    this.#sessionExpired = config.d2lSessionVal === SESSION_VALS.expired.d2lSessionVal;
  }

  override async getUser(): Promise<User> {
    if (this.#sessionExpired) throw new Error("MockPOLITELib: simulated expired session");
    return mockDataFor(this.#domain).user;
  }

  override async getInstitution(): Promise<Institution> {
    return mockDataFor(this.#domain).institution;
  }

  override getInstitutionImageURL(config: { width: number; height: number }): Promise<string>;
  override getInstitutionImageURL(config: { width: number; height: number; institutionId: string }): string;
  override getInstitutionImageURL(config: {
    width: number;
    height: number;
    institutionId?: string;
  }): Promise<string> | string {
    const url = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'/%3E";
    return config.institutionId ? url : Promise.resolve(url);
  }

  override async getModulesAndSemesters(): Promise<{
    modules: (Module & { semesterId: string })[];
    semesters: Semester[];
  }> {
    const { module, semester } = mockDataFor(this.#domain);
    return { modules: [module], semesters: [semester] };
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
}
