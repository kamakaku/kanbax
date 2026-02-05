import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient, Prisma } from '@prisma/client';
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
import { PrincipalType, TaskStatus } from '@kanbax/domain';
import type { PolicyContext, TaskActivity } from '@kanbax/domain';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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

const ensureDefaultBoard = async (tenantId: string) => {
    const existing = await prisma.board.findFirst({
        where: { tenantId, id: 'default-board' },
    });
    if (existing) return existing;
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

const ROLE_PERMISSIONS: Record<string, string[]> = {
    SUPERADMIN: ['task.create', 'task.update-status', 'task.update-details', 'task.delete', 'team.manage', 'system.manage'],
    ADMIN: ['task.create', 'task.update-status', 'task.update-details', 'task.delete', 'team.manage'],
    MEMBER: ['task.create', 'task.update-status', 'task.update-details', 'task.delete'],
};

const isApiRoute = (pathName: string) =>
    pathName.startsWith('/commands') ||
    pathName.startsWith('/tasks') ||
    pathName.startsWith('/boards') ||
    pathName.startsWith('/okrs') ||
    pathName.startsWith('/calendar') ||
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

const resolveJwtKey = (token: string): Uint8Array | JWTVerifyGetKey => {
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

const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:4000';
const UI_PUBLIC_URL = process.env.UI_PUBLIC_URL || 'http://localhost:5173';
const CALENDAR_STATE_SECRET = process.env.CALENDAR_STATE_SECRET || SUPABASE_JWT_SECRET || 'calendar-dev-secret';
const CALENDAR_ENCRYPTION_KEY = process.env.CALENDAR_ENCRYPTION_KEY || SUPABASE_JWT_SECRET || '';
const CALENDAR_SCOPES = [
    'offline_access',
    'Calendars.Read',
    'User.Read',
];

const getCalendarEncryptionKey = () => {
    if (!CALENDAR_ENCRYPTION_KEY) {
        throw new Error('Server misconfigured: CALENDAR_ENCRYPTION_KEY missing');
    }
    return crypto.createHash('sha256').update(CALENDAR_ENCRYPTION_KEY).digest();
};

const encryptSecret = (value: string) => {
    const iv = crypto.randomBytes(12);
    const key = getCalendarEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
};

const decryptSecret = (payload: string) => {
    const raw = Buffer.from(payload, 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const key = getCalendarEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
};

const signCalendarState = (payload: Record<string, any>) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', CALENDAR_STATE_SECRET).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
};

const verifyCalendarState = (state?: string | null) => {
    if (!state) return null;
    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac('sha256', CALENDAR_STATE_SECRET).update(encoded).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
        return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
};

const getCalendarSecretKey = (provider: string, userId: string) => `calendar:${provider}:${userId}`;

const getCalendarSecret = async (tenantId: string, key: string) =>
    prisma.secret.findUnique({ where: { tenantId_key: { tenantId, key } } });

const setCalendarSecret = async (tenantId: string, key: string, value: string, metadata: Record<string, any>) =>
    prisma.secret.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: { value, metadata },
        create: { tenantId, key, value, metadata },
    });

const deleteCalendarSecret = async (tenantId: string, key: string) =>
    prisma.secret.delete({ where: { tenantId_key: { tenantId, key } } });

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';

const ensureCalendarConfig = () => {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        throw new Error('Microsoft Calendar not configured');
    }
};

const buildOAuthRedirectUri = () => `${API_PUBLIC_URL}/calendar/oauth/microsoft/callback`;

const exchangeMicrosoftCode = async (code: string) => {
    const body = new URLSearchParams({
        code,
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        redirect_uri: buildOAuthRedirectUri(),
        grant_type: 'authorization_code',
        scope: CALENDAR_SCOPES.join(' '),
    });
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Microsoft token exchange failed: ${err}`);
    }
    return res.json();
};

const refreshMicrosoftToken = async (refreshToken: string) => {
    const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        redirect_uri: buildOAuthRedirectUri(),
        grant_type: 'refresh_token',
        scope: CALENDAR_SCOPES.join(' '),
    });
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Microsoft refresh failed: ${err}`);
    }
    return res.json();
};

type CalendarImportEntry = {
    id: string;
    name: string;
    type: 'file' | 'url';
    ics?: string;
    url?: string;
    createdAt: string;
};

const getCalendarImportKey = (userId: string) => `calendar:ics:${userId}`;

const getCalendarImports = async (tenantId: string, userId: string): Promise<CalendarImportEntry[]> => {
    const key = getCalendarImportKey(userId);
    const secret = await getCalendarSecret(tenantId, key);
    if (!secret?.value) return [];
    try {
        const parsed = JSON.parse(decryptSecret(secret.value));
        const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.imports) ? parsed.imports : []);
        if (!Array.isArray(rawList)) return [];
        return rawList.map((entry: any) => {
            const type = entry?.type || (entry?.url ? 'url' : 'file');
            return {
                id: String(entry.id || crypto.randomUUID()),
                name: String(entry.name || 'Imported calendar'),
                type,
                ics: entry.ics,
                url: entry.url,
                createdAt: entry.createdAt || new Date().toISOString(),
            } satisfies CalendarImportEntry;
        });
    } catch {
        return [];
    }
};

const setCalendarImports = async (tenantId: string, userId: string, imports: CalendarImportEntry[]) => {
    const key = getCalendarImportKey(userId);
    const encrypted = encryptSecret(JSON.stringify(imports));
    await setCalendarSecret(tenantId, key, encrypted, {
        type: 'calendar-imports',
        count: imports.length,
        updatedAt: new Date().toISOString(),
    });
};

const normalizeCalendarUrl = (value: string) => {
    try {
        const parsed = new URL(value);
        if (!['https:', 'http:'].includes(parsed.protocol)) return null;
        return parsed.toString();
    } catch {
        return null;
    }
};

const fetchIcsFromUrl = async (url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url, {
            headers: { Accept: 'text/calendar,text/plain,*/*' },
            signal: controller.signal,
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch ICS (${res.status})`);
        }
        const text = await res.text();
        if (text.length > 2_000_000) {
            throw new Error('ICS payload too large');
        }
        return text;
    } finally {
        clearTimeout(timeout);
    }
};

const unfoldIcsLines = (ics: string) => {
    const normalized = ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawLines = normalized.split('\n');
    const lines: string[] = [];
    for (const line of rawLines) {
        if (!line) continue;
        if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
            lines[lines.length - 1] += line.slice(1);
        } else {
            lines.push(line);
        }
    }
    return lines;
};

const unescapeIcsText = (value: string) =>
    value
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');

const parseIcsDate = (value: string, params: Record<string, string>) => {
    const trimmed = value.trim();
    const isDateOnly = params.VALUE === 'DATE' || /^\d{8}$/.test(trimmed);
    if (isDateOnly) {
        const year = Number(trimmed.slice(0, 4));
        const month = Number(trimmed.slice(4, 6)) - 1;
        const day = Number(trimmed.slice(6, 8));
        const date = new Date(Date.UTC(year, month, day, 0, 0, 0));
        return { iso: date.toISOString(), allDay: true };
    }
    const hasZ = trimmed.endsWith('Z');
    const stamp = hasZ ? trimmed.slice(0, -1) : trimmed;
    if (!/^\d{8}T\d{6}$/.test(stamp)) return null;
    const year = Number(stamp.slice(0, 4));
    const month = Number(stamp.slice(4, 6)) - 1;
    const day = Number(stamp.slice(6, 8));
    const hour = Number(stamp.slice(9, 11));
    const minute = Number(stamp.slice(11, 13));
    const second = Number(stamp.slice(13, 15));
    const date = hasZ
        ? new Date(Date.UTC(year, month, day, hour, minute, second))
        : new Date(year, month, day, hour, minute, second);
    return { iso: date.toISOString(), allDay: false };
};

const parseIcsEvents = (ics: string) => {
    const lines = unfoldIcsLines(ics);
    const events: Array<{
        id: string;
        title: string;
        start: string;
        end: string;
        allDay: boolean;
        location?: string | null;
        description?: string | null;
        url?: string | null;
    }> = [];
    let current: any = null;
    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
            current = { id: '', title: '', allDay: false };
            continue;
        }
        if (line === 'END:VEVENT') {
            if (current?.start) {
                if (!current.end) current.end = current.start;
                if (!current.id) current.id = crypto.randomUUID();
                events.push(current);
            }
            current = null;
            continue;
        }
        if (!current) continue;
        const [rawProp, ...rest] = line.split(':');
        if (!rawProp || rest.length === 0) continue;
        const value = rest.join(':');
        const [rawName, ...paramParts] = rawProp.split(';');
        const name = rawName.toUpperCase();
        const params: Record<string, string> = {};
        paramParts.forEach((part) => {
            const [k, v] = part.split('=');
            if (k) params[k.toUpperCase()] = v || '';
        });

        if (name === 'UID') current.id = value.trim();
        if (name === 'SUMMARY') current.title = unescapeIcsText(value.trim());
        if (name === 'LOCATION') current.location = unescapeIcsText(value.trim());
        if (name === 'DESCRIPTION') current.description = unescapeIcsText(value.trim());
        if (name === 'URL') current.url = value.trim();
        if (name === 'DTSTART') {
            const parsed = parseIcsDate(value, params);
            if (parsed) {
                current.start = parsed.iso;
                current.allDay = parsed.allDay;
            }
        }
        if (name === 'DTEND') {
            const parsed = parseIcsDate(value, params);
            if (parsed) {
                current.end = parsed.iso;
                current.allDay = current.allDay || parsed.allDay;
            }
        }
    }
    return events;
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
    if (req.path.startsWith('/calendar/oauth') && req.path.includes('/callback')) {
        return next();
    }

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
    } catch (err: any) {
        const debug = {
            message: err?.message,
            code: err?.code,
            issuer: SUPABASE_ISSUER,
            tokenIssuer: (() => {
                try {
                    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'))?.iss;
                } catch {
                    return 'unknown';
                }
            })(),
        };
        console.error('Auth verify failed', debug);
        return res.status(401).json({ error: 'Invalid or expired token', debug });
    }
});

// --- Query Endpoints ---

app.get('/tasks', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const boardId = typeof req.query.boardId === 'string' && req.query.boardId ? req.query.boardId : 'default-board';
        await ensureDefaultBoard(tenantId);
        const tasks = await queryService.getTasks((req as any).principal, boardId);
        res.json(tasks);
    } catch (e: any) {
        res.status(403).json({ error: e?.message ?? 'Forbidden' });
    }
});

app.get('/boards', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const boards = await prisma.board.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
        });
        const boardList = boards.length ? boards : [await ensureDefaultBoard(tenantId)];
        const statuses = [TaskStatus.BACKLOG, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
        const principal = (req as any).principal;
        const allTasks = await queryService.getTasks(principal, 'all');
        const allColumns = statuses.map(status => ({
            status,
            tasks: allTasks.filter(t => t.status === status),
        }));
        const result = await Promise.all(boardList.map(async (board) => {
            const tasks = await queryService.getTasks(principal, board.id);
            const columns = statuses.map(status => ({
                status,
                tasks: tasks.filter(t => t.status === status),
            }));
            return { id: board.id, name: board.name, columns };
        }));
        res.json([{ id: 'all', name: 'All', columns: allColumns }, ...result]);
    } catch (e: any) {
        res.status(403).json({ error: e?.message ?? 'Forbidden' });
    }
});

app.get('/calendar/connections', async (req, res) => {
    try {
        const principal = (req as any).principal;
        if (!principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const userId = principal.id;
        const providers: Array<'microsoft'> = ['microsoft'];
        const connections = await Promise.all(
            providers.map(async (provider) => {
                const key = getCalendarSecretKey(provider, userId);
                const secret = await getCalendarSecret(tenantId, key);
                if (!secret) return { provider, connected: false };
                const metadata = (secret.metadata as any) || {};
                return {
                    provider,
                    connected: true,
                    email: metadata.email || null,
                    expiresAt: metadata.expiresAt || null,
                };
            })
        );
        res.json(connections);
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Failed to load calendar connections' });
    }
});

app.get('/calendar/imports', async (req, res) => {
    try {
        const principal = (req as any).principal;
        if (!principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const userId = principal.id;
        const imports = await getCalendarImports(tenantId, userId);
        res.json(imports.map((entry) => ({
            id: entry.id,
            name: entry.name,
            type: entry.type,
            createdAt: entry.createdAt,
        })));
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Failed to load calendar imports' });
    }
});

app.post('/calendar/imports', async (req, res) => {
    try {
        const principal = (req as any).principal;
        if (!principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const userId = principal.id;
        const ics = typeof req.body?.ics === 'string' ? req.body.ics.trim() : '';
        const urlInput = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
        if (!ics && !urlInput) {
            return res.status(400).json({ error: 'Missing .ics file or URL' });
        }
        if (ics && urlInput) {
            return res.status(400).json({ error: 'Provide either file or URL, not both' });
        }
        const name = typeof req.body?.name === 'string' && req.body.name.trim()
            ? req.body.name.trim()
            : 'Imported calendar';
        const imports = await getCalendarImports(tenantId, userId);
        if (imports.length >= 12) {
            return res.status(400).json({ error: 'Too many calendar imports (max 12)' });
        }
        let entry: CalendarImportEntry;
        if (ics) {
            if (!ics.includes('BEGIN:VCALENDAR')) {
                return res.status(400).json({ error: 'Invalid .ics payload' });
            }
            entry = {
                id: crypto.randomUUID(),
                name,
                type: 'file',
                ics,
                createdAt: new Date().toISOString(),
            };
        } else {
            const normalized = normalizeCalendarUrl(urlInput);
            if (!normalized) {
                return res.status(400).json({ error: 'Invalid calendar URL' });
            }
            const icsText = await fetchIcsFromUrl(normalized);
            if (!icsText.includes('BEGIN:VCALENDAR')) {
                return res.status(400).json({ error: 'URL does not return a valid calendar' });
            }
            entry = {
                id: crypto.randomUUID(),
                name,
                type: 'url',
                url: normalized,
                createdAt: new Date().toISOString(),
            };
        }
        const next = [...imports, entry];
        await setCalendarImports(tenantId, userId, next);
        res.json({ id: entry.id, name: entry.name, type: entry.type, createdAt: entry.createdAt });
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Failed to import calendar' });
    }
});

app.delete('/calendar/imports/:importId', async (req, res) => {
    try {
        const principal = (req as any).principal;
        if (!principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const userId = principal.id;
        const importId = String(req.params.importId || '');
        const imports = await getCalendarImports(tenantId, userId);
        const next = imports.filter((entry) => entry.id !== importId);
        await setCalendarImports(tenantId, userId, next);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Failed to remove calendar import' });
    }
});

app.delete('/calendar/connections/:provider', async (req, res) => {
    try {
        const principal = (req as any).principal;
        if (!principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const userId = principal.id;
        const provider = String(req.params.provider || '');
        if (provider !== 'microsoft') {
            return res.status(400).json({ error: 'Unsupported provider' });
        }
        const key = getCalendarSecretKey(provider, userId);
        try {
            await deleteCalendarSecret(tenantId, key);
        } catch (err: any) {
            if (err?.code !== 'P2025') throw err;
        }
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Failed to disconnect calendar' });
    }
});

app.get('/calendar/oauth/:provider', async (req, res) => {
    try {
        const principal = (req as any).principal;
        if (!principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const userId = principal.id;
        const provider = String(req.params.provider || '');
        if (provider !== 'microsoft') {
            return res.status(400).json({ error: 'Unsupported provider' });
        }
        ensureCalendarConfig();
        const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : UI_PUBLIC_URL;
        const state = signCalendarState({
            provider,
            tenantId,
            userId,
            returnTo,
            ts: Date.now(),
        });
        const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        url.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
        url.searchParams.set('redirect_uri', buildOAuthRedirectUri());
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('response_mode', 'query');
        url.searchParams.set('scope', CALENDAR_SCOPES.join(' '));
        url.searchParams.set('state', state);
        return res.redirect(url.toString());
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Failed to start OAuth flow' });
    }
});

app.get('/calendar/oauth/:provider/callback', async (req, res) => {
    try {
        const provider = String(req.params.provider || '');
        if (provider !== 'microsoft') {
            return res.status(400).send('Unsupported provider');
        }
        if (req.query.error) {
            return res.redirect(`${UI_PUBLIC_URL}?view=calendar&calendarError=${encodeURIComponent(String(req.query.error))}`);
        }
        const code = typeof req.query.code === 'string' ? req.query.code : null;
        const state = verifyCalendarState(typeof req.query.state === 'string' ? req.query.state : null);
        if (!code || !state || state.provider !== provider) {
            return res.status(400).send('Invalid calendar OAuth state');
        }
        if (!state.ts || Date.now() - Number(state.ts) > 10 * 60 * 1000) {
            return res.status(400).send('Expired calendar OAuth state');
        }
        ensureCalendarConfig();
        const tenantId = state.tenantId;
        const userId = state.userId;
        const key = getCalendarSecretKey(provider, userId);
        const existing = await getCalendarSecret(tenantId, key);
        let existingPayload: any = null;
        if (existing?.value) {
            try {
                existingPayload = JSON.parse(decryptSecret(existing.value));
            } catch {
                existingPayload = null;
            }
        }
        const tokenData = await exchangeMicrosoftCode(code);
        const refreshToken = tokenData.refresh_token || existingPayload?.refresh_token || null;
        const expiresAt = tokenData.expires_in ? Date.now() + Number(tokenData.expires_in) * 1000 : null;
        const tokenPayload = {
            access_token: tokenData.access_token,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            scope: tokenData.scope,
            token_type: tokenData.token_type,
        };
        let email: string | null = null;
        try {
            const infoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (infoRes.ok) {
                const info = await infoRes.json();
                email = info.mail || info.userPrincipalName || null;
            }
        } catch {
            // ignore metadata fetch failures
        }
        const encrypted = encryptSecret(JSON.stringify(tokenPayload));
        await setCalendarSecret(tenantId, key, encrypted, {
            provider,
            userId,
            email,
            scopes: CALENDAR_SCOPES,
            connectedAt: new Date().toISOString(),
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        });
        const returnTo = typeof state.returnTo === 'string' && state.returnTo ? state.returnTo : `${UI_PUBLIC_URL}?view=calendar`;
        return res.redirect(returnTo);
    } catch (e: any) {
        res.status(500).send(e?.message ?? 'Failed to complete OAuth flow');
    }
});

app.get('/calendar/events', async (req, res) => {
    try {
        const principal = (req as any).principal;
        if (!principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const userId = principal.id;
        const start = typeof req.query.start === 'string' ? new Date(req.query.start) : null;
        const end = typeof req.query.end === 'string' ? new Date(req.query.end) : null;
        if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date range' });
        }
        const providers: Array<'microsoft'> = ['microsoft'];
        const results: any[] = [];

        const imports = await getCalendarImports(tenantId, userId);
        for (const entry of imports) {
            let icsText: string | null = null;
            if (entry.type === 'file') {
                icsText = entry.ics || null;
            } else if (entry.type === 'url' && entry.url) {
                try {
                    icsText = await fetchIcsFromUrl(entry.url);
                } catch {
                    icsText = null;
                }
            }
            if (!icsText) continue;
            const parsed = parseIcsEvents(icsText);
            parsed.forEach((event, index) => {
                const startTime = new Date(event.start).getTime();
                const endTime = new Date(event.end).getTime();
                if (Number.isNaN(startTime) || Number.isNaN(endTime)) return;
                if (endTime < start.getTime() || startTime > end.getTime()) return;
                results.push({
                    ...event,
                    id: `${entry.id}:${event.id || index}`,
                    provider: 'ics',
                    calendarName: entry.name,
                });
            });
        }

        for (const provider of providers) {
            const key = getCalendarSecretKey(provider, userId);
            const secret = await getCalendarSecret(tenantId, key);
            if (!secret) continue;
            let payload: any;
            try {
                payload = JSON.parse(decryptSecret(secret.value));
            } catch {
                continue;
            }
            let accessToken = payload.access_token;
            const refreshToken = payload.refresh_token;
            const expiresAt = payload.expires_at ? Number(payload.expires_at) : null;
            if (expiresAt && refreshToken && Date.now() > expiresAt - 60_000) {
                try {
                    const refreshed = await refreshMicrosoftToken(refreshToken);
                    accessToken = refreshed.access_token;
                    const nextRefresh = refreshed.refresh_token || refreshToken;
                    const nextExpires = refreshed.expires_in ? Date.now() + Number(refreshed.expires_in) * 1000 : null;
                    const nextPayload = {
                        ...payload,
                        access_token: accessToken,
                        refresh_token: nextRefresh,
                        expires_at: nextExpires,
                        scope: refreshed.scope || payload.scope,
                        token_type: refreshed.token_type || payload.token_type,
                    };
                    const encrypted = encryptSecret(JSON.stringify(nextPayload));
                    await setCalendarSecret(tenantId, key, encrypted, {
                        ...(secret.metadata as any),
                        expiresAt: nextExpires ? new Date(nextExpires).toISOString() : null,
                    });
                } catch {
                    // ignore refresh failures
                }
            }

            if (!accessToken) continue;
            const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
            url.searchParams.set('startDateTime', start.toISOString());
            url.searchParams.set('endDateTime', end.toISOString());
            const response = await fetch(url.toString(), {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Prefer: 'outlook.timezone="UTC"',
                },
            });
            if (!response.ok) continue;
            const data = await response.json();
            (data.value || []).forEach((event: any) => {
                if (!event.start?.dateTime || !event.end?.dateTime) return;
                results.push({
                    id: event.id,
                    provider,
                    title: event.subject || '',
                    start: event.start.dateTime,
                    end: event.end.dateTime,
                    allDay: Boolean(event.isAllDay),
                    location: event.location?.displayName || null,
                    description: event.bodyPreview || null,
                    url: event.webLink || null,
                });
            });
        }

        results.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        res.set('Cache-Control', 'no-store');
        res.json(results);
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Failed to load calendar events' });
    }
});

app.post('/boards', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Board name is required' });
        const board = await prisma.board.create({
            data: {
                tenantId,
                id: `board-${Math.random().toString(36).slice(2, 10)}`,
                name,
            },
        });
        const statuses = [TaskStatus.BACKLOG, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
        const columns = statuses.map(status => ({ status, tasks: [] }));
        res.json({ id: board.id, name: board.name, columns });
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.delete('/boards/:boardId', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const boardId = String(req.params.boardId);
        if (boardId === 'all') return res.status(400).json({ error: 'All board cannot be deleted' });
        const boardCount = await prisma.board.count({ where: { tenantId } });
        if (boardCount <= 1) {
            return res.status(400).json({ error: 'At least one board must remain' });
        }
        const board = await prisma.board.findUnique({
            where: { tenantId_id: { tenantId, id: boardId } },
        });
        if (!board) return res.status(404).json({ error: 'Board not found' });

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
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const computeKeyResultProgress = (startValue: number, targetValue: number, currentValue: number) => {
    const range = targetValue - startValue;
    if (range === 0) {
        return currentValue >= targetValue ? 100 : 0;
    }
    const progress = ((currentValue - startValue) / range) * 100;
    return clamp(Number.isFinite(progress) ? progress : 0);
};

const formatObjective = (objective: any) => {
    const keyResults = (objective.keyResults || []).map((kr: any) => ({
        id: kr.id,
        objectiveId: kr.objectiveId,
        title: kr.title,
        description: kr.description ?? null,
        assignees: kr.assignees ?? [],
        startValue: kr.startValue,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
        status: kr.status,
        progress: computeKeyResultProgress(kr.startValue, kr.targetValue, kr.currentValue),
        createdAt: kr.createdAt,
        updatedAt: kr.updatedAt,
    }));
    const progress = keyResults.length
        ? keyResults.reduce((sum: number, kr: any) => sum + kr.progress, 0) / keyResults.length
        : 0;
    return {
        id: objective.id,
        tenantId: objective.tenantId,
        boardId: objective.boardId,
        title: objective.title,
        description: objective.description ?? null,
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
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const boardId = typeof req.query.boardId === 'string' && req.query.boardId ? req.query.boardId : 'default-board';
        await ensureDefaultBoard(tenantId);
        const objectives = await prisma.objective.findMany({
            where: { tenantId, boardId },
            include: { keyResults: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(objectives.map(formatObjective));
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.post('/okrs/objectives', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const {
            title,
            description,
            ownerId,
            startDate,
            endDate,
            status,
            confidence,
            boardId: rawBoardId,
        } = req.body || {};

        if (!title || !status) return res.status(400).json({ error: 'Title and status are required' });
        const boardId = rawBoardId ? String(rawBoardId) : 'default-board';
        await ensureDefaultBoard(tenantId);
        const board = await prisma.board.findUnique({
            where: { tenantId_id: { tenantId, id: boardId } },
        });
        if (!board) return res.status(400).json({ error: 'Board not found' });

        const created = await prisma.objective.create({
            data: {
                tenantId,
                boardId,
                title: String(title),
                description: description ? String(description) : null,
                ownerId: ownerId ? String(ownerId) : null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                status: String(status),
                confidence: confidence !== undefined && confidence !== null ? Number(confidence) : null,
            },
            include: { keyResults: true },
        });
        res.json(formatObjective(created));
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.patch('/okrs/objectives/:id', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const objectiveId = String(req.params.id);
        const {
            title,
            description,
            ownerId,
            startDate,
            endDate,
            status,
            confidence,
            boardId: rawBoardId,
        } = req.body || {};

        const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
        if (!existing || existing.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Objective not found' });
        }
        if (rawBoardId) {
            const board = await prisma.board.findUnique({
                where: { tenantId_id: { tenantId, id: String(rawBoardId) } },
            });
            if (!board) return res.status(400).json({ error: 'Board not found' });
        }

        const updated = await prisma.objective.update({
            where: { id: objectiveId },
            data: {
                title: title !== undefined ? String(title) : undefined,
                description: description === null ? null : (description !== undefined ? String(description) : undefined),
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
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.delete('/okrs/objectives/:id', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const objectiveId = String(req.params.id);
        const existing = await prisma.objective.findUnique({ where: { id: objectiveId } });
        if (!existing || existing.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Objective not found' });
        }
        await prisma.objective.delete({ where: { id: objectiveId } });
        res.json({ ok: true });
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.post('/okrs/objectives/:id/key-results', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const objectiveId = String(req.params.id);
        const objective = await prisma.objective.findUnique({ where: { id: objectiveId } });
        if (!objective || objective.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Objective not found' });
        }
        const {
            title,
            description,
            assignees,
            startValue,
            targetValue,
            currentValue,
            status,
        } = req.body || {};
        if (!title || status === undefined || targetValue === undefined || startValue === undefined) {
            return res.status(400).json({ error: 'Title, startValue, targetValue, and status are required' });
        }
        const created = await prisma.keyResult.create({
            data: {
                objectiveId,
                title: String(title),
                description: description ? String(description) : null,
                assignees: Array.isArray(assignees) ? assignees.map((id) => String(id)) : [],
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
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.patch('/okrs/key-results/:id', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
        const keyResultId = String(req.params.id);
        const existing = await prisma.keyResult.findUnique({
            where: { id: keyResultId },
            include: { objective: true },
        });
        if (!existing || existing.objective.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Key result not found' });
        }
        const {
            title,
            description,
            assignees,
            startValue,
            targetValue,
            currentValue,
            status,
        } = req.body || {};
        const updated = await prisma.keyResult.update({
            where: { id: keyResultId },
            data: {
                title: title !== undefined ? String(title) : undefined,
                description: description === null ? null : (description !== undefined ? String(description) : undefined),
                assignees: assignees !== undefined
                    ? (Array.isArray(assignees) ? assignees.map((id) => String(id)) : [])
                    : undefined,
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
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
    }
});

app.delete('/okrs/key-results/:id', async (req, res) => {
    try {
        if (!(req as any).principal) return res.status(403).json({ error: 'No tenant selected' });
        const tenantId = (req as any).tenantId;
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
    } catch (e: any) {
        res.status(400).json({ error: e?.message ?? 'Bad Request' });
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
        const source = (task.source && typeof task.source === 'object') ? (task.source as { type?: string }) : null;
        if (source?.type && source.type !== 'MANUAL') {
            return res.status(400).json({ error: 'Only manual tasks can be moved' });
        }

        const policyContext = (task.policyContext && typeof task.policyContext === 'object') ? task.policyContext : {};
        const nextPolicyContext = {
            ...(policyContext as Record<string, any>),
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

app.post('/commands/task/assign-board', async (req, res) => {
    try {
        const user = (req as any).user;
        const tenantId = (req as any).tenantId;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (!tenantId) return res.status(403).json({ error: 'No tenant selected' });

        const taskId = String(req.body?.taskId || '');
        const boardId = String(req.body?.boardId || '');
        if (!taskId || !boardId) return res.status(400).json({ error: 'Task ID and board are required' });
        if (boardId === 'all') return res.status(400).json({ error: 'All board is read-only' });

        const board = await prisma.board.findUnique({
            where: { tenantId_id: { tenantId, id: boardId } },
        });
        if (!board) return res.status(404).json({ error: 'Board not found' });

        const task = await taskRepo.findById(taskId, tenantId);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.source.type !== 'MANUAL') return res.status(400).json({ error: 'Only manual tasks can be moved' });

        const nextPolicyContext: PolicyContext = {
            ...task.policyContext,
            scopeId: boardId,
        };
        const nextActivityLog: TaskActivity[] = [...(task.activityLog ?? []), {
            id: Math.random().toString(36).substring(2, 15),
            type: 'DETAILS' as const,
            message: 'Board updated',
            timestamp: new Date(),
            actorId: user.id,
        }];

        await taskRepo.save({
            ...task,
            policyContext: nextPolicyContext,
            activityLog: nextActivityLog,
            updatedAt: new Date(),
        });

        res.json({ ok: true });
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

    if (name !== undefined || avatarUrl !== undefined) {
        await prisma.$executeRaw(Prisma.sql`
            update huddle_inbox_items
            set
                creator_label = ${name ?? updated.name ?? null},
                creator_avatar_url = ${avatarUrl ?? updated.avatarUrl ?? null}
            where creator_id = ${user.id}
        `);
    }

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

app.patch('/teams/:tenantId', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Private huddles cannot be renamed' });
    }

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    // Members can update scopes as part of collaboration

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Team name is required' });

    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: { name },
    });

    res.json(updated);
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

app.get('/teams/:tenantId/scopes', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    const isTeamAdmin = membership?.role === 'ADMIN' || membership?.role === 'OWNER';

    try {
        const visibilityFilter = isTeamAdmin || user.isSuperAdmin
            ? Prisma.sql``
            : Prisma.sql`
              and (
                visibility is null
                or visibility = 'shared'
                or created_by = ${user.id}
              )
            `;
        const scopes = await prisma.$queryRaw<
            Array<{
                id: string;
                name: string;
                description: string | null;
                start_date: Date | null;
                end_date: Date | null;
                task_ids: any;
                created_at: Date;
                visibility: string | null;
                created_by: string | null;
            }>
        >(Prisma.sql`
            select id, name, description, start_date, end_date, task_ids, created_at, visibility, created_by
            from huddle_scopes
            where tenant_id = ${tenantId}
            ${visibilityFilter}
            order by created_at asc
        `);

        const scopeIds = scopes.map((scope) => scope.id);
        const memberRows = scopeIds.length > 0
            ? await prisma.$queryRaw<Array<{ scope_id: string; user_id: string; role: string }>>(Prisma.sql`
                select scope_id, user_id, role
                from huddle_scope_members
                where tenant_id = ${tenantId}
                  and scope_id in (${Prisma.join(scopeIds)})
            `)
            : [];
        const membersByScope = new Map<string, Array<{ userId: string; role: string }>>();
        memberRows.forEach((row) => {
            const list = membersByScope.get(row.scope_id) || [];
            list.push({ userId: row.user_id, role: row.role });
            membersByScope.set(row.scope_id, list);
        });

        res.json({
            scopes: scopes.map((scope) => {
                let taskIds: string[] = [];
                if (Array.isArray(scope.task_ids)) {
                    taskIds = scope.task_ids;
                } else if (typeof scope.task_ids === 'string') {
                    try {
                        const parsed = JSON.parse(scope.task_ids);
                        if (Array.isArray(parsed)) taskIds = parsed;
                    } catch {
                        taskIds = [];
                    }
                }
                const members = membersByScope.get(scope.id) || [];
                const creatorId = scope.created_by;
                const hasCreator = creatorId && members.some((member) => member.userId === creatorId);
                const normalizedMembers = hasCreator || !creatorId
                    ? members
                    : members.concat([{ userId: creatorId, role: 'ADMIN' }]);

                const memberRole = normalizedMembers.find((member) => member.userId === user.id)?.role;
                const role = user.isSuperAdmin || isTeamAdmin
                    ? 'ADMIN'
                    : creatorId && creatorId === user.id
                        ? 'ADMIN'
                        : memberRole || 'VIEWER';

                const includeMembers = role === 'ADMIN' || user.isSuperAdmin || isTeamAdmin;
                return {
                    id: scope.id,
                    name: scope.name,
                    description: scope.description,
                    startDate: scope.start_date ? scope.start_date.toISOString() : null,
                    endDate: scope.end_date ? scope.end_date.toISOString() : null,
                    taskIds,
                    createdAt: scope.created_at.toISOString(),
                    visibility: scope.visibility === 'personal' ? 'personal' : 'shared',
                    createdBy: scope.created_by,
                    role,
                    members: includeMembers ? normalizedMembers : undefined,
                };
            }),
        });
    } catch {
        res.json({ scopes: [] });
    }
});

app.put('/teams/:tenantId/scopes', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
    const isTeamAdmin = membership?.role === 'ADMIN' || membership?.role === 'OWNER';
    const isSuperAdmin = Boolean(user.isSuperAdmin);

    const scopes = req.body?.scopes;
    if (!Array.isArray(scopes)) return res.status(400).json({ error: 'Invalid scopes' });

    const payload = scopes as Array<{
        id: string;
        name: string;
        description?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        taskIds?: string[];
        createdAt?: string;
        visibility?: string;
        createdBy?: string | null;
        members?: Array<{ userId: string; role: string }>;
    }>;
    try {
        const normalized = Array.from(
            new Map(
                payload
                    .filter((scope) => scope?.id && scope?.name)
                    .map((scope) => [scope.id, scope])
            ).values()
        );
        const ids = normalized.map((scope) => scope.id);

        const existingScopes = await prisma.$queryRaw<
            Array<{
                id: string;
                name: string;
                description: string | null;
                start_date: Date | null;
                end_date: Date | null;
                task_ids: any;
                created_at: Date;
                visibility: string | null;
                created_by: string | null;
            }>
        >(Prisma.sql`
            select id, name, description, start_date, end_date, task_ids, created_at, visibility, created_by
            from huddle_scopes
            where tenant_id = ${tenantId}
        `);
        const existingById = new Map(existingScopes.map((row) => [row.id, row]));

        const memberRows = await prisma.$queryRaw<Array<{ scope_id: string; user_id: string; role: string }>>(Prisma.sql`
            select scope_id, user_id, role
            from huddle_scope_members
            where tenant_id = ${tenantId}
              and user_id = ${user.id}
        `);
        const memberRoleByScope = new Map(memberRows.map((row) => [row.scope_id, row.role]));

        const toUpsert = normalized.map((scope) => {
            const existing = existingById.get(scope.id);
            const memberRole = memberRoleByScope.get(scope.id);
            const isCreator = existing?.created_by && existing.created_by === user.id;
            const role = isSuperAdmin || isTeamAdmin || isCreator
                ? 'ADMIN'
                : memberRole || 'VIEWER';

            const isAdmin = role === 'ADMIN';
            const isMember = role === 'MEMBER';

            if (!existing) {
                return {
                    ...scope,
                    role: 'ADMIN',
                    createdBy: user.id,
                    name: scope.name,
                    description: scope.description ?? null,
                    startDate: scope.startDate ?? null,
                    endDate: scope.endDate ?? null,
                    visibility: scope.visibility === 'personal' ? 'personal' : 'shared',
                    taskIds: scope.taskIds || [],
                    createdAt: scope.createdAt ?? new Date().toISOString(),
                    members: scope.members,
                };
            }

            const existingTaskIds: string[] = Array.isArray(existing.task_ids)
                ? existing.task_ids
                : typeof existing.task_ids === 'string'
                    ? (() => {
                        try {
                            const parsed = JSON.parse(existing.task_ids);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch {
                            return [];
                        }
                    })()
                    : [];
            const incomingTaskIds = scope.taskIds || [];

            if (role === 'VIEWER') {
                const sameTasks = existingTaskIds.length === incomingTaskIds.length
                    && existingTaskIds.every((id) => incomingTaskIds.includes(id));
                if (!sameTasks) {
                    throw new Error('Scope role does not permit editing items');
                }
                return {
                    ...scope,
                    role,
                    name: existing.name,
                    description: existing.description,
                    startDate: existing.start_date ? existing.start_date.toISOString() : null,
                    endDate: existing.end_date ? existing.end_date.toISOString() : null,
                    visibility: existing.visibility === 'personal' ? 'personal' : 'shared',
                    taskIds: existingTaskIds,
                    createdBy: existing.created_by,
                    createdAt: existing.created_at.toISOString(),
                    members: scope.members,
                };
            }

            if (isMember && !isAdmin) {
                return {
                    ...scope,
                    role,
                    name: existing.name,
                    description: existing.description,
                    startDate: existing.start_date ? existing.start_date.toISOString() : null,
                    endDate: existing.end_date ? existing.end_date.toISOString() : null,
                    visibility: existing.visibility === 'personal' ? 'personal' : 'shared',
                    createdBy: existing.created_by,
                    createdAt: existing.created_at.toISOString(),
                    taskIds: incomingTaskIds,
                    members: scope.members,
                };
            }

            return {
                ...scope,
                role,
                createdBy: existing.created_by || user.id,
                visibility: scope.visibility === 'personal' ? 'personal' : 'shared',
                taskIds: incomingTaskIds,
            };
        });

        const deletableIds = existingScopes
            .filter((scope) => {
                if (!ids.includes(scope.id)) {
                    const memberRole = memberRoleByScope.get(scope.id);
                    const isCreator = scope.created_by && scope.created_by === user.id;
                    return isSuperAdmin || isTeamAdmin || isCreator || memberRole === 'ADMIN';
                }
                return false;
            })
            .map((scope) => scope.id);

        const transactionSteps: any[] = [];
        if (deletableIds.length > 0) {
            transactionSteps.push(prisma.$executeRaw(Prisma.sql`
                delete from huddle_scopes
                where tenant_id = ${tenantId}
                  and id in (${Prisma.join(deletableIds)})
            `));
            transactionSteps.push(prisma.$executeRaw(Prisma.sql`
                delete from huddle_scope_members
                where tenant_id = ${tenantId}
                  and scope_id in (${Prisma.join(deletableIds)})
            `));
        }

        if (ids.length === 0) {
            if (transactionSteps.length > 0) {
                await prisma.$transaction(transactionSteps);
            }
            return res.json({ scopes: [] });
        }

        transactionSteps.push(...toUpsert.map((scope) =>
            prisma.$executeRaw(Prisma.sql`
                insert into huddle_scopes
                    (tenant_id, id, name, description, start_date, end_date, task_ids, created_at, visibility, created_by)
                values
                    (
                        ${tenantId},
                        ${scope.id},
                        ${scope.name},
                        ${scope.description ?? null},
                        ${scope.startDate ? new Date(scope.startDate) : null},
                        ${scope.endDate ? new Date(scope.endDate) : null},
                        ${JSON.stringify(scope.taskIds || [])}::jsonb,
                        ${scope.createdAt ? new Date(scope.createdAt) : new Date()},
                        ${scope.visibility === 'personal' ? 'personal' : 'shared'},
                        ${scope.createdBy || user.id}
                    )
                on conflict (tenant_id, id)
                do update set
                    name = excluded.name,
                    description = excluded.description,
                    start_date = excluded.start_date,
                    end_date = excluded.end_date,
                    task_ids = excluded.task_ids,
                    created_at = excluded.created_at,
                    visibility = case
                        when huddle_scopes.created_by is null
                             or huddle_scopes.created_by = ${user.id}
                             or ${isSuperAdmin || isTeamAdmin}
                            then excluded.visibility
                        else huddle_scopes.visibility
                    end,
                    created_by = coalesce(huddle_scopes.created_by, excluded.created_by)
            `)
        ));

        const memberUpdates = toUpsert.flatMap((scope) => {
            const existingRole = memberRoleByScope.get(scope.id);
            const canManage = isSuperAdmin || isTeamAdmin || existingRole === 'ADMIN' || scope.createdBy === user.id;
            if (!canManage || !Array.isArray(scope.members)) return [];
            const validMembers = scope.members
                .filter((member) => member?.userId)
                .map((member) => ({
                    userId: member.userId,
                    role: member.role === 'ADMIN' || member.role === 'MEMBER' ? member.role : 'VIEWER',
                }));
            const creatorId = scope.createdBy || user.id;
            const withCreator = validMembers.some((member) => member.userId === creatorId)
                ? validMembers
                : validMembers.concat([{ userId: creatorId, role: 'ADMIN' }]);
            const memberIds = withCreator.map((member) => member.userId);
            return [
                prisma.$executeRaw(Prisma.sql`
                    delete from huddle_scope_members
                    where tenant_id = ${tenantId}
                      and scope_id = ${scope.id}
                      and user_id not in (${Prisma.join(memberIds)})
                `),
                ...withCreator.map((member) =>
                    prisma.$executeRaw(Prisma.sql`
                        insert into huddle_scope_members (tenant_id, scope_id, user_id, role)
                        values (${tenantId}, ${scope.id}, ${member.userId}, ${member.role})
                        on conflict (tenant_id, scope_id, user_id)
                        do update set role = excluded.role
                    `)
                ),
            ];
        });

        await prisma.$transaction([...transactionSteps, ...memberUpdates]);

        res.json({ scopes: toUpsert });
    } catch (err: any) {
        console.error('Failed to save scopes', { tenantId, message: err?.message });
        const status = err?.message?.includes('role does not permit') ? 403 : 500;
        res.status(status).json({ error: err?.message || 'Failed to save scopes' });
    }
});

app.get('/teams/:tenantId/inbox', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });

    try {
        const items = await prisma.$queryRaw<
            Array<{
                id: string;
                title: string;
                description: string | null;
                source: string | null;
                suggested_action: string | null;
                priority: string | null;
                kind: string | null;
                creator_id: string | null;
                creator_label: string | null;
                created_at: Date;
                status: string;
            }>
        >(Prisma.sql`
            select id, title, description, source, suggested_action, priority, kind,
                   creator_id, creator_label, created_at, status
            from huddle_inbox_items
            where tenant_id = ${tenantId}
              and creator_id = ${user.id}
            order by created_at desc
        `);
        const statuses: Record<string, string> = {};
        const mapped = items.map((item) => {
            statuses[item.id] = item.status || 'eingang';
            return {
                id: item.id,
                title: item.title,
                description: item.description ?? undefined,
                source: item.source ?? undefined,
                suggestedAction: item.suggested_action ?? undefined,
                priority: item.priority ?? undefined,
                kind: item.kind ?? undefined,
                creatorId: item.creator_id ?? undefined,
                creatorLabel: item.creator_label ?? undefined,
                creatorAvatarUrl: undefined,
                createdAt: item.created_at.toISOString(),
                tenantId,
            };
        });
        res.json({ items: mapped, statuses });
    } catch {
        res.json({ items: [], statuses: {} });
    }
});

app.put('/teams/:tenantId/inbox', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });

    const items = req.body?.items;
    const statuses = req.body?.statuses;
    if (!Array.isArray(items) || typeof statuses !== 'object') {
        return res.status(400).json({ error: 'Invalid inbox payload' });
    }

    const payload = items as Array<any>;
    const creatorLabel = user.name || user.email || 'User';
    await prisma.$transaction([
        prisma.$executeRaw(Prisma.sql`
            delete from huddle_inbox_items
            where tenant_id = ${tenantId}
              and creator_id = ${user.id}
        `),
        ...payload.map((item) =>
            prisma.$executeRaw(Prisma.sql`
                insert into huddle_inbox_items
                    (tenant_id, id, title, description, source, suggested_action, priority, kind,
                     creator_id, creator_label, creator_avatar_url, created_at, status)
                values
                    (
                        ${tenantId},
                        ${item.id},
                        ${item.title},
                        ${item.description ?? null},
                        ${item.source ?? null},
                        ${item.suggestedAction ?? null},
                        ${item.priority ?? null},
                        ${item.kind ?? null},
                        ${user.id},
                        ${creatorLabel},
                        ${null},
                        ${item.createdAt ? new Date(item.createdAt) : new Date()},
                        ${statuses?.[item.id] || 'eingang'}
                    )
            `)
        ),
    ]);

    res.json({ items: payload, statuses });
});

app.get('/teams/:tenantId/timeline-overrides', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });

    try {
        const rows = await prisma.$queryRaw<
            Array<{ task_id: string; date: Date; is_point: boolean; duration_days: number | null }>
        >(Prisma.sql`
            select task_id, date, is_point, duration_days
            from huddle_timeline_overrides
            where tenant_id = ${tenantId}
        `);
        const overrides = Object.fromEntries(
            rows.map((row) => [
                row.task_id,
                {
                    date: row.date.toISOString(),
                    isPoint: row.is_point,
                    durationDays: row.duration_days ?? undefined,
                },
            ])
        );
        res.json({ overrides });
    } catch {
        res.json({ overrides: {} });
    }
});

app.put('/teams/:tenantId/timeline-overrides', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });

    const overrides = req.body?.overrides;
    if (!overrides || typeof overrides !== 'object') {
        return res.status(400).json({ error: 'Invalid overrides' });
    }

    const entries = Object.entries(overrides);
    const taskIds = entries.map(([taskId]) => taskId);
    if (taskIds.length === 0) {
        await prisma.$executeRaw(
            Prisma.sql`delete from huddle_timeline_overrides where tenant_id = ${tenantId}`
        );
        return res.json({ overrides });
    }

    await prisma.$transaction([
        prisma.$executeRaw(Prisma.sql`
            delete from huddle_timeline_overrides
            where tenant_id = ${tenantId}
              and task_id not in (${Prisma.join(taskIds)})
        `),
        ...entries.map(([taskId, payload]) => {
            const value = payload as any;
            return prisma.$executeRaw(Prisma.sql`
                insert into huddle_timeline_overrides
                    (tenant_id, task_id, date, is_point, duration_days)
                values
                    (
                        ${tenantId},
                        ${taskId},
                        ${new Date(value.date)},
                        ${Boolean(value.isPoint)},
                        ${value.durationDays ?? null}
                    )
                on conflict (tenant_id, task_id)
                do update set
                    date = excluded.date,
                    is_point = excluded.is_point,
                    duration_days = excluded.duration_days
            `);
        }),
    ]);

    res.json({ overrides });
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

app.delete('/teams/:tenantId', async (req, res) => {
    const user = (req as any).user;
    const tenantId = req.params.tenantId;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Huddle not found' });
    if (tenant.name === 'Personal') {
        return res.status(400).json({ error: 'Private huddles cannot be deleted' });
    }

    const membership = await prisma.teamMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (!membership && !user.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
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
    if (
        req.path.startsWith('/commands') ||
        req.path.startsWith('/tasks') ||
        req.path.startsWith('/boards') ||
        req.path.startsWith('/okrs') ||
        req.path.startsWith('/calendar') ||
        req.path.startsWith('/me') ||
        req.path.startsWith('/teams') ||
        req.path.startsWith('/invites')
    ) {
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
