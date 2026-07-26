#!/usr/bin/env node
/**
 * Local test harness for trustprompt-download.mjs.
 *
 * Builds a Function-URL-shaped event and calls the handler directly, using
 * whatever AWS credentials are active in the shell (region for S3/SSM/SES is
 * hardcoded inside the handler, so the ambient default region doesn't matter).
 *
 * Usage:
 *   export CF_KEY_PAIR_ID=K1MHS7VHQHLATT
 *   node lambda/scripts/invoke-local.mjs '{"name":"Test","email":"m.herranz@pangeanic.com","disclaimer":true,"model_locale":"en"}'
 *
 * Pass --renew "<token>" as a second CLI arg to exercise the renew path.
 * Pass DRY_RUN_SES=1 in the environment to skip the real SES send.
 */

import { handler } from '../trustprompt-download.mjs';

const rawBody = process.argv[2] ?? '{}';
const parsed = JSON.parse(rawBody);

const body = {
  _t: Date.now() - 5000, // 5s ago, satisfies the >=3s timestamp trap
  ...parsed,
};

const event = {
  requestContext: {
    http: { method: process.env.TEST_METHOD || 'POST', sourceIp: process.env.TEST_IP || '203.0.113.9' },
  },
  headers: {
    origin: process.env.TEST_ORIGIN ?? 'https://solutions.futurion.es',
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
};

if (process.env.TEST_ORIGIN === '') delete event.headers.origin;

const res = await handler(event);
console.log(res.statusCode, res.body);
