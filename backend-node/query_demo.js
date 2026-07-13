const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const logs = await prisma.executionLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 1
  });
  fs.writeFileSync('db_plan_demo.json', logs[0].planData, 'utf8');
  fs.writeFileSync('fails_demo.json', logs[0].stepLogs, 'utf8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
