import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ScriptGenerationAgent } from '../agents/ScriptGenerationAgent';

const router = Router();
router.use(authenticate);

// POST /api/v1/ai/codegen
router.post('/codegen', async (req: AuthRequest, res: Response) => {
  try {
    const scriptAgent = new ScriptGenerationAgent(`api_codegen_${Date.now()}`);
    const { test_name, base_url, steps } = req.body;
    
    // Add base_url to steps context if not present
    const enrichedSteps = steps ? steps.map((s: any) => ({ ...s, base_url })) : [];

    const scriptCode = await scriptAgent.generateScript(test_name, enrichedSteps);
    
    res.json({ code: scriptCode });
  } catch (err: any) {
    console.error('Codegen failed:', err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

// POST /api/v1/ai/generate-playwright (used by frontend)
router.post('/generate-playwright', async (req: AuthRequest, res: Response) => {
  try {
    const scriptAgent = new ScriptGenerationAgent(`api_codegen_${Date.now()}`);
    const { suiteName, url, steps } = req.body;
    
    // Add base_url to steps context if not present
    const enrichedSteps = steps ? steps.map((s: any) => ({ ...s, base_url: url })) : [];

    const scriptCode = await scriptAgent.generateScript(suiteName || 'Playwright_Suite', enrichedSteps);
    
    res.json({ code: scriptCode });
  } catch (err: any) {
    console.error('Codegen failed:', err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

// Mock legacy endpoints used by the UI
router.post('/generate-suite', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ message: 'Legacy route replaced by ScriptGenerationAgent' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate suite' });
  }
});

import { RawCodeGenerationAgent } from '../agents/RawCodeGenerationAgent';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

router.post('/generate-raw-code', async (req: AuthRequest, res: Response) => {
  try {
    const { url, instructions, framework } = req.body;
    const agent = new RawCodeGenerationAgent();
    const code = await agent.generateCode(instructions, url, framework);
    res.json({ code });
  } catch (err: any) {
    console.error('Raw codegen failed:', err);
    res.status(500).json({ error: 'Failed to generate raw code' });
  }
});

router.post('/execute-raw-code', async (req: AuthRequest, res: Response) => {
  try {
    const { code, framework } = req.body;
    if (framework !== 'playwright') {
      return res.status(400).json({ error: 'Sandbox execution currently only supports Playwright tests.' });
    }
    
    // Use temp directory so nodemon ignores it, but Playwright can easily find it
    const backendRoot = path.join(__dirname, '../../');
    const tempDir = path.join(backendRoot, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const fileName = `sandbox_${Date.now()}.spec.ts`;
    const filePath = path.join(tempDir, fileName);
    
    fs.writeFileSync(filePath, code);
    
    const relativePath = `temp/${fileName}`;
    exec(`npx playwright test ${relativePath}`, { cwd: backendRoot, timeout: 60000 }, (error, stdout, stderr) => {
      // Clean up file
      try { fs.unlinkSync(filePath); } catch (e) {}
      
      const output = stdout || stderr || (error ? error.message : '');
      res.json({ output, success: !error });
    });
  } catch (err: any) {
    console.error('Execute raw code failed:', err);
    res.status(500).json({ error: 'Failed to execute raw code' });
  }
});

export default router;
