const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function seed() {
  const exec = await p.executionLog.findFirst({ where: { status: 'PASSED' } });
  if (exec) {
    await p.healingEvent.create({ data: { executionLogId: exec.id, originalSelector: '#submit-btn', healedSelector: '.submit-button', success: true } });
    await p.healingEvent.create({ data: { executionLogId: exec.id, originalSelector: '#username-input', healedSelector: 'input[name="user"]', success: true } });
    await p.healingEvent.create({ data: { executionLogId: exec.id, originalSelector: '.nav-link-login', healedSelector: '#login-nav', success: true } });
    console.log('Seeded 3 healing events!');
  }
}

seed();
