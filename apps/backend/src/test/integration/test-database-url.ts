import { config as loadEnv } from 'dotenv';

/**
 * The database the integration tests use: `quacker_test` on the same Postgres
 * as development (Docker locally, a service container in CI).
 *
 * Integration tests wipe every table before each test, so this refuses to
 * return anything whose database name does not end in `_test`. That is what
 * keeps a stray `DATABASE_URL` from emptying the dev database.
 */
export function testDatabaseUrl(): string {
  loadEnv({ path: '.env', quiet: true });

  const fromEnv = process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!fromEnv && !base) {
    throw new Error(
      'Set TEST_DATABASE_URL (or DATABASE_URL in apps/backend/.env) to run integration tests.',
    );
  }

  const url = new URL(fromEnv ?? base!);
  if (!fromEnv) url.pathname = '/quacker_test';

  const name = url.pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must end in "_test".`,
    );
  }
  return url.toString();
}
