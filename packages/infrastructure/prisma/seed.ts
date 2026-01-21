import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Kanbax database...');

    // 1. Create Tenant
    const tenant = await prisma.tenant.upsert({
        where: { id: 'acme-corp' },
        update: {},
        create: {
            id: 'acme-corp',
            name: 'Acme Corp',
        },
    });

    // 2. Create Permissions
    const permissions = [
        { name: 'task.read', description: 'Read tasks' },
        { name: 'task.create', description: 'Create tasks' },
        { name: 'board.read', description: 'Read boards' },
        { name: 'audit.read', description: 'Read audit events' },
    ];

    for (const p of permissions) {
        await prisma.permission.upsert({
            where: { tenantId_name: { tenantId: tenant.id, name: p.name } },
            update: {},
            create: {
                tenantId: tenant.id,
                name: p.name,
                description: p.description,
            },
        });
    }

    // 3. Create Admin Role
    const adminRole = await prisma.role.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'ADMIN' } },
        update: {},
        create: {
            tenantId: tenant.id,
            name: 'ADMIN',
        },
    });

    // Link permissions to role
    const allPerms = await prisma.permission.findMany({ where: { tenantId: tenant.id } });
    for (const p of allPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
            update: {},
            create: {
                roleId: adminRole.id,
                permissionId: p.id,
            },
        });
    }

    // 4. Create Admin Principal
    const adminPrincipal = await prisma.principal.create({
        data: {
            id: 'admin-user-1',
            tenantId: tenant.id,
            type: 'USER',
            metadata: { email: 'admin@acme.com' },
        },
    });

    await prisma.principalRole.create({
        data: {
            principalId: adminPrincipal.id,
            roleId: adminRole.id,
        },
    });

    // 5. Create Sample Tasks
    const tasks = [
        { title: 'Manual Task 1', status: 'TODO', priority: 'HIGH', source: { type: 'MANUAL' } },
        { title: 'Manual Task 2', status: 'IN_PROGRESS', priority: 'MEDIUM', source: { type: 'MANUAL' } },
        { title: 'JIRA-101: Fix bug', status: 'TODO', priority: 'CRITICAL', source: { type: 'JIRA', issueKey: 'JIRA-101' } },
        { title: 'JIRA-102: New feature', status: 'IN_PROGRESS', priority: 'HIGH', source: { type: 'JIRA', issueKey: 'JIRA-102' } },
        { title: 'Email: Customer feedback', status: 'TODO', priority: 'LOW', source: { type: 'EMAIL' } },
        { title: 'Email: Security alert', status: 'DONE', priority: 'CRITICAL', source: { type: 'EMAIL' } },
        { title: 'Manual Task 3', status: 'DONE', priority: 'LOW', source: { type: 'MANUAL' } },
        { title: 'JIRA-103: Update docs', status: 'DONE', priority: 'MEDIUM', source: { type: 'JIRA', issueKey: 'JIRA-103' } },
        { title: 'Manual Task 4', status: 'TODO', priority: 'HIGH', source: { type: 'MANUAL' } },
        { title: 'Email: Weekly report', status: 'IN_PROGRESS', priority: 'MEDIUM', source: { type: 'EMAIL' } },
    ];

    for (const t of tasks) {
        await prisma.task.create({
            data: {
                tenantId: tenant.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                source: t.source,
                policyContext: { scope: 'GLOBAL', scopeId: 'global', rules: [], auditLevel: 'INFO' },
            },
        });
    }

    console.log('Seeding completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
