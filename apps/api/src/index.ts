import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
    TaskRepositoryPostgres,
    AuditEventRepositoryPostgres,
    PolicyContextRepositoryPostgres,
} from '@kanbax/infrastructure';
import { HardenedPolicyEngine } from '@kanbax/policy';
import { QueryService } from './query-service.js';
import { CreateTaskPipeline } from './create-task-pipeline.js';
import { UpdateTaskStatusPipeline } from './update-task-status-pipeline.js';
import { UpdateTaskDetailsPipeline } from './update-task-details-pipeline.js';
import { DeleteTaskPipeline } from './delete-task-pipeline.js';
import { PrincipalType } from '@kanbax/domain';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';

import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health-check / root endpoint
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Kanbax API is running' });
});

// Optional: serve the UI build (if you run `pnpm --filter @kanbax/ui build`)
const uiDistPath = path.join(__dirname, '../../ui/dist');
app.use(express.static(uiDistPath));

const prisma = new PrismaClient();
const taskRepo = new TaskRepositoryPostgres(prisma);
const auditRepo = new AuditEventRepositoryPostgres(prisma);
const policyRepo = new PolicyContextRepositoryPostgres(prisma);
const policyEngine = new HardenedPolicyEngine();

const queryService = new QueryService(taskRepo, auditRepo);

// Pipelines
const createPipeline = new CreateTaskPipeline(policyEngine, auditRepo, taskRepo);
const updateStatusPipeline = new UpdateTaskStatusPipeline(policyEngine, auditRepo, taskRepo);
const updateDetailsPipeline = new UpdateTaskDetailsPipeline(policyEngine, auditRepo, taskRepo);
const deletePipeline = new DeleteTaskPipeline(policyEngine, auditRepo, taskRepo);

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_ISSUER = process.env.SUPABASE_ISSUER;
const SUPABASE_JWKS = SUPABASE_ISSUER
    ? createRemoteJWKSet(new URL('.well-known/jwks.json', SUPABASE_ISSUER.endsWith('/') ? SUPABASE_ISSUER : `${SUPABASE_ISSUER}/`))
    : null;

const ROLE_PERMISSIONS: Record<string, string[]> = {
    SUPERADMIN: ['task.create', 'task.update-status', 'task.update-details', 'task.delete', 'team.manage', 'system.manage'],
    ADMIN: ['task.create', 'task.update-status', 'task.update-details', 'task.delete', 'team.manage'],
    MEMBER: ['task.create', 'task.update-status', 'task.update-details', 'task.delete'],
};

const isApiRoute = (pathName: string) =>
    pathName.startsWith('/commands') ||
    pathName.startsWith('/tasks') ||
    pathName.startsWith('/boards') ||
    pathName.startsWith('/me') ||
    pathName.startsWith('/teams') ||
    pathName.startsWith('/invites');

const resolveJwtSecret = (secret: string) => {
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    const looksBase64 = secret.length % 4 === 0 && base64Pattern.test(secret);
    if (looksBase64) {
        return Buffer.from(secret, 'base64');
    }
    return new TextEncoder().encode(secret);
};

const resolveJwtKey = (token: string) => {
    const header = decodeProtectedHeader(token);
    if (header.alg && header.alg.startsWith('HS')) {
        if (!SUPABASE_JWT_SECRET) {
            throw new Error('Server misconfigured: SUPABASE_JWT_SECRET missing');
        }
        return resolveJwtSecret(SUPABASE_JWT_SECRET);
    }
    if (!SUPABASE_JWKS) {
        throw new Error('Server misconfigured: SUPABASE_ISSUER missing');
    }
    return SUPABASE_JWKS;
};

const buildPrincipal = (tenantId: string, user: any, role: string) => ({
    id: user.id,
    tenantId,
    type: PrincipalType.USER,
    roles: [
        {
            id: `${role.toLowerCase()}-role`,
            tenantId,
            name: role.toLowerCase(),
            permissions: ROLE_PERMISSIONS[role].map((name) => ({
                id: `${tenantId}-${name}`,
                tenantId,
                name,
            })),
        },
    ],
    metadata: {
        authUserId: user.authUserId,
        email: user.email,
    },
});

// Supabase Auth Middleware
app.use(async (req, res, next) => {
    if (!isApiRoute(req.path)) return next();

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    try {
        const jwtKey = resolveJwtKey(token);
        const { payload } = await jwtVerify(token, jwtKey, SUPABASE_ISSUER
            ? { issuer: SUPABASE_ISSUER }
            : undefined);

        const authUserId = String(payload.sub || '');
        const email = String(payload.email || '');
        const userMetadata = (payload.user_metadata || {}) as Record<string, any>;

        if (!authUserId || !email) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        const existingUser = await prisma.user.findUnique({ where: { authUserId } });
        const metadataName = userMetadata.full_name || userMetadata.name || null;
        const metadataAvatar = userMetadata.avatar_url || null;
        const user = existingUser
            ? await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    email,
                    ...(existingUser.name ? {} : { name: metadataName }),
                    ...(existingUser.avatarUrl ? {} : { avatarUrl: metadataAvatar }),
                },
            })
            : await prisma.user.create({
                data: {
                    authUserId,
                    email,
                    name: metadataName,
                    avatarUrl: metadataAvatar,
                },
            });

        const requestedTenantId = req.headers['x-tenant-id'] as string | undefined;
        let membership = requestedTenantId
            ? await prisma.teamMembership.findUnique({
                where: { tenantId_userId: { tenantId: requestedTenantId, userId: user.id } },
            })
            : await prisma.teamMembership.findFirst({ where: { userId: user.id } });

        const ensurePersonalHuddle = async () => {
            const existingPersonal = await prisma.teamMembership.findFirst({
                where: {
                    userId: user.id,
                    tenant: { name: 'Personal' },
                },
            });
            if (existingPersonal) return existingPersonal;

            const personalTenant = await prisma.tenant.create({
                data: { name: 'Personal' },
            });
            return prisma.teamMembership.create({
                data: { tenantId: personalTenant.id, userId: user.id, role: 'ADMIN' },
            });
        };

        if (!user.isSuperAdmin) {
            await ensurePersonalHuddle();
        }

        if (!membership && !user.isSuperAdmin) {
            membership = await prisma.teamMembership.findFirst({ where: { userId: user.id } });
        }

        if (requestedTenantId && !membership && !user.isSuperAdmin) {
            return res.status(403).json({ error: 'Access denied for tenant' });
        }

        const tenantId = requestedTenantId || membership?.tenantId || null;
        (req as any).user = user;
        (req as any).membership = membership;
        (req as any).tenantId = tenantId;

        if (tenantId) {
            const role = user.isSuperAdmin ? 'SUPERADMIN' : (membership?.role || 'MEMBER');
            (req as any).principal = buildPrincipal(tenantId, user, role);
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// --- Query Endpoints ---

app.get('/tasks', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tasks = await queryService.getTasks((req as any).principal);
        res.json(tasks);
    } catch (e: any) {
        res.status(403).json({ error: e?.message ?? 'Forbidden' });
    }
});

app.get('/boards', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const boards = await queryService.getBoards((req as any).principal);
        res.json(boards);
    } catch (e: any) {
        res.status(403).json({ error: e?.message ?? 'Forbidden' });
    }
});

// --- Command Endpoints ---

app.post('/commands/task/create', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_CREATE' as const,
            tenantId: (req as any).tenantId,
            principal: (req as any).principal,
            payload: req.body,
        };
        const result = await createPipeline.execute(command);
        res.json(result);
    } catch (e: any) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.post('/commands/task/update-status', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_UPDATE_STATUS' as const,
            tenantId: (req as any).tenantId,
            principal: (req as any).principal,
            payload: req.body,
        };
        const result = await updateStatusPipeline.execute(command);
        res.json(result);
    } catch (e: any) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.post('/commands/task/update-details', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_UPDATE_DETAILS' as const,
            tenantId: (req as any).tenantId,
            principal: (req as any).principal,
            payload: req.body,
        };
        const result = await updateDetailsPipeline.execute(command);
        res.json(result);
    } catch (e: any) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.post('/commands/task/assign-huddle', async (req, res) => {
    try {
        const user = (req as any).user;
        const tenantId = (req as any).tenantId;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (!tenantId) return res.status(403).json({ error: 'No tenant selected' });

        const taskId = String(req.body?.taskId || '');
        const targetTenantId = String(req.body?.targetTenantId || '');
        if (!taskId || !targetTenantId) return res.status(400).json({ error: 'Task ID and target huddle are required' });

        const targetMembership = await prisma.teamMembership.findUnique({
            where: { tenantId_userId: { tenantId: targetTenantId, userId: user.id } },
        });
        if (!targetMembership && !user.isSuperAdmin) {
            return res.status(403).json({ error: 'Access denied for target huddle' });
        }

        const task = await prisma.task.findFirst({ where: { id: taskId, tenantId } });
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.source?.type && task.source.type !== 'MANUAL') {
            return res.status(400).json({ error: 'Only manual tasks can be moved' });
        }

        const nextPolicyContext = {
            ...(task.policyContext || {}),
            tenantId: targetTenantId,
            scopeId: 'default-board',
        };

        const updated = await prisma.task.update({
            where: { id: taskId },
            data: {
                tenantId: targetTenantId,
                policyContext: nextPolicyContext,
                updatedAt: new Date(),
                version: (task.version || 0) + 1,
            },
        });

        res.json(updated);
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.post('/commands/task/delete', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_DELETE' as const,
            tenantId: (req as any).tenantId,
            principal: (req as any).principal,
            payload: req.body,
        };
        await deletePipeline.execute(command);
        res.status(204).send();
    } catch (e: any) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});

// --- Identity / Teams ---

app.get('/me', async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const memberships = await prisma.teamMembership.findMany({
        where: { userId: user.id },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
    });
    const invites = await prisma.teamInvite.findMany({
        where: { email: user.email, status: 'PENDING' },
        include: { tenant: true, invitedBy: true },
    });

    res.json({ user, memberships, invites });
});

app.patch('/me', async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() : undefined;
    const preferences = req.body?.preferences ?? undefined;

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
            ...(name !== undefined ? { name } : {}),
            ...(avatarUrl !== undefined ? { avatarUrl } : {}),
            ...(preferences !== undefined ? { preferences } : {}),
        },
    });

    res.json({ user: updated });
});

app.post('/invites/:inviteId/accept', async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const inviteId = req.params.inviteId;
    const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(404).json({ error: 'Invite not found' });
    }
    if (invite.status !== 'PENDING') {
        return res.status(400).json({ error: 'Invite already processed' });
    }

    await prisma.teamMembership.upsert({
        where: { tenantId_userId: { tenantId: invite.tenantId, userId: user.id } },
        update: { role: invite.role },
        create: { tenantId: invite.tenantId, userId: user.id, role: invite.role },
    });
    await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
    });

    res.json({ status: 'ACCEPTED' });
});

app.post('/invites/:inviteId/decline', async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const inviteId = req.params.inviteId;
    const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(404).json({ error: 'Invite not found' });
    }
    if (invite.status !== 'PENDING') {
        return res.status(400).json({ error: 'Invite already processed' });
    }

    await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'DECLINED' },
    });

    res.json({ status: 'DECLINED' });
});

app.get('/teams', async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const memberships = await prisma.teamMembership.findMany({
        where: { userId: user.id },
        include: { tenant: true },
    });
    res.json(memberships);
});

app.post('/teams', async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Team name is required' });

    const tenant = await prisma.tenant.create({ data: { name } });
    const membership = await prisma.teamMembership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'ADMIN' },
    });

    res.status(201).json({ tenant, membership });
});

app.get('/teams/:tenantId/members', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });

    const members = await prisma.teamMembership.findMany({
        where: { tenantId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
    });
    res.json(members);
});

app.post('/teams/:tenantId/invites', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Cannot invite members to a private huddle' });
    }

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    if (membership?.role !== 'ADMIN' && !user.isSuperAdmin) return res.status(403).json({ error: 'Admin required' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'MEMBER').toUpperCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!['ADMIN', 'MEMBER'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const invite = await prisma.teamInvite.upsert({
        where: { tenantId_email: { tenantId, email } },
        update: { role, status: 'PENDING', invitedByUserId: user.id },
        create: { tenantId, email, role, status: 'PENDING', invitedByUserId: user.id },
    });

    res.status(201).json(invite);
});

app.post('/teams/:tenantId/leave', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        include: { tenant: true },
    });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.tenant?.name === 'Personal') {
        return res.status(400).json({ error: 'Cannot leave personal huddle' });
    }

    await prisma.teamMembership.delete({ where: { id: membership.id } });
    res.status(204).send();
});

app.patch('/teams/:tenantId/members/:memberId', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    const memberId = req.params.memberId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Private huddles cannot be managed' });
    }

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    if (membership?.role !== 'ADMIN' && !user.isSuperAdmin) return res.status(403).json({ error: 'Admin required' });

    const role = String(req.body?.role || '').toUpperCase();
    if (!['ADMIN', 'MEMBER'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const updated = await prisma.teamMembership.update({
        where: { id: memberId },
        data: { role },
    });

    res.json(updated);
});

app.delete('/teams/:tenantId/members/:memberId', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    const memberId = req.params.memberId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Private huddles cannot be managed' });
    }

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    if (membership?.role !== 'ADMIN' && !user.isSuperAdmin) return res.status(403).json({ error: 'Admin required' });

    await prisma.teamMembership.delete({ where: { id: memberId } });
    res.status(204).send();
});

// SPA fallback MUST be after API routes (Express 5 safe)
// Only send index.html if the file exists; otherwise return 404 JSON.
app.use((req, res) => {
    // If the request looks like an API route, return 404 JSON.
    if (req.path.startsWith('/commands') || req.path.startsWith('/tasks') || req.path.startsWith('/boards')) {
        return res.status(404).json({ error: 'Not Found' });
    }

    return res.sendFile(path.join(uiDistPath, 'index.html'), (err) => {
        if (err) res.status(404).json({ error: 'UI build not found. Run `pnpm --filter @kanbax/ui build`.' });
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Kanbax API listening on port ${PORT}`);
});
