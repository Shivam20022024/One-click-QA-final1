import { io } from 'socket.io-client';

const API_URL = 'http://localhost:8080/api/v1';

async function validateAPI() {
  console.log('--- PHASE 2: API Runtime Validation ---');
  try {
    // POST /projects
    const projRes = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Validation Project',
        description: 'End-to-End Testing Project'
      })
    });
    const project = await projRes.json();
    console.log('POST /projects response:', project);

    // We need a test suite to trigger execution. 
    const suiteRes = await fetch(`${API_URL}/suites`, {
      method: 'GET'
    });
    // For validation, we can just insert a suite into DB directly
    const prisma = (await import('../src/prismaClient')).default;
    const testSuite = await prisma.testSuite.create({
      data: {
        name: 'Validation Suite',
        projectId: project.id
      }
    });

    // Trigger real execution 1
    console.log('\n--- PHASE 3-6: Validation 1 (Example.com) ---');
    let execFetch = await fetch(`${API_URL}/executions/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testName: 'Example Verification',
        suiteId: testSuite.id,
        targetUrl: 'https://example.com',
        instruction: 'Open homepage and validate title',
        browser: 'chromium'
      })
    });
    let execRes = await execFetch.json();
    console.log('Execution 1 Queued:', execRes);

    await trackExecution(execRes.executionId);

    console.log('\n--- PHASE 3-6: Validation 2 (Practice Login) ---');
    execFetch = await fetch(`${API_URL}/executions/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testName: 'Login Tests',
        suiteId: testSuite.id,
        targetUrl: 'https://practicetestautomation.com/practice-test-login/',
        instruction: 'Test login with positive and negative cases',
        browser: 'chromium'
      })
    });
    execRes = await execFetch.json();
    console.log('Execution 2 Queued:', execRes);

    await trackExecution(execRes.executionId);
    
    console.log('Validation complete.');
    process.exit(0);

  } catch (err: any) {
    console.error('Validation failed:', err.message);
    process.exit(1);
  }
}

function trackExecution(executionId: string): Promise<void> {
  return new Promise((resolve) => {
    const socket = io('http://localhost:8080');
    socket.emit('subscribe', executionId);
    
    socket.on('queued', (data) => console.log(`[Event: queued]`, data));
    socket.on('agent_progress', (data) => console.log(`[Event: agent_progress]`, data));
    socket.on('browser_log', (data) => console.log(`[Event: browser_log]`, data));
    socket.on('screenshot_uploaded', (data) => console.log(`[Event: screenshot_uploaded]`, data));
    socket.on('execution_completed', (data) => {
      console.log(`[Event: execution_completed]`, data);
      socket.disconnect();
      resolve();
    });
  });
}

validateAPI();
