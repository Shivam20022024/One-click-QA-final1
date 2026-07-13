const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLatestExecution() {
  const latestExec = await prisma.executionLog.findFirst({
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  if (!latestExec) {
    console.log("No execution logs found.");
    return;
  }

  console.log("Latest Execution ID:", latestExec.id);
  console.log("Status:", latestExec.status);
  console.log("Logs:");
  console.log(latestExec.logs);
}

checkLatestExecution()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
