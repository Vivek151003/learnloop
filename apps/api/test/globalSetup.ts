import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './env.js';

/** Applies migrations to the test database once per run (creates it if missing). */
export default function setup() {
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    });
  } catch (err) {
    const out = (err as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? '';
    const errText = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`Test database migration failed. Is Postgres running?\n${out}\n${errText}`);
  }
}
