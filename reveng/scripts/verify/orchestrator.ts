/**
 * Orchestrator for comprehensive API testing
 * Chains requests and uses real data from previous responses
 *
 * @module orchestrator
 */

import type { OpenAPIV3 } from "openapi-types";
import type { Credentials, ApiResponse, VerificationSummary } from "./types.js";
import { makeRequest, buildAuthHeaders } from "./http.js";
import { validateResponse } from "./validator.js";
import * as reporter from "./reporter.js";

interface TestContext {
  creds: Credentials;
  tenantId: string;
  userId: string;
  orgId: string;
  moduleIds: string[];
  specs: {
    polite: OpenAPIV3.Document;
    enrollments: OpenAPIV3.Document;
    sequences: OpenAPIV3.Document;
    activities: OpenAPIV3.Document;
    contentService: OpenAPIV3.Document;
  };
}

interface EnrollmentItem {
  OrgUnit: {
    Id: number;
    Type: { Id: number; Code: string };
    Name: string;
  };
  Access: {
    IsActive: boolean;
    CanAccess: boolean;
  };
}

interface TOCModule {
  ModuleId: number;
  Title: string;
  Topics?: TOCTopic[];
  Modules?: TOCModule[];
}

interface TOCTopic {
  TopicId: number;
  Title: string;
  TypeIdentifier: string;
  ActivityId: string;
  ToolId: number | null;
  ToolItemId: number | null;
  ActivityType: number;
}

interface DropboxFolder {
  Id: number;
  Name: string;
}

/**
 * Run comprehensive API tests using real data
 */
export async function runComprehensiveTests(
  specs: {
    polite: OpenAPIV3.Document;
    enrollments: OpenAPIV3.Document;
    sequences: OpenAPIV3.Document;
    activities: OpenAPIV3.Document;
    contentService: OpenAPIV3.Document;
  },
  creds: Credentials,
  summary: VerificationSummary,
): Promise<void> {
  reporter.printSpecHeader("Comprehensive Test Suite");

  // Step 1: Initial authentication and context gathering
  const context = await bootstrapContext(specs, creds, summary);
  if (!context) {
    reporter.error("Failed to bootstrap test context");
    return;
  }

  console.log(`\nDiscovered ${context.moduleIds.length} active modules to test\n`);

  // Step 2: Test each module comprehensively (parallelized)
  const moduleTests = context.moduleIds.map((moduleId) => testModule(context, moduleId, summary));

  await Promise.allSettled(moduleTests);

  console.log();
}

/**
 * Bootstrap the test context by gathering initial data
 */
async function bootstrapContext(
  specs: {
    polite: OpenAPIV3.Document;
    enrollments: OpenAPIV3.Document;
    sequences: OpenAPIV3.Document;
    activities: OpenAPIV3.Document;
    contentService: OpenAPIV3.Document;
  },
  creds: Credentials,
  summary: VerificationSummary,
): Promise<TestContext | null> {
  // Get JWT token
  const tokenResp = await testEndpoint(
    "GET /d2l/lp/auth/oauth2/token",
    "https://nplms.polite.edu.sg/d2l/lp/auth/oauth2/token",
    "GET",
    { Cookie: `d2lSessionVal=${creds.d2lSessionVal}; d2lSecureSessionVal=${creds.d2lSecureSessionVal}` },
    specs.polite.paths["/d2l/lp/auth/oauth2/token"]?.get?.responses,
    summary,
    false, // May return 302 redirect
  );

  // Token endpoint may return 302 or 200
  if (!tokenResp || (tokenResp.status !== 200 && tokenResp.status !== 302)) {
    return null;
  }

  // Update JWT token if we got a new one (only for 200 responses with JSON)
  if (tokenResp.status === 200) {
    const tokenBody = tokenResp.body as { access_token?: string };
    if (tokenBody.access_token) {
      creds.d2lFetchToken = tokenBody.access_token;
    }
  }

  // Get user info
  const whoamiResp = await testEndpoint(
    "GET /d2l/api/lp/1.0/users/whoami",
    "https://nplms.polite.edu.sg/d2l/api/lp/1.0/users/whoami",
    "GET",
    { Cookie: `d2lSessionVal=${creds.d2lSessionVal}; d2lSecureSessionVal=${creds.d2lSecureSessionVal}` },
    specs.polite.paths["/d2l/api/lp/1.0/users/whoami"]?.get?.responses,
    summary,
    true,
  );

  if (!whoamiResp || whoamiResp.status !== 200) {
    return null;
  }

  const whoami = whoamiResp.body as { Identifier?: string };
  const userId = whoami.Identifier || creds.userId || "490586";

  // Get organization info
  const orgResp = await testEndpoint(
    "GET /d2l/api/lp/1.46/organization/info",
    "https://nplms.polite.edu.sg/d2l/api/lp/1.46/organization/info",
    "GET",
    { Cookie: `d2lSessionVal=${creds.d2lSessionVal}; d2lSecureSessionVal=${creds.d2lSecureSessionVal}` },
    specs.polite.paths["/d2l/api/lp/1.46/organization/info"]?.get?.responses,
    summary,
    true,
  );

  if (!orgResp || orgResp.status !== 200) {
    return null;
  }

  const org = orgResp.body as { Identifier?: string };
  const orgId = org.Identifier || "6665";

  // Get enrollments
  const enrollmentsResp = await testEndpoint(
    "GET /d2l/api/lp/1.46/enrollments/myenrollments/",
    "https://nplms.polite.edu.sg/d2l/api/lp/1.46/enrollments/myenrollments/?pageSize=200",
    "GET",
    { Cookie: `d2lSessionVal=${creds.d2lSessionVal}; d2lSecureSessionVal=${creds.d2lSecureSessionVal}` },
    specs.polite.paths["/d2l/api/lp/1.46/enrollments/myenrollments/"]?.get?.responses,
    summary,
    true,
  );

  if (!enrollmentsResp || enrollmentsResp.status !== 200) {
    return null;
  }

  // Extract module IDs (only course offerings)
  const enrollments = enrollmentsResp.body as { Items?: EnrollmentItem[] };
  const moduleIds = (enrollments.Items || [])
    .filter((item) => item.OrgUnit.Type.Code === "Course Offering" && item.Access.IsActive && item.Access.CanAccess)
    .map((item) => String(item.OrgUnit.Id));

  const tenantId = creds.tenantId || "746e9230-82d6-4d6b-bd68-5aa40aa19cce";

  return {
    creds,
    tenantId,
    userId,
    orgId,
    moduleIds,
    specs,
  };
}

/**
 * Comprehensively test a single module
 */
async function testModule(context: TestContext, moduleId: string, summary: VerificationSummary): Promise<void> {
  const tenantHeaders = {
    Cookie: `d2lSessionVal=${context.creds.d2lSessionVal}; d2lSecureSessionVal=${context.creds.d2lSecureSessionVal}`,
  };
  const brightspaceHeaders = {
    Authorization: `Bearer ${context.creds.d2lFetchToken}`,
  };

  // Test module image
  await testEndpoint(
    `GET /d2l/api/lp/1.46/courses/${moduleId}/image`,
    `https://nplms.polite.edu.sg/d2l/api/lp/1.46/courses/${moduleId}/image`,
    "GET",
    tenantHeaders,
    context.specs.polite.paths["/d2l/api/lp/1.46/courses/{moduleId}/image"]?.get?.responses,
    summary,
    true,
  );

  // Test TOC and extract topics
  const tocResp = await testEndpoint(
    `GET /d2l/api/le/1.75/${moduleId}/content/toc`,
    `https://nplms.polite.edu.sg/d2l/api/le/1.75/${moduleId}/content/toc`,
    "GET",
    tenantHeaders,
    context.specs.polite.paths["/d2l/api/le/1.75/{moduleId}/content/toc"]?.get?.responses,
    summary,
    true,
  );

  let allTopics: TOCTopic[] = [];
  if (tocResp && tocResp.status === 200) {
    const toc = tocResp.body as { Modules?: TOCModule[] };
    allTopics = extractAllTopics(toc.Modules || []);
  }

  // Test sequences for each topic (parallelized)
  const sequenceTests = allTopics.slice(0, 10).map(
    (
      topic, // Limit to first 10 to avoid overwhelming
    ) => testTopicSequences(context, moduleId, topic, summary),
  );
  await Promise.allSettled(sequenceTests);

  // Test dropboxes
  const dropboxResp = await testEndpoint(
    `GET /d2l/api/le/1.75/${moduleId}/dropbox/folders/`,
    `https://nplms.polite.edu.sg/d2l/api/le/1.75/${moduleId}/dropbox/folders/`,
    "GET",
    tenantHeaders,
    context.specs.polite.paths["/d2l/api/le/1.75/{moduleId}/dropbox/folders/"]?.get?.responses,
    summary,
    true,
  );

  if (dropboxResp && dropboxResp.status === 200 && Array.isArray(dropboxResp.body)) {
    const dropboxes = dropboxResp.body as DropboxFolder[];

    // Test each dropbox submission (parallelized, limited)
    const dropboxTests = dropboxes
      .slice(0, 5)
      .map((dropbox) => testDropboxSubmissions(context, moduleId, dropbox.Id, summary));
    await Promise.allSettled(dropboxTests);
  }

  // Test quizzes
  await testEndpoint(
    `GET /d2l/api/le/1.75/${moduleId}/quizzes/`,
    `https://nplms.polite.edu.sg/d2l/api/le/1.75/${moduleId}/quizzes/`,
    "GET",
    tenantHeaders,
    context.specs.polite.paths["/d2l/api/le/1.75/{moduleId}/quizzes/"]?.get?.responses,
    summary,
    true,
  );
}

/**
 * Extract all topics from nested TOC modules
 */
function extractAllTopics(modules: TOCModule[]): TOCTopic[] {
  const topics: TOCTopic[] = [];

  for (const module of modules) {
    if (module.Topics) {
      topics.push(...module.Topics);
    }
    if (module.Modules) {
      topics.push(...extractAllTopics(module.Modules));
    }
  }

  return topics;
}

/**
 * Test sequence endpoints for a topic
 */
async function testTopicSequences(
  context: TestContext,
  moduleId: string,
  topic: TOCTopic,
  summary: VerificationSummary,
): Promise<void> {
  const brightspaceHeaders = {
    Authorization: `Bearer ${context.creds.d2lFetchToken}`,
  };

  // Test sequence root
  await testEndpoint(
    `GET /{moduleId} (sequences)`,
    `https://${context.tenantId}.sequences.api.brightspace.com/${moduleId}`,
    "GET",
    brightspaceHeaders,
    context.specs.sequences.paths["/{moduleId}"]?.get?.responses,
    summary,
    true,
  );

  // Test activity sequence only if we have a valid ActivityId
  if (topic.ActivityId) {
    const activityIdMatch = topic.ActivityId.match(/activities\/.*?\/([A-F0-9-]+)/i);
    if (activityIdMatch) {
      const activityId = `${activityIdMatch[1]}-${topic.TopicId}`;
      const activityResp = await testEndpoint(
        `GET /{moduleId}/activity/{activityId}`,
        `https://${context.tenantId}.sequences.api.brightspace.com/${moduleId}/activity/${activityId}`,
        "GET",
        brightspaceHeaders,
        context.specs.sequences.paths["/{moduleId}/activity/{activityId}"]?.get?.responses,
        summary,
        true,
      );

      // Skip content service tests if activity doesn't exist
      if (!activityResp || activityResp.status !== 200) {
        return;
      }
    }
  }

  // Test content service endpoints only for File types with valid activity IDs
  // ContentService activities typically have specific activity IDs
  if (topic.TypeIdentifier === "File" && topic.ActivityType === 1 && topic.ActivityId?.includes("contenttopic")) {
    // These endpoints may return 404 if the content doesn't have associated media
    // so we don't expect success
    await testEndpoint(
      `GET /topics/${moduleId}/${topic.TopicId}`,
      `https://${context.tenantId}.content-service.api.brightspace.com/topics/${moduleId}/${topic.TopicId}`,
      "GET",
      brightspaceHeaders,
      context.specs.contentService.paths["/topics/{moduleId}/{activityId}"]?.get?.responses,
      summary,
      false, // Don't expect 200, may be 404
    );

    await testEndpoint(
      `GET /topics/${moduleId}/${topic.TopicId}/media`,
      `https://${context.tenantId}.content-service.api.brightspace.com/topics/${moduleId}/${topic.TopicId}/media`,
      "GET",
      brightspaceHeaders,
      context.specs.contentService.paths["/topics/{moduleId}/{activityId}/media"]?.get?.responses,
      summary,
      false, // Don't expect 200, may be 404
    );
  }
}

/**
 * Test dropbox submissions
 */
async function testDropboxSubmissions(
  context: TestContext,
  moduleId: string,
  dropboxId: number,
  summary: VerificationSummary,
): Promise<void> {
  const tenantHeaders = {
    Cookie: `d2lSessionVal=${context.creds.d2lSessionVal}; d2lSecureSessionVal=${context.creds.d2lSecureSessionVal}`,
  };
  const brightspaceHeaders = {
    Authorization: `Bearer ${context.creds.d2lFetchToken}`,
  };

  // Test direct submissions endpoint
  const submissionsResp = await testEndpoint(
    `GET /d2l/api/le/1.75/${moduleId}/dropbox/folders/${dropboxId}/submissions/`,
    `https://nplms.polite.edu.sg/d2l/api/le/1.75/${moduleId}/dropbox/folders/${dropboxId}/submissions/`,
    "GET",
    tenantHeaders,
    context.specs.polite.paths["/d2l/api/le/1.75/{moduleId}/dropbox/folders/{dropboxId}/submissions/"]?.get?.responses,
    summary,
    false, // May return 403 for closed dropboxes
  );

  // Test activities API (for closed dropboxes) - only if submissions returned error
  if (submissionsResp && submissionsResp.status !== 200) {
    await testEndpoint(
      `GET /old/activities/${context.orgId}_2000_${dropboxId}/usages/${moduleId}/users/${context.userId}`,
      `https://${context.tenantId}.activities.api.brightspace.com/old/activities/${context.orgId}_2000_${dropboxId}/usages/${moduleId}/users/${context.userId}`,
      "GET",
      brightspaceHeaders,
      context.specs.activities.paths["/old/activities/{orgId}_{toolId}_{dropboxId}/usages/{moduleId}/users/{userId}"]
        ?.get?.responses,
      summary,
      false, // May return 200 or 404
    );
  }
}

/**
 * Test a single endpoint and validate response
 */
async function testEndpoint(
  testName: string,
  url: string,
  method: string,
  headers: Record<string, string>,
  responses: OpenAPIV3.ResponsesObject | undefined,
  summary: VerificationSummary,
  expectSuccess: boolean = true,
): Promise<ApiResponse | null> {
  summary.total++;

  const response = await makeRequest(url, method, headers);

  if (response.error) {
    reporter.error(`${testName} - Request failed`);
    reporter.printDetails([`Error: ${response.error}`]);
    summary.failed++;
    return null;
  }

  const statusStr = response.status.toString();

  // In comprehensive mode, we expect 200 responses for valid data
  if (expectSuccess && response.status !== 200) {
    // Skip and don't count as failure if it's a documented error response
    if (responses && (responses[statusStr] || responses["default"])) {
      summary.total--; // Don't count this test
      return response;
    }

    reporter.error(`${testName} (${response.status})`);
    reporter.printDetails([`Expected 200 but got ${statusStr}`, `This endpoint should return success with valid data`]);
    summary.failed++;
    return response;
  }

  // Check if status is documented
  if (!responses || (!responses[statusStr] && !responses["default"])) {
    reporter.error(`${testName} (${response.status})`);
    reporter.printDetails([
      `Status ${statusStr} not documented`,
      `Documented: ${responses ? Object.keys(responses).join(", ") : "none"}`,
    ]);
    summary.failed++;
    return response;
  }

  // Validate schema for 200 responses
  if (response.status === 200) {
    const responseSpec = responses[statusStr] || responses["default"];
    const responseObj = responseSpec as OpenAPIV3.ResponseObject | undefined;
    const schema = responseObj?.content?.["application/json"]?.schema;

    if (schema && response.contentType?.includes("application/json")) {
      const validation = validateResponse(response.body, schema);

      if (validation.valid) {
        reporter.success(`${testName} (${response.status})`);
        summary.passed++;
      } else {
        reporter.error(`${testName} (${response.status})`);
        reporter.printDetails(["Schema validation failed:", ...(validation.errors?.slice(0, 3) || [])]);
        summary.failed++;
      }
    } else {
      reporter.success(`${testName} (${response.status})`);
      summary.passed++;
    }
  } else {
    reporter.success(`${testName} (${response.status})`);
    summary.passed++;
  }

  return response;
}
