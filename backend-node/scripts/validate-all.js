"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const API_URL = 'http://localhost:8080/api/v1';
async function validateAPI() {
    console.log('--- TEST VALIDATION SUITE ---');
    try {
        const projRes = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Validation Project', description: 'End-to-End Testing Project' })
        });
        const project = await projRes.json();
        const prisma = (await Promise.resolve().then(() => __importStar(require('../src/prismaClient')))).default;
        const testSuite = await prisma.testSuite.create({
            data: { name: 'Validation Suite', projectId: project.id }
        });
        console.log('\n--- TEST 1: Basic Browser Validation ---');
        await runExecutionTest('Example.com Test', testSuite.id, 'https://example.com', 'Open homepage and validate page title contains Example Domain', 'chromium');
        console.log('\n--- TEST 2: Real Login Validation ---');
        await runExecutionTest('Practice Login', testSuite.id, 'https://practicetestautomation.com/practice-test-login/', 'Test login functionality with positive and negative scenarios (username: student, password: Password123)', 'chromium');
        console.log('\n--- TEST 3: Cross-Browser Validation ---');
        console.log('Running Firefox...');
        await runExecutionTest('Firefox Test', testSuite.id, 'https://example.com', 'Open homepage and validate title', 'firefox');
        console.log('Running WebKit...');
        await runExecutionTest('WebKit Test', testSuite.id, 'https://example.com', 'Open homepage and validate title', 'webkit');
        console.log('\n--- TEST 4: Failure Recovery Validation ---');
        await runExecutionTest('Self-Healing Test', testSuite.id, 'https://practicetestautomation.com/practice-test-login/', 'Go to the login page and fill the username field using the specific intentionally broken selector "#bad-username-id-intentionally"', 'chromium');
        console.log('\n--- ALL TESTS COMPLETE ---');
        process.exit(0);
    }
    catch (err) {
        console.error('Validation failed:', err.message);
        process.exit(1);
    }
}
async function runExecutionTest(testName, suiteId, targetUrl, instruction, browser) {
    const execFetch = await fetch(`${API_URL}/executions/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testName, suiteId, targetUrl, instruction, browser })
    });
    const execRes = await execFetch.json();
    console.log(`Execution Queued [${testName}]:`, execRes.executionId);
    return new Promise((resolve) => {
        const socket = (0, socket_io_client_1.io)('http://localhost:8080');
        socket.emit('subscribe', execRes.executionId);
        socket.on('agent_progress', (data) => console.log(`[Progress]`, data));
        socket.on('browser_log', (data) => console.log(`[Log]`, data.message));
        socket.on('healing', (data) => console.log(`[HEALING]`, data.message));
        socket.on('screenshot_uploaded', (data) => console.log(`[Screenshot]`, data.message));
        socket.on('execution_completed', (data) => {
            console.log(`[Result]`, data);
            socket.disconnect();
            resolve();
        });
    });
}
validateAPI();
//# sourceMappingURL=validate-all.js.map