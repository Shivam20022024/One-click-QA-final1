const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const query = {
      orderBy: { createdAt: 'desc' },
      include: {
        executionLog: {
          include: {
            suite: { include: { project: true } }
          }
        }
      }
    };
    query.where = { status: 'PENDING' };
    console.log(JSON.stringify(await prisma.healingEvent.findMany(query), null, 2));
}
main().catch(console.error).finally(()=>prisma.$disconnect());
