import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { TaskRepositoryPostgres, AuditEventRepositoryPostgres, PolicyContextRepositoryPostgres, } from '@kanbax/infrastructure';
import { HardenedPolicyEngine } from '@kanbax/policy';
import { QueryService } from './query-service.js';
import { CreateTaskPipeline } from './create-task-pipeline.js';
import { UpdateTaskStatusPipeline } from './update-task-status-pipeline.js';
import { UpdateTaskDetailsPipeline } from './update-task-details-pipeline.js';
import { DeleteTaskPipeline } from './delete-task-pipeline.js';
import { PrincipalType, TaskStatus } from '@kanbax/domain';
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
const prisma = new PrismaClient();
const taskRepo = new TaskRepositoryPostgres(prisma);
const auditRepo = new AuditEventRepositoryPostgres(prisma);
const policyRepo = new PolicyContextRepositoryPostgres(prisma);
const policyEngine = new HardenedPolicyEngine();
const queryService = new QueryService(taskRepo, auditRepo);
const ensureDefaultBoard = async (tenantId) => {
    const existing = await prisma.board.findFirst({
        where: { tenantId, id: 'default-board' },
    });
    if (existing)
        return existing;
    return prisma.board.create({
        data: {
            id: 'default-board',
            tenantId,
            name: 'Main Board',
        },
    });
};
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
const ROLE_PERMISSIONS = {
    SUPERADMIN: ['task.create', 'task.update-status', 'task.update-details', 'task.delete', 'team.manage', 'system.manage'],
    ADMIN: ['task.create', 'task.update-status', 'task.update-details', 'task.delete', 'team.manage'],
    MEMBER: ['task.create', 'task.update-status', 'task.update-details', 'task.delete'],
};
const isApiRoute = (pathName) => pathName.startsWith('/commands') ||
    pathName.startsWith('/tasks') ||
    pathName.startsWith('/boards') ||
    pathName.startsWith('/okrs') ||
    pathName.startsWith('/me') ||
    pathName.startsWith('/teams') ||
    pathName.startsWith('/invites');
const resolveJwtSecret = (secret) => {
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    const looksBase64 = secret.length % 4 === 0 && base64Pattern.test(secret);
    if (looksBase64) {
        return Buffer.from(secret, 'base64');
    }
    return new TextEncoder().encode(secret);
};
const resolveJwtKey = (token) => {
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
const buildPrincipal = (tenantId, user, role) => ({
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
    if (!isApiRoute(req.path))
        return next();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }
    try {
        const jwtKey = resolveJwtKey(token);
        const verifyOptions = SUPABASE_ISSUER ? { issuer: SUPABASE_ISSUER } : undefined;
        const { payload } = typeof jwtKey === 'function'
            ? await jwtVerify(token, jwtKey, verifyOptions)
            : await jwtVerify(token, jwtKey, verifyOptions);
        const authUserId = String(payload.sub || '');
        const email = String(payload.email || '');
        const userMetadata = (payload.user_metadata || {});
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
        const requestedTenantId = req.headers['x-tenant-id'];
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
            if (existingPersonal)
                return existingPersonal;
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
        req.user = user;
        req.membership = membership;
        req.tenantId = tenantId;
        if (tenantId) {
            const role = user.isSuperAdmin ? 'SUPERADMIN' : (membership?.role || 'MEMBER');
            req.principal = buildPrincipal(tenantId, user, role);
        }
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});
// --- Query Endpoints ---
app.get('/tasks', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const boardId = typeof req.query.boardId === 'string' && req.query.boardId ? req.query.boardId : 'default-board';
        await ensureDefaultBoard(tenantId);
        const tasks = await queryService.getTasks(req.principal, boardId);
        res.json(tasks);
    }
    catch (e) {
        res.status(403).json({ error: e?.message ?? 'Forbidden' });
    }
});
app.get('/boards', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const boards = await prisma.board.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
        });
        const boardList = boards.length ? boards : [await ensureDefaultBoard(tenantId)];
        const statuses = [TaskStatus.BACKLOG, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
        const principal = req.principal;
        const result = await Promise.all(boardList.map(async (board) => {
            const tasks = await queryService.getTasks(principal, board.id);
            const columns = statuses.map(status => ({
                status,
                tasks: tasks.filter(t => t.status === status),
            }));
            return { id: board.id, name: board.name, columns };
        }));
        res.json(result);
    }
    catch (e) {
        res.status(403).json({ error: e?.message ?? 'Forbidden' });
    }
});
app.delete('/boards/:boardId', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const boardId = String(req.params.boardId);
        const boardCount = await prisma.board.count({ where: { tenantId } });
        if (boardCount <= 1) {
            return res.status(400).json({ error: 'At least one board must remain' });
        }
        const board = await prisma.board.findUnique({
            where: { tenantId_id: { tenantId, id: boardId } },
        });
        if (!board)
            return res.status(404).json({ error: 'Board not found' });
        await prisma.$transaction([
            prisma.keyResult.deleteMany({
                where: { objective: { tenantId, boardId } },
            }),
            prisma.objective.deleteMany({ where: { tenantId, boardId } }),
            prisma.task.deleteMany({
                where: {
                    tenantId,
                    policyContext: {
                        path: ['scopeId'],
                        equals: boardId,
                    },
                },
            }),
            prisma.board.delete({ where: { tenantId_id: { tenantId, id: boardId } } }),
        ]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
const clamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const computeKeyResultProgress = (startValue, targetValue, currentValue) => {
    const range = targetValue - startValue;
    if (range === 0) {
        return currentValue >= targetValue ? 100 : 0;
    }
    const progress = ((currentValue - startValue) / range) * 100;
    return clamp(Number.isFinite(progress) ? progress : 0);
};
const formatObjective = (objective) => {
    const keyResults = (objective.keyResults || []).map((kr) => ({
        id: kr.id,
        objectiveId: kr.objectiveId,
        title: kr.title,
        startValue: kr.startValue,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        status: kr.status,
        progress: computeKeyResultProgress(kr.startValue, kr.targetValue, kr.currentValue),
        createdAt: kr.createdAt,
        updatedAt: kr.updatedAt,
    }));
    const progress = keyResults.length
        ? keyResults.reduce((sum, kr) => sum + kr.progress, 0) / keyResults.length
        : 0;
    return {
        id: objective.id,
        tenantId: objective.tenantId,
        boardId: objective.boardId,
        title: objective.title,
        ownerId: objective.ownerId ?? null,
        startDate: objective.startDate,
        endDate: objective.endDate,
        status: objective.status,
        confidence: typeof objective.confidence === 'number' ? objective.confidence : null,
        progress: clamp(Number.isFinite(progress) ? progress : 0),
        keyResults,
        createdAt: objective.createdAt,
        updatedAt: objective.updatedAt,
    };
};
// --- OKR Endpoints ---
app.get('/okrs', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const boardId = typeof req.query.boardId === 'string' && req.query.boardId ? req.query.boardId : 'default-board';
        await ensureDefaultBoard(tenantId);
        const objectives = await prisma.objective.findMany({
            where: { tenantId, boardId },
            include: { keyResults: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(objectives.map(formatObjective));
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.post('/okrs/objectives', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const { title, ownerId, startDate, endDate, status, confidence, boardId: rawBoardId, } = req.body || {};
        if (!title || !status)
            return res.status(400).json({ error: 'Title and status are required' });
        const boardId = rawBoardId ? String(rawBoardId) : 'default-board';
        await ensureDefaultBoard(tenantId);
        const board = await prisma.board.findUnique({
            where: { tenantId_id: { tenantId, id: boardId } },
        });
        if (!board)
            return res.status(400).json({ error: 'Board not found' });
        const created = await prisma.objective.create({
            data: {
                tenantId,
                boardId,
                title: String(title),
                ownerId: ownerId ? String(ownerId) : null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                status: String(status),
                confidence: confidence !== undefined && confidence !== null ? Number(confidence) : null,
            },
            include: { keyResults: true },
        });
        res.json(formatObjective(created));
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.patch('/okrs/objectives/:id', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const objectiveId = String(req.params.id);
        const { title, ownerId, startDate, endDate, status, confidence, boardId: rawBoardId, } = req.body || {};
        const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
        if (!existing || existing.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Objective not found' });
        }
        if (rawBoardId) {
            const board = await prisma.board.findUnique({
                where: { tenantId_id: { tenantId, id: String(rawBoardId) } },
            });
            if (!board)
                return res.status(400).json({ error: 'Board not found' });
        }
        const updated = await prisma.objective.update({
            where: { id: objectiveId },
            data: {
                title: title !== undefined ? String(title) : undefined,
                ownerId: ownerId === null ? null : (ownerId ? String(ownerId) : undefined),
                startDate: startDate === null ? null : (startDate ? new Date(startDate) : undefined),
                endDate: endDate === null ? null : (endDate ? new Date(endDate) : undefined),
                status: status !== undefined ? String(status) : undefined,
                confidence: confidence === null ? null : (confidence !== undefined ? Number(confidence) : undefined),
                boardId: rawBoardId ? String(rawBoardId) : undefined,
            },
            include: { keyResults: true },
        });
        res.json(formatObjective(updated));
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.delete('/okrs/objectives/:id', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const objectiveId = String(req.params.id);
        const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
        if (!existing || existing.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Objective not found' });
        }
        await prisma.objective.delete({ where: { id: objectiveId } });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.post('/okrs/objectives/:id/key-results', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const objectiveId = String(req.params.id);
        const objective = await prisma.objective.findUnique({ where: { id: objectiveId } });
        if (!objective || objective.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Objective not found' });
        }
        const { title, startValue, targetValue, currentValue, status, } = req.body || {};
        if (!title || status === undefined || targetValue === undefined || startValue === undefined) {
            return res.status(400).json({ error: 'Title, startValue, targetValue, and status are required' });
        }
        const created = await prisma.keyResult.create({
            data: {
                objectiveId,
                title: String(title),
                startValue: Number(startValue),
                targetValue: Number(targetValue),
                currentValue: currentValue !== undefined ? Number(currentValue) : Number(startValue),
                status: String(status),
            },
        });
        res.json({
            ...created,
            progress: computeKeyResultProgress(created.startValue, created.targetValue, created.currentValue),
        });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.patch('/okrs/key-results/:id', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const keyResultId = String(req.params.id);
        const existing = await prisma.keyResult.findUnique({
            where: { id: keyResultId },
            include: { objective: true },
        });
        if (!existing || existing.objective.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Key result not found' });
        }
        const { title, startValue, targetValue, currentValue, status, } = req.body || {};
        const updated = await prisma.keyResult.update({
            where: { id: keyResultId },
            data: {
                title: title !== undefined ? String(title) : undefined,
                startValue: startValue !== undefined ? Number(startValue) : undefined,
                targetValue: targetValue !== undefined ? Number(targetValue) : undefined,
                currentValue: currentValue !== undefined ? Number(currentValue) : undefined,
                status: status !== undefined ? String(status) : undefined,
            },
        });
        res.json({
            ...updated,
            progress: computeKeyResultProgress(updated.startValue, updated.targetValue, updated.currentValue),
        });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.delete('/okrs/key-results/:id', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = req.tenantId;
        const keyResultId = String(req.params.id);
        const existing = await prisma.keyResult.findUnique({
            where: { id: keyResultId },
            include: { objective: true },
        });
        if (!existing || existing.objective.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Key result not found' });
        }
        await prisma.keyResult.delete({ where: { id: keyResultId } });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
// --- Command Endpoints ---
app.post('/commands/task/create', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_CREATE',
            tenantId: req.tenantId,
            principal: req.principal,
            payload: req.body,
        };
        const result = await createPipeline.execute(command);
        res.json(result);
    }
    catch (e) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.post('/commands/task/update-status', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_UPDATE_STATUS',
            tenantId: req.tenantId,
            principal: req.principal,
            payload: req.body,
        };
        const result = await updateStatusPipeline.execute(command);
        res.json(result);
    }
    catch (e) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.post('/commands/task/update-details', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_UPDATE_DETAILS',
            tenantId: req.tenantId,
            principal: req.principal,
            payload: req.body,
        };
        const result = await updateDetailsPipeline.execute(command);
        res.json(result);
    }
    catch (e) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.post('/commands/task/assign-huddle', async (req, res) => {
    try {
        const user = req.user;
        const tenantId = req.tenantId;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!tenantId)
            return res.status(403).json({ error: 'No tenant selected' });
        const taskId = String(req.body?.taskId || '');
        const targetTenantId = String(req.body?.targetTenantId || '');
        if (!taskId || !targetTenantId)
            return res.status(400).json({ error: 'Task ID and target huddle are required' });
        const targetMembership = await prisma.teamMembership.findUnique({
            where: { tenantId_userId: { tenantId: targetTenantId, userId: user.id } },
        });
        if (!targetMembership && !user.isSuperAdmin) {
            return res.status(403).json({ error: 'Access denied for target huddle' });
        }
        const task = await prisma.task.findFirst({ where: { id: taskId, tenantId } });
        if (!task)
            return res.status(404).json({ error: 'Task not found' });
        const source = (task.source && typeof task.source === 'object') ? task.source : null;
        if (source?.type && source.type !== 'MANUAL') {
            return res.status(400).json({ error: 'Only manual tasks can be moved' });
        }
        const policyContext = (task.policyContext && typeof task.policyContext === 'object') ? task.policyContext : {};
        const nextPolicyContext = {
            ...policyContext,
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
    }
    catch (e) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});
app.post('/commands/task/delete', async (req, res) => {
    try {
        if (!req.principal)
            return res.status(403).json({ error: 'No tenant selected' });
        const command = {
            type: 'TASK_DELETE',
            tenantId: req.tenantId,
            principal: req.principal,
            payload: req.body,
        };
        await deletePipeline.execute(command);
        res.status(204).send();
    }
    catch (e) {
        res.status(e?.message?.includes('denied') ? 403 : 400).json({ error: e?.message ?? 'Bad Request' });
    }
});
// --- Identity / Teams ---
app.get('/me', async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
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
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
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
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
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
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
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
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const memberships = await prisma.teamMembership.findMany({
        where: { userId: user.id },
        include: { tenant: true },
    });
    res.json(memberships);
});
app.post('/teams', async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const name = String(req.body?.name || '').trim();
    if (!name)
        return res.status(400).json({ error: 'Team name is required' });
    const tenant = await prisma.tenant.create({ data: { name } });
    const membership = await prisma.teamMembership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'ADMIN' },
    });
    res.status(201).json({ tenant, membership });
});
app.get('/teams/:tenantId/members', async (req, res) => {
    const user = req.user;
    const tenantId = req.params.tenantId;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Forbidden' });
    const members = await prisma.teamMembership.findMany({
        where: { tenantId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
    });
    res.json(members);
});
app.post('/teams/:tenantId/invites', async (req, res) => {
    const user = req.user;
    const tenantId = req.params.tenantId;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant)
        return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Cannot invite members to a private huddle' });
    }
    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Forbidden' });
    if (membership?.role !== 'ADMIN' && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Admin required' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'MEMBER').toUpperCase();
    if (!email)
        return res.status(400).json({ error: 'Email is required' });
    if (!['ADMIN', 'MEMBER'].includes(role))
        return res.status(400).json({ error: 'Invalid role' });
    const invite = await prisma.teamInvite.upsert({
        where: { tenantId_email: { tenantId, email } },
        update: { role, status: 'PENDING', invitedByUserId: user.id },
        create: { tenantId, email, role, status: 'PENDING', invitedByUserId: user.id },
    });
    res.status(201).json(invite);
});
app.post('/teams/:tenantId/leave', async (req, res) => {
    const user = req.user;
    const tenantId = req.params.tenantId;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        include: { tenant: true },
    });
    if (!membership)
        return res.status(404).json({ error: 'Membership not found' });
    if (membership.tenant?.name === 'Personal') {
        return res.status(400).json({ error: 'Cannot leave personal huddle' });
    }
    await prisma.teamMembership.delete({ where: { id: membership.id } });
    res.status(204).send();
});
app.patch('/teams/:tenantId/members/:memberId', async (req, res) => {
    const user = req.user;
    const tenantId = req.params.tenantId;
    const memberId = req.params.memberId;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant)
        return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Private huddles cannot be managed' });
    }
    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Forbidden' });
    if (membership?.role !== 'ADMIN' && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Admin required' });
    const role = String(req.body?.role || '').toUpperCase();
    if (!['ADMIN', 'MEMBER'].includes(role))
        return res.status(400).json({ error: 'Invalid role' });
    const updated = await prisma.teamMembership.update({
        where: { id: memberId },
        data: { role },
    });
    res.json(updated);
});
app.delete('/teams/:tenantId/members/:memberId', async (req, res) => {
    const user = req.user;
    const tenantId = req.params.tenantId;
    const memberId = req.params.memberId;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant)
        return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Private huddles cannot be managed' });
    }
    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Forbidden' });
    if (membership?.role !== 'ADMIN' && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Admin required' });
    await prisma.teamMembership.delete({ where: { id: memberId } });
    res.status(204).send();
});
app.delete('/teams/:tenantId', async (req, res) => {
    const user = req.user;
    const tenantId = req.params.tenantId;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant)
        return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Private huddles cannot be deleted' });
    }
    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin)
        return res.status(403).json({ error: 'Forbidden' });
    if (membership?.role !== 'ADMIN' && membership?.role !== 'OWNER' && !user.isSuperAdmin) {
        return res.status(403).json({ error: 'Admin required' });
    }
    await prisma.$transaction([
        prisma.keyResult.deleteMany({
            where: { objective: { tenantId } },
        }),
        prisma.objective.deleteMany({ where: { tenantId } }),
        prisma.task.deleteMany({ where: { tenantId } }),
        prisma.policyContext.deleteMany({ where: { tenantId } }),
        prisma.auditEvent.deleteMany({ where: { tenantId } }),
        prisma.permission.deleteMany({ where: { tenantId } }),
        prisma.role.deleteMany({ where: { tenantId } }),
        prisma.secret.deleteMany({ where: { tenantId } }),
        prisma.principal.deleteMany({ where: { tenantId } }),
        prisma.teamInvite.deleteMany({ where: { tenantId } }),
        prisma.teamMembership.deleteMany({ where: { tenantId } }),
        prisma.tenant.delete({ where: { id: tenantId } }),
    ]);
    res.json({ ok: true });
});
// SPA fallback MUST be after API routes (Express 5 safe)
// Only send index.html if the file exists; otherwise return 404 JSON.
// Serve static UI build after API routes
app.use(express.static(uiDistPath));
app.use((req, res) => {
    // If the request looks like an API route, return 404 JSON.
    if (req.path.startsWith('/commands') ||
        req.path.startsWith('/tasks') ||
        req.path.startsWith('/boards') ||
        req.path.startsWith('/okrs') ||
        req.path.startsWith('/me') ||
        req.path.startsWith('/teams') ||
        req.path.startsWith('/invites')) {
        return res.status(404).json({ error: 'Not Found' });
    }
    return res.sendFile(path.join(uiDistPath, 'index.html'), (err) => {
        if (err)
            res.status(404).json({ error: 'UI build not found. Run `pnpm --filter @kanbax/ui build`.' });
    });
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Kanbax API listening on port ${PORT}`);
});
//# sourceMappingURL=index.js.map