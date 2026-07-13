const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const suite = await prisma.testSuite.findFirst();
    if (!suite) {
      console.log('No suite found');
      return;
    }
    const res = await prisma.testRun.create({
      data: {
        name: 'test',
        intent: 'test',
        steps: '[]',
        suiteId: suite.id
      }
    });
    console.log('SUCCESS:', res);
  } catch (e) {
    console.error('PRISMA ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
