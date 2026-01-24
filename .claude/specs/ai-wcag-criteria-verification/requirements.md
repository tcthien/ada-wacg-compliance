# Requirements Document: AI WCAG Criteria Verification

## Introduction

This feature enhances the AI scan tool to systematically verify ALL WCAG criteria (50 for AA level) by providing explicit criteria batches to the AI model with structured verification instructions. Currently, the AI tool only enhances existing axe-core issues and verifies ~5-6 "priority" criteria. This update will enable comprehensive WCAG coverage by iterating through all criteria batch-by-batch and updating the coverage from 14/50 to potentially 50/50.

## Problem Statement

**Current State:**
- After AI scan import, criteria coverage remains at 14/50 (28%)
- AI prompt only lists 6 "Priority Criteria to Verify" without structured instructions
- AI does NOT receive the full list of WCAG criteria to verify
- Criteria verification is ad-hoc, not systematic

**Desired State:**
- AI systematically verifies ALL 50 WCAG AA criteria
- Criteria are batched (e.g., 10 per prompt) to avoid context limits
- Each criterion includes ID, title, and verification instructions
- Coverage increases from 14/50 to closer to 50/50

## Alignment with Product Vision

This feature directly supports ADAShield's core value proposition of **honest, transparent testing**:

> "Traditional automated testing: ~57% of issues detected
> + AI enhancement: ~75-85% of issues detected"

By systematically verifying ALL WCAG criteria with AI, we:
1. Increase detection coverage from 28% to 75-85%
2. Provide transparent criteria-by-criteria verification status
3. Differentiate from competitors who only report axe-core findings

## Requirements

### Requirement 1: WCAG Criteria Batching System

**User Story:** As an operator running the AI scan CLI, I want the system to batch WCAG criteria into manageable groups, so that the AI can systematically verify each criterion without exceeding context limits.

#### Acceptance Criteria

1. WHEN the AI scan CLI processes a scan THEN the system SHALL divide the 50 WCAG AA criteria into batches of 8-10 criteria each
2. IF the WCAG level is AA THEN the system SHALL process 50 criteria in 5-6 batches
3. IF the WCAG level is A THEN the system SHALL process only Level A criteria (~30)
4. WHEN batching criteria THEN the system SHALL include for each criterion:
   - Criterion ID (e.g., "1.1.1")
   - Criterion title (e.g., "Non-text Content")
   - Criterion description/requirement
   - Verification instructions specific to that criterion
5. WHEN processing a batch THEN the system SHALL NOT exceed 20,000 tokens per prompt to stay within model limits

### Requirement 2: Enhanced AI Verification Prompt

**User Story:** As an operator, I want the AI prompt to include structured verification instructions for each WCAG criterion, so that the AI can provide consistent and accurate pass/fail assessments.

#### Acceptance Criteria

1. WHEN generating a verification prompt THEN the system SHALL include:
   - The HTML content or accessibility snapshot of the page
   - A structured list of criteria to verify with specific instructions
   - Expected output format with criterionId, status, confidence, and reasoning
2. IF a criterion requires DOM inspection (e.g., 1.1.1 Non-text Content) THEN the prompt SHALL instruct the AI to check for specific elements (img tags, alt attributes, etc.)
3. IF a criterion requires semantic understanding (e.g., 2.4.6 Headings and Labels) THEN the prompt SHALL instruct the AI to assess if headings/labels are descriptive
4. WHEN verifying a criterion THEN the AI SHALL output one of:
   - `AI_VERIFIED_PASS` - Criterion passes based on page content
   - `AI_VERIFIED_FAIL` - Criterion fails based on page content
   - `NOT_TESTED` - Cannot be determined from available content
5. WHEN the AI verifies a criterion as FAIL THEN it SHALL attempt to link to existing issue IDs if applicable

### Requirement 3: Multi-Pass Verification Workflow

**User Story:** As the system, I want to process verification in multiple passes (batches), so that all criteria are verified without overwhelming the AI context window.

#### Acceptance Criteria

1. WHEN starting AI verification THEN the system SHALL:
   - First, run the issue enhancement pass (existing functionality)
   - Then, run criteria verification passes for each batch
2. WHEN processing a criteria batch THEN the system SHALL:
   - Send the batch to the AI model
   - Parse the verification results
   - Aggregate results with previous batches
3. IF a batch fails to process THEN the system SHALL:
   - Log the error
   - Continue with remaining batches
   - Mark failed batch criteria as NOT_TESTED
4. WHEN all batches complete THEN the system SHALL merge all verifications into the final output JSON

### Requirement 4: Criteria Verification Instructions Repository

**User Story:** As a developer, I want a structured repository of verification instructions for each WCAG criterion, so that prompts are consistent and maintainable.

#### Acceptance Criteria

1. WHEN the system needs verification instructions THEN it SHALL reference a structured data file containing:
   - Criterion ID
   - Human-readable description
   - What to check (specific HTML elements, attributes, patterns)
   - Pass condition (what constitutes a pass)
   - Fail indicators (what indicates failure)
2. IF a criterion requires media content (audio/video) THEN the instruction SHALL indicate "requires manual review" and set confidence lower
3. IF a criterion can be fully automated (e.g., 3.1.1 Language of Page) THEN the instruction SHALL provide specific checks
4. WHEN updating instructions THEN the system SHALL NOT require code changes (data-driven approach)

### Requirement 5: Updated CSV Export/Import Format

**User Story:** As an operator, I want the CSV export/import to handle the expanded criteria verifications, so that the full verification data is preserved through the workflow.

#### Acceptance Criteria

1. WHEN exporting AI results THEN the CSV SHALL include an `ai_criteria_verifications_json` column containing all verified criteria
2. IF there are more than 20 criteria verifications THEN the system SHALL properly serialize and deserialize the JSON array
3. WHEN importing AI results THEN the system SHALL:
   - Parse the `ai_criteria_verifications_json` column
   - Store each verification in the CriteriaVerification table
   - Update the scan's coverage statistics
4. WHEN a verification overwrites an existing axe-core verification THEN the AI verification SHALL take precedence (AI_VERIFIED_* status)

### Requirement 6: Coverage Statistics Update

**User Story:** As a user viewing scan results, I want to see updated coverage statistics that reflect AI verification progress, so that I understand the true WCAG compliance state.

#### Acceptance Criteria

1. WHEN AI verifications are imported THEN the system SHALL:
   - Recalculate `criteriaChecked` count (criteria with PASS, FAIL, or AI_VERIFIED_* status)
   - Recalculate `coveragePercentage` based on new checked count
   - Update `criteriaAiVerified` count
2. IF AI verifies a previously NOT_TESTED criterion THEN the coverage SHALL increase
3. WHEN displaying the Criteria Coverage tab THEN the table SHALL show the AI verification status for each criterion
4. WHEN a criterion changes from NOT_TESTED to AI_VERIFIED_PASS THEN the UI SHALL reflect this immediately after import

### Requirement 7: Checkpoint for Resumable Processing

**User Story:** As an operator, I want the system to checkpoint progress during multi-batch processing, so that I can resume from the last completed batch if processing is interrupted.

#### Acceptance Criteria

1. WHEN a batch completes successfully THEN the system SHALL:
   - Save a checkpoint file containing completed batch numbers
   - Store partial verification results accumulated so far
   - Record tokens used up to this point
   - Use atomic writes (temp file + rename) to prevent corruption
2. WHEN processing is started for a scan THEN the system SHALL:
   - Check for existing checkpoint file
   - IF checkpoint exists, prompt operator to resume or start fresh
   - IF resuming, skip already-completed batches
3. WHEN resuming from checkpoint THEN the system SHALL:
   - Load partial verifications from checkpoint
   - Continue from the first incomplete batch
   - Merge new results with existing partial results
4. WHEN all batches complete successfully THEN the system SHALL:
   - Delete the checkpoint file
   - Output complete verification results
5. IF the `--resume` CLI flag is provided THEN the system SHALL automatically resume without prompting
6. IF the `--fresh` CLI flag is provided THEN the system SHALL ignore existing checkpoints and start fresh

### Requirement 8: Verification Result Caching

**User Story:** As an operator, I want the system to cache verification results by page content hash, so that re-scanning pages with identical content saves tokens and processing time.

#### Acceptance Criteria

1. WHEN processing a scan THEN the system SHALL:
   - Generate a content hash (SHA-256, first 16 chars) of the page HTML/accessibility snapshot
   - Check cache for existing verification results with matching hash
2. IF cache hit occurs THEN the system SHALL:
   - Return cached verification results
   - Log "Cache hit for batch X" with tokens saved
   - NOT call the AI API
3. IF cache miss occurs THEN the system SHALL:
   - Call AI API for verification
   - Store results in cache with content hash key
   - Set cache entry expiration (default: 7 days, configurable)
4. WHEN storing cache entries THEN the system SHALL include:
   - Content hash + WCAG level + batch number as composite key
   - Verification results
   - Tokens used
   - AI model name
   - Created timestamp and expiration timestamp
5. WHEN the `--no-cache` CLI flag is provided THEN the system SHALL bypass cache lookup
6. WHEN the `--clear-cache` CLI flag is provided THEN the system SHALL delete all cached entries before processing
7. WHEN processing completes THEN the system SHALL report cache statistics:
   - Cache hits vs misses
   - Tokens saved due to cache hits

## Non-Functional Requirements

### Performance
- Batch processing should complete within 2-3 minutes per scan (5-6 batches x 20-30 seconds each)
- Memory usage should not exceed 512MB during batch processing
- CSV import should handle 100+ criteria verifications efficiently
- Cache lookup should complete in <50ms
- Checkpoint save should complete in <100ms

### Reliability
- If one batch fails, other batches should still complete
- Failed verifications should default to NOT_TESTED status
- System should be idempotent - re-running import should produce same result
- Checkpoint files must use atomic writes to prevent corruption on crash
- Cache corruption should be handled gracefully (delete and continue)

### Maintainability
- Verification instructions should be data-driven (JSON/YAML file)
- Adding new WCAG 2.2 criteria should not require code changes
- Batch size should be configurable via environment variable
- Cache TTL should be configurable (default: 7 days)
- Checkpoint directory should be configurable

### Token Budget
- Each verification batch should use ~3,000-4,000 tokens
- Total verification for 50 criteria should use ~20,000-25,000 tokens
- Combined with issue enhancement (~4,000 tokens), total per scan should be ~25,000-30,000 tokens
- Cache hits should reduce token usage proportionally (e.g., 50% cache hit = 50% token savings)

## Technical Constraints

1. **Context Window**: AI model has ~128K context limit; batch size must stay under 20K tokens per batch
2. **Rate Limits**: Must respect API rate limits; batches may need 1-2 second delays
3. **Existing Schema**: Must use existing CriteriaVerification table and statuses
4. **Backward Compatibility**: Existing scans without AI verification should continue to work

## Success Metrics

1. **Coverage Increase**: Criteria coverage should increase from ~28% to ~80%+ after AI scan
2. **Verification Accuracy**: AI verifications should be >85% accurate compared to manual review
3. **Processing Time**: Total AI processing time should stay under 5 minutes per scan
4. **Token Efficiency**: Total token usage per scan should stay under 35,000 tokens
5. **Resume Success Rate**: 100% of interrupted scans should resume correctly from checkpoint
6. **Cache Effectiveness**: For batch scans of similar pages, cache should achieve >30% hit rate

## Out of Scope

1. Real-time AI verification during initial scan (async only)
2. Manual review workflow integration
3. WCAG 2.2 criteria (only 2.1 supported initially)
4. Custom criteria verification rules per customer
5. Distributed cache (single-node file-based cache only)
6. Cross-machine checkpoint sharing
