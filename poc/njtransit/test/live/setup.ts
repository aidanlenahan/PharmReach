import { loadEnv } from '../../src/njtClient.ts';

// Load poc/njtransit/.env (if present) before test files are collected, so describe.skipIf sees it.
loadEnv();
