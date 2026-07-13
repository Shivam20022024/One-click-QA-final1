require('dotenv').config(); 
import { executionQueue, flowProducer, executionQueueName } from './src/queue/executionWorker'; 
import prisma from './src/prismaClient'; 

async function main() { 
  const browsers = ['chromium', 'firefox', 'webkit', 'edge']; 
  let suite = await prisma.testSuite.findFirst(); 
  if (!suite) { 
    let project = await prisma.project.findFirst(); 
    suite = await prisma.testSuite.create({ data: { name: 'Autonomous Run', projectId: project!.id } }); 
  } 
  
  const children = []; 
  const executionIds = []; 
  
  for (const browser of browsers) { 
    const browserLower = browser.toLowerCase(); 
    const execution = await prisma.executionLog.create({ 
      data: { suiteId: suite.id, status: 'QUEUED', durationMs: 0, browser: browserLower } 
    }); 
    children.push({ 
      name: 'autonomous-test', 
      queueName: executionQueueName, 
      data: { 
        executionId: execution.id, 
        testName: `Auto-QA [${browserLower}]`, 
        targetUrl: 'https://the-internet.herokuapp.com/', 
        customScenario: '1. Login validation\n- Open login page\n- Username: tomsmith\n- Password: SuperSecretPassword!\n- Login successfully\n- Verify secure area\n\n2. Logout validation\n- Logout\n- Verify login page', 
        browser: browserLower, 
        depth: 'Full Autonomous', 
        features: { crossBrowser: true }, 
        mode: 'full_autonomous', 
        isAutonomous: true 
      }, 
      opts: { jobId: execution.id, attempts: 1 } 
    }); 
    executionIds.push(execution.id); 
  } 
  
  const parentJob = await flowProducer.add({ 
    name: 'cross-browser-suite', 
    queueName: executionQueueName, 
    data: { targetUrl: 'https://the-internet.herokuapp.com/', browsers }, 
    children 
  }); 
  
  console.log('Queued parent job:', parentJob.job.id, 'children:', executionIds); 
} 
main().catch(console.error).finally(() => process.exit(0));
