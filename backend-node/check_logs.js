"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("./src/prismaClient"));
async function main() {
    const executionId = 'bf34ae82-c6b3-488d-8bd3-2ca45e5aae5d';
    const exec = await prismaClient_1.default.executionLog.findUnique({ where: { id: executionId } });
    if (exec) {
        console.log("STATUS:", exec.status);
        console.log("ERROR/LOGS:");
        const logs = JSON.parse(exec.logs || '[]');
        logs.forEach((l) => console.log(l));
        console.log("STEP LOGS:");
        const steps = JSON.parse(exec.stepLogs || '[]');
        steps.forEach((s) => console.log(s));
    }
    else {
        console.log("Execution not found");
    }
}
main().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=check_logs.js.map