/**
 * Utility functions for the spec verifier
 * 
 * @module utils
 */

import type { OpenAPIV3 } from 'openapi-types';
import type { Credentials, GeneratedParameters, Operation } from './types.js';

/**
 * Default values for known API parameters
 * These are used when generating test requests
 */
const DEFAULT_PARAMETER_VALUES: Record<string, string | number | boolean> = {
  domain: 'nplms',
  tenantId: '746e9230-82d6-4d6b-bd68-5aa40aa19cce',
  userId: '490586',
  moduleId: '51409',
  activityId: '4349549',
  dropboxId: '451456',
  orgId: '6665',
  toolId: '2000',
  organizationId: '6665'
};

/**
 * Generate parameter values for an API operation
 * Uses example values from spec, then defaults, then type-based fallbacks
 * 
 * @param operation - The OpenAPI operation definition
 * @param creds - User credentials for context-specific values
 * @returns Object with path and query parameters
 * 
 * @example
 * ```typescript
 * const params = generateParameters(operation, creds);
 * // Returns: { path: { userId: '490586' }, query: { pageSize: 20 } }
 * ```
 */
export function generateParameters(
  operation: Operation, 
  creds: Credentials
): GeneratedParameters {
  const params: GeneratedParameters = {
    path: {},
    query: {}
  };

  for (const param of operation.parameters) {
    const value = getParameterValue(param, creds);

    if (param.in === 'path' && value !== undefined) {
      params.path[param.name] = String(value);
    } else if (param.in === 'query' && value !== undefined) {
      params.query[param.name] = value;
    }
  }

  return params;
}

/**
 * Get a single parameter value from available sources
 * Priority: example > default > known values > type-based fallback
 * 
 * @param param - OpenAPI parameter definition
 * @param creds - User credentials
 * @returns The generated value or undefined
 */
function getParameterValue(
  param: OpenAPIV3.ParameterObject, 
  creds: Credentials
): string | number | boolean | undefined {
  const schema = param.schema as OpenAPIV3.SchemaObject | undefined;

  // Use example if available
  if (schema?.example !== undefined) {
    return schema.example as string | number | boolean;
  }

  // Use default if available
  if (schema?.default !== undefined) {
    return schema.default as string | number | boolean;
  }

  // Check known values
  const knownValue = DEFAULT_PARAMETER_VALUES[param.name];
  if (knownValue !== undefined) {
    return knownValue;
  }

  // Override with credentials if available
  if (param.name === 'tenantId' && creds.tenantId) {
    return creds.tenantId;
  }
  if (param.name === 'userId' && creds.userId) {
    return creds.userId;
  }

  // Type-based defaults
  return getTypeDefault(schema);
}

/**
 * Get a default value based on schema type
 * 
 * @param schema - OpenAPI schema object
 * @returns Default value for the type
 */
function getTypeDefault(
  schema: OpenAPIV3.SchemaObject | undefined
): string | number | boolean | undefined {
  switch (schema?.type) {
    case 'string':
      return 'test';
    case 'integer':
    case 'number':
      return schema.minimum ?? 0;
    case 'boolean':
      return false;
    default:
      return undefined;
  }
}

/**
 * Substitute path parameters into a URL path
 * 
 * @param path - URL path with placeholders (e.g., /users/{userId})
 * @param params - Parameter values to substitute
 * @returns Path with placeholders replaced
 * 
 * @example
 * ```typescript
 * const path = substitutePathParams('/users/{userId}', { userId: '123' });
 * // Returns: '/users/123'
 * ```
 */
export function substitutePathParams(
  path: string, 
  params: Record<string, string>
): string {
  let result = path;
  for (const [name, value] of Object.entries(params)) {
    result = result.replace(`{${name}}`, encodeURIComponent(value));
  }
  return result;
}

/**
 * Build a query string from parameters
 * 
 * @param params - Query parameters
 * @returns Query string starting with ? or empty string
 * 
 * @example
 * ```typescript
 * const qs = buildQueryString({ page: 1, limit: 10 });
 * // Returns: '?page=1&limit=10'
 * ```
 */
export function buildQueryString(
  params: Record<string, string | number | boolean>
): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);

  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

/**
 * Build a complete URL from server config and path
 * 
 * @param server - OpenAPI server configuration
 * @param path - API path
 * @param variables - Variables to substitute in server URL
 * @returns Complete URL
 * 
 * @example
 * ```typescript
 * const url = buildUrl(
 *   { url: 'https://{tenantId}.api.com' },
 *   '/users',
 *   { tenantId: 'abc123' }
 * );
 * // Returns: 'https://abc123.api.com/users'
 * ```
 */
export function buildUrl(
  server: OpenAPIV3.ServerObject,
  path: string,
  variables: Record<string, string> = {}
): string {
  let url = server.url;

  // Replace server variables
  if (server.variables) {
    for (const [name, config] of Object.entries(server.variables)) {
      const value = variables[name] || config.default;
      url = url.replace(`{${name}}`, value);
    }
  }

  // Ensure no trailing slash on base, ensure leading slash on path
  url = url.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);

  return url;
}

/**
 * Extract testable operations from an OpenAPI document
 * Only includes HTTP methods (GET, POST, PUT, PATCH, DELETE)
 * 
 * @param api - Parsed OpenAPI document
 * @returns Array of operations
 */
export function extractOperations(api: OpenAPIV3.Document): Operation[] {
  const operations: Operation[] = [];
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

  for (const [pathPath, pathItem] of Object.entries(api.paths || {})) {
    if (!pathItem) continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.includes(method) || !operation || typeof operation !== 'object') {
        continue;
      }

      const op = operation as OpenAPIV3.OperationObject;
      operations.push({
        path: pathPath,
        method: method.toUpperCase(),
        operationId: op.operationId || `${method}${pathPath}`,
        summary: op.summary,
        parameters: (op.parameters || []) as OpenAPIV3.ParameterObject[],
        responses: op.responses || {},
        security: (op.security as OpenAPIV3.SecurityRequirementObject[]) || 
                 (api.security as OpenAPIV3.SecurityRequirementObject[]) || []
      });
    }
  }

  return operations;
}
