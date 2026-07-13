import prisma from './src/prismaClient';

async function main() {
  const executionId = 'bf34ae82-c6b3-488d-8bd3-2ca45e5aae5d';
  const exec = await prisma.executionLog.findUnique({ where: { id: executionId } });
  if (exec) {
    console.log("STATUS:", exec.status);
    console.log("ERROR/LOGS:");
    const logs = JSON.parse(exec.logs || '[]');
    logs.forEach((l: string) => console.log(l));
    console.log("STEP LOGS:");
    const steps = JSON.parse(exec.stepLogs || '[]');
    steps.forEach((s: any) => console.log(s));
  } else {
    console.log("Execution not found");
  }
}

main().catch(console.error).finally(() => process.exit(0));
