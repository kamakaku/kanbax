declare class MockPrismaClient {
    data: any;
    task: {
        findUnique: ({ where }: any) => Promise<any>;
        upsert: ({ where, create, update }: any) => Promise<any>;
        delete: ({ where }: any) => Promise<void>;
        findMany: ({ where }: any) => Promise<unknown[]>;
    };
    auditEvent: {
        create: ({ data }: any) => Promise<any>;
        findUnique: ({ where }: any) => Promise<any>;
        deleteMany: ({ where }: any) => Promise<{
            count: number;
        }>;
        update: () => never;
    };
}
declare class TaskRepositoryPostgres {
    private prisma;
    constructor(prisma: any);
    findById(id: string, tenantId: string): Promise<any>;
    save(task: any): Promise<any>;
}
declare class AuditEventRepositoryPostgres {
    private prisma;
    constructor(prisma: any);
    log(event: any): Promise<any>;
    deleteBefore(date: Date, tenantId: string): Promise<any>;
}
declare class RetentionService {
    private auditRepository;
    constructor(auditRepository: any);
    runRetention(tenantId: string, retentionDays: number): Promise<any>;
}
declare function runPersistenceTests(): Promise<void>;
//# sourceMappingURL=persistence-lifecycle.test.d.ts.map