# Implementation Plan: AI WCAG Criteria Verification

## Task Overview

This implementation plan breaks down the 8 components from the design into atomic, agent-friendly tasks. The tasks follow a logical dependency order: types → data → utilities → core components → integration → testing.

## Steering Document Compliance

- Follows `structure.md`: All new files in `tools/ai-scan-cli/src/` and `tools/ai-scan-cli/data/`
- Follows `tech.md`: TypeScript with strict typing, Handlebars templates, existing patterns
- Each task references specific requirements and existing code to leverage

## Atomic Task Requirements

**Each task must meet these criteria for optimal agent execution:**
- **File Scope**: Touches 1-3 related files maximum
- **Time Boxing**: Completable in 15-30 minutes
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Must specify exact files to create/modify
- **Agent-Friendly**: Clear input/output with minimal context switching

## Tasks

### Phase 1: Types and Interfaces

- [x] 1. Add criteria verification types to types.ts
  - File: `tools/ai-scan-cli/src/types.ts`
  - Add `CriterionVerificationInstruction` interface with criterionId, title, description, whatToCheck, passCondition, failIndicators, requiresManualReview
  - Add `CriteriaBatchResult` interface with batchNumber, criteriaVerified, verifications, tokensUsed, durationMs, errors
  - Add `CriteriaBatchProcessorOptions` interface with batchSize, delayBetweenBatches, timeout
  - Purpose: Establish type safety for criteria batch processing
  - _Leverage: tools/ai-scan-cli/src/types.ts (existing AiCriteriaVerification type)_
  - _Requirements: 1.4, 2.4_

- [x] 2. Add checkpoint types to types.ts
  - File: `tools/ai-scan-cli/src/types.ts`
  - Add `CriteriaCheckpoint` interface with scanId, url, wcagLevel, totalBatches, completedBatches, partialVerifications, issueEnhancementComplete, issueEnhancementResult, startedAt, updatedAt, tokensUsed
  - Purpose: Define checkpoint data structure for resumable processing
  - _Leverage: tools/ai-scan-cli/src/types.ts_
  - _Requirements: 7.1, 7.3_

- [x] 3. Add cache types to types.ts
  - File: `tools/ai-scan-cli/src/types.ts`
  - Add `CacheKey` interface with contentHash, wcagLevel, batchNumber
  - Add `CacheEntry` interface with key, verifications, tokensUsed, aiModel, createdAt, expiresAt
  - Add `CacheStats` interface with hits, misses, hitRate, entriesCount, totalSavedTokens
  - Purpose: Define cache data structures for verification caching
  - _Leverage: tools/ai-scan-cli/src/types.ts_
  - _Requirements: 8.4_

### Phase 2: Data Files

- [x] 4. Create WCAG verification instructions JSON (criteria 1.x)
  - File: `tools/ai-scan-cli/data/wcag-verification-instructions.json` (CREATE)
  - Add version field and criteria object
  - Add instructions for criteria 1.1.1, 1.2.1-1.2.5, 1.3.1-1.3.5, 1.4.1-1.4.13 (Perceivable)
  - Each criterion has: criterionId, title, description, whatToCheck, passCondition, failIndicators, requiresManualReview
  - Purpose: Data-driven verification instructions for Principle 1 criteria
  - _Leverage: packages/core/src/constants/wcag.constants.ts (WCAG_CRITERIA data)_
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Add WCAG verification instructions for criteria 2.x
  - File: `tools/ai-scan-cli/data/wcag-verification-instructions.json` (MODIFY)
  - Add instructions for criteria 2.1.1-2.1.4, 2.2.1-2.2.2, 2.3.1, 2.4.1-2.4.10, 2.5.1-2.5.4 (Operable)
  - Purpose: Data-driven verification instructions for Principle 2 criteria
  - _Leverage: packages/core/src/constants/wcag.constants.ts_
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Add WCAG verification instructions for criteria 3.x and 4.x
  - File: `tools/ai-scan-cli/data/wcag-verification-instructions.json` (MODIFY)
  - Add instructions for criteria 3.1.1-3.1.2, 3.2.1-3.2.4, 3.3.1-3.3.4 (Understandable)
  - Add instructions for criteria 4.1.1-4.1.3 (Robust)
  - Purpose: Complete the verification instructions for all 50 AA criteria
  - _Leverage: packages/core/src/constants/wcag.constants.ts_
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

### Phase 3: Template

- [x] 7. Create criteria verification prompt template
  - File: `tools/ai-scan-cli/templates/criteria-verification-prompt.hbs` (CREATE)
  - Add system context (WCAG auditor role)
  - Add page context section (url, title, wcagLevel)
  - Add criteria batch iteration with each helper
  - Add HTML content section with truncation support
  - Add output format specification with JSON example
  - Purpose: Handlebars template for AI verification prompts
  - _Leverage: tools/ai-scan-cli/templates/issue-enhancement-prompt.hbs (existing template patterns)_
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

### Phase 4: Core Components - Cache

- [x] 8. Create CriteriaVerificationCache class (core methods)
  - File: `tools/ai-scan-cli/src/criteria-verification-cache.ts` (CREATE)
  - Add constructor with options (cacheDir, ttlDays, maxEntries)
  - Implement `generateKey()` using SHA-256 hash (first 16 chars)
  - Implement `get()` to retrieve cached verifications
  - Implement `set()` to store verifications with TTL
  - Purpose: Core cache functionality for verification results
  - _Leverage: crypto module for hashing_
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 9. Add cache management methods to CriteriaVerificationCache
  - File: `tools/ai-scan-cli/src/criteria-verification-cache.ts` (MODIFY)
  - Implement `has()` to check cache entry existence
  - Implement `cleanup()` to remove expired entries
  - Implement `clearAll()` to remove all entries
  - Implement `getStats()` to return cache statistics
  - Implement `warmup()` to load cache index into memory
  - Purpose: Cache management and statistics functionality
  - _Leverage: tools/ai-scan-cli/src/criteria-verification-cache.ts_
  - _Requirements: 8.5, 8.6, 8.7_

- [x] 10. Create CriteriaVerificationCache unit tests
  - File: `tools/ai-scan-cli/src/criteria-verification-cache.test.ts` (CREATE)
  - Test generateKey() produces consistent hashes
  - Test get/set roundtrip works correctly
  - Test TTL expiration works
  - Test cleanup removes expired entries
  - Test getStats returns accurate statistics
  - Purpose: Ensure cache reliability
  - _Leverage: tools/ai-scan-cli/src/criteria-verification-cache.ts_
  - _Requirements: 8.1-8.7_

### Phase 5: Core Components - Checkpoint

- [x] 11. Create CriteriaCheckpointManager class (core methods)
  - File: `tools/ai-scan-cli/src/criteria-checkpoint-manager.ts` (CREATE)
  - Add constructor with checkpointDir option
  - Implement `getCheckpoint()` to load checkpoint from disk
  - Implement `initCheckpoint()` to create new checkpoint
  - Implement `saveCheckpoint()` with atomic writes (temp file + rename)
  - Purpose: Core checkpoint functionality for resumable processing
  - _Leverage: tools/ai-scan-cli/src/checkpoint-manager.ts (existing pattern for atomic writes)_
  - _Requirements: 7.1, 7.2_

- [x] 12. Add batch tracking methods to CriteriaCheckpointManager
  - File: `tools/ai-scan-cli/src/criteria-checkpoint-manager.ts` (MODIFY)
  - Implement `markBatchComplete()` to save batch progress
  - Implement `markIssueEnhancementComplete()` to save enhancement results
  - Implement `clearCheckpoint()` to delete checkpoint file
  - Implement `getIncompleteBatches()` to find batches to resume
  - Implement `isBatchComplete()` to check batch status
  - Purpose: Batch progress tracking for checkpoint
  - _Leverage: tools/ai-scan-cli/src/criteria-checkpoint-manager.ts_
  - _Requirements: 7.3, 7.4_

- [x] 13. Create CriteriaCheckpointManager unit tests
  - File: `tools/ai-scan-cli/src/criteria-checkpoint-manager.test.ts` (CREATE)
  - Test initCheckpoint creates valid structure
  - Test saveCheckpoint uses atomic writes
  - Test markBatchComplete updates completedBatches array
  - Test getCheckpoint loads saved checkpoint
  - Test clearCheckpoint removes file
  - Test getIncompleteBatches returns correct batch numbers
  - Purpose: Ensure checkpoint reliability
  - _Leverage: tools/ai-scan-cli/src/criteria-checkpoint-manager.ts_
  - _Requirements: 7.1-7.6_

### Phase 6: Core Components - Prompt Generator

- [x] 14. Add criteria verification prompt function to prompt-generator.ts
  - File: `tools/ai-scan-cli/src/prompt-generator.ts` (MODIFY)
  - Add `generateCriteriaVerificationPrompt()` function
  - Load criteria-verification-prompt.hbs template
  - Accept downloadedSite, criteriaBatch, existingIssueIds, maxHtmlLength parameters
  - Compile template with Handlebars
  - Purpose: Generate structured AI prompts for criteria verification
  - _Leverage: tools/ai-scan-cli/src/prompt-generator.ts (existing generateIssueEnhancementPrompt)_
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 15. Add instruction loader helper to prompt-generator.ts
  - File: `tools/ai-scan-cli/src/prompt-generator.ts` (MODIFY)
  - Add `loadVerificationInstructions()` function
  - Load wcag-verification-instructions.json
  - Add `getCriteriaBatch()` to get instructions for specific criteria IDs
  - Add `batchCriteriaByLevel()` to split criteria into batches based on WCAG level
  - Purpose: Helper functions for loading and batching criteria instructions
  - _Leverage: tools/ai-scan-cli/data/wcag-verification-instructions.json_
  - _Requirements: 1.1, 1.2, 1.3, 4.1_

### Phase 7: Core Components - Result Parser

- [x] 16. Add batch verification parser to result-parser.ts
  - File: `tools/ai-scan-cli/src/result-parser.ts` (MODIFY)
  - Add `parseBatchVerificationOutput()` function
  - Extract JSON from AI response (handle markdown code blocks)
  - Validate criteriaVerifications array structure
  - Normalize status values to CriteriaStatus enum
  - Return BatchVerificationResult with verifications array
  - Purpose: Parse AI batch verification output into structured data
  - _Leverage: tools/ai-scan-cli/src/result-parser.ts (existing extractJsonFromMarkdown, parseCriteriaVerifications)_
  - _Requirements: 2.4, 2.5_

### Phase 8: Core Components - Batch Processor

- [x] 17. Create CriteriaBatchProcessor class (constructor and setup)
  - File: `tools/ai-scan-cli/src/criteria-batch-processor.ts` (CREATE)
  - Add constructor with logger and CriteriaBatchProcessorOptions
  - Add private methods for initializing dependencies
  - Inject CriteriaVerificationCache and CriteriaCheckpointManager
  - Add method to load verification instructions at startup
  - Purpose: Set up batch processor with dependencies
  - _Leverage: tools/ai-scan-cli/src/mini-batch-processor.ts (class structure pattern)_
  - _Requirements: 1.1, 1.5_

- [x] 18. Add batch creation logic to CriteriaBatchProcessor
  - File: `tools/ai-scan-cli/src/criteria-batch-processor.ts` (MODIFY)
  - Add `createBatches()` method to divide criteria into groups
  - Respect batchSize option (default: 10)
  - Filter criteria based on WCAG level (A vs AA)
  - Return array of CriterionVerificationInstruction batches
  - Purpose: Create manageable batches for AI processing
  - _Leverage: packages/core/src/constants/wcag.constants.ts (WCAG_CRITERIA)_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 19. Add single batch processing to CriteriaBatchProcessor
  - File: `tools/ai-scan-cli/src/criteria-batch-processor.ts` (MODIFY)
  - Add `processSingleBatch()` method
  - Check cache first using generateKey()
  - If cache miss, generate prompt and call invokeClaudeCode()
  - Parse response with parseBatchVerificationOutput()
  - Store in cache and checkpoint on success
  - Return CriteriaBatchResult
  - Purpose: Process one batch with cache and checkpoint integration
  - _Leverage: tools/ai-scan-cli/src/claude-invoker.ts (invokeClaudeCode)_
  - _Requirements: 3.2, 8.2, 8.3, 7.1_

- [x] 20. Add main processCriteriaBatches method to CriteriaBatchProcessor
  - File: `tools/ai-scan-cli/src/criteria-batch-processor.ts` (MODIFY)
  - Implement `processCriteriaBatches()` as main entry point
  - Check checkpoint for resume state
  - Loop through batches, skipping completed ones
  - Add delay between batches (configurable)
  - Aggregate all verifications into final array
  - Clear checkpoint on completion
  - Return array of CriteriaBatchResult
  - Purpose: Orchestrate full batch processing workflow
  - _Leverage: tools/ai-scan-cli/src/criteria-batch-processor.ts_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.3, 7.4_

- [x] 21. Add error handling to CriteriaBatchProcessor
  - File: `tools/ai-scan-cli/src/criteria-batch-processor.ts` (MODIFY)
  - Add try/catch in processSingleBatch()
  - Handle timeout with NOT_TESTED fallback
  - Handle malformed JSON with retry
  - Handle rate limits with exponential backoff
  - Log errors but continue with remaining batches
  - Purpose: Robust error handling for batch processing
  - _Leverage: Error handling patterns in mini-batch-processor.ts_
  - _Requirements: 3.3_

- [x] 22. Create CriteriaBatchProcessor unit tests
  - File: `tools/ai-scan-cli/src/criteria-batch-processor.test.ts` (CREATE)
  - Test createBatches divides criteria correctly
  - Test processSingleBatch uses cache correctly
  - Test processCriteriaBatches respects checkpoint
  - Test error handling falls back to NOT_TESTED
  - Mock invokeClaudeCode responses
  - Purpose: Ensure batch processor reliability
  - _Leverage: tools/ai-scan-cli/src/criteria-batch-processor.ts_
  - _Requirements: 1.1-1.5, 3.1-3.4_

### Phase 9: Integration

- [x] 23. Extend MiniBatchProcessor options for criteria verification
  - File: `tools/ai-scan-cli/src/mini-batch-processor.ts` (MODIFY)
  - Add `enableCriteriaVerification` option (default: true)
  - Add `criteriaBatchSize` option
  - Add `skipCriteriaVerification` option
  - Add `useCache` option (default: true)
  - Add `checkpointDir` and `cacheDir` options
  - Purpose: Expose criteria verification options in existing processor
  - _Leverage: tools/ai-scan-cli/src/mini-batch-processor.ts (existing options pattern)_
  - _Requirements: 3.1_

- [x] 24. Integrate CriteriaBatchProcessor into MiniBatchProcessor workflow
  - File: `tools/ai-scan-cli/src/mini-batch-processor.ts` (MODIFY)
  - Import and instantiate CriteriaBatchProcessor
  - After issue enhancement pass, check enableCriteriaVerification flag
  - Call processCriteriaBatches() with downloaded site and existing issues
  - Merge criteriaVerifications into ScanResult
  - Add tokenUsage breakdown (issueEnhancement + criteriaVerification)
  - Purpose: Integrate criteria verification into main workflow
  - _Leverage: tools/ai-scan-cli/src/criteria-batch-processor.ts_
  - _Requirements: 3.1, 3.4_

- [x] 25. Add cache and checkpoint CLI options to cli.ts
  - File: `tools/ai-scan-cli/src/cli.ts` (MODIFY)
  - Add `--skip-criteria-verification` option
  - Add `--criteria-batch-size <number>` option
  - Add `--resume` option
  - Add `--fresh` option
  - Add `--no-cache` option
  - Add `--clear-cache` option
  - Add `--cache-stats` option
  - Add `--checkpoint-dir <path>` option
  - Add `--cache-dir <path>` option
  - Add `--cache-ttl <days>` option
  - Purpose: Expose all configuration via CLI
  - _Leverage: tools/ai-scan-cli/src/cli.ts (existing option patterns)_
  - _Requirements: 7.5, 7.6, 8.5, 8.6_

- [x] 26. Wire CLI options to MiniBatchProcessor
  - File: `tools/ai-scan-cli/src/cli.ts` (MODIFY)
  - Parse CLI options and pass to MiniBatchProcessor
  - Handle --resume flag to auto-resume from checkpoint
  - Handle --fresh flag to ignore existing checkpoints
  - Handle --clear-cache to clear cache before processing
  - Display cache stats if --cache-stats provided
  - Purpose: Connect CLI options to processing logic
  - _Leverage: tools/ai-scan-cli/src/cli.ts, tools/ai-scan-cli/src/mini-batch-processor.ts_
  - _Requirements: 7.5, 7.6, 8.5, 8.6, 8.7_

### Phase 10: CSV Export/Import

- [x] 27. Update CSV export to include all criteria verifications
  - File: `tools/ai-scan-cli/src/csv-writer.ts` (MODIFY)
  - Ensure `ai_criteria_verifications_json` column handles 50+ verifications
  - Properly serialize large JSON arrays
  - Add tokenUsage to export if available
  - Purpose: Export full criteria verification data
  - _Leverage: tools/ai-scan-cli/src/csv-writer.ts (existing CSV export logic)_
  - _Requirements: 5_

- [x] 28. Update CSV import to handle expanded criteria verifications
  - File: `apps/api/src/modules/results/result.service.ts` (MODIFY)
  - Update `storeCriteriaVerifications()` to handle 50+ verifications efficiently
  - Ensure AI verification status takes precedence over axe-core (AI_VERIFIED_* status)
  - Verify coverage statistics are recalculated after import
  - Purpose: Ensure import handles full criteria data
  - _Leverage: apps/api/src/modules/results/result.service.ts (storeCriteriaVerifications)_
  - _Requirements: 5, 6_

### Phase 11: Testing

- [x] 29. Create integration test harness for criteria verification
  - File: `tools/ai-scan-cli/src/criteria-verification.integration.test.ts` (CREATE)
  - Set up test harness with mock AI responses
  - Create test fixtures for sample HTML pages
  - Create expected verification results for fixture pages
  - Purpose: Set up integration test infrastructure
  - _Leverage: tools/ai-scan-cli/src/mini-batch-processor.test.ts (test patterns)_
  - _Requirements: All_

- [x] 30. Add integration test for happy path workflow
  - File: `tools/ai-scan-cli/src/criteria-verification.integration.test.ts` (MODIFY)
  - Test: CSV input → criteria batching → mock AI responses → CSV output
  - Verify all 50 criteria are processed in 5-6 batches
  - Verify cache is populated after processing
  - Verify checkpoint is created during processing and cleared after completion
  - Purpose: End-to-end test of criteria verification happy path
  - _Leverage: tools/ai-scan-cli/src/criteria-verification.integration.test.ts_
  - _Requirements: 1, 2, 3_

- [x] 31. Add integration test for checkpoint resume
  - File: `tools/ai-scan-cli/src/criteria-verification.integration.test.ts` (MODIFY)
  - Test: Start processing, simulate interruption after 2 batches
  - Test: Resume processing, verify only batches 3-5 are processed
  - Test: Verify final result matches fresh run
  - Purpose: Validate checkpoint resume functionality
  - _Leverage: tools/ai-scan-cli/src/criteria-checkpoint-manager.ts_
  - _Requirements: 7_

- [x] 32. Add integration test for cache effectiveness
  - File: `tools/ai-scan-cli/src/criteria-verification.integration.test.ts` (MODIFY)
  - Test: Process same page twice, verify second run uses cache
  - Test: Verify token savings are reported
  - Test: Verify --no-cache bypasses cache
  - Test: Verify --clear-cache clears entries
  - Purpose: Validate cache functionality
  - _Leverage: tools/ai-scan-cli/src/criteria-verification-cache.ts_
  - _Requirements: 8_

### Phase 12: Documentation and Cleanup

- [x] 33. Add JSDoc comments to cache and checkpoint modules
  - Files: `tools/ai-scan-cli/src/criteria-verification-cache.ts`, `tools/ai-scan-cli/src/criteria-checkpoint-manager.ts`
  - Add JSDoc comments with @param, @returns, @example
  - Document cache TTL behavior and checkpoint atomicity
  - Purpose: Code documentation for cache and checkpoint modules
  - _Leverage: Existing JSDoc patterns in codebase_
  - _Requirements: Non-functional (Maintainability)_

- [x] 34. Add JSDoc comments to batch processor and parser modules
  - Files: `tools/ai-scan-cli/src/criteria-batch-processor.ts`, `tools/ai-scan-cli/src/result-parser.ts`, `tools/ai-scan-cli/src/prompt-generator.ts`
  - Add JSDoc comments with @param, @returns, @example
  - Document batch processing workflow
  - Purpose: Code documentation for core processing modules
  - _Leverage: Existing JSDoc patterns in codebase_
  - _Requirements: Non-functional (Maintainability)_

- [x] 35. Update README with criteria verification documentation
  - File: `tools/ai-scan-cli/README.md` (MODIFY)
  - Document new CLI options for cache and checkpoint
  - Add section on criteria verification workflow
  - Document environment variables
  - Add examples of common use cases
  - Purpose: User documentation
  - _Leverage: Existing README structure_
  - _Requirements: Non-functional (Maintainability)_

## Dependency Graph

```
Phase 1: Types (Tasks 1-3) - No dependencies
    ↓
Phase 2: Data (Tasks 4-6) - Depends on Phase 1
    ↓
Phase 3: Template (Task 7) - Depends on Phase 1
    ↓
Phase 4: Cache (Tasks 8-10) - Depends on Phase 1
    ↓
Phase 5: Checkpoint (Tasks 11-13) - Depends on Phase 1
    ↓
Phase 6: Prompt Generator (Tasks 14-15) - Depends on Phase 2, 3
    ↓
Phase 7: Result Parser (Task 16) - Depends on Phase 1
    ↓
Phase 8: Batch Processor (Tasks 17-22) - Depends on Phase 4, 5, 6, 7
    ↓
Phase 9: Integration (Tasks 23-26) - Depends on Phase 8
    ↓
Phase 10: CSV (Tasks 27-28) - Depends on Phase 9
    ↓
Phase 11: Testing (Tasks 29-32) - Depends on Phase 10
    ↓
Phase 12: Documentation (Tasks 33-35) - Depends on all previous
```

## Summary

- **Total Tasks**: 35
- **New Files**: 8 (data file, template, cache, checkpoint, batch processor, test file)
- **Modified Files**: 8 (types, prompt-generator, result-parser, mini-batch-processor, cli, csv-writer, result.service, README)
- **Test Files**: 5 (cache test, checkpoint test, batch processor test, integration test suite)
- **Estimated Total Time**: 10-14 hours (15-25 min per task)
