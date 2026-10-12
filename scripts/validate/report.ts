// Collects each check's errors and warnings and prints the summary.

import * as path from "node:path";
import * as url from "node:url";

import type { CheckResult, ValidationMessage } from "../types.ts";

const scriptPath = url.fileURLToPath(import.meta.url);

const scriptDir = path.dirname(scriptPath);

const root = path.join(scriptDir, "..", "..");

/**
 * Converts an absolute path to a path relative to the repository root.
 *
 * @param absPath - The absolute file path.
 * @returns The relative path, or the original if it doesn't start with root.
 */
export function relPath(absPath: string): string
{
    return absPath.startsWith(root) ? absPath.slice(root.length + 1) : absPath;
}

export const errors = new Array<ValidationMessage>();

export const warnings = new Array<ValidationMessage>();

/**
 * Records a validation error.
 *
 * @param check - The name of the validation check.
 * @param file - The file path that triggered the error, or null for global errors.
 * @param message - Human-readable error description.
 */
export function addError(check: string, file: string | null, message: string): void
{
    errors.push({ check, file: file ? relPath(file) : "(global)", message });
}

/**
 * Records a validation warning.
 *
 * @param check - The name of the validation check.
 * @param file - The file path that triggered the warning, or null for global warnings.
 * @param message - Human-readable warning description.
 */
export function addWarning(check: string, file: string | null, message: string): void
{
    warnings.push({ check, file: file ? relPath(file) : "(global)", message });
}

// Track per-check results
export const checkResults: Record<string, CheckResult> = {};

/**
 * Initializes counters for a new validation check.
 *
 * @param name - The display name of the check.
 */
export function startCheck(name: string): void
{
    checkResults[name] = {
        errors: 0,
        warnings: 0,
    };
}

/**
 * Records an error for a specific validation check.
 *
 * @param name - The check name (must have been initialized with startCheck).
 * @param file - The file path, or null for global errors.
 * @param message - Human-readable error description.
 */
export function checkError(name: string, file: string | null, message: string): void
{
    checkResults[name].errors++;
    addError(name, file, message);
}

/**
 * Records a warning for a specific validation check.
 *
 * @param name - The check name (must have been initialized with startCheck).
 * @param file - The file path, or null for global warnings.
 * @param message - Human-readable warning description.
 */
export function checkWarning(name: string, file: string | null, message: string): void
{
    checkResults[name].warnings++;
    addWarning(name, file, message);
}

/**
 * Prints each check's result and the error and warning totals.
 */
export function printReport(): void
{
    console.log("Validating Open Paleo data...\n");

    for (const name of Object.keys(checkResults))
    {
        const result = checkResults[name];
        if (result.errors === 0 && result.warnings === 0)
        {
            console.log(`\u2713 ${name} check passed`);
        }
        else if (result.errors > 0)
        {
            console.log(`\u2717 ${name}: ${result.errors} error${result.errors !== 1 ? "s" : ""}`);
            for (const entry of errors.filter(entry => entry.check === name))
            {
                console.log(`  ${entry.file}: ${entry.message}`);
            }
        }
        else
        {
            console.log(`\u26A0 ${name}: ${result.warnings} warning${result.warnings !== 1 ? "s" : ""}`);
            for (const entry of warnings.filter(entry => entry.check === name))
            {
                console.log(`  ${entry.file}: ${entry.message}`);
            }
        }
    }

    console.log(`\nSummary: ${errors.length} error${errors.length !== 1 ? "s" : ""}, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`);
}
