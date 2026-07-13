import prisma from '../src/prismaClient';
import { supabase } from '../src/utils/storage';

async function validatePhase1() {
  console.log('\n--- PHASE 1: Database Verification ---');
  try {
    const usersCount = await prisma.user.count();
    const projectsCount = await prisma.project.count();
    const suitesCount = await prisma.testSuite.count();
    const runsCount = await prisma.testRun.count();
    const executionsCount = await prisma.executionLog.count();
    const screenshotsCount = await prisma.screenshot.count();
    const videosCount = await prisma.video.count();
    const healingCount = await prisma.healingEvent.count();
    const reportsCount = await prisma.report.count();

    console.log(`Verified Tables exist:
    users: ${usersCount}
    projects: ${projectsCount}
    test_suites: ${suitesCount}
    test_runs: ${runsCount}
    execution_logs: ${executionsCount}
    screenshots: ${screenshotsCount}
    videos: ${videosCount}
    healing_events: ${healingCount}
    reports: ${reportsCount}`);
  } catch (err: any) {
    console.error('Phase 1 Verification Failed:', err.message);
  }
}

async function validateBuckets() {
  console.log('\n--- PHASE 6: Buckets Verification ---');
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    console.log('Buckets existing in Supabase Storage:', data.map(b => b.name).join(', '));
  } catch (err: any) {
    console.error('Buckets Verification Failed:', err.message);
  }
}

async function run() {
  await validatePhase1();
  await validateBuckets();
  process.exit(0);
}

run();
