import { execSync } from 'child_process';
import { testDatabaseUrl } from './test-database-url';

/**
 * Runs once before all integration tests: creates the test database if it is
 * missing and brings its schema up to date from the Prisma migrations.
 */
export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
