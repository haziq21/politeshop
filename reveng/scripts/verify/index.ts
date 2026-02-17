#!/usr/bin/env node
/**
 * OpenAPI Spec Verifier
 *
 * Validates that the documented OpenAPI specs match the real API responses.
 * Makes actual HTTP requests and checks responses against schemas.
 *
 * @module index
 */

import { Command } from "commander";
import type { OpenAPIV3 } from "openapi-types";
import type { CliOptions, Credentials, Operation, Spec, VerificationSummary } from "./types.js";
import { loadCredentials } from "./credentials.js";
import { findSpecs, parseSpec } from "./specs.js";
import { makeRequest, buildAuthHeaders } from "./http.js";
import { validateResponse } from "./validator.js";
import { generateParameters, substitutePathParams, buildQueryString, buildUrl, extractOperations } from "./utils.js";
import * as reporter from "./reporter.js";
import { runComprehensiveTests } from "./orchestrator.js";

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name("verify")
    .description("Verify OpenAPI specs against live API responses")
    .version("1.0.0")
    .option(
      "-s, --spec <name>",
      "verify only specific spec (polite, enrollments, sequences, activities, content-service)",
    )
    .option("-e, --endpoint <path>", "verify only endpoints matching path pattern (e.g., /users)")
    .option("-v, --verbose", "show full response bodies on failure")
    .option("-d, --dry-run", "show what would be tested without making requests")
    .option("-c, --comprehensive", "run comprehensive tests using real data from API (tests all modules, topics, etc.)")
    .parse();

  return program;
}

/**
 * Parse CLI options from commander program
 *
 * @param program - Configured commander program
 * @returns Parsed CLI options
 */
function parseOptions(program: Command): CliOptions {
  const opts = program.opts();

  return {
    spec: opts.spec,
    endpoint: opts.endpoint,
    verbose: opts.verbose || false,
    dryRun: opts.dryRun || false,
    comprehensive: opts.comprehensive || false,
  };
}

/**
 * Main verification function
 * Coordinates loading specs, making requests, and validating responses
 *
 * @param options - CLI options
 */
async function runVerification(options: CliOptions): Promise<void> {
  reporter.printTitle();

  // Load credentials (skip for dry-run)
  let creds: Credentials | undefined;
  if (!options.dryRun) {
    creds = loadCredentials();
  }

  // Initialize summary counters
  const summary: VerificationSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Run comprehensive tests if requested
  if (options.comprehensive) {
    if (options.dryRun) {
      console.log("Comprehensive mode does not support dry-run\n");
      process.exit(0);
    }

    // Load all specs
    const [polite, enrollments, sequences, activities, contentService] = await Promise.all([
      parseSpec(await findSpecs("polite").then((s) => s[0].path)),
      parseSpec(await findSpecs("enrollments").then((s) => s[0].path)),
      parseSpec(await findSpecs("sequences").then((s) => s[0].path)),
      parseSpec(await findSpecs("activities").then((s) => s[0].path)),
      parseSpec(await findSpecs("content-service").then((s) => s[0].path)),
    ]);

    if (!polite || !enrollments || !sequences || !activities || !contentService) {
      reporter.error("Failed to load one or more specs");
      process.exit(1);
    }

    await runComprehensiveTests({ polite, enrollments, sequences, activities, contentService }, creds!, summary);
  } else {
    // Standard mode: test each spec independently
    const specs = await findSpecs(options.spec);
    console.log(`Found ${specs.length} spec(s) to verify\n`);

    // Process each spec
    for (const spec of specs) {
      if (options.dryRun) {
        await dryRunSpec(spec, options, summary);
      } else {
        await verifySpec(spec, creds!, options, summary);
      }
    }
  }

  // Print final summary
  console.log();
  reporter.printSummary(summary);

  // Exit with appropriate code
  if (summary.failed > 0) {
    reporter.printFinalFailure();
    process.exit(1);
  } else {
    reporter.printFinalSuccess();
    process.exit(0);
  }
}

/**
 * Perform a dry run on a spec (no actual requests)
 *
 * @param spec - Spec definition
 * @param options - CLI options
 * @param summary - Running summary counters (mutated)
 */
async function dryRunSpec(spec: Spec, options: CliOptions, summary: VerificationSummary): Promise<void> {
  reporter.printSpecHeader(spec.name);

  // Parse the spec
  const api = await parseSpec(spec.path);
  if (!api) {
    reporter.warning("Skipped (parse error)");
    summary.skipped++;
    console.log();
    return;
  }

  // Extract operations
  const operations = extractOperations(api);

  // List each operation
  for (const op of operations) {
    // Filter by endpoint if specified
    if (options.endpoint && !op.path.includes(options.endpoint)) {
      continue;
    }

    summary.total++;

    const testName = `${op.method} ${op.path}`;
    reporter.dryRun(`${testName} (dry run)`);
    summary.passed++; // Count as passed in dry-run
  }

  console.log();
}

/**
 * Verify a single OpenAPI spec
 *
 * @param spec - Spec definition
 * @param creds - User credentials
 * @param options - CLI options
 * @param summary - Running summary counters (mutated)
 */
async function verifySpec(
  spec: Spec,
  creds: Credentials,
  options: CliOptions,
  summary: VerificationSummary,
): Promise<void> {
  reporter.printSpecHeader(spec.name);

  // Parse the spec
  const api = await parseSpec(spec.path);
  if (!api) {
    reporter.warning("Skipped (parse error)");
    summary.skipped++;
    console.log();
    return;
  }

  // Extract operations
  const operations = extractOperations(api);

  // Verify each operation
  for (const op of operations) {
    await verifyOperation(op, spec, api, creds, options, summary);
  }

  console.log();
}

/**
 * Verify a single API operation
 *
 * @param op - Operation definition
 * @param spec - Parent spec
 * @param api - Parsed OpenAPI document
 * @param creds - User credentials
 * @param options - CLI options
 * @param summary - Running summary counters (mutated)
 */
async function verifyOperation(
  op: Operation,
  spec: Spec,
  api: OpenAPIV3.Document,
  creds: Credentials,
  options: CliOptions,
  summary: VerificationSummary,
): Promise<void> {
  // Filter by endpoint if specified
  if (options.endpoint && !op.path.includes(options.endpoint)) {
    return;
  }

  summary.total++;

  const testName = `${op.method} ${op.path}`;

  // Handle dry run
  if (options.dryRun) {
    reporter.dryRun(`${testName} (dry run)`);
    return;
  }

  // Skip if no server defined
  if (!api.servers || api.servers.length === 0) {
    reporter.warning(`${testName} - No server defined`);
    summary.skipped++;
    return;
  }

  // Generate request parameters
  const params = generateParameters(op, creds);

  // Build URL
  const server = api.servers[0] as OpenAPIV3.ServerObject;
  const serverVars: Record<string, string> = {
    domain: "nplms",
    tenantId: creds.tenantId || "746e9230-82d6-4d6b-bd68-5aa40aa19cce",
  };

  let fullPath = substitutePathParams(op.path, params.path);
  fullPath += buildQueryString(params.query);

  const url = buildUrl(server, fullPath, serverVars);

  // Build authentication headers
  const headers = buildAuthHeaders(spec.type, creds.d2lSessionVal, creds.d2lSecureSessionVal, creds.d2lFetchToken);

  // Make the request
  const response = await makeRequest(url, op.method, headers);

  // Handle request errors
  if (response.error) {
    reporter.error(testName);
    reporter.printDetails([`Error: ${response.error}`]);
    summary.failed++;
    return;
  }

  // Check if status code is documented
  const documentedStatuses = Object.keys(op.responses);
  const statusStr = response.status.toString();

  if (!documentedStatuses.includes(statusStr) && !documentedStatuses.includes("default")) {
    reporter.error(`${testName} (${response.status})`);
    reporter.printDetails([`Status ${statusStr} not documented`, `Documented: ${documentedStatuses.join(", ")}`]);
    summary.failed++;
    return;
  }

  // Get response schema
  const responseSpec = op.responses[statusStr] || op.responses["default"];
  const responseObj = responseSpec as OpenAPIV3.ResponseObject | undefined;
  const schema = responseObj?.content?.["application/json"]?.schema;

  // Validate response body against schema
  if (schema && response.contentType?.includes("application/json")) {
    const validation = validateResponse(response.body, schema);

    if (validation.valid) {
      reporter.success(`${testName} (${response.status})`);
      summary.passed++;
    } else {
      reporter.error(`${testName} (${response.status})`);
      reporter.printDetails(["Schema validation failed:", ...(validation.errors?.slice(0, 5) || [])]);

      if ((validation.errors?.length || 0) > 5) {
        reporter.printDetails([`... and ${(validation.errors?.length || 0) - 5} more`]);
      }

      if (options.verbose) {
        reporter.printVerboseBody(response.body);
      }

      summary.failed++;
    }
  } else {
    // No schema validation needed
    reporter.success(`${testName} (${response.status})`);
    summary.passed++;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const program = createProgram();
    const options = parseOptions(program);

    await runVerification(options);
  } catch (err) {
    reporter.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Run the verifier
main();
