/**
 * Type definitions for the OpenAPI spec verifier
 *
 * @module types
 */

import type { OpenAPIV3 } from "openapi-types";

/**
 * Credentials required for API authentication
 */
export interface Credentials {
  /** Session cookie for POLITEMall tenant APIs */
  d2lSessionVal: string;
  /** Secure session cookie for POLITEMall tenant APIs */
  d2lSecureSessionVal: string;
  /** JWT token for Brightspace APIs */
  d2lFetchToken: string;
  /** Optional tenant ID override */
  tenantId?: string;
  /** Optional user ID override */
  userId?: string;
}

/**
 * CLI options parsed from command line arguments
 */
export interface CliOptions {
  /** Specific spec to verify (e.g., 'polite', 'enrollments') */
  spec?: string;
  /** Filter endpoints by path pattern */
  endpoint?: string;
  /** Show full response bodies on failure */
  verbose: boolean;
  /** Show what would be tested without making requests */
  dryRun: boolean;
  /** Run comprehensive tests using real data */
  comprehensive: boolean;
}

/**
 * Represents an OpenAPI specification file
 */
export interface Spec {
  /** Human-readable name of the spec */
  name: string;
  /** Absolute path to the spec file */
  path: string;
  /** Type of API (tenant = POLITEMall, brightspace = Brightspace APIs) */
  type: "tenant" | "brightspace";
}

/**
 * Represents an API operation extracted from an OpenAPI spec
 */
export interface Operation {
  /** API path (e.g., /users/{userId}) */
  path: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Operation identifier from the spec */
  operationId?: string;
  /** Human-readable summary */
  summary?: string;
  /** Path, query, and header parameters */
  parameters: OpenAPIV3.ParameterObject[];
  /** Possible response definitions */
  responses: OpenAPIV3.ResponsesObject;
  /** Security requirements for this operation */
  security: OpenAPIV3.SecurityRequirementObject[];
}

/**
 * HTTP response from an API call
 */
export interface ApiResponse {
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Parsed response body */
  body: unknown;
  /** Content-Type header value */
  contentType?: string;
  /** Error message if request failed */
  error?: string;
}

/**
 * Result of a single test/verification
 */
export interface TestResult {
  /** Test identifier (method + path) */
  name: string;
  /** Whether the test passed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Generated parameters for an API request
 */
export interface GeneratedParameters {
  /** Path parameters to substitute in the URL */
  path: Record<string, string>;
  /** Query parameters to append to the URL */
  query: Record<string, string | number | boolean>;
}

/**
 * Summary statistics for a verification run
 */
export interface VerificationSummary {
  /** Total number of tests run */
  total: number;
  /** Number of tests that passed */
  passed: number;
  /** Number of tests that failed */
  failed: number;
  /** Number of tests skipped */
  skipped: number;
}

/**
 * Validation result from AJV schema check
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Array of error messages if validation failed */
  errors?: string[];
}
