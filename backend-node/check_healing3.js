const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const projects = await prisma.project.findMany();
    console.log('Projects:', projects);
    const healingEvents = await prisma.healingEvent.findMany({
      include: {
        executionLog: {
          include: {
            suite: { include: { project: true } }
          }
        }
      }
    });
    for (const event of healingEvents) {
      if (event.status === 'PENDING') {
         console.log('Healing event:', event.id, 'Suite Project ID:', event.executionLog.suite.projectId);
      }
    }
}
main().catch(console.error).finally(()=>prisma.$disconnect());
