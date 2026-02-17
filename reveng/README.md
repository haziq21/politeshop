# OpenAPI Spec Verifier

This directory contains the OpenAPI specifications for the POLITEMall APIs, plus a verification script that validates specs against live API responses.

The verifier is written in **TypeScript** and uses ESM modules.

## Project Structure

```
reveng/
├── scripts/
│   └── verify/
│       ├── index.ts         # Main entry point with CLI
│       ├── orchestrator.ts  # Comprehensive test orchestration
│       ├── types.ts         # TypeScript type definitions
│       ├── credentials.ts   # Credentials loading & validation
│       ├── specs.ts         # Spec discovery & parsing
│       ├── http.ts          # HTTP request handling
│       ├── validator.ts     # AJV schema validation
│       ├── utils.ts         # Utility functions
│       └── reporter.ts      # Colored output with picocolors
├── spec/
│   ├── polite.yaml          # Main POLITEMall APIs
│   ├── brightspace/         # Brightspace API specs
│   └── shared/              # Shared schemas
├── package.json
└── tsconfig.json
```

## Usage

### Install dependencies

```bash
pnpm install
# or
npm install
```

### Run verification

```bash
# Standard mode: Verify all specs with default parameters
pnpm run verify

# Comprehensive mode: Test ALL modules, topics, dropboxes, etc. using real data
pnpm run verify --comprehensive

# Verify specific spec
pnpm run verify -- --spec=polite

# Verify specific endpoint pattern
pnpm run verify -- --endpoint=/users

# Dry run (show what would be tested)
pnpm run verify -- --dry-run

# Verbose mode (show full response bodies on failure)
pnpm run verify -- --verbose

# Custom credentials path
pnpm run verify -- --creds=/path/to/creds.json
```

### Test Modes

#### Standard Mode (default)
Tests each endpoint once with default/example parameters. Validates that the OpenAPI spec documentation is accurate.
- ✓ Validates specs against OpenAPI format
- ✓ Checks status codes are documented (including error codes like 400, 404, 403)
- ✓ Validates response schemas for all documented responses
- ⚡ ~17 tests in ~3 seconds
- **Purpose**: Verify the spec documentation is correct

#### Comprehensive Mode (`--comprehensive`)
Tests ALL modules, topics, dropboxes, etc. using real data from the API. Validates that real-world data returns successful responses.
- ✓ Chains requests (uses data from enrollments to test modules)
- ✓ Tests every enrolled module
- ✓ Tests every topic in every module
- ✓ Tests every dropbox and submission
- ✓ Tests content service and sequences endpoints  
- ✓ Parallelized for performance
- ✓ **Only counts 200 responses as successful** - validates actual data works
- ⚡ ~600+ tests in ~60 seconds (varies by enrollment count)
- **Purpose**: Verify all real API responses match the documented schemas

### CLI Options

| Option | Description |
|--------|-------------|
| `-s, --spec <name>` | Verify only specific spec (`polite`, `enrollments`, `sequences`, `activities`, `content-service`) |
| `-e, --endpoint <path>` | Verify only endpoints matching path pattern |
| `-c, --comprehensive` | Run comprehensive tests using real data from API (tests all modules, topics, etc.) |
| `-v, --verbose` | Show full response bodies on failure |
| `-d, --dry-run` | Show what would be tested without making requests |
| `--creds <path>` | Path to credentials JSON file (default: `./creds.json`) |
| `-h, --help` | Show help |
| `-V, --version` | Show version |

### Development

```bash
# Type check the verifier script
pnpm run typecheck
```

### Credentials

The verifier expects a `creds.json` file in the reveng directory with:

```json
{
  "d2lSessionVal": "...",
  "d2lSecureSessionVal": "...",
  "d2lFetchToken": "..."
}
```

You can also set `CREDS_PATH` environment variable or use `--creds` flag.

### What it checks

#### Standard Mode
1. **Spec validity** - Validates OpenAPI spec format with swagger-parser
2. **Endpoint availability** - Makes real HTTP requests
3. **Status codes** - Verifies response status is documented
4. **Response schemas** - Validates JSON responses against schemas using AJV

#### Comprehensive Mode
1. **Everything in Standard Mode**, plus:
2. **Data chaining** - Uses enrollment IDs to test module endpoints
3. **Complete coverage** - Tests every module, topic, dropbox, quiz
4. **Real-world validation** - Uses actual user data instead of defaults
5. **Parallel execution** - Tests modules concurrently for speed

### Exit codes

- `0` - All verifications passed
- `1` - One or more verifications failed

## Tech Stack

- **TypeScript** - Type safety
- **AJV** - JSON Schema validation (handles OpenAPI schemas with circular refs)
- **Commander.js** - CLI argument parsing
- **Picocolors** - Terminal colors
- **Swagger Parser** - OpenAPI spec validation & reference resolution

## Specs

- `spec/polite.yaml` - Main POLITEMall tenant APIs (`*.polite.edu.sg`)
- `spec/brightspace/enrollments.yaml` - Enrollments API
- `spec/brightspace/sequences.yaml` - Content sequences API
- `spec/brightspace/activities.yaml` - Assignment activities API
- `spec/brightspace/content-service.yaml` - Content service API (videos)
- `spec/shared/siren.yaml` - Shared Siren entity schemas
