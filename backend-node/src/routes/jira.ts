import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../prismaClient';
import { JiraService } from '../services/JiraService';

const router = Router();
router.use(authenticate);

// GET /api/v1/jira/config
router.get('/config', async (req: AuthRequest, res) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    const integration = await prisma.jiraIntegration.findUnique({
      where: { projectId }
    });
    
    if (!integration) {
      return res.json(null);
    }

    // Mask API token
    res.json({
      ...integration,
      apiToken: '********'
    });
  } catch (err: any) {
    console.error('[JiraRoute] Failed to fetch config:', err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// POST /api/v1/jira/save
router.post('/save', async (req: AuthRequest, res) => {
  try {
    const { projectId, baseUrl, email, apiToken, projectKey, issueType, isActive } = req.body;
    if (!projectId || !baseUrl || !email || !projectKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let existing = await prisma.jiraIntegration.findUnique({
      where: { projectId }
    });

    let tokenToSave = apiToken;
    if (existing && (apiToken === '********' || !apiToken)) {
      tokenToSave = existing.apiToken;
    }

    if (existing) {
      existing = await prisma.jiraIntegration.update({
        where: { projectId },
        data: {
          baseUrl,
          email,
          apiToken: tokenToSave,
          projectKey,
          issueType: issueType || 'Bug',
          isActive: isActive !== undefined ? isActive : true
        }
      });
    } else {
      existing = await prisma.jiraIntegration.create({
        data: {
          projectId,
          baseUrl,
          email,
          apiToken: tokenToSave,
          projectKey,
          issueType: issueType || 'Bug',
          isActive: isActive !== undefined ? isActive : true
        }
      });
    }

    res.json({ message: 'Saved successfully' });
  } catch (err: any) {
    console.error('[JiraRoute] Failed to save config:', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// POST /api/v1/jira/test
router.post('/test', async (req: AuthRequest, res) => {
  try {
    const { projectId, baseUrl, email, apiToken, projectKey } = req.body;
    
    let actualToken = apiToken;
    if (apiToken === '********' && projectId) {
       const existing = await prisma.jiraIntegration.findUnique({ where: { projectId } });
       if (existing) actualToken = existing.apiToken;
    }

    if (!baseUrl || !email || !actualToken || !projectKey) {
      return res.status(400).json({ error: 'Missing required fields for test' });
    }

    const service = new JiraService(baseUrl, email, actualToken, projectKey);
    const success = await service.testConnection();

    if (success) {
      res.json({ success: true, message: 'Connection successful!' });
    } else {
      res.status(400).json({ success: false, error: 'Connection failed. Check credentials and project key.' });
    }
  } catch (err: any) {
    console.error('[JiraRoute] Failed to test config:', err);
    res.status(500).json({ error: 'Test failed' });
  }
});

// GET /api/v1/jira/health
router.get('/health', async (req: AuthRequest, res) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    const integration = await prisma.jiraIntegration.findUnique({
      where: { projectId }
    });
    
    if (!integration || !integration.baseUrl || !integration.apiToken) {
      return res.json({
         jiraConnected: false,
         projectVerified: false,
         authenticationStatus: 'Not Configured',
         availableProjects: []
      });
    }

    const service = new JiraService(integration.baseUrl, integration.email, integration.apiToken, integration.projectKey);
    const health = await service.healthCheck();

    res.json(health);
  } catch (err: any) {
    console.error('[JiraRoute] Failed to fetch health:', err);
    res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;
