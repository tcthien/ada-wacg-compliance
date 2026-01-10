# Implementation Plan: Local AI Scan CLI

## Task Overview

This implementation plan breaks down the Local AI Scan CLI tool into atomic, agent-friendly tasks. The tool processes pending accessibility scan URLs by invoking Claude Code CLI with Playwright MCP to perform real browser-based WCAG analysis.

**Implementation Strategy**:
1. **Foundation Phase**: Project setup, types, and utilities (Tasks 1-4)
2. **Core Components Phase**: CSV parsing, batch organization, prompt generation (Tasks 5-10)
3. **Processing Phase**: Claude invocation, result parsing, transformation (Tasks 11-18)
4. **State Management Phase**: Checkpoint, lock files, directory scanning (Tasks 19-25)
5. **Orchestration Phase**: Mini-batch processor, CLI entry point (Tasks 26-30)
6. **Testing Phase**: Unit tests for all components (Tasks 31-38)
7. **Integration Phase**: End-to-end testing and documentation (Tasks 39-41)

## Steering Document Compliance

- **structure.md**: Tool located in `tools/ai-scan-cli/`, kebab-case file names
- **tech.md**: Node.js/TypeScript, pnpm, Vitest for testing, ESLint + Prettier

## Atomic Task Requirements
**Each task must meet these criteria for optimal agent execution:**
- **File Scope**: Touches 1-3 related files maximum
- **Time Boxing**: Completable in 15-30 minutes
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Must specify exact files to create/modify
- **Agent-Friendly**: Clear input/output with minimal context switching

---

## Phase 1: Foundation (Tasks 1-5)

- [x] 1a. Create package.json with dependencies
  - File: `tools/ai-scan-cli/package.json`
  - Add dependencies with exact versions:
    - commander@^11.0.0 (CLI argument parsing)
    - csv-parse@^5.5.0 (CSV reading)
    - csv-stringify@^6.4.0 (CSV writing)
    - handlebars@^4.7.0 (prompt templating)
    - chalk@^5.3.0 (terminal colors)
  - Add devDependencies:
    - typescript@^5.3.0
    - vitest@^1.0.0
    - @types/node@^20.0.0
  - Add scripts: build, start, test, lint
  - Set "type": "module" for ESM support (chalk v5 requires ESM)
  - Purpose: Define project dependencies and scripts
  - _Requirements: NFR: Technical Standards, Compatibility_

- [x] 1b. Create tsconfig.json with strict TypeScript configuration
  - File: `tools/ai-scan-cli/tsconfig.json`
  - Set strict mode enabled
  - Set target: ES2022
  - Set module: Node16, moduleResolution: Node16
  - Set outDir: "./dist", rootDir: "./src"
  - Enable sourceMap for debugging
  - Include src/**/*.ts, exclude node_modules
  - Purpose: Configure TypeScript compiler for Node.js
  - _Requirements: NFR: Technical Standards_

- [x] 2. Create shared types and exit codes in src/types.ts
  - File: `tools/ai-scan-cli/src/types.ts`
  - Define ExitCode constants (SUCCESS=0, PARTIAL_FAILURE=1, COMPLETE_FAILURE=2, LOCK_EXISTS=3, PREREQUISITES_MISSING=4)
  - Define ExitCodeDescription map
  - Define PendingScan, Issue, ScanResult, ImportRow interfaces
  - Define ErrorType enum (TIMEOUT, RATE_LIMIT, PROCESS_CRASH, INVALID_OUTPUT, UNKNOWN)
  - Purpose: Establish type safety for all components
  - _Requirements: 5.4, 5.5, 10.5_

- [x] 3. Create Logger utility in src/logger.ts
  - File: `tools/ai-scan-cli/src/logger.ts`
  - Implement Logger class with info, success, warning, error, debug, progress methods
  - Add chalk-based color coding (green=success, yellow=warning, red=error)
  - Support quiet mode (suppress non-critical output)
  - Support verbose mode (show debug messages)
  - Support log file output when --log is provided
  - Purpose: Provide consistent logging across all components
  - _Leverage: chalk library_
  - _Requirements: 8.1, 8.4, 10.1, 10.2_

- [x] 4. Create default prompt template file
  - File: `tools/ai-scan-cli/templates/default-prompt.hbs`
  - Create Handlebars template with WCAG scanning instructions
  - Include {{wcagLevel}} and {{#each scans}} placeholders
  - Define expected JSON output format with issues array structure
  - Include impact levels (CRITICAL, SERIOUS, MODERATE, MINOR) and priority scoring (1-10)
  - Purpose: Provide default prompt for Claude Code invocation
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

---

## Phase 2: Input Processing (Tasks 5-10)

- [x] 5. Create CSV Parser in src/csv-parser.ts
  - File: `tools/ai-scan-cli/src/csv-parser.ts`
  - Implement parseInputCsv() function using csv-parse library
  - Extract scan_id, url, wcag_level from each row
  - Return ParseResult with scans array, skipped rows, and totalRows
  - Handle empty/invalid URLs by skipping and logging warning
  - Purpose: Parse exported pending scans CSV
  - _Leverage: csv-parse library, src/types.ts_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 6. Create Batch Organizer in src/batch-organizer.ts
  - File: `tools/ai-scan-cli/src/batch-organizer.ts`
  - Implement organizeBatches() function to split scans into batches of N (default: 100)
  - Split each batch into mini-batches of M (default: 5, range: 1-10)
  - Preserve scan_id association with each URL
  - Return Batch[] with batchNumber, scans, and miniBatches arrays
  - Purpose: Organize URLs for efficient batch processing
  - _Leverage: src/types.ts_
  - _Requirements: 2.1, 2.2, 3.1_

- [x] 7a. Create Prompt Generator core in src/prompt-generator.ts
  - File: `tools/ai-scan-cli/src/prompt-generator.ts`
  - Implement generatePrompt() using Handlebars to render template with scans and wcagLevel
  - Implement getDefaultTemplatePath() to resolve default template location relative to package
  - Load default template from templates/default-prompt.hbs
  - Purpose: Generate prompts for Claude Code invocation
  - _Leverage: handlebars library, templates/default-prompt.hbs_
  - _Requirements: 4.6_

- [x] 7b. Add template validation and custom loading to Prompt Generator
  - File: `tools/ai-scan-cli/src/prompt-generator.ts` (continue from task 7a)
  - Implement loadCustomTemplate() to read custom template from file path
  - Implement validateTemplate() to check required placeholders:
    - {{#each scans}} - iterate over scan URLs
    - {{wcagLevel}} - WCAG compliance level
    - {{this.url}} - scan URL
    - {{this.scanId}} - scan identifier
  - Throw error if validation fails with list of missing placeholders
  - Try Handlebars.compile() to catch syntax errors
  - Purpose: Support custom prompt templates with validation
  - _Leverage: design.md Component 5 (lines 259-299) for validation logic_
  - _Requirements: 4.7_

- [x] 8. Create Prerequisites Checker in src/prerequisites.ts
  - File: `tools/ai-scan-cli/src/prerequisites.ts`
  - Implement checkPrerequisites() to verify Claude CLI and Playwright MCP
  - Execute `claude --version` and parse version string
  - Execute `claude mcp list` and check for "playwright" server
  - Return PrerequisiteResult with claudeInstalled, claudeVersion, playwrightMcpConfigured, errors
  - Display installation instructions if Claude not found
  - Purpose: Validate environment before processing
  - _Leverage: child_process, src/types.ts_
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 9. Create Claude Code Invoker in src/claude-invoker.ts
  - File: `tools/ai-scan-cli/src/claude-invoker.ts`
  - Implement invokeClaudeCode() to execute `claude -p "<prompt>" --output-format json`
  - Handle timeout with configurable limit (default: 180000ms)
  - Detect error types with specific patterns:
    - TIMEOUT: child process exceeds timeout or SIGKILL signal sent
    - RATE_LIMIT: output contains "rate limit" or "429" or exit code 429
    - PROCESS_CRASH: non-zero exit code (except timeout/rate limit cases)
    - INVALID_OUTPUT: process succeeds but output is not valid JSON
  - Implement retry logic with exponential backoff:
    - General errors: delay = 5000 * (2 ^ attemptNumber) → 5s, 10s, 20s
    - Rate limit: delay = 60000 * (2 ^ attemptNumber) → 60s, 120s, 240s
  - Catch SIGTERM/SIGINT to kill child process cleanly using child.kill()
  - Purpose: Execute Claude Code commands and capture output
  - _Leverage: child_process.spawn, src/types.ts, src/logger.ts, design.md Component 6 (lines 301-344)_
  - _Requirements: 3.2, 3.4, 8.2, 8.7_

- [x] 10. Add rate limit logging to Claude Code Invoker
  - File: `tools/ai-scan-cli/src/claude-invoker.ts` (continue from task 9)
  - Log wait time and retry count when rate limit detected
  - Track and return durationMs for each invocation
  - Return InvocationResult with success, output, error, errorType, durationMs
  - Purpose: Complete Claude invoker with proper logging
  - _Leverage: src/logger.ts_
  - _Requirements: 8.8_

---

## Phase 3: Output Processing (Tasks 11-18)

- [x] 11. Create Result Parser core in src/result-parser.ts
  - File: `tools/ai-scan-cli/src/result-parser.ts`
  - Implement parseClaudeOutput() to parse JSON from Claude Code output
  - Implement extractJsonFromMarkdown() using regex `/```(?:json)?\s*([\s\S]*?)```/`
  - If direct JSON.parse fails, try markdown extraction
  - If extraction fails, try finding array pattern `/\[\s*\{[\s\S]*\}\s*\]/`
  - Purpose: Extract structured data from Claude Code output
  - _Leverage: src/types.ts_
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 12. Add issue normalization to Result Parser
  - File: `tools/ai-scan-cli/src/result-parser.ts` (continue from task 11)
  - Implement normalizeIssue() to convert raw issue to Issue interface
  - Generate UUID for each issue using crypto.randomUUID()
  - Normalize helpUrl to empty string if undefined/null
  - Validate impact level (CRITICAL, SERIOUS, MODERATE, MINOR)
  - Default aiPriority to 5 if not provided
  - Purpose: Ensure consistent issue structure
  - _Leverage: crypto module, src/types.ts_
  - _Requirements: 5.4, 5.5_

- [x] 13. Create Result Transformer in src/result-transformer.ts
  - File: `tools/ai-scan-cli/src/result-transformer.ts`
  - Implement transformToImportFormat() to convert ScanResult[] to ImportRow[]
  - Map fields: summary→ai_summary, remediationPlan→ai_remediation_plan, issues→issues_with_ai_json
  - Set ai_model to "claude-code-playwright"
  - Implement countIssuesByImpact() to calculate critical/serious/moderate/minor counts
  - Purpose: Transform results to import-compatible format
  - _Leverage: src/types.ts_
  - _Requirements: 5.4, 6.1_

- [x] 14. Create CSV Writer core in src/csv-writer.ts
  - File: `tools/ai-scan-cli/src/csv-writer.ts`
  - Implement writeCsv() using csv-stringify library
  - Support append mode for streaming writes
  - Properly escape JSON strings and special characters
  - Set file permissions to 0o644
  - Purpose: Write results to output CSV
  - _Leverage: csv-stringify library, src/types.ts_
  - _Requirements: 6.5, 6.6_

- [x] 15. Add output path generation to CSV Writer
  - File: `tools/ai-scan-cli/src/csv-writer.ts` (continue from task 14)
  - Implement generateDefaultOutputPath() returning `./ai-scan-results-{timestamp}.csv`
  - Implement generateOutputPath() for directory-based output
  - Handle both file path and directory outputs
  - Purpose: Generate appropriate output file paths
  - _Requirements: 6.2, 6.3, 6.4_

- [x] 16. Create Summary Generator in src/summary-generator.ts
  - File: `tools/ai-scan-cli/src/summary-generator.ts`
  - Implement generateSummary() to create ProcessingSummary object
  - Calculate status: completed, partial_failure, complete_failure
  - Track files_processed, total_urls, successful, failed, skipped, duration_seconds
  - Purpose: Generate processing summary for cron mode
  - _Leverage: src/types.ts_
  - _Requirements: 10.4_

- [x] 17. Add JSON summary output to Summary Generator
  - File: `tools/ai-scan-cli/src/summary-generator.ts` (continue from task 16)
  - Implement printJsonSummary() to output JSON to stdout
  - Include output_files, failed_files, errors arrays
  - Purpose: Enable machine-readable summary output
  - _Requirements: 10.4_

- [x] 18. Create failed scans CSV writer
  - File: `tools/ai-scan-cli/src/csv-writer.ts` (add function)
  - Implement writeFailedScansCsv() to write failed scans to separate file
  - Generate filename: `failed-scans-{timestamp}.csv`
  - Include scan_id, url, error_type, error_message columns
  - Purpose: Track failed scans for retry
  - _Requirements: 8.6_

---

## Phase 4: State Management (Tasks 19-25)

- [x] 19. Create Checkpoint Manager core in src/checkpoint-manager.ts
  - File: `tools/ai-scan-cli/src/checkpoint-manager.ts`
  - Implement loadCheckpoint() to read checkpoint from JSON file
  - Implement clearCheckpoint() to delete checkpoint file
  - Define Checkpoint interface with inputFile, processedScanIds, lastBatch, lastMiniBatch, startedAt, updatedAt
  - Purpose: Track progress for resume capability
  - _Leverage: fs/promises, src/types.ts_
  - _Requirements: 7.1, 7.6_

- [x] 20. Add atomic checkpoint saves to Checkpoint Manager
  - File: `tools/ai-scan-cli/src/checkpoint-manager.ts` (continue from task 19)
  - Implement saveCheckpoint() with atomic write (temp file + rename)
  - Implement markProcessed() to buffer scan IDs in memory
  - Implement flush() to write buffered changes to disk
  - Purpose: Ensure checkpoint integrity on crash
  - _Leverage: fs/promises_
  - _Requirements: 7.2, 7.4, NFR: Checkpoint atomicity_

- [x] 21. Create Lock File Manager core in src/lock-manager.ts
  - File: `tools/ai-scan-cli/src/lock-manager.ts`
  - Implement acquireLock() with exclusive file creation (flag: 'wx')
  - Implement releaseLock() to remove lock file
  - Define LockInfo interface with pid, startedAt, hostname
  - Purpose: Prevent concurrent execution in directory mode
  - _Leverage: fs/promises, os module_
  - _Requirements: 9.7, 9.8_

- [x] 22. Add stale lock detection to Lock File Manager
  - File: `tools/ai-scan-cli/src/lock-manager.ts` (continue from task 21)
  - Implement isProcessRunning() using process.kill(pid, 0)
  - Implement isLockStale() checking PID existence and lock age (>24 hours)
  - Remove and retry if stale lock detected
  - Purpose: Handle orphaned lock files
  - _Requirements: 9.9_

- [x] 23. Create Directory Scanner core in src/directory-scanner.ts
  - File: `tools/ai-scan-cli/src/directory-scanner.ts`
  - Implement scanDirectory() to find *.csv files in directory
  - Sort files alphabetically (oldest first by filename)
  - Support maxFiles parameter to limit files per invocation
  - Return ScannerResult with files array and totalFound
  - Purpose: Find CSV files for batch processing
  - _Leverage: fs/promises, path_
  - _Requirements: 9.1, 9.3, 9.10_

- [x] 24. Add subdirectory management to Directory Scanner
  - File: `tools/ai-scan-cli/src/directory-scanner.ts` (continue from task 23)
  - Implement ensureSubdirectories() to create processed/ and failed/ directories
  - Implement moveFile() to move processed/failed files to subdirectories
  - Purpose: Organize processed files
  - _Requirements: 9.4, 9.5, 9.6_

- [x] 25. Handle empty directory case in Directory Scanner
  - File: `tools/ai-scan-cli/src/directory-scanner.ts` (continue from task 24)
  - Return empty array if no CSV files found
  - Log "No pending files" message
  - Purpose: Handle edge case gracefully
  - _Requirements: 9.2_

---

## Phase 5: Orchestration (Tasks 26-30)

- [x] 26. Create Mini-Batch Processor core in src/mini-batch-processor.ts
  - File: `tools/ai-scan-cli/src/mini-batch-processor.ts`
  - Define MiniBatchProcessorOptions interface with delay, timeout, retries, verbose
  - Define MiniBatchResult and FailedScan interfaces
  - Create MiniBatchProcessor class constructor
  - Purpose: Orchestrate mini-batch processing
  - _Leverage: src/types.ts, src/prompt-generator.ts, src/claude-invoker.ts, src/result-parser.ts_
  - _Requirements: 3.1, 3.3_

- [x] 27. Implement mini-batch processing logic
  - File: `tools/ai-scan-cli/src/mini-batch-processor.ts` (continue from task 26)
  - Implement processMiniBatch() to generate prompt, invoke Claude, parse results
  - Add delay between mini-batches using setTimeout
  - Log prompt in verbose mode via logger.debug()
  - Track retry count and apply exponential backoff
  - Purpose: Process individual mini-batches
  - _Leverage: src/logger.ts, src/checkpoint-manager.ts_
  - _Requirements: 3.3, 3.4, 3.5, 4.7_

- [x] 28. Implement batch processing with checkpoints
  - File: `tools/ai-scan-cli/src/mini-batch-processor.ts` (continue from task 27)
  - Implement processBatch() to iterate through mini-batches
  - Call checkpointManager.markProcessed() after each successful mini-batch
  - Handle progress callback for UI updates
  - Log rate limit wait time and retry count
  - Purpose: Complete batch processing with state tracking
  - _Leverage: src/checkpoint-manager.ts_
  - _Requirements: 7.2, 8.8_

- [x] 29a. Set up Commander.js with core CLI options
  - File: `tools/ai-scan-cli/src/cli.ts`
  - Set up Commander.js program with name, version, description
  - Add core options:
    - --input, -i <file>: Single CSV file to process
    - --output, -o <path>: Output file or directory (default: ./)
    - --batch-size, -b <n>: URLs per batch (default: 100)
    - --mini-batch-size, -m <n>: URLs per Claude invocation (default: 5, range: 1-10)
    - --delay <seconds>: Delay between mini-batches (default: 5)
    - --start-batch <n>: Skip batches before this number (default: 1)
  - Define CliOptions interface with all option types
  - Display help with --help flag
  - Purpose: Parse core CLI arguments for single-file mode
  - _Leverage: commander library, src/types.ts_
  - _Requirements: 1.1, 2.1, 2.3, 3.1-3.3_

- [x] 29b. Add advanced CLI options for directory mode and features
  - File: `tools/ai-scan-cli/src/cli.ts` (continue from task 29a)
  - Add directory mode options:
    - --input-dir, -d <dir>: Directory to scan for CSV files
    - --max-files <n>: Max CSV files to process per invocation
    - --log, -l <path>: Log file or directory
  - Add checkpoint options:
    - --resume, -r: Resume from checkpoint
    - --clear-checkpoint: Clear checkpoint and start fresh
  - Add feature flags:
    - --prompt-template <file>: Custom prompt template
    - --dry-run: Validate without processing
    - --check-prerequisites: Only validate environment
    - --verbose, -v: Show detailed output including prompts
    - --quiet, -q: Minimal output for cron
    - --json-summary, -j: Output JSON summary at end
  - Purpose: Complete CLI with all advanced options
  - _Leverage: commander library_
  - _Requirements: 4.6, 4.7, 7.3, 7.6, 8.4, 9.1, 9.10, 10.1-10.4, 11.5_

- [x] 30a. Implement main execution flow for single-file mode
  - File: `tools/ai-scan-cli/src/cli.ts` (continue from task 29b)
  - Implement main() function structure with try/catch error handling
  - Handle --check-prerequisites flag: run prerequisite check and exit
  - Handle --dry-run flag: parse CSV, show batch plan, exit without processing
  - Implement single-file processing flow:
    1. Parse input CSV with csvParser
    2. Organize into batches with batchOrganizer
    3. Load/create checkpoint if --resume
    4. Process batches with miniBatchProcessor
    5. Write results with csvWriter
    6. Generate summary with summaryGenerator
  - Purpose: Complete single-file processing workflow
  - _Leverage: All component modules_
  - _Requirements: 1.5, 11.5_

- [x] 30b. Implement main execution flow for directory mode
  - File: `tools/ai-scan-cli/src/cli.ts` (continue from task 30a)
  - Implement directory mode processing flow:
    1. Scan directory for CSV files with directoryScanner
    2. Acquire lock with lockManager (exit if lock exists)
    3. Process each file sequentially (reuse single-file logic)
    4. Move processed files to processed/ subdirectory
    5. Move failed files to failed/ subdirectory
    6. Release lock on completion
  - Default to --quiet behavior in directory mode
  - Respect --max-files limit
  - Purpose: Complete directory mode workflow for cron automation
  - _Leverage: src/directory-scanner.ts, src/lock-manager.ts_
  - _Requirements: 9.1-9.10, 10.3_

- [x] 30c. Add graceful shutdown and exit code handling
  - File: `tools/ai-scan-cli/src/cli.ts` (continue from task 30b)
  - Implement setupGracefulShutdown() function:
    - Register SIGINT handler (Ctrl+C)
    - Register SIGTERM handler (kill command)
    - On signal: set isShuttingDown flag, flush checkpoint, release lock, exit
    - Prevent double-shutdown with guard flag
  - Implement determineExitCode() function:
    - Return SUCCESS (0) if all URLs processed successfully
    - Return PARTIAL_FAILURE (1) if some URLs failed
    - Return COMPLETE_FAILURE (2) if no processing completed
    - Return LOCK_EXISTS (3) if another instance running
    - Return PREREQUISITES_MISSING (4) if Claude CLI not found
  - Output JSON summary if --json-summary enabled
  - Purpose: Handle interruptions gracefully and return proper exit codes
  - _Leverage: design.md CLI Entry Point (lines 96-132) for implementation_
  - _Requirements: 7.4, 7.5, 10.5, 10.6_

---

## Phase 6: Unit Tests (Tasks 31-38)

- [x] 31. Create CSV Parser tests
  - File: `tools/ai-scan-cli/tests/csv-parser.test.ts`
  - Test cases:
    - Valid CSV with 5 rows → returns 5 PendingScan objects
    - Empty CSV file → returns empty array with totalRows=0
    - CSV with empty URL in row 3 → skips row 3, logs warning
    - CSV with invalid wcag_level → skips row, logs warning
    - Malformed CSV (unclosed quote) → throws error with line number
    - CSV with 1000 rows → returns all rows without memory issues
  - Purpose: Validate CSV parser reliability
  - _Leverage: vitest, src/csv-parser.ts_
  - _Requirements: 1.1-1.4_

- [x] 32. Create Batch Organizer tests
  - File: `tools/ai-scan-cli/tests/batch-organizer.test.ts`
  - Test cases:
    - 10 URLs, batchSize=100 → 1 batch with 10 URLs
    - 150 URLs, batchSize=100 → 2 batches (100 + 50)
    - 100 URLs, miniBatchSize=5 → 20 mini-batches per batch
    - 7 URLs, miniBatchSize=5 → 2 mini-batches (5 + 2)
    - Empty input → returns empty array
    - Single URL → 1 batch, 1 mini-batch
    - miniBatchSize=1 to 10 → correct mini-batch counts
  - Purpose: Validate batch organization logic
  - _Leverage: vitest, src/batch-organizer.ts_
  - _Requirements: 2.1, 2.2, 3.1_

- [x] 33. Create Result Parser tests
  - File: `tools/ai-scan-cli/tests/result-parser.test.ts`
  - Test cases:
    - Direct JSON array → parses successfully
    - JSON in ```json``` code block → extracts and parses
    - JSON in bare ``` code block → extracts and parses
    - Array pattern with surrounding text → extracts array
    - Malformed JSON → returns empty results, no throw
    - Issue missing helpUrl → normalizes to empty string
    - Issue missing aiPriority → defaults to 5
    - Issue with invalid impact → defaults to MODERATE
  - Purpose: Validate result parsing robustness
  - _Leverage: vitest, src/result-parser.ts_
  - _Requirements: 5.1-5.5_

- [x] 34. Create Checkpoint Manager tests
  - File: `tools/ai-scan-cli/tests/checkpoint-manager.test.ts`
  - Test cases:
    - Save checkpoint → creates JSON file with correct structure
    - Load existing checkpoint → returns Checkpoint object
    - Load non-existent checkpoint → returns null
    - Atomic write → temp file removed after rename
    - markProcessed() → buffers scan IDs in memory
    - flush() → writes buffered IDs to file
    - Clear checkpoint → removes file from disk
    - Resume with 50 processed IDs → skips those IDs
  - Purpose: Validate checkpoint persistence
  - _Leverage: vitest, src/checkpoint-manager.ts, fs/promises_
  - _Requirements: 7.1-7.6_

- [x] 35. Create Lock Manager tests
  - File: `tools/ai-scan-cli/tests/lock-manager.test.ts`
  - Test cases:
    - Acquire lock (no existing) → creates lock file, returns true
    - Acquire lock (existing, running PID) → returns false
    - Acquire lock (existing, dead PID) → removes stale, acquires, returns true
    - Acquire lock (existing, >24h old) → removes stale, acquires, returns true
    - Release lock → removes lock file
    - Concurrent acquire attempts → only one succeeds (use 'wx' flag)
    - isProcessRunning with current PID → returns true
    - isProcessRunning with invalid PID → returns false
  - Purpose: Validate lock file mechanism
  - _Leverage: vitest, src/lock-manager.ts, child_process for spawning test processes_
  - _Requirements: 9.7-9.9_

- [x] 36. Create Mini-Batch Processor tests
  - File: `tools/ai-scan-cli/tests/mini-batch-processor.test.ts`
  - Test cases:
    - Process 5-URL mini-batch → returns 5 ScanResults
    - Claude invocation fails → retries 3 times with backoff
    - All retries fail → returns FailedScan entries
    - Delay between batches → waits specified seconds (mock timers)
    - Verbose mode → logs prompt via logger.debug()
    - Rate limit error → uses 60s base delay for retry
    - Checkpoint updated → markProcessed called with scan IDs
  - Purpose: Validate orchestration logic
  - _Leverage: vitest, src/mini-batch-processor.ts (with mocked dependencies)_
  - _Requirements: 3.3-3.5_

- [x] 37. Create Summary Generator tests
  - File: `tools/ai-scan-cli/tests/summary-generator.test.ts`
  - Test cases:
    - All URLs successful → status = "completed"
    - Some URLs failed → status = "partial_failure"
    - All URLs failed → status = "complete_failure"
    - 100 successful, 5 failed → correct counts in summary
    - Duration calculation → correct seconds from start to end
    - JSON output format → valid JSON with all required fields
  - Purpose: Validate summary generation
  - _Leverage: vitest, src/summary-generator.ts_
  - _Requirements: 10.4_

- [x] 38. Create Prompt Generator tests
  - File: `tools/ai-scan-cli/tests/prompt-generator.test.ts`
  - Test cases:
    - Default template with 3 scans → renders all URLs and scan IDs
    - wcagLevel="AAA" → appears in rendered prompt
    - Custom template path → loads and uses custom template
    - Custom template missing {{wcagLevel}} → throws validation error
    - Custom template with syntax error → throws Handlebars error
    - getDefaultTemplatePath() → returns valid path to templates/default-prompt.hbs
  - Purpose: Validate prompt generation
  - _Leverage: vitest, src/prompt-generator.ts_
  - _Requirements: 4.6, 4.7_

---

## Phase 7: Integration (Tasks 39-41)

- [x] 39. Create integration test for single file processing
  - File: `tools/ai-scan-cli/tests/integration.test.ts`
  - Test end-to-end flow with sample CSV (mocked Claude invocation)
  - Verify output CSV format matches import schema
  - Verify checkpoint creation and cleanup
  - Purpose: Validate component integration
  - _Leverage: vitest, all component modules_
  - _Requirements: All_

- [x] 40. Create integration test for directory mode
  - File: `tools/ai-scan-cli/tests/integration.test.ts` (continue from task 39)
  - Test directory scanning with multiple CSV files
  - Verify lock file creation and release
  - Verify file movement to processed/failed directories
  - Test JSON summary output
  - Purpose: Validate directory mode workflow
  - _Requirements: 9.1-9.10, 10.4_

- [x] 41. Create README documentation
  - File: `tools/ai-scan-cli/README.md`
  - Document installation and prerequisites
  - Document all CLI options with examples
  - Document cron job configuration
  - Document troubleshooting common issues
  - Purpose: Provide user documentation
  - _Requirements: NFR: Usability_

---

## Dependency Graph

```
Phase 1 (Foundation)
├── Task 1a: package.json
├── Task 1b: tsconfig.json
├── Task 2: types.ts ─────────────────────────────────┐
├── Task 3: logger.ts ──────────────────────────────┐ │
└── Task 4: default-prompt.hbs                      │ │
                                                    │ │
Phase 2 (Input)                                     │ │
├── Task 5: csv-parser.ts ◄─────────────────────────┼─┤
├── Task 6: batch-organizer.ts ◄────────────────────┼─┤
├── Task 7a-7b: prompt-generator.ts ◄───────────────┼─┤
├── Task 8: prerequisites.ts ◄──────────────────────┼─┤
├── Task 9-10: claude-invoker.ts ◄──────────────────┴─┤
                                                      │
Phase 3 (Output)                                      │
├── Task 11-12: result-parser.ts ◄────────────────────┤
├── Task 13: result-transformer.ts ◄──────────────────┤
├── Task 14-15, 18: csv-writer.ts ◄───────────────────┤
└── Task 16-17: summary-generator.ts ◄────────────────┤
                                                      │
Phase 4 (State)                                       │
├── Task 19-20: checkpoint-manager.ts ◄───────────────┤
├── Task 21-22: lock-manager.ts ◄─────────────────────┤
└── Task 23-25: directory-scanner.ts ◄────────────────┤
                                                      │
Phase 5 (Orchestration)                               │
├── Task 26-28: mini-batch-processor.ts ◄─────────────┘
│                    ▲
│                    │ (uses all components)
├── Task 29a-29b: cli.ts (argument parsing)
└── Task 30a-30c: cli.ts (execution flow) ◄───────────┘

Phase 6 (Tests) ← depends on corresponding components
Phase 7 (Integration) ← depends on all components
```

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Foundation | 1a, 1b, 2, 3, 4 | Project setup, types, logger, template |
| 2. Input | 5, 6, 7a, 7b, 8, 9, 10 | CSV parsing, batching, prompts, prerequisites, invoker |
| 3. Output | 11, 12, 13, 14, 15, 16, 17, 18 | Result parsing, transformation, CSV writing, summaries |
| 4. State | 19, 20, 21, 22, 23, 24, 25 | Checkpoints, locks, directory scanning |
| 5. Orchestration | 26, 27, 28, 29a, 29b, 30a, 30b, 30c | Mini-batch processor, CLI |
| 6. Testing | 31-38 | Unit tests for all components |
| 7. Integration | 39, 40, 41 | E2E tests, documentation |

**Total Tasks: 46** (including split tasks)

---

*Last Updated: January 2026*
*Version: 2.0*
