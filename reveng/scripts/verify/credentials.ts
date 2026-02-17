/**
 * Credentials loading and validation module
 *
 * Loads credentials from environment variables (from .env file or process.env)
 *
 * @module credentials
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Credentials } from './types.js';

// Get the directory of this module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file from the reveng directory
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

/**
 * Required environment variable names
 */
const REQUIRED_ENV_VARS = [
  'D2L_SESSION_VAL',
  'D2L_SECURE_SESSION_VAL',
  'D2L_FETCH_TOKEN'
] as const;

/**
 * Load and validate credentials from environment variables
 *
 * @returns Credentials object populated from environment variables
 * @throws Error if required environment variables are missing or token is expired
 *
 * @example
 * ```typescript
 * const creds = loadCredentials();
 * console.log(creds.d2lFetchToken);
 * ```
 */
export function loadCredentials(): Credentials {
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name] || process.env[name]?.trim() === ''
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n` +
        missing.map((name) => `  - ${name}`).join('\n') +
        `\n\n` +
        `Create a .env file in the reveng/ directory with:\n` +
        `  D2L_SESSION_VAL=your_session_value\n` +
        `  D2L_SECURE_SESSION_VAL=your_secure_session_value\n` +
        `  D2L_FETCH_TOKEN=your_jwt_token`
    );
  }

  const creds = {
    d2lSessionVal: process.env.D2L_SESSION_VAL!,
    d2lSecureSessionVal: process.env.D2L_SECURE_SESSION_VAL!,
    d2lFetchToken: process.env.D2L_FETCH_TOKEN!,
    tenantId: process.env.TENANT_ID,
    userId: process.env.USER_ID
  };

  // Check if JWT token is expired
  if (isTokenExpired(creds.d2lFetchToken)) {
    const payload = JSON.parse(Buffer.from(creds.d2lFetchToken.split('.')[1], 'base64url').toString());
    const expDate = new Date(payload.exp * 1000);
    throw new Error(
      `JWT token has expired!\n` +
        `  Expiry date: ${expDate.toISOString()}\n` +
        `\n` +
        `Please update D2L_FETCH_TOKEN in reveng/.env with a fresh token from:\n` +
        `  1. Open browser dev tools\n` +
        `  2. Go to Application/Storage > Cookies\n` +
        `  3. Find and copy the JWT token from network requests`
    );
  }

  return creds;
}

/**
 * Extract tenant ID from a Brightspace JWT token
 *
 * @param token - The JWT token string
 * @returns The tenant ID or undefined if parsing fails
 *
 * @example
 * ```typescript
 * const tenantId = extractTenantIdFromJWT(creds.d2lFetchToken);
 * // Returns: '746e9230-82d6-4d6b-bd68-5aa40aa19cce'
 * ```
 */
export function extractTenantIdFromJWT(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.tenantid as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract user ID from a Brightspace JWT token
 *
 * @param token - The JWT token string
 * @returns The user ID or undefined if parsing fails
 *
 * @example
 * ```typescript
 * const userId = extractUserIdFromJWT(creds.d2lFetchToken);
 * // Returns: '490586'
 * ```
 */
export function extractUserIdFromJWT(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.sub as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if a JWT token is expired
 *
 * @param token - The JWT token string
 * @returns True if token is expired, false otherwise
 *
 * @example
 * ```typescript
 * if (isTokenExpired(creds.d2lFetchToken)) {
 *   console.warn('Token has expired!');
 * }
 * ```
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!payload.exp) return false;

    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() > expiryTime;
  } catch {
    return true;
  }
}
