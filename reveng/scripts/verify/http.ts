/**
 * HTTP request module for making API calls
 * 
 * @module http
 */

import type { ApiResponse } from './types.js';

/**
 * Make an HTTP request to the API
 * 
 * @param url - Full URL to request
 * @param method - HTTP method (GET, POST, etc.)
 * @param headers - Request headers
 * @returns Response object with status, headers, and body
 * 
 * @example
 * ```typescript
 * const response = await makeRequest(
 *   'https://api.example.com/users',
 *   'GET',
 *   { 'Authorization': 'Bearer token123' }
 * );
 * 
 * if (response.status === 200) {
 *   console.log(response.body);
 * }
 * ```
 */
export async function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string>
): Promise<ApiResponse> {
  try {
    const response = await fetch(url, {
      method,
      headers,
      redirect: 'manual'
    });

    const contentType = response.headers.get('content-type') || '';
    let body: unknown;

    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      contentType
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      status: 0,
      headers: {},
      body: null
    };
  }
}

/**
 * Build authentication headers based on API type
 * 
 * @param specType - Type of spec (tenant or brightspace)
 * @param sessionVal - d2lSessionVal cookie value
 * @param secureSessionVal - d2lSecureSessionVal cookie value
 * @param jwtToken - JWT token for Brightspace APIs
 * @returns Headers object with appropriate authentication
 * 
 * @example
 * ```typescript
 * // For POLITEMall tenant API
 * const headers = buildAuthHeaders(
 *   'tenant',
 *   creds.d2lSessionVal,
 *   creds.d2lSecureSessionVal,
 *   creds.d2lFetchToken
 * );
 * // Returns: { Cookie: 'd2lSessionVal=...; d2lSecureSessionVal=...' }
 * 
 * // For Brightspace API
 * const headers = buildAuthHeaders(
 *   'brightspace',
 *   creds.d2lSessionVal,
 *   creds.d2lSecureSessionVal,
 *   creds.d2lFetchToken
 * );
 * // Returns: { Authorization: 'Bearer ...' }
 * ```
 */
export function buildAuthHeaders(
  specType: 'tenant' | 'brightspace',
  sessionVal: string,
  secureSessionVal: string,
  jwtToken: string
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (specType === 'tenant') {
    headers['Cookie'] = `d2lSessionVal=${sessionVal}; d2lSecureSessionVal=${secureSessionVal}`;
  } else if (specType === 'brightspace') {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  return headers;
}
