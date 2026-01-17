# AI Scan CLI

Local AI Scan CLI for ADAShield - Batch processing tool for ADA/WCAG accessibility scanning using Claude Code CLI with Playwright MCP.

## Overview

The AI Scan CLI is a command-line tool that automates batch processing of pending accessibility scans using Claude Code and Playwright MCP server. It processes CSV files containing URLs to scan, invokes Claude Code to perform AI-powered accessibility analysis, and generates results in a format compatible with the ADAShield admin import system.

**Use Case**: Batch processing pending AI scans exported from the ADAShield admin panel using Claude Code for automated WCAG compliance analysis.

## Build & Run Guide

### Step 1: Install Dependencies

```bash
cd tools/ai-scan-cli
pnpm install
```

### Step 2: Build the CLI

```bash
pnpm build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 3: Run the CLI

**Option A: Using npm scripts**
```bash
# Run with default options
pnpm start -- --input /path/to/scans.csv

# Development mode (build + run)
pnpm dev -- --input /path/to/scans.csv --verbose
```

**Option B: Direct node execution**
```bash
node dist/cli.js --input /path/to/scans.csv --output ./results/
```

**Option C: Global installation**
```bash
# Link globally (one-time setup)
pnpm link --global

# Then run from anywhere
ai-scan-cli --input /path/to/scans.csv
```

### Available npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `pnpm build` | `tsc` | Compile TypeScript to JavaScript |
| `pnpm start` | `node dist/cli.js` | Run the compiled CLI |
| `pnpm dev` | `tsc && node dist/cli.js` | Build and run in one step |
| `pnpm test` | `vitest` | Run tests in watch mode |
| `pnpm test:run` | `vitest run` | Run tests once |
| `pnpm lint` | `eslint src --ext .ts` | Lint source files |

### Common Run Examples

```bash
# Basic scan with output directory
pnpm start -- -i pending-scans.csv -o ./results/

# Verbose mode (see detailed progress and prompts)
pnpm start -- -i pending-scans.csv -o ./results/ --verbose

# Process 1 URL at a time (recommended for testing)
pnpm start -- -i pending-scans.csv -m 1 --verbose

# Dry run - preview batch plan without processing
pnpm start -- -i pending-scans.csv --dry-run

# Check prerequisites before running
pnpm start -- --check-prerequisites
```

## Prerequisites

Before using this tool, ensure you have the following installed and configured:

### Required

1. **Node.js 18+**
   - Check version: `node --version`
   - Install from: https://nodejs.org/

2. **Claude Code CLI** - Anthropic's official CLI tool
   - Must be installed globally on your system
   - Must be authenticated with valid API credentials
   - Verify installation: `claude --version`
   - Installation: https://claude.ai/code

3. **Playwright MCP Server** - For web automation
   - Must be configured in Claude Code's MCP settings
   - Required for browser-based accessibility scanning
   - Configuration: Add to Claude Code MCP configuration file

### Verifying Prerequisites

Run the prerequisite check to verify your environment:

```bash
ai-scan-cli --check-prerequisites
```

This will display:
- Claude CLI installation status and version
- Playwright MCP server configuration status
- Any missing prerequisites with installation instructions

## Installation

### 1. Navigate to the CLI directory

```bash
cd /path/to/ada-wacg-compliance/tools/ai-scan-cli
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build the tool

```bash
pnpm build
```

This compiles the TypeScript source code to JavaScript in the `dist/` directory.

### 4. (Optional) Link globally

To use `ai-scan-cli` from anywhere on your system:

```bash
pnpm link --global
```

Or use directly via `node dist/index.js` from the tool directory.

## Quick Start

### Step 1: Build the tool
```bash
cd tools/ai-scan-cli
pnpm install && pnpm build
```

### Step 2: Verify prerequisites
```bash
node dist/index.js --check-prerequisites
```

### Step 3: Run a scan
```bash
# Basic usage - process a CSV file
node dist/index.js --input /path/to/pending-scans.csv --output ./results/

# With verbose output (shows prompts and detailed progress)
node dist/index.js -i pending-scans.csv -o ./results/ --verbose

# Process only 1 URL per Claude invocation (recommended for testing)
node dist/index.js -i pending-scans.csv -m 1 --verbose

# Dry run - preview batch plan without processing
node dist/index.js -i pending-scans.csv --dry-run
```

### Expected Input CSV Format
```csv
scan_id,url,wcag_level,email
scan-001,https://example.com,AA,user@example.com
scan-002,https://test.com,A,
```

**Required columns**: `scan_id`, `url`, `wcag_level`
**Optional columns**: `email`, `created_at`

### What Happens During Processing

1. **CSV Parsing**: Reads and validates the input CSV
2. **Batch Organization**: Groups URLs into batches and mini-batches
3. **Claude Code Invocation**: For each mini-batch:
   - Generates a prompt with WCAG scanning instructions
   - Invokes `claude -p "<prompt>"` with Playwright MCP
   - Claude loads each URL in a browser and analyzes accessibility
   - **This step can take 1-3 minutes per mini-batch**
4. **Result Parsing**: Extracts JSON results from Claude's output
5. **CSV Output**: Writes results in import-compatible format

> **Note**: When you see "Processing batch X, mini-batch Y" followed by silence, Claude Code is actively working. Each mini-batch can take 1-3 minutes depending on page complexity.

## CLI Options Reference

### Core Options

| Option | Alias | Description | Default | Required |
|--------|-------|-------------|---------|----------|
| `--input <file>` | `-i` | Single CSV file to process | - | Yes (or --input-dir) |
| `--output <path>` | `-o` | Output file or directory | `./` | No |
| `--batch-size <n>` | `-b` | URLs per batch | `100` | No |
| `--mini-batch-size <n>` | `-m` | URLs per Claude invocation (1-10) | `5` | No |
| `--delay <seconds>` | - | Delay between mini-batches in seconds | `5` | No |
| `--start-batch <n>` | - | Skip batches before this number | `1` | No |

### Directory Mode Options

| Option | Alias | Description | Default | Required |
|--------|-------|-------------|---------|----------|
| `--input-dir <dir>` | `-d` | Directory to scan for CSV files | - | Yes (or --input) |
| `--max-files <n>` | - | Max CSV files to process per run | All files | No |
| `--log <path>` | `-l` | Log file or directory | - | No |

### Checkpoint Options

| Option | Description | Default |
|--------|-------------|---------|
| `--resume` `-r` | Resume from checkpoint | `false` |
| `--clear-checkpoint` | Clear checkpoint and start fresh | `false` |

### Feature Flags

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--prompt-template <file>` | - | Custom prompt template path | Built-in template |
| `--dry-run` | - | Validate without processing | `false` |
| `--check-prerequisites` | - | Only validate environment | `false` |
| `--verbose` | `-v` | Show detailed output including prompts | `false` |
| `--quiet` | `-q` | Minimal output for cron jobs | `false` |
| `--json-summary` | `-j` | Output JSON summary at end | `false` |

### Notes

- `--input` and `--input-dir` are mutually exclusive
- `--verbose` and `--quiet` are mutually exclusive
- `--resume` and `--clear-checkpoint` are mutually exclusive
- Mini-batch size must be between 1-10 (Claude context window limitation)

## Configuration

### Default Timeouts and Retries

The CLI uses the following default configuration for page downloads:

| Setting | Default Value | Description |
|---------|---------------|-------------|
| Page load timeout | 60 seconds | Max time to wait for a page to load |
| Download retries | 3 attempts | Number of retry attempts for failed page loads |
| Retry backoff | 5s, 10s, 20s | Exponential backoff delays between retries |
| Claude analysis timeout | 180 seconds | Max time for Claude to analyze a mini-batch |
| Mini-batch delay | 5 seconds | Delay between processing mini-batches |

### Modifying Configuration

To change timeout or retry settings, edit the source files and rebuild:

**Page download settings** (`src/website-downloader.ts`):
```typescript
// In constructor defaults
timeout: options.timeout ?? 60000,  // Page load timeout in ms
retries: options.retries ?? 3,      // Number of retry attempts
```

**Mini-batch processor settings** (`src/mini-batch-processor.ts`):
```typescript
// In WebsiteDownloader initialization
timeout: 60000,  // 60 seconds timeout
retries: 3,      // 3 retries for failed page loads
```

After modifying, rebuild with `pnpm build`.

## Usage Examples

### Single File Processing

Process a single CSV file with default settings:

```bash
ai-scan-cli --input ai-pending-scans.csv --output ./results/
```

Process with custom batch configuration:

```bash
ai-scan-cli \
  --input ai-pending-scans.csv \
  --output ./results/output.csv \
  --batch-size 50 \
  --mini-batch-size 3 \
  --delay 10
```

Verbose mode to see detailed processing information:

```bash
ai-scan-cli --input ai-pending-scans.csv --verbose
```

### Directory Mode (Cron Job)

Process multiple CSV files from a directory:

```bash
ai-scan-cli \
  --input-dir /path/to/pending-scans/ \
  --output ./results/ \
  --log ./logs/ai-scan.log \
  --quiet \
  --json-summary
```

Process up to 5 files per run:

```bash
ai-scan-cli \
  --input-dir /path/to/pending-scans/ \
  --max-files 5 \
  --quiet
```

### Resume from Checkpoint

If processing is interrupted, resume from where it left off:

```bash
ai-scan-cli --input ai-pending-scans.csv --resume
```

Clear checkpoint and start fresh:

```bash
ai-scan-cli --input ai-pending-scans.csv --clear-checkpoint
```

### Dry Run

Validate input and show processing plan without executing:

```bash
ai-scan-cli --input ai-pending-scans.csv --dry-run
```

Output example:
```
=== Dry Run - Batch Plan ===
Total batches: 3
Total mini-batches: 15
Total URLs: 150
Batch size: 100
Mini-batch size: 5
  Batch 1: 100 scans, 10 mini-batches
  Batch 2: 50 scans, 5 mini-batches
```

### Check Prerequisites

Verify your environment is properly configured:

```bash
ai-scan-cli --check-prerequisites
```

Expected output when prerequisites are met:
```
=== Prerequisite Check ===

Claude CLI: ✓
  Version: 1.0.0

Playwright MCP: ✓
  Available MCP servers: playwright

✓ All prerequisites are met
```

## Cron Job Configuration

For automated batch processing, configure a cron job to run the CLI periodically.

### Example: Every 30 Minutes

```bash
# Edit crontab
crontab -e

# Add entry to run every 30 minutes
*/30 * * * * cd /path/to/tools/ai-scan-cli && node dist/index.js --input-dir /path/to/pending-scans/ --output /path/to/results/ --log /path/to/logs/ --quiet --json-summary >> /path/to/logs/cron.log 2>&1
```

### Recommended Options for Cron

- `--quiet`: Suppress progress output (reduces log noise)
- `--json-summary`: Output structured summary for monitoring
- `--max-files`: Limit files per run to prevent long-running jobs
- `--log`: Specify log file for debugging

### Full Cron Example

```bash
# Process up to 10 files every hour, log to file
0 * * * * cd /home/user/ada-wacg-compliance/tools/ai-scan-cli && node dist/index.js --input-dir /var/scans/pending/ --output /var/scans/results/ --max-files 10 --log /var/scans/logs/ --quiet --json-summary >> /var/scans/logs/cron.log 2>&1
```

### Directory Structure for Cron

When using `--input-dir`, the tool automatically creates and manages subdirectories:

```
/path/to/pending-scans/
├── pending-file-1.csv     # Files to process
├── pending-file-2.csv
├── processed/             # Successfully processed files (auto-created)
│   └── pending-file-1.csv
├── failed/                # Failed processing files (auto-created)
│   └── pending-file-2.csv
└── .ai-scan.lock          # Lock file (prevents concurrent runs)
```

### Lock File Behavior

The lock file prevents multiple instances from running simultaneously:

- Lock is automatically created when processing starts
- Lock is released when processing completes or is interrupted (SIGINT/SIGTERM)
- If another instance is running, the tool exits with code 3
- Stale locks (from crashed processes) should be manually removed

## Output Files

### Results CSV

The main output file contains scan results in a format compatible with the ADAShield admin import endpoint.

**Filename Pattern**:
- Single file: `ai-results-{input-basename}-{timestamp}.csv`
- Directory mode: Generated per input file

**Columns**:

| Column | Type | Description |
|--------|------|-------------|
| `scan_id` | string | Original scan ID from input |
| `url` | string | URL that was scanned |
| `page_title` | string | Page title extracted by AI |
| `wcag_level` | string | WCAG level (A, AA, AAA) |
| `ai_summary` | string | AI-generated summary of findings |
| `ai_remediation_plan` | string | AI-generated remediation recommendations |
| `ai_model` | string | AI model used (e.g., "claude-opus-4-5") |
| `total_issues` | number | Total issues found |
| `critical_count` | number | Critical severity issues |
| `serious_count` | number | Serious severity issues |
| `moderate_count` | number | Moderate severity issues |
| `minor_count` | number | Minor severity issues |
| `issues_with_ai_json` | string | JSON array of detailed issues |
| `status` | string | "COMPLETED" or "FAILED" |
| `error_message` | string | Error details (if failed) |

**Example Row**:
```csv
"scan_id","url","page_title","wcag_level","ai_summary",...
"scan-123","https://example.com","Example Site","AA","Found 5 accessibility issues...",...
```

### Failed Scans CSV

If any scans fail during processing, a separate CSV is created with failure details.

**Filename Pattern**: `failed-scans-{timestamp}.csv`

**Columns**:

| Column | Type | Description |
|--------|------|-------------|
| `scan_id` | string | Original scan ID from input |
| `url` | string | URL that failed to scan |
| `error_type` | string | Error category (TIMEOUT, RATE_LIMIT, etc.) |
| `error_message` | string | Detailed error message |

**Example**:
```csv
"scan_id","url","error_type","error_message"
"scan-456","https://timeout.com","TIMEOUT","Request exceeded 180 second timeout"
"scan-789","https://invalid.test","URL_UNREACHABLE","DNS resolution failed"
```

### Checkpoint File

When using `--resume`, a checkpoint file tracks processing progress.

**Filename**: `.ai-scan-checkpoint.json`

**Format**:
```json
{
  "inputFile": "ai-pending-scans.csv",
  "processedScanIds": ["scan-123", "scan-456", "scan-789"],
  "lastBatch": 0,
  "lastMiniBatch": 2,
  "startedAt": "2026-01-03T10:30:00.000Z",
  "updatedAt": "2026-01-03T10:35:22.000Z"
}
```

**Fields**:
- `inputFile`: Path to the input CSV being processed
- `processedScanIds`: Array of scan IDs already completed
- `lastBatch`: Last completed batch number (0-indexed)
- `lastMiniBatch`: Last completed mini-batch within batch (0-indexed)
- `startedAt`: When processing first started
- `updatedAt`: Last checkpoint update time

**Behavior**:
- Automatically saved after each mini-batch completes
- Deleted automatically when full processing completes
- Use `--clear-checkpoint` to manually reset

## Troubleshooting

### Claude Not Installed

**Error**: `Claude CLI: ✗`

**Solution**:
1. Install Claude Code CLI from https://claude.ai/code
2. Follow the authentication setup
3. Verify with: `claude --version`

### MCP Not Configured

**Error**: `Playwright MCP: ✗`

**Solution**:
1. Ensure Playwright MCP server is installed
2. Add to Claude Code MCP configuration
3. Restart Claude Code CLI
4. Verify with: `ai-scan-cli --check-prerequisites`

### Lock File Exists

**Error**: `Another instance is already running (PID 12345 on hostname)`

**Causes**:
- Another instance is currently processing files
- Previous instance crashed without cleaning up lock

**Solution**:
1. Check if process is actually running: `ps aux | grep ai-scan-cli`
2. If process exists, wait for it to complete
3. If process is dead (stale lock), manually remove lock file:
   ```bash
   rm /path/to/input-dir/.ai-scan.lock
   ```

### Rate Limiting

**Symptom**: Many scans failing with `RATE_LIMIT` error type

**Solution**:
1. Increase `--delay` between mini-batches (default: 5 seconds)
2. Reduce `--mini-batch-size` to process fewer URLs per Claude invocation
3. Example:
   ```bash
   ai-scan-cli --input scans.csv --delay 15 --mini-batch-size 3
   ```

### Timeout Errors

**Symptom**: Scans failing with `TIMEOUT` or `URL_UNREACHABLE` error type

**Current Configuration**:
- Page load timeout: **60 seconds** (per URL)
- Automatic retries: **3 attempts** with exponential backoff (5s, 10s, 20s delays)
- Claude analysis timeout: **180 seconds** (per mini-batch)

**Solution**:
1. Check network connectivity
2. Verify URLs are accessible (try opening in browser)
3. For slow-loading pages, the 60-second timeout should be sufficient
4. The CLI will automatically retry failed downloads up to 3 times
5. If still failing, check `failed-scans-{timestamp}.csv` for specific errors
6. To modify timeouts, edit `src/website-downloader.ts` and rebuild

### Out of Memory

**Symptom**: Process crashes during large batch processing

**Solution**:
1. Reduce `--batch-size` (default: 100)
2. Reduce `--mini-batch-size` (default: 5)
3. Process files one at a time instead of using `--input-dir`
4. Increase Node.js memory limit:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" ai-scan-cli --input scans.csv
   ```

### Invalid CSV Format

**Error**: `No valid scans found in input file`

**Solution**:
1. Verify CSV has required columns: `scan_id`, `url`, `wcag_level`
2. Check for proper CSV formatting (quoted fields, proper delimiters)
3. Ensure URLs are valid and complete (include protocol: https://)
4. Use `--verbose` to see which rows were skipped and why

### Permission Denied

**Error**: `EACCES: permission denied`

**Solution**:
1. Check file/directory permissions
2. Ensure write access to output directory
3. Ensure write access for log files
4. Example fix:
   ```bash
   chmod 755 /path/to/output/
   chmod 644 /path/to/input/scans.csv
   ```

### Checkpoint Issues

**Problem**: Resume not working as expected

**Solution**:
1. Verify checkpoint file exists: `ls -la .ai-scan-checkpoint.json`
2. Check checkpoint is valid JSON: `cat .ai-scan-checkpoint.json`
3. Clear and restart: `ai-scan-cli --input scans.csv --clear-checkpoint`
4. If corrupted, manually delete: `rm .ai-scan-checkpoint.json`

## Exit Codes

The tool uses specific exit codes for automation and monitoring:

| Code | Status | Description |
|------|--------|-------------|
| 0 | SUCCESS | All scans completed successfully |
| 1 | PARTIAL_FAILURE | Some scans failed but at least one succeeded |
| 2 | COMPLETE_FAILURE | All scans failed |
| 3 | LOCK_EXISTS | Another instance is already running |
| 4 | PREREQUISITES_MISSING | Required prerequisites are not met |

**Usage in scripts**:
```bash
ai-scan-cli --input scans.csv
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "All scans completed successfully"
elif [ $EXIT_CODE -eq 1 ]; then
  echo "Partial success - check failed-scans.csv"
elif [ $EXIT_CODE -eq 3 ]; then
  echo "Another instance running - skipping"
fi
```

## Support

For issues or questions:
1. Check this README for troubleshooting guidance
2. Verify prerequisites with `--check-prerequisites`
3. Use `--verbose` mode to get detailed diagnostic output
4. Review log files if using `--log` option
5. Check the specification documents in `.claude/specs/local-ai-scan-cli/`

## License

MIT
