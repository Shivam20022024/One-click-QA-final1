"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    let user = await prisma.user.findFirst();
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: 'admin@testplatform.ai',
                name: 'Admin'
            }
        });
    }
    let project = await prisma.project.findFirst();
    if (!project) {
        project = await prisma.project.create({
            data: {
                name: 'Sandbox Project',
                description: 'Default project for anonymous runs',
                userId: user.id
            }
        });
        console.log('Created project:', project.id);
    }
    else {
        console.log('Project already exists:', project.id);
    }
}
main()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map