const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.executionLog.findUnique({where: {id: '4fcb6b4b-efbb-4c41-90f1-b458e3c21316'}})
  .then(x => {
    const data = JSON.parse(x.planData);
    console.log(JSON.stringify(JSON.parse(data.scriptCode), null, 2));
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
