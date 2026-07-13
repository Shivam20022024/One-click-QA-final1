import prisma from '../src/prismaClient';

async function proof() {
  const execs = await prisma.executionLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      screenshots: true,
      videos: true,
      reports: true,
      healingEvents: true
    }
  });

  for (const exec of execs) {
    const run = await prisma.testRun.findFirst({ where: { suiteId: exec.suiteId } });
    console.log('=== EXECUTION RECORD ===');
    console.log('Execution ID:', exec.id);
    console.log('Status:', exec.status);
    console.log('Start Time:', exec.startedAt);
    console.log('End Time:', exec.completedAt);
    if (exec.screenshots.length) console.log('Screenshot URLs:', exec.screenshots.map(s => s.url));
    if (exec.videos.length) console.log('Video URLs:', exec.videos.map(v => v.url));
    if (exec.reports.length) console.log('Report URLs:', exec.reports.map(r => r.url));
    if (exec.healingEvents.length) console.log('Healing Events:', exec.healingEvents);
  }
}

proof();
