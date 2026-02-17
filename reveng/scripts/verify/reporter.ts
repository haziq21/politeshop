/**
 * Reporter module for colored console output
 * 
 * Uses picocolors for cross-platform terminal color support
 * 
 * @module reporter
 */

import pc from 'picocolors';
import type { VerificationSummary } from './types.js';

/**
 * Print a success message with checkmark
 * 
 * @param message - The message to print
 */
export function success(message: string): void {
  console.log(pc.green(`✓ ${message}`));
}

/**
 * Print an error message with X mark
 * 
 * @param message - The message to print
 */
export function error(message: string): void {
  console.log(pc.red(`✗ ${message}`));
}

/**
 * Print a warning message with warning symbol
 * 
 * @param message - The message to print
 */
export function warning(message: string): void {
  console.log(pc.yellow(`⚠ ${message}`));
}

/**
 * Print an info message with bullet point
 * 
 * @param message - The message to print
 */
export function info(message: string): void {
  console.log(pc.blue(`• ${message}`));
}

/**
 * Print a dry-run message (gray)
 * 
 * @param message - The message to print
 */
export function dryRun(message: string): void {
  console.log(pc.gray(`○ ${message}`));
}

/**
 * Print a header/title
 * 
 * @param message - The message to print
 */
export function header(message: string): void {
  console.log(pc.bold(message));
}

/**
 * Print a separator line
 * 
 * @param length - Length of the separator (default: 50)
 */
export function separator(length = 50): void {
  console.log(pc.gray('-'.repeat(length)));
}

/**
 * Print the main title banner
 */
export function printTitle(): void {
  console.log(pc.bold('OpenAPI Spec Verifier\n'));
}

/**
 * Print a summary of verification results
 * 
 * @param summary - Statistics from the verification run
 */
export function printSummary(summary: VerificationSummary): void {
  header('Summary');
  separator();
  console.log(`Total:   ${summary.total}`);
  console.log(pc.green(`Passed:  ${summary.passed}`));
  console.log(pc.red(`Failed:  ${summary.failed}`));
  console.log(pc.yellow(`Skipped: ${summary.skipped}`));
}

/**
 * Print final success message
 */
export function printFinalSuccess(): void {
  console.log(`\n${pc.green('✓ All specs verified')}`);
}

/**
 * Print final failure message
 */
export function printFinalFailure(): void {
  console.log(`\n${pc.red('✗ Verification failed')}`);
}

/**
 * Print details indented under a test result
 * 
 * @param details - Array of detail strings to print
 * @param indent - Number of spaces to indent (default: 2)
 */
export function printDetails(details: string[], indent = 2): void {
  const prefix = ' '.repeat(indent);
  details.forEach(detail => {
    console.log(`${prefix}${detail}`);
  });
}

/**
 * Print a spec section header
 * 
 * @param specName - Name of the spec
 */
export function printSpecHeader(specName: string): void {
  header(`Spec: ${specName}`);
  separator();
}

/**
 * Print verbose response body (truncated)
 * 
 * @param body - The response body to print
 * @param maxLength - Maximum length before truncation (default: 500)
 */
export function printVerboseBody(body: unknown, maxLength = 500): void {
  const bodyStr = JSON.stringify(body, null, 2);
  const truncated = bodyStr.length > maxLength 
    ? bodyStr.substring(0, maxLength) + '...' 
    : bodyStr;
  console.log(`  Response body:`);
  console.log(`    ${truncated}`);
}
