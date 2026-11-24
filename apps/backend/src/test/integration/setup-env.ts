import { testDatabaseUrl } from './test-database-url';

// Runs in every test file before it imports anything, so PrismaService and
// Config only ever see the test database.
process.env.DATABASE_URL = testDatabaseUrl();

// Sign-up sends a verification email. react-email renders it through a dynamic
// import(), which Jest's module loader can't run, and no test checks emails.
jest.mock('@/core/email/render', () => ({
  renderEmail: async (): Promise<string> => '',
}));
