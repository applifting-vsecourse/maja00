import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { PrismaService } from '@/core/prisma/prisma.service';
import { Config } from '@/shared/config/config.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  /** Requests without a session. */
  anonymous: () => request.Agent;
  /** Signs a new user up and returns an agent that sends their session cookie. */
  signUp: (user?: Partial<TestUser>) => Promise<SignedInUser>;
  /** Empties every table, so each test starts from nothing. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
};

export type TestUser = { email: string; password: string; name: string };
export type SignedInUser = TestUser & { id: string; agent: request.Agent };

let userCounter = 0;

/**
 * The real AppModule with the real database (quacker_test), configured exactly
 * like main.ts. Create it once per file in `beforeAll`, call `reset()` in
 * `beforeEach` and `close()` in `afterAll`.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    // No test checks emails; don't print them to the log either.
    .overrideProvider('EmailService')
    .useValue({ sendEmail: async (): Promise<void> => undefined })
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const { frontendUrl } = app.get(Config);
  const server = app.getHttpServer();

  // BetterAuth only accepts cookie requests from trusted origins, like a browser
  // on the frontend would send.
  const agent = (): request.Agent =>
    request.agent(server).set('Origin', frontendUrl);

  return {
    app,
    prisma,
    anonymous: agent,
    async signUp(overrides = {}): Promise<SignedInUser> {
      userCounter += 1;
      const user: TestUser = {
        email: `user${userCounter}-${Date.now()}@example.com`,
        password: 'password123',
        name: `Test User ${userCounter}`,
        ...overrides,
      };
      const userAgent = agent();
      const response = await userAgent
        .post('/api/auth/sign-up/email')
        .send(user);
      if (response.status !== 200) {
        throw new Error(
          `Sign-up failed with ${response.status}: ${JSON.stringify(response.body)}`,
        );
      }
      return { ...user, id: response.body.user.id, agent: userAgent };
    },
    async reset(): Promise<void> {
      const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      if (tables.length === 0) return;
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
      );
    },
    async close(): Promise<void> {
      await app.close();
    },
  };
}
