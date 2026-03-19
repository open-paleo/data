import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

// Formatting rules shared by both TypeScript and plain JavaScript files.
const sharedStylisticRules = {
    // Allman brace style
    "@stylistic/brace-style": ["error", "allman", { allowSingleLine: false }],

    // 4-space indentation, no tabs
    "@stylistic/indent": ["error", 4],
    "@stylistic/no-tabs": "error",

    // Double quotes
    "@stylistic/quotes": ["error", "double", { avoidEscape: true }],

    // Semicolons required
    "@stylistic/semi": ["error", "always"],

    // Trailing commas
    "@stylistic/comma-dangle": ["error", "always-multiline"],

    // Spacing
    "@stylistic/comma-spacing": "error",
    "@stylistic/key-spacing": "error",
    "@stylistic/keyword-spacing": "error",
    "@stylistic/space-before-blocks": "error",
    "@stylistic/space-infix-ops": "error",
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/arrow-spacing": "error",
    "@stylistic/block-spacing": "error",
    "@stylistic/semi-spacing": "error",
    "@stylistic/space-before-function-paren": ["error", {
        anonymous: "always",
        named: "never",
        asyncArrow: "always",
    }],

    // No trailing spaces, require final newline
    "@stylistic/no-trailing-spaces": "error",
    "@stylistic/eol-last": ["error", "always"],

    // No multiple empty lines
    "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0, maxBOF: 0 }],

    // Blank line after block-like statements (if, for, while, etc.)
    "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "block-like", next: "*" },
    ],

    // Prefer const
    "prefer-const": "error",
    "no-var": "error",
};

export default tseslint.config(
    eslint.configs.recommended,
    {
        // Apply tseslint recommended only to TypeScript files
        files: ["scripts/**/*.ts"],
        extends: [...tseslint.configs.recommended],
    },
    {
        // Shared formatting rules for TypeScript files
        files: ["scripts/**/*.ts"],
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            ...sharedStylisticRules,

            // Require node: protocol for Node.js built-in modules
            "no-restricted-imports": ["error", {
                paths: [
                    { name: "fs", message: "Use 'node:fs' instead." },
                    { name: "fs/promises", message: "Use 'node:fs/promises' instead." },
                    { name: "path", message: "Use 'node:path' instead." },
                    { name: "url", message: "Use 'node:url' instead." },
                    { name: "os", message: "Use 'node:os' instead." },
                    { name: "crypto", message: "Use 'node:crypto' instead." },
                    { name: "stream", message: "Use 'node:stream' instead." },
                    { name: "util", message: "Use 'node:util' instead." },
                    { name: "child_process", message: "Use 'node:child_process' instead." },
                    { name: "events", message: "Use 'node:events' instead." },
                    { name: "http", message: "Use 'node:http' instead." },
                    { name: "https", message: "Use 'node:https' instead." },
                    { name: "buffer", message: "Use 'node:buffer' instead." },
                    { name: "assert", message: "Use 'node:assert' instead." },
                    { name: "readline", message: "Use 'node:readline' instead." },
                    { name: "zlib", message: "Use 'node:zlib' instead." },
                ],
            }],

            // Naming conventions (TypeScript-specific selectors)
            camelcase: "off",
            "no-underscore-dangle": "off",
            "@typescript-eslint/naming-convention": ["error",
                {
                    selector: "default",
                    format: ["camelCase"],
                    leadingUnderscore: "forbid",
                    trailingUnderscore: "forbid",
                },
                {
                    selector: "typeLike",
                    format: ["PascalCase"],
                },
                {
                    selector: "parameter",
                    modifiers: ["unused"],
                    format: ["camelCase"],
                    leadingUnderscore: "allow",
                    filter: { regex: "^_$", match: true },
                },
                {
                    selector: "objectLiteralProperty",
                    format: null,
                },
                {
                    selector: "typeProperty",
                    format: null,
                },
            ],

            // No unused variables
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_$",
            }],

            // No explicit any
            "@typescript-eslint/no-explicit-any": "error",

            // Prefer type over interface
            "@typescript-eslint/consistent-type-definitions": ["error", "type"],

            // Use Array<T> generic syntax, not T[]
            "@typescript-eslint/array-type": ["error", { default: "generic" }],
        },
    },
    {
        // Shared formatting rules for browser JavaScript files
        files: ["docs/**/*.js"],
        languageOptions: {
            globals: {
                window: "readonly",
                document: "readonly",
                console: "readonly",
                fetch: "readonly",
                setTimeout: "readonly",
                Event: "readonly",
                history: "readonly",
            },
        },
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            ...sharedStylisticRules,
        },
    },
    {
        // Shared formatting rules for GitHub Actions workflow scripts
        files: [".github/scripts/**/*.cjs"],
        languageOptions: {
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                Buffer: "readonly",
                console: "readonly",
            },
        },
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            ...sharedStylisticRules,
        },
    },
    {
        ignores: ["dist/**", "node_modules/**"],
    },
);
