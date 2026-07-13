"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("../src/prismaClient"));
const storage_1 = require("../src/utils/storage");
async function validatePhase1() {
    console.log('\n--- PHASE 1: Database Verification ---');
    try {
        const usersCount = await prismaClient_1.default.user.count();
        const projectsCount = await prismaClient_1.default.project.count();
        const suitesCount = await prismaClient_1.default.testSuite.count();
        const runsCount = await prismaClient_1.default.testRun.count();
        const executionsCount = await prismaClient_1.default.executionLog.count();
        const screenshotsCount = await prismaClient_1.default.screenshot.count();
        const videosCount = await prismaClient_1.default.video.count();
        const healingCount = await prismaClient_1.default.healingEvent.count();
        const reportsCount = await prismaClient_1.default.report.count();
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
    }
    catch (err) {
        console.error('Phase 1 Verification Failed:', err.message);
    }
}
async function validateBuckets() {
    console.log('\n--- PHASE 6: Buckets Verification ---');
    try {
        const { data, error } = await storage_1.supabase.storage.listBuckets();
        if (error)
            throw error;
        console.log('Buckets existing in Supabase Storage:', data.map(b => b.name).join(', '));
    }
    catch (err) {
        console.error('Buckets Verification Failed:', err.message);
    }
}
async function run() {
    await validatePhase1();
    await validateBuckets();
    process.exit(0);
}
run();
//# sourceMappingURL=validate.js.map