const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) return null;
  const raw = args[index];
  if (raw.includes('=')) return raw.split('=').slice(1).join('=');
  return args[index + 1] || null;
};
const hasFlag = (name) => args.includes(name);

const loadDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.split('\n').find((line) => line.startsWith('DATABASE_URL='));
  if (!match) return;
  const raw = match.replace('DATABASE_URL=', '').trim();
  process.env.DATABASE_URL = raw.replace(/^"(.+)"$/, '$1');
};

const mulberry32 = (seed) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const run = async () => {
  loadDatabaseUrl();
  const prisma = new PrismaClient();
  const listOnly = hasFlag('--list');
  const tenantArg = getArg('--tenant') || getArg('-t');
  const perBoard = parseInt(getArg('--per-board') || getArg('-n') || '40', 10);
  const seedValue = parseInt(getArg('--seed') || '', 10);
  const rng = Number.isFinite(seedValue) ? mulberry32(seedValue) : Math.random;

  const tenants = await prisma.tenant.findMany({
    include: { boards: true },
  });

  if (listOnly || !tenantArg) {
    console.log('Tenants & boards:');
    tenants.forEach((tenant) => {
      console.log(`- ${tenant.name} (${tenant.id})`);
      tenant.boards.forEach((board) => {
        console.log(`  • ${board.name} (${board.id})`);
      });
    });
    console.log('\nRun: node scripts/seed-tasks.cjs --tenant <tenantId|name> --per-board 40');
    await prisma.$disconnect();
    return;
  }

  const tenant = tenants.find((t) => t.id === tenantArg)
    || tenants.find((t) => t.name.toLowerCase() === tenantArg.toLowerCase());
  if (!tenant) {
    console.error('Tenant not found. Use --list to see available tenants.');
    await prisma.$disconnect();
    process.exit(1);
  }
  const boards = tenant.boards;
  if (!boards.length) {
    console.error('No boards found for tenant.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const memberships = await prisma.teamMembership.findMany({
    where: { tenantId: tenant.id },
    include: { user: true },
  });
  const userIds = memberships.map((m) => m.userId);
  const defaultActor = userIds[0] || 'seed-user';

  const verbs = ['Align', 'Design', 'Implement', 'Review', 'Ship', 'Refine', 'Test', 'Polish', 'Plan', 'Audit'];
  const nouns = ['dashboard', 'workflow', 'export', 'notifications', 'search', 'cards', 'access', 'sync', 'navigation', 'filters'];
  const contexts = ['for mobile', 'for teams', 'for onboarding', 'for OKRs', 'for analytics', 'for performance'];
  const kindOptions = ['UX', 'UI', 'API', 'Infra', 'Research', 'Docs', 'QA', 'Growth'];
  const statusOptions = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'];
  const priorityOptions = [
    { value: 'LOW', weight: 0.25 },
    { value: 'MEDIUM', weight: 0.35 },
    { value: 'HIGH', weight: 0.25 },
    { value: 'CRITICAL', weight: 0.15 },
  ];

  const pick = (list) => list[Math.floor(rng() * list.length)];
  const chance = (value) => rng() < value;
  const pickWeighted = (list) => {
    const total = list.reduce((sum, item) => sum + item.weight, 0);
    let threshold = rng() * total;
    for (const item of list) {
      threshold -= item.weight;
      if (threshold <= 0) return item.value;
    }
    return list[list.length - 1].value;
  };
  const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

  const makeChecklist = () => {
    if (!chance(0.3)) return [];
    return Array.from({ length: randInt(2, 5) }).map((_, idx) => ({
      id: crypto.randomUUID(),
      text: `Checklist item ${idx + 1}`,
      done: chance(0.4),
    }));
  };

  const makeComments = () => {
    if (!chance(0.25)) return [];
    return Array.from({ length: randInt(1, 3) }).map(() => ({
      id: crypto.randomUUID(),
      text: `Note: ${pick(['Need review', 'Follow up', 'Looks good', 'Waiting for feedback'])}`,
      createdAt: new Date().toISOString(),
      createdBy: pick(userIds) || defaultActor,
    }));
  };

  const makeAssignees = () => {
    if (userIds.length === 0 || !chance(0.7)) return [];
    const count = randInt(1, Math.min(2, userIds.length));
    const shuffled = [...userIds].sort(() => rng() - 0.5);
    return shuffled.slice(0, count);
  };

  const tasksToCreate = [];
  const now = new Date();

  for (const board of boards) {
    for (let i = 0; i < perBoard; i += 1) {
      const title = `${pick(verbs)} ${pick(nouns)} ${pick(contexts)}`;
      const status = pick(statusOptions);
      const priority = pickWeighted(priorityOptions);
      const kindList = Array.from(new Set([
        pick(kindOptions),
        chance(0.4) ? pick(kindOptions) : null,
      ].filter(Boolean)));
      const dueDate = chance(0.15)
        ? null
        : (() => {
          const offset = randInt(-90, 120);
          const date = new Date(now);
          date.setDate(now.getDate() + offset);
          return date;
        })();
      const createdAt = new Date(now);
      createdAt.setDate(now.getDate() - randInt(0, 120));
      const updatedAt = new Date(createdAt);
      updatedAt.setDate(createdAt.getDate() + randInt(0, 14));
      const assignees = makeAssignees();
      const ownerId = assignees[0] || (chance(0.4) ? pick(userIds) : null);
      const checklist = makeChecklist();
      const comments = makeComments();
      const activityLog = [
        {
          id: crypto.randomUUID(),
          type: 'CREATE',
          message: 'Task created',
          timestamp: createdAt.toISOString(),
          actorId: ownerId || defaultActor,
        },
      ];

      tasksToCreate.push({
        tenantId: tenant.id,
        title,
        description: chance(0.7) ? `Auto-generated task for ${board.name}.` : null,
        kind: kindList[0] || null,
        kinds: kindList,
        status,
        priority,
        dueDate,
        ownerId,
        assignees,
        labels: [],
        attachments: [],
        comments,
        checklist,
        linkedTaskIds: [],
        activityLog,
        isFavorite: chance(0.1),
        excludeFromAll: chance(0.1),
        source: { type: 'MANUAL', createdBy: ownerId || defaultActor },
        policyContext: {
          tenantId: tenant.id,
          scope: 'BOARD',
          scopeId: board.id,
          rules: [
            { id: 'rule-1', action: 'TASK_CREATE', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' },
            { id: 'rule-2', action: 'TASK_UPDATE', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' },
            { id: 'rule-3', action: 'TASK_DELETE', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' },
          ],
          auditLevel: 'FULL',
        },
        createdAt,
        updatedAt,
        version: 1,
      });
    }
  }

  console.log(`Seeding ${tasksToCreate.length} tasks across ${boards.length} boards for ${tenant.name}...`);
  for (let i = 0; i < tasksToCreate.length; i += 500) {
    const chunk = tasksToCreate.slice(i, i + 500);
    await prisma.task.createMany({ data: chunk });
  }
  console.log('Done.');

  await prisma.$disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
