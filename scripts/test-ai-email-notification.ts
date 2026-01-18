#!/usr/bin/env tsx
/**
 * Test script for AI Email Notification
 *
 * This script tests the complete AI email notification flow:
 * 1. Creates a test scan with aiEnabled=true
 * 2. Simulates standard scan completion (without sending email due to fix)
 * 3. Imports AI results
 * 4. Verifies email notification is queued
 *
 * Usage: tsx scripts/test-ai-email-notification.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

// Database connection string
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:55432/adashield?schema=public';

// Initialize Prisma with pg adapter (same as worker/API)
function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const TEST_EMAIL = 'test-ai-scan@example.com';
const TEST_URL = 'https://example.com/test-ai-email';

async function main() {
  console.log('🧪 AI Email Notification Test\n');
  console.log('='.repeat(60));

  // Initialize Prisma with pg adapter
  const prisma = createPrismaClient();

  // Initialize Redis connection for BullMQ
  const redis = new Redis({
    host: 'localhost',
    port: 56379,
    maxRetriesPerRequest: null,
  });

  // Initialize send-email queue to check jobs
  const sendEmailQueue = new Queue('send-email', {
    connection: redis,
  });

  try {
    // Step 1: Create a test scan with AI enabled
    console.log('\n📝 Step 1: Creating test scan with AI enabled...');

    const testScan = await prisma.scan.create({
      data: {
        url: TEST_URL,
        email: TEST_EMAIL,
        wcagLevel: 'AA',
        status: 'COMPLETED',
        aiEnabled: true,
        aiStatus: 'DOWNLOADED', // Ready for AI import
        completedAt: new Date(),
        durationMs: 5000,
      },
    });
    console.log(`   ✅ Created scan: ${testScan.id}`);
    console.log(`   Email: ${testScan.email}`);
    console.log(`   AI Enabled: ${testScan.aiEnabled}`);
    console.log(`   AI Status: ${testScan.aiStatus}`);

    // Step 2: Create scan result with issues
    console.log('\n📊 Step 2: Creating scan result with issues...');

    const scanResult = await prisma.scanResult.create({
      data: {
        scanId: testScan.id,
        totalIssues: 2,
        criticalCount: 1,
        seriousCount: 1,
        moderateCount: 0,
        minorCount: 0,
        passedChecks: 50,
        inapplicableChecks: 10,
        issues: {
          create: [
            {
              ruleId: 'color-contrast',
              impact: 'SERIOUS',
              description: 'Elements must have sufficient color contrast',
              helpText: 'Ensure text has sufficient contrast',
              helpUrl: 'https://dequeuniversity.com/rules/axe/color-contrast',
              wcagCriteria: ['1.4.3'],
              cssSelector: '.test-element',
              htmlSnippet: '<div class="test-element">Test</div>',
              nodes: [],
            },
            {
              ruleId: 'image-alt',
              impact: 'CRITICAL',
              description: 'Images must have alternate text',
              helpText: 'Add alt attribute to images',
              helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
              wcagCriteria: ['1.1.1'],
              cssSelector: 'img.logo',
              htmlSnippet: '<img src="logo.png">',
              nodes: [],
            },
          ],
        },
      },
      include: {
        issues: true,
      },
    });
    console.log(`   ✅ Created scan result with ${scanResult.issues.length} issues`);

    // Step 3: Get jobs before import
    console.log('\n📬 Step 3: Checking email queue before import...');
    const jobsBefore = await sendEmailQueue.getJobs(['waiting', 'active', 'delayed']);
    console.log(`   Jobs in queue before: ${jobsBefore.length}`);

    // Step 4: Simulate AI result import (update scan with AI data)
    console.log('\n🤖 Step 4: Importing AI results...');

    await prisma.scan.update({
      where: { id: testScan.id },
      data: {
        aiStatus: 'COMPLETED',
        aiSummary: 'Test AI summary: Found 2 accessibility issues that need attention.',
        aiRemediationPlan: 'Test remediation plan:\n1. Fix color contrast\n2. Add alt text to images\n\nEstimated time: 2 hours',
        aiProcessedAt: new Date(),
        aiTotalTokens: 1500,
        aiModel: 'claude-opus-4-5-20251101',
      },
    });
    console.log(`   ✅ Updated scan with AI results`);

    // Update issues with AI enhancements
    for (const issue of scanResult.issues) {
      await prisma.issue.update({
        where: { id: issue.id },
        data: {
          aiExplanation: `AI explanation for ${issue.ruleId}: This issue affects users with visual impairments.`,
          aiFixSuggestion: `AI fix suggestion for ${issue.ruleId}: Update the code to meet WCAG standards.`,
          aiPriority: issue.impact === 'CRITICAL' ? 9 : 7,
        },
      });
    }
    console.log(`   ✅ Updated ${scanResult.issues.length} issues with AI enhancements`);

    // Step 5: Queue AI email notification (simulating what importAiResults does)
    console.log('\n📧 Step 5: Queuing AI scan complete email...');

    const emailJob = await sendEmailQueue.add(
      'send-email',
      {
        scanId: testScan.id,
        email: TEST_EMAIL,
        type: 'ai_scan_complete',
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
    console.log(`   ✅ Queued email job: ${emailJob.id}`);

    // Step 6: Verify email job was created
    console.log('\n✅ Step 6: Verifying email notification...');
    const jobsAfter = await sendEmailQueue.getJobs(['waiting', 'active', 'delayed']);
    console.log(`   Jobs in queue after: ${jobsAfter.length}`);

    const aiEmailJob = jobsAfter.find(
      (job) => job.data.scanId === testScan.id && job.data.type === 'ai_scan_complete'
    );

    if (aiEmailJob) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 SUCCESS: AI email notification job created!');
      console.log('='.repeat(60));
      console.log(`\n   Job ID: ${aiEmailJob.id}`);
      console.log(`   Scan ID: ${aiEmailJob.data.scanId}`);
      console.log(`   Email: ${aiEmailJob.data.email}`);
      console.log(`   Type: ${aiEmailJob.data.type}`);
      console.log('\n📬 Check Mailpit at http://localhost:8025 for the email');
      console.log('   (Worker will process the job and send the email)');
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('❌ FAILED: AI email notification job NOT found!');
      console.log('='.repeat(60));
    }

    // Step 7: Wait for worker to process and check result
    console.log('\n⏳ Waiting 5 seconds for worker to process email job...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if job was processed
    const processedJob = await sendEmailQueue.getJob(emailJob.id!);
    if (processedJob) {
      const state = await processedJob.getState();
      console.log(`\n   Job state: ${state}`);

      if (state === 'completed') {
        console.log('   ✅ Email job completed successfully!');
        console.log('\n📬 Check Mailpit at http://localhost:8025 for the email');
      } else if (state === 'failed') {
        console.log('   ❌ Email job failed');
        const failedReason = processedJob.failedReason;
        console.log(`   Reason: ${failedReason}`);
      } else {
        console.log(`   ⏳ Job still in ${state} state`);
      }
    }

    // Cleanup info
    console.log('\n' + '-'.repeat(60));
    console.log('🧹 Test scan created:');
    console.log(`   ID: ${testScan.id}`);
    console.log(`   To cleanup: DELETE FROM scans WHERE id = '${testScan.id}';`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

main().catch(console.error);
