const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.healingEvent.findMany());
}
main().catch(console.error).finally(()=>prisma.$disconnect());
