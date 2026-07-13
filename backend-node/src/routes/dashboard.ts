import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../prismaClient';

const router = Router();
router.use(authenticate);

router.get('/summary', async (req, res) => {
  try {
    const totalExecutions = await prisma.executionLog.count();
    const passedCount = await prisma.executionLog.count({ 
      where: { 
        status: { in: ['PASSED', 'COMPLETED'] } 
      } 
    });
    const failedCount = await prisma.executionLog.count({ where: { status: 'FAILED' } });
    const selfHealingCount = await prisma.healingEvent.count();
    
    // Calculate average duration
    const completedExecutions = await prisma.executionLog.findMany({
      where: { durationMs: { not: null } },
      select: { durationMs: true }
    });
    
    let avgDuration = 0;
    if (completedExecutions.length > 0) {
      const sum = completedExecutions.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
      avgDuration = Math.round((sum / completedExecutions.length) / 1000);
    }
    
    const successRate = totalExecutions === 0 ? 0 : Math.round((passedCount / totalExecutions) * 100);

    res.json({
      totalExecutions,
      passedCount,
      failedCount,
      selfHealingCount,
      successRate,
      avgDuration
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.get('/execution-trend', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const executions = await prisma.executionLog.findMany({
      where: {
        createdAt: { gte: threshold }
      },
      select: {
        status: true,
        createdAt: true
      }
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Use an array to maintain strict chronological order
    const trendData: { date: string, passed: number, failed: number }[] = [];

    // Initialize the last N days with zero to ensure empty days appear on graph in order
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = dayNames[d.getDay()] as string;
      // If days > 7, append date to distinguish
      const displayStr = days > 7 ? `${d.getMonth() + 1}/${d.getDate()}` : dayStr;
      
      trendData.push({ date: displayStr, passed: 0, failed: 0 });
    }

    executions.forEach((ex) => {
      const d = new Date(ex.createdAt);
      d.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - d.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      // Map it to the correct bucket backwards
      const index = (days - 1) - diffDays;
      if (index >= 0 && index < days) {
        const item = trendData[index];
        if (item) {
          if (ex.status === 'PASSED' || ex.status === 'COMPLETED') item.passed++;
          else if (ex.status === 'FAILED') item.failed++;
        }
      }
    });

    res.json(trendData);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch execution trend' });
  }
});

router.get('/browser-distribution', async (req, res) => {
  try {
    const distribution = await prisma.executionLog.groupBy({
      by: ['browser'],
      _count: {
        id: true,
      },
    });

    let formattedDist = distribution.map((d) => ({
      browser: d.browser || 'chromium', // Default to chromium if null
      count: d._count.id,
    }));
    
    // Merge duplicates if multiple had null/chromium
    const merged: Record<string, number> = {};
    formattedDist.forEach(item => {
      merged[item.browser] = (merged[item.browser] || 0) + item.count;
    });

    const finalDist = Object.entries(merged)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count);

    res.json(finalDist);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch browser distribution' });
  }
});

router.get('/recent-executions', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 25;
  try {
    const runs = await prisma.executionLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        suite: {
          include: { project: true }
        }
      }
    });
    
    const formattedRuns = runs.map(run => ({
      id: run.id,
      run_id: run.id,
      testName: run.suite.name,
      browser: run.browser || 'chromium',
      projectName: run.suite.project.name,
      status: run.status.toLowerCase(),
      duration: run.durationMs ? Math.round(run.durationMs / 1000) : 0,
      startedAt: run.startedAt,
    }));
    
    res.json(formattedRuns);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch recent executions' });
  }
});

export default router;
