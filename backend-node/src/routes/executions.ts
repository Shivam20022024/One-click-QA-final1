import { Router } from 'express';
import { executionQueue, flowProducer, executionQueueName } from '../queue/executionWorker';
import prisma from '../prismaClient';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/v1/executions
router.get('/', async (req: AuthRequest, res) => {
  try {
    let whereInput: any = {};
    if (req.query.projectId && typeof req.query.projectId === 'string') {
      whereInput = { suite: { projectId: req.query.projectId } };
    }

    const executions = await prisma.executionLog.findMany({
      where: Object.keys(whereInput).length > 0 ? whereInput : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        suite: {
          include: { project: true }
        }
      }
    });
    res.json(executions);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// GET /api/v1/executions/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const execution = await prisma.executionLog.findUnique({
      where: { id },
      include: {
        screenshots: true,
        videos: true,
        reports: true,
        healingEvents: true,
      }
    });
    if (!execution) return res.status(404).json({ error: 'Not found' });

    if (['QUEUED', 'RUNNING'].includes(execution.status)) {
      return res.json({
        id: execution.id,
        status: execution.status,
        message: 'Execution is waiting in worker queue or running',
        suiteId: execution.suiteId,
        createdAt: execution.createdAt,
        stepLogs: [],
        videos: [],
        screenshots: [],
        reports: [],
      });
    }

    let safeStepLogs = [];
    try {
      if (Array.isArray(execution.stepLogs)) {
        safeStepLogs = execution.stepLogs;
      } else if (typeof execution.stepLogs === "string") {
        const parsed = JSON.parse(execution.stepLogs);
        safeStepLogs = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      safeStepLogs = [];
    }

    res.json({
      ...execution,
      stepLogs: safeStepLogs,
      videos: execution.videos || [],
      screenshots: execution.screenshots || [],
      reports: execution.reports || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch execution details' });
  }
});

// GET /api/v1/executions/:id/trace
router.get('/:id/trace', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    console.log(`TRACE_ENDPOINT_HIT ${id}`);
    const execution = await prisma.executionLog.findUnique({
      where: { id },
      include: {
        screenshots: true,
        videos: true
      }
    });
    if (!execution) return res.status(404).json({ error: 'Not found' });

    let traceData = [];
    if (execution.traceData) {
      try { traceData = JSON.parse(execution.traceData); } catch(e) {}
    } else if (execution.stepLogs) {
      try { traceData = JSON.parse(execution.stepLogs); } catch(e) {}
    }

    res.json({
      id: execution.id,
      status: execution.status,
      traceEvents: Array.isArray(traceData) ? traceData : [],
      screenshots: execution.screenshots || [],
      videos: execution.videos || []
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

// GET /api/v1/executions/:id/plan
router.get('/:id/plan', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    console.log(`PLAN_ENDPOINT_HIT ${id}`);
    const execution = await prisma.executionLog.findUnique({
      where: { id }
    });
    if (!execution) return res.status(404).json({ error: 'Not found' });

    let planData = null;
    if (execution.planData) {
      try { planData = JSON.parse(execution.planData); } catch(e) {}
    }

    res.json({
      id: execution.id,
      plan: planData || {}
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch execution plan' });
  }
});

// POST /api/v1/executions/run
router.post('/run', async (req: AuthRequest, res) => {
  const { testName, suiteId, targetUrl, instruction, browser } = req.body;

  try {
    const execution = await prisma.executionLog.create({
      data: {
        suiteId: suiteId,
        status: 'QUEUED',
        browser: browser || 'chromium',
      }
    });

    const job = await executionQueue.add('run-test', {
      executionId: execution.id,
      testName,
      targetUrl,
      instruction,
      browser
    }, {
      jobId: execution.id,
      attempts: 1
    });

    res.json({ message: 'Execution queued successfully', executionId: execution.id, jobId: job.id });
  } catch (err: any) {
    console.error('Error queueing execution:', err);
    res.status(500).json({ error: 'Failed to queue execution' });
  }
});

// POST /api/v1/executions/run-multi-test
router.post('/run-multi-test', async (req: AuthRequest, res) => {
  console.log('PARALLEL_RUN_REQUEST', req.body);
  const { test_name, base_url, steps, browsers, devices, project_id, suite_id } = req.body;
  
  if (!browsers || browsers.length === 0) {
    return res.status(400).json({ error: 'Browsers are required' });
  }

  try {
    const children = [];
    const executionIds = [];

    let validSuiteId = suite_id;
    if (!validSuiteId && project_id) {
      let suite = await prisma.testSuite.findFirst({ where: { projectId: project_id } });
      if (!suite) {
        suite = await prisma.testSuite.create({
          data: { name: 'Default Suite', projectId: project_id }
        });
      }
      validSuiteId = suite.id;
    } else if (!validSuiteId) {
      // Fallback
      let suite = await prisma.testSuite.findFirst();
      if (!suite) return res.status(400).json({ error: 'No suite found' });
      validSuiteId = suite.id;
    }

    for (const browser of browsers) {
      const browserLower = browser.toLowerCase();
      const execution = await prisma.executionLog.create({
        data: {
          suiteId: validSuiteId,
          status: 'QUEUED',
          browser: browserLower,
        }
      });

      children.push({
        name: 'run-multi-test',
        queueName: executionQueueName,
        data: {
          executionId: execution.id,
          testName: `${test_name} (${browser})`,
          targetUrl: base_url,
          browser: browserLower,
          steps: steps
        },
        opts: {
          jobId: execution.id,
          attempts: 1
        }
      });

      console.log(`QUEUE_JOB_CREATED: child job for execution ${execution.id}`);
      executionIds.push(execution.id);
    }

    const parentJob = await flowProducer.add({
      name: 'cross-browser-suite',
      queueName: executionQueueName,
      data: {
        testName: test_name,
        browsers: browsers
      },
      children: children
    });

    console.log(`FLOW_PRODUCER_PARENT_CREATED: parent job ${parentJob.job.id}`);

    res.json({ message: 'Multi-test queued successfully via FlowProducer', executionIds, jobs: children.map(c => c.opts.jobId) });
  } catch (err: any) {
    console.error('Error queueing multi-test:', err);
    res.status(500).json({ error: 'Failed to queue multi-test executions' });
  }
});
// POST /api/v1/executions/:id/cancel
router.post('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    
    // Attempt to remove job from queue if it hasn't started yet
    // BullMQ requires jobId to remove it. We don't store jobId in ExecutionLog currently.
    // Instead we can fetch active/waiting jobs and find by executionId
    const jobs = await executionQueue.getJobs(['waiting', 'active', 'delayed', 'paused']);
    for (const job of jobs) {
      if (job.data.executionId === id) {
        await job.remove().catch(() => {});
      }
    }

    // Update execution state to CANCELLED
    await prisma.executionLog.update({
      where: { id },
      data: { status: 'CANCELLED', logs: 'Execution cancelled by user' }
    });

    res.json({ message: 'Execution cancelled successfully' });
  } catch (err: any) {
    console.error('Error cancelling execution:', err);
    res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

// GET /api/v1/executions/:id/video
router.get('/:id/video', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const execution = await prisma.executionLog.findUnique({
      where: { id },
      include: { videos: true }
    });
    
    if (!execution) return res.status(404).json({ error: 'Not found' });
    
    if (!execution.videos || execution.videos.length === 0) {
      console.log(`VIDEO_ARTIFACT_NOT_FOUND for execution ${id}`);
      return res.status(404).json({ error: 'VIDEO_ARTIFACT_NOT_FOUND' });
    }
    
    const video = execution.videos[0];
    if (!video) {
      console.log(`VIDEO_ARTIFACT_NOT_FOUND for execution ${id}`);
      return res.status(404).json({ error: 'VIDEO_ARTIFACT_NOT_FOUND' });
    }
    
    res.json({ url: video.url, storagePath: video.storagePath });
  } catch (err: any) {
    console.error('Error fetching video:', err);
    res.status(500).json({ error: 'Failed to fetch video artifact' });
  }
});

export default router;
