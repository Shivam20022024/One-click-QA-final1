import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../prismaClient';

const router = Router();

router.use(authenticate);

// GET /api/v1/projects
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(projects);
  } catch (err: any) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/v1/projects
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { name, description } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        user: {
          connectOrCreate: {
            where: { id: userId },
            create: {
              id: userId,
              email: req.user?.email || 'unknown@example.com',
              name: req.user?.user_metadata?.full_name || 'Unknown'
            }
          }
        }
      }
    });

    res.status(201).json(project);
  } catch (err: any) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/v1/projects/:id/suites
router.get('/:id/suites', async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id as string;
    const suites = await prisma.testSuite.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(suites);
  } catch (err: any) {
    console.error('Error fetching project suites:', err);
    res.status(500).json({ error: 'Failed to fetch project suites' });
  }
});

// POST /api/v1/projects/:id/suites
router.post('/:id/suites', async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id as string;
    const { name, description } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Suite name is required' });
      return;
    }

    const suite = await prisma.testSuite.create({
      data: {
        name,
        description: description || null,
        projectId
      }
    });

    res.status(201).json(suite);
  } catch (err: any) {
    console.error('Error creating suite:', err);
    res.status(500).json({ 
      error: 'Failed to create suite: ' + err.message,
      stack: err.stack 
    });
  }
});

export default router;
