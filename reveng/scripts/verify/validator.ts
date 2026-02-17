/**
 * Validation module using AJV
 *
 * Uses AJV to validate responses against OpenAPI schemas directly
 * without needing complex conversion logic
 *
 * @module validator
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { ValidationResult } from "./types.js";

/**
 * Create and configure an AJV instance
 * @returns Configured AJV instance with formats support
 */
function createAjv(): Ajv {
  const ajv = new Ajv({
    strict: false, // Allow OpenAPI-specific keywords
    allErrors: true, // Collect all errors, not just first
    verbose: true, // Include schema and data in errors
    validateSchema: false, // Disable schema validation to allow circular refs
  });

  // Add format validators (date-time, email, uri, etc.)
  addFormats(ajv);

  return ajv;
}

/**
 * Validate a response body against an OpenAPI schema using AJV
 *
 * @param body - The response body to validate
 * @param schema - The OpenAPI schema definition (JSON Schema format)
 * @returns Validation result with success status and optional errors
 *
 * @example
 * ```typescript
 * const result = validateResponse(
 *   { name: 'John', age: 30 },
 *   { type: 'object', properties: { name: { type: 'string' } } }
 * );
 *
 * if (!result.valid) {
 *   console.log(result.errors);
 * }
 * ```
 */
export function validateResponse(body: unknown, schema: unknown): ValidationResult {
  if (!schema || typeof schema !== "object") {
    return { valid: true };
  }

  try {
    const ajv = createAjv();

    // Clone schema to avoid circular reference issues
    const schemaClone = JSON.parse(JSON.stringify(schema, getCircularReplacer()));

    const validate = ajv.compile(schemaClone as object);
    const valid = validate(body);

    if (valid) {
      return { valid: true };
    } else {
      return {
        valid: false,
        errors: validate.errors?.map((err) => {
          const path = err.instancePath || "root";
          return `${path}: ${err.message}`;
        }),
      };
    }
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? `Schema compilation error: ${err.message}` : "Unknown validation error"],
    };
  }
}

/**
 * Get a replacer function that handles circular references
 * @returns Replacer function for JSON.stringify
 */
function getCircularReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: unknown) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return; // Remove circular reference
      }
      seen.add(value);
    }
    return value;
  };
}
