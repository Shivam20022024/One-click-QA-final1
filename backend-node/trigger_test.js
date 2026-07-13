"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const executionWorker_1 = require("./src/queue/executionWorker");
const prismaClient_1 = __importDefault(require("./src/prismaClient"));
async function main() {
    const instruction = `1. Homepage and login validation
- Open the OrangeHRM website
- Verify login page loads successfully
- Verify username field is visible
- Verify password field is visible
- Verify login button is clickable
- Verify branding/logo is visible

2. Invalid login validation
- Enter invalid username
- Enter invalid password
- Click login
- Verify error message appears
- Verify user remains on login page

3. Valid login validation
Use credentials:
Username: Admin
Password: admin123

- Login successfully
- Verify dashboard loads
- Verify dashboard widgets are visible
- Verify sidebar navigation is visible

4. Dashboard validation
- Verify dashboard cards/widgets load correctly
- Verify quick launch/menu items are visible
- Verify no broken UI components

5. Admin module validation
- Navigate to Admin module
- Verify user management page loads
- Verify search form is visible
- Verify user table is visible

6. User search validation
- Search for existing user
- Verify filtered results appear
- Clear filters
- Verify full results return

7. PIM module validation
- Navigate to PIM module
- Verify employee list loads
- Verify employee search/filter form is visible
- Verify employee table is visible

8. Employee search validation
- Search employee by name or ID
- Verify filtered results
- Reset search
- Verify table restores

9. Leave module validation
- Navigate to Leave module
- Verify leave dashboard loads
- Verify leave-related menu items are visible

10. Time module validation
- Navigate to Time module
- Verify timesheet or time dashboard loads
- Verify UI components are functional

11. Recruitment module validation
- Navigate to Recruitment module
- Verify candidate/job vacancy page loads
- Verify search/filter UI is visible

12. Navigation validation
- Navigate between:
  Dashboard
  Admin
  PIM
  Leave
  Time
  Recruitment
- Verify each page remains stable
- Verify no navigation failures

13. Profile menu validation
- Open user profile menu
- Verify menu options are visible
- Verify About / Support / Logout options

14. Logout validation
- Logout successfully
- Verify return to login page
- Verify authenticated pages are protected

15. Back navigation validation
- Press browser back after logout
- Verify session protection remains active

16. UI validation
- Verify major buttons are clickable
- Verify forms accept valid input
- Verify tables render correctly
- Verify no broken layouts

Execution rules:
- STRICT_SCENARIO mode
- Execute ALL scenarios
- Do not merge scenarios
- Preserve exact 1:1 scenario mapping
- Capture screenshots for major steps
- Record full execution video
- Generate per-scenario pass/fail report
- If any required scenario is skipped -> FAIL`;
    let suite = await prismaClient_1.default.testSuite.findFirst();
    if (!suite) {
        let project = await prismaClient_1.default.project.findFirst();
        if (!project) {
            // Find a user or create one
            let user = await prismaClient_1.default.user.findFirst();
            if (!user) {
                user = await prismaClient_1.default.user.create({ data: { email: 'test@example.com', passwordHash: 'abc', role: 'USER' } });
            }
            project = await prismaClient_1.default.project.create({ data: { name: 'Default Project', userId: user.id } });
        }
        suite = await prismaClient_1.default.testSuite.create({
            data: { name: 'Default Suite', projectId: project.id }
        });
    }
    const execution = await prismaClient_1.default.executionLog.create({
        data: {
            suiteId: suite.id,
            status: 'QUEUED',
        }
    });
    const job = await executionWorker_1.executionQueue.add('run-test', {
        executionId: execution.id,
        testName: 'OrangeHRM Validation',
        targetUrl: 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login',
        instruction: instruction,
        browser: 'chromium'
    }, {
        jobId: execution.id,
        attempts: 1
    });
    console.log('Successfully queued OrangeHRM validation job!');
    console.log('Execution ID:', execution.id);
    console.log('Job ID:', job.id);
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=trigger_test.js.map