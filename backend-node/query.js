const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const logs = await prisma.executionLog.findMany({
    where: { status: { not: 'RUNNING' } },
    orderBy: { startedAt: 'desc' },
    take: 1
  });
  fs.writeFileSync('db_plan.json', logs[0].planData, 'utf8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
