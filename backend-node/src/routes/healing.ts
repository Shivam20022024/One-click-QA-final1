import { Router } from 'express';
import prisma from '../prismaClient';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/v1/healing
router.get('/', async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string;
    
    const query: any = {
      orderBy: { createdAt: 'desc' },
      include: {
        executionLog: {
          include: {
            suite: { include: { project: true } }
          }
        }
      }
    };
    
    if (status) {
      query.where = { status };
    }
    
    const events = await prisma.healingEvent.findMany(query);
    res.json(events);
  } catch (err: any) {
    console.error('Error fetching healing events:', err);
    res.status(500).json({ error: 'Failed to fetch healing events' });
  }
});

// POST /api/v1/healing/:id/approve
router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    
    const event = await prisma.healingEvent.findUnique({
      where: { id },
      include: { executionLog: true }
    });
    
    if (!event) return res.status(404).json({ error: 'Not found' });
    
    // We need to find the TestRun that matches event.testName in the suite
    const suiteId = event.executionLog.suiteId;
    if (suiteId && event.testName) {
       const testRun = await prisma.testRun.findFirst({
         where: { suiteId, name: event.testName }
       });
       
       if (testRun) {
         let steps = [];
         try {
           steps = JSON.parse(testRun.steps);
         } catch(e) {}
         
         // If we have stepIndex, we can update it
         if (event.stepIndex && steps.length >= event.stepIndex) {
           const stepToUpdate = steps[event.stepIndex - 1]; // stepIndex is 1-based in Python
           if (stepToUpdate && stepToUpdate.selector === event.originalSelector) {
             stepToUpdate.selector = event.healedSelector;
           } else {
             // Fallback: just search for the selector anywhere in the steps
             for (const step of steps) {
               if (step.selector === event.originalSelector) {
                 step.selector = event.healedSelector;
               }
             }
           }
           
           await prisma.testRun.update({
             where: { id: testRun.id },
             data: { steps: JSON.stringify(steps) }
           });
         } else {
            // Fallback: just search for the selector anywhere in the steps
             for (const step of steps) {
               if (step.selector === event.originalSelector) {
                 step.selector = event.healedSelector;
               }
             }
             await prisma.testRun.update({
               where: { id: testRun.id },
               data: { steps: JSON.stringify(steps) }
             });
         }
       }
    }
    
    const updated = await prisma.healingEvent.update({
      where: { id },
      data: { status: 'APPROVED' }
    });
    
    res.json(updated);
  } catch (err: any) {
    console.error('Error approving healing event:', err);
    res.status(500).json({ error: 'Failed to approve healing event' });
  }
});

// POST /api/v1/healing/:id/reject
router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    
    const updated = await prisma.healingEvent.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
    
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reject healing event' });
  }
});

export default router;
