const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const log = await prisma.executionLog.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log("Status:", log.status);
  console.log("Duration Ms:", log.durationMs);
  
  if (log.stepLogs) {
    const steps = JSON.parse(log.stepLogs);
    const failures = steps.filter(s => s.status === 'FAILED');
    console.log("Failures:", failures);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
