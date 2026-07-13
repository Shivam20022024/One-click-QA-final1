import { Router, Response } from 'express';
import prisma from '../prismaClient';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/v1/suites
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const suites = await prisma.testSuite.findMany();
    res.json(suites);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch suites' });
  }
});

// GET /api/v1/suites/:id/executions
router.get('/:id/executions', async (req: AuthRequest, res: Response) => {
  try {
    const executions = await prisma.executionLog.findMany({
      where: { suiteId: req.params.id as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json(executions);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch suite executions' });
  }
});

// POST /api/v1/suites/:id/run
router.post('/:id/run', async (req: AuthRequest, res: Response) => {
  try {
    const newExecution = await prisma.executionLog.create({
      data: {
        suiteId: req.params.id as string,
        status: 'PENDING'
      }
    });
    // Placeholder to hook into BullMQ later if needed directly from suites
    res.json(newExecution);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to start suite run' });
  }
});

// DELETE /api/v1/suites/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.testSuite.delete({
      where: { id: req.params.id as string }
    });
    res.json({ message: 'Suite deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete suite' });
  }
});

// GET /api/v1/suites/:id/cases
router.get('/:id/cases', async (req: AuthRequest, res: Response) => {
  try {
    const cases = await prisma.testRun.findMany({
      where: { suiteId: req.params.id as string },
      orderBy: { createdAt: 'desc' }
    });
    
    // Parse steps from JSON string to array
    const formattedCases = cases.map(c => ({
      ...c,
      steps: c.steps ? (typeof c.steps === 'string' ? JSON.parse(c.steps) : c.steps) : []
    }));
    
    res.json(formattedCases);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
});

// POST /api/v1/suites/:id/cases
router.post('/:id/cases', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, steps } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Test case name is required' });
      return;
    }
    
    const stepsString = typeof steps === 'string' ? steps : JSON.stringify(steps || []);
    
    const testCase = await prisma.testRun.create({
      data: {
        name,
        intent: description || '',
        steps: stepsString,
        suiteId: req.params.id as string
      }
    });
    
    res.status(201).json({
      ...testCase,
      steps: testCase.steps ? (typeof testCase.steps === 'string' ? JSON.parse(testCase.steps) : testCase.steps) : []
    });
  } catch (err: any) {
    console.error('Error creating test case:', err);
    res.status(500).json({ error: 'Failed to create test case' });
  }
});

export default router;
