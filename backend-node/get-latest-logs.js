const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.executionLog.findFirst({orderBy: {startedAt: 'desc'}})
  .then(x => {
    console.log('Latest ID:', x.id);
    console.log('Logs:', x.logs);
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
