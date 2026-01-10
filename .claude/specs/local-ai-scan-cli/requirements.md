# Requirements Document: Local AI Scan CLI (Claude Code + Playwright MCP)

## Introduction

The Local AI Scan CLI is a batch processing tool that leverages **Claude Code CLI** (`claude -p "<prompt>"`) with the **Playwright MCP server** to perform real-time ADA/WCAG accessibility scanning on pending URLs. This approach enables cost-effective scanning during the MVP phase by utilizing the administrator's personal Claude Code subscription.

### Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│  Input CSV      │────▶│  Batch Processor │────▶│  claude -p "<prompt>"   │
│  (pending URLs) │     │  (100 URL batch) │     │  + Playwright MCP       │
└─────────────────┘     └──────────────────┘     └─────────────────────────┘
                                │                           │
                                ▼                           ▼
                        ┌──────────────────┐     ┌─────────────────────────┐
                        │  Mini-batch (default=2)  │────▶│  Browser loads URL      │
                        │  Sequential run  │     │  Scans for WCAG issues  │
                        └──────────────────┘     │  Returns JSON results   │
                                                 └─────────────────────────┘
                                                            │
                                ┌───────────────────────────┘
                                ▼
                        ┌──────────────────┐     ┌─────────────────────────┐
                        │  Result Parser   │────▶│  Output CSV             │
                        │  Transform JSON  │     │  (compatible w/ import) │
                        └──────────────────┘     └─────────────────────────┘
```

### Cron-Job Automation Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CRON JOB AUTOMATION                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Admin downloads CSV ──▶ Drops in /input-dir/                         │
│                                                                         │
│   Cron runs every 30 min:                                              │
│   ./ai-scan-cli --input-dir /data/pending \                            │
│                  --output /data/results \                               │
│                  --log /var/log/ai-scan.log                            │
│                                                                         │
│   Tool behavior:                                                        │
│   1. Check for .csv files in /data/pending/                            │
│   2. Process each file sequentially                                     │
│   3. Move processed CSV to /data/pending/processed/                    │
│   4. Move failed CSV to /data/pending/failed/                          │
│   5. Write results to /data/results/ai-results-{filename}-{ts}.csv    │
│   6. Append logs to /var/log/ai-scan.log                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Workflow
1. **Parse CSV** → Extract URLs from exported pending scans
2. **Batch (100 URLs)** → Group URLs into manageable batches for checkpoint/resume
3. **Mini-batch (5 URLs)** → Submit 5 URLs per `claude -p` invocation
4. **Claude Code + Playwright** → Load pages, perform WCAG analysis, return structured results
5. **Transform & Export** → Convert results to import-compatible CSV format

## Alignment with Product Vision

This feature directly supports the following goals from `product.md`:

1. **AI Enhancement Phase (Phase 2)**:
   - Product goal: "AI Alt Text Analysis, AI Link Text Evaluation, AI Heading Analysis"
   - This tool provides browser-based AI scanning that evaluates real page content, not just static HTML

2. **Cost Optimization**:
   - Product goal: "Affordable, honest testing" for SMBs
   - Uses personal Claude Code subscription during MVP to validate approach before production API integration
   - Enables processing of customer scans without depleting production token budget

3. **Developer-First Approach**:
   - Product goal: "Clean API and CLI tools, CI/CD integration is first-class"
   - CLI-based workflow integrates with existing admin export/import mechanism
   - Cron-ready design enables 24/7 batch processing without manual intervention

4. **Agentic CLI Analysis (Phase 3)**:
   - Product goal: "Claude Code integration for deep analysis"
   - This tool serves as proof-of-concept for agentic analysis workflow
   - Validates the `claude -p` + Playwright MCP approach for production use

## Requirements

### Requirement 1: CSV Input Parsing

**User Story:** As an administrator, I want to parse the exported pending AI scan CSV, so that I can extract URLs for batch processing.

#### Acceptance Criteria

1. WHEN a CSV file path is provided via `--input` THEN the tool SHALL read and extract `scan_id`, `url`, `wcag_level` from each row
2. IF the CSV file does not exist THEN the tool SHALL display an error with the file path
3. IF a row has an empty or invalid URL THEN the tool SHALL skip that row and log a warning
4. WHEN parsing completes THEN the tool SHALL display total URLs found and any skipped rows
5. IF `--dry-run` flag is provided THEN the tool SHALL only validate CSV and show batch plan without processing

### Requirement 2: Batch Organization (100 URLs per Batch)

**User Story:** As an administrator, I want URLs grouped into batches of 100, so that I can track progress and resume from specific batches.

#### Acceptance Criteria

1. WHEN parsing completes THEN the tool SHALL organize URLs into batches of 100 (configurable via `--batch-size`)
2. WHEN creating batches THEN the tool SHALL preserve the original `scan_id` association with each URL
3. WHEN `--start-batch` is provided THEN the tool SHALL skip batches before that number
4. WHEN each batch completes THEN the tool SHALL log batch number and success/failure count
5. IF a batch fails completely THEN the tool SHALL log the batch number for manual retry

### Requirement 3: Mini-Batch Processing (Configurable URLs per Claude Invocation)

**User Story:** As an administrator, I want to configure how many URLs are processed per Claude Code invocation, so that I can optimize for context limits and reliability.

#### Acceptance Criteria

1. WHEN processing a batch THEN the tool SHALL split it into mini-batches based on `--mini-batch-size` (default: 5, range: 1-10)
2. WHEN invoking Claude Code THEN the tool SHALL use `claude -p "<prompt>"` with the configured number of URLs embedded in the prompt
3. WHEN `--delay` is provided THEN the tool SHALL wait that many seconds between mini-batch invocations (default: 5)
4. IF a mini-batch invocation fails THEN the tool SHALL retry up to 3 times before marking those URLs as failed
5. WHEN a mini-batch completes THEN the tool SHALL parse the JSON output and accumulate results

### Requirement 4: Browser-Based WCAG Scanning

**User Story:** As an administrator, I want the tool to load web pages in a real browser and analyze them for accessibility issues, so that I get accurate WCAG compliance results.

#### Acceptance Criteria

1. WHEN processing a URL THEN the tool SHALL use Claude Code with Playwright MCP to load the page in a browser
2. WHEN scanning a page THEN the tool SHALL analyze it against the WCAG level (A, AA, or AAA) specified in the CSV
3. WHEN scanning completes THEN the tool SHALL return structured JSON with: scan_id, url, page_title, issues array, summary, and remediationPlan
4. WHEN identifying issues THEN each issue SHALL include: ruleId, wcagCriteria, impact, description, helpText, htmlSnippet, cssSelector, aiExplanation, aiFixSuggestion, aiPriority
5. IF the browser fails to load a page THEN the tool SHALL mark the scan as failed with error details
6. IF `--prompt-template` is provided THEN the tool SHALL use the custom template file instead of the built-in prompt
7. WHEN `--verbose` is enabled THEN the tool SHALL display the prompt being sent to Claude Code

*Note: The specific prompt template structure will be defined in the design document.*

### Requirement 5: Result Parsing and Transformation

**User Story:** As an administrator, I want Claude Code's output parsed and transformed to match the existing import format, so that I can upload results back to ADAShield.

#### Acceptance Criteria

1. WHEN Claude Code returns output THEN the tool SHALL parse it as JSON
2. IF the output is not valid JSON THEN the tool SHALL attempt to extract JSON from markdown code blocks
3. IF JSON extraction fails THEN the tool SHALL mark those scans as failed and log the raw output
4. WHEN transforming results THEN the tool SHALL map fields to the import CSV schema:
   - `scan_id` → `scan_id`
   - `summary` → `ai_summary`
   - `remediationPlan` → `ai_remediation_plan`
   - `issues` → `issues_with_ai_json` (JSON string of AI-discovered issues)
5. WHEN transforming issues THEN each issue SHALL include `id` (generated UUID), `aiExplanation`, `aiFixSuggestion`, `aiPriority`

### Requirement 6: Output CSV Generation

**User Story:** As an administrator, I want the tool to generate a CSV compatible with the admin import API, so that I can update scan results in ADAShield.

#### Acceptance Criteria

1. WHEN processing completes THEN the tool SHALL write an output CSV with columns:
   - `scan_id`, `url`, `page_title`, `wcag_level`
   - `ai_summary`, `ai_remediation_plan`
   - `ai_model` (set to "claude-code-playwright")
   - `total_issues`, `critical_count`, `serious_count`, `moderate_count`, `minor_count`
   - `issues_with_ai_json` (AI-discovered issues array as JSON string)
   - `status` (COMPLETED or FAILED)
   - `error_message` (if failed)
2. WHEN `--output` specifies a directory THEN the tool SHALL write to `{output_dir}/ai-results-{input_filename}-{timestamp}.csv`
3. WHEN `--output` specifies a file path THEN the tool SHALL write to that exact path
4. WHEN `--output` is not provided THEN the tool SHALL write to `./ai-scan-results-{timestamp}.csv`
5. WHEN writing CSV THEN the tool SHALL properly escape JSON strings and special characters
6. WHEN each batch completes THEN the tool SHALL append results to output file (streaming write)

### Requirement 7: Progress Tracking and Resumption

**User Story:** As an administrator, I want to track progress and resume from interruptions, so that I don't re-scan already processed URLs.

#### Acceptance Criteria

1. WHEN processing starts THEN the tool SHALL create/update a checkpoint file (`.ai-scan-checkpoint.json`)
2. WHEN a mini-batch completes THEN the tool SHALL record processed `scan_id`s in the checkpoint
3. IF `--resume` flag is provided THEN the tool SHALL skip `scan_id`s already in the checkpoint
4. WHEN Ctrl+C is pressed THEN the tool SHALL save current checkpoint and exit gracefully
5. WHEN all processing completes THEN the tool SHALL display summary: processed, skipped, failed counts
6. WHEN `--clear-checkpoint` is provided THEN the tool SHALL delete the checkpoint file and start fresh

### Requirement 8: Error Handling and Logging

**User Story:** As an administrator, I want comprehensive error handling and logs, so that I can diagnose issues and retry failed scans.

#### Acceptance Criteria

1. WHEN an error occurs THEN the tool SHALL log: timestamp, batch number, mini-batch number, error message
2. IF Claude Code process times out THEN the tool SHALL log the timeout and continue to next mini-batch
3. IF a URL is unreachable THEN the tool SHALL record it as failed with "URL_UNREACHABLE" status
4. WHEN `--log` is provided THEN the tool SHALL append detailed logs to that file path
5. WHEN `--log` specifies a directory THEN the tool SHALL write to `{log_dir}/ai-scan-{date}.log`
6. WHEN processing completes THEN the tool SHALL write a `failed-scans-{timestamp}.csv` to the output directory
7. IF Claude Code returns a rate limit error THEN the tool SHALL wait with exponential backoff (starting at 60s) and retry
8. WHEN rate limit retry occurs THEN the tool SHALL log the wait time and retry count

### Requirement 9: Directory Mode for Cron Automation

**User Story:** As an administrator, I want to specify an input directory that the tool monitors for CSV files, so that I can automate processing via cron job.

#### Acceptance Criteria

1. WHEN `--input-dir` is provided THEN the tool SHALL scan the directory for `*.csv` files
2. IF no CSV files are found in the input directory THEN the tool SHALL log "No pending files" and exit with code 0
3. WHEN CSV files are found THEN the tool SHALL process them in alphabetical order (oldest first by filename)
4. WHEN a CSV file is successfully processed (all URLs completed or partially failed) THEN the tool SHALL move it to `{input_dir}/processed/` subdirectory
5. IF a CSV file fails completely (CSV parsing error OR 100% of URLs failed) THEN the tool SHALL move it to `{input_dir}/failed/` subdirectory
6. WHEN `--input-dir` is used THEN the tool SHALL create `processed/` and `failed/` subdirectories if they don't exist
7. WHEN running in directory mode THEN the tool SHALL create a lock file (`{input_dir}/.ai-scan.lock`) containing the process PID
8. IF lock file exists AND the PID in the lock file is still running THEN the tool SHALL exit with message "Another instance is running (PID: {pid})"
9. IF lock file exists AND the PID in the lock file is not running (stale lock) THEN the tool SHALL remove the lock and proceed
10. WHEN `--max-files` is provided THEN the tool SHALL only process that many CSV files per invocation (default: unlimited)

### Requirement 10: Cron-Friendly Output Mode

**User Story:** As an administrator, I want the tool to produce machine-readable output suitable for cron jobs, so that I can easily parse logs and monitor automation.

#### Acceptance Criteria

1. WHEN `--quiet` flag is provided THEN the tool SHALL suppress progress bars and interactive output
2. WHEN `--quiet` is enabled THEN the tool SHALL only output: start message, completion summary, and errors
3. WHEN running in directory mode THEN the tool SHALL default to `--quiet` behavior
4. WHEN `--json-summary` is provided THEN the tool SHALL output a JSON summary at the end:
   ```json
   {
     "status": "completed",
     "files_processed": 2,
     "total_urls": 150,
     "successful": 145,
     "failed": 5,
     "duration_seconds": 1234,
     "output_files": ["ai-results-file1.csv", "ai-results-file2.csv"]
   }
   ```
5. WHEN errors occur in cron mode THEN the tool SHALL exit with non-zero code (1 for partial failure, 2 for complete failure)
6. WHEN all files process successfully THEN the tool SHALL exit with code 0

### Requirement 11: Prerequisites Validation

**User Story:** As an administrator, I want the tool to validate prerequisites before starting, so that I can fix configuration issues early.

#### Acceptance Criteria

1. WHEN the tool starts THEN it SHALL verify that Claude Code CLI is installed by running `claude --version`
2. IF Claude Code CLI is not found THEN the tool SHALL display installation instructions and exit with code 2
3. WHEN the tool starts THEN it SHALL verify that Playwright MCP is configured by checking `claude mcp list`
4. IF Playwright MCP is not configured THEN the tool SHALL display a warning but continue (scan may fail later)
5. WHEN `--check-prerequisites` flag is provided THEN the tool SHALL only validate prerequisites and exit
6. WHEN prerequisites check passes THEN the tool SHALL log the Claude Code version and available MCP servers

## CLI Reference

### Command Line Options

| Option                      | Short | Description                              | Default   |
|-----------------------------|-------|------------------------------------------|-----------|
| `--input <file>`            | `-i`  | Single CSV file to process               | -         |
| `--input-dir <dir>`         | `-d`  | Directory to scan for CSV files (cron)   | -         |
| `--output <path>`           | `-o`  | Output file or directory for results     | `./`      |
| `--log <path>`              | `-l`  | Log file or directory                    | stdout    |
| `--batch-size=<n>`          | `-b`  | URLs per batch                           | 100       |
| `--mini-batch-size=<n>`     | `-m`  | URLs per Claude invocation (1-10)        | 5         |
| `--delay=<seconds>`         | -     | Delay between mini-batches               | 5         |
| `--start-batch=<n>`         | -     | Skip batches before this number          | 1         |
| `--max-files=<n>`           | -     | Max CSV files to process (dir mode)      | unlimited |
| `--prompt-template <file>`  | -     | Custom prompt template file              | built-in  |
| `--resume`                  | `-r`  | Resume from checkpoint                   | false     |
| `--clear-checkpoint`        | -     | Clear checkpoint and start fresh         | false     |
| `--dry-run`                 | -     | Validate without processing              | false     |
| `--check-prerequisites`     | -     | Only validate Claude CLI and MCP setup   | false     |
| `--verbose`                 | `-v`  | Show detailed output including prompts   | false     |
| `--quiet`                   | `-q`  | Minimal output (for cron)                | false     |
| `--json-summary`            | `-j`  | Output JSON summary at end               | false     |
| `--help`                    | `-h`  | Show help                                | -         |

### Example Usage

```bash
# Single file processing
./ai-scan-cli --input pending-scans.csv --output ./results/

# Custom mini-batch size (2 URLs per Claude invocation)
./ai-scan-cli --input pending.csv --mini-batch-size=2 --output ./results/

# Smaller batches for testing
./ai-scan-cli -i pending.csv -m 1 -b 10 --verbose

# Cron job setup (process directory)
./ai-scan-cli --input-dir /data/pending \
              --output /data/results \
              --log /var/log/ai-scan.log \
              --quiet

# Cron with JSON summary for monitoring
./ai-scan-cli -d /data/pending -o /data/results -l /var/log/ai-scan.log -q -j

# Resume interrupted processing
./ai-scan-cli --input large-file.csv --resume

# Dry run to preview batch plan
./ai-scan-cli --input pending.csv --dry-run

# Check prerequisites before first run
./ai-scan-cli --check-prerequisites

# Process max 5 files per cron run
./ai-scan-cli --input-dir /data/pending --max-files=5 --output /data/results
```

### Cron Configuration Example

```cron
# Run every 30 minutes
*/30 * * * * /usr/local/bin/ai-scan-cli \
    --input-dir /home/admin/ai-scans/pending \
    --output /home/admin/ai-scans/results \
    --log /var/log/ai-scan/scan.log \
    --quiet \
    >> /var/log/ai-scan/cron.log 2>&1
```

## Non-Functional Requirements

### Performance
- Mini-batch of 5 URLs should complete in under 3 minutes (includes page load + analysis)
- Tool should handle input CSV with up to 10,000 URLs without memory issues
- Checkpoint writes should be atomic (write to temp file, then rename)
- Directory scanning should complete in under 1 second for up to 1000 files

### Reliability
- Tool must handle Claude Code process crashes gracefully
- Tool must handle network timeouts for page loads
- Partial results must be preserved if tool is interrupted
- Tool must validate JSON output before writing to CSV
- Lock file mechanism must prevent data corruption from concurrent runs

### Security
- Tool must not log sensitive data from scanned pages
- Lock files must be cleaned up on normal exit
- File permissions on output should be 644 (readable by others for import)

### Usability
- `--help` must show all options with examples
- Progress display should show: current batch, mini-batch, URL being processed, ETA
- Color-coded output: green for success, yellow for warnings, red for errors
- Quiet mode must still show critical errors

### Compatibility
- Must work with Claude Code CLI installed via `npm install -g @anthropic-ai/claude-code`
- Must work with Playwright MCP server configured in Claude Code
- Output CSV must be compatible with existing `/admin/ai/import` endpoint
- Must work on Linux (for cron), macOS, and Windows

---

*Last Updated: January 2026*
*Version: 5.0*
