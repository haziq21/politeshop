/**
 * Spec discovery and parsing module
 * 
 * @module specs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import type { Spec } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Base directory for spec files (relative to project root)
 */
const SPECS_BASE_DIR = path.join(process.cwd(), 'spec');

/**
 * List of available specs with their metadata
 */
const AVAILABLE_SPECS: Spec[] = [
  {
    name: 'polite',
    path: path.join(SPECS_BASE_DIR, 'polite.yaml'),
    type: 'tenant'
  },
  {
    name: 'enrollments',
    path: path.join(SPECS_BASE_DIR, 'brightspace', 'enrollments.yaml'),
    type: 'brightspace'
  },
  {
    name: 'sequences',
    path: path.join(SPECS_BASE_DIR, 'brightspace', 'sequences.yaml'),
    type: 'brightspace'
  },
  {
    name: 'activities',
    path: path.join(SPECS_BASE_DIR, 'brightspace', 'activities.yaml'),
    type: 'brightspace'
  },
  {
    name: 'content-service',
    path: path.join(SPECS_BASE_DIR, 'brightspace', 'content-service.yaml'),
    type: 'brightspace'
  }
];

/**
 * Find and return all available specs, or filter by name
 * 
 * @param specName - Optional name to filter by
 * @returns Array of spec definitions
 * @throws Error if specName is provided but not found
 * 
 * @example
 * ```typescript
 * // Get all specs
 * const allSpecs = await findSpecs();
 * 
 * // Get specific spec
 * const politeSpec = await findSpecs('polite');
 * ```
 */
export async function findSpecs(specName?: string): Promise<Spec[]> {
  if (specName) {
    const spec = AVAILABLE_SPECS.find(s => s.name === specName);
    if (!spec) {
      const available = AVAILABLE_SPECS.map(s => s.name).join(', ');
      throw new Error(
        `Unknown spec: ${specName}\n` +
        `Available specs: ${available}`
      );
    }
    return [spec];
  }

  return AVAILABLE_SPECS;
}

/**
 * Parse and validate an OpenAPI spec file
 * Uses swagger-parser to validate the spec format and resolve references
 * 
 * @param specPath - Path to the spec file
 * @returns Parsed OpenAPI document or null if parsing fails
 * 
 * @example
 * ```typescript
 * const api = await parseSpec('/path/to/spec.yaml');
 * if (api) {
 *   console.log(`API Title: ${api.info.title}`);
 * }
 * ```
 */
export async function parseSpec(specPath: string): Promise<OpenAPIV3.Document | null> {
  try {
    const api = await SwaggerParser.validate(specPath) as OpenAPIV3.Document;
    return api;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to parse spec: ${specPath}`);
    console.error(`  ${message}`);
    return null;
  }
}

/**
 * Get the list of available spec names
 * 
 * @returns Array of spec names
 */
export function getAvailableSpecNames(): string[] {
  return AVAILABLE_SPECS.map(s => s.name);
}
