/**
 * Lambda handler for entitlement redemption (tmp/payments.md §5.4).
 *
 * POST only, from the browser (Access page). Verifies the stateless
 * entitlement HMAC token, then — because a token alone is never proof of
 * payment — re-checks the invoice is still `paid` in Qonto before minting a
 * 15-minute CloudFront signed URL. Only lists the allowlisted S3 prefix for
 * that SKU (never reads object bytes: CloudFront's OAC does that, same
 * pattern as lambda/trustprompt-download.mjs). IAM here is list-only S3 + SSM
 * read for two parameters — no SES, so a missing artifact mapping fails
 * closed with a structured error log rather than an email (see the comment
 * at ARTIFACT_MAP below for why).
 *
 * The artifact prefixes are an owner input (tmp/payments.md §12) not yet
 * supplied — every SKU maps to null until then, which returns 503 and NEVER
 * falls back to another product's files.
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import {
  isAllowedOrigin,
  jsonResponse,
  createRateLimiter,
  getSecret,
  CATALOGUE,
  verifyToken,
  createQontoClient,
} from './payments-shared.mjs';

// The bucket lives in an opt-in region (eu-south-2) — see the identical
// comment in trustprompt-download.mjs. SSM/SES stay in eu-west-3.
const s3 = new S3Client({ region: 'eu-south-2' });
const ssm = new SSMClient({ region: 'eu-west-3' });

const DOWNLOAD_HOST = 'https://trustprompt.futurion.es';
const URL_TTL_SECONDS = 900; // 15 minutes, tmp/payments.md §5.4
const FILENAME_REGEX = /^[A-Za-z0-9._-]+$/;

// Defense-in-depth, not required by the token's own HMAC guarantee (which
// already makes brute-forcing infeasible) — matches every other public
// endpoint in this codebase having a per-IP budget.
const checkRateLimit = createRateLimiter({ maxRequests: 20, windowMs: 60 * 60 * 1000 });

/**
 * Frozen SKU -> S3/CloudFront mapping. `prefix` is the S3 ListObjectsV2
 * prefix (for IAM scoping); `urlPath` is the *CloudFront-side* path used to
 * build the signed URL. These are kept as two separate, explicit fields
 * (rather than deriving one from the other, the way trustprompt-download.mjs
 * strips a hardcoded "models/" segment for its own bucket layout) because
 * the CloudFront origin-path mapping for these not-yet-created prefixes is
 * an owner decision, not something this code should guess.
 *
 * Every value is null until the owner supplies real prefixes (tmp/payments.md
 * §12) — a missing entry is a fail-closed 503, never a fallback to a
 * different product's files.
 */
const ARTIFACT_MAP = Object.freeze({
  'trustprompt-small-team': null,
  'trustprompt-business': null,
  'trustprompt-growth': null,
  'trustcore-starter-1-seat': null,
  'trustcore-team-10-seats': null,
  'trustcore-business-50-seats': null,
});

async function getQontoAuthHeader() {
  return getSecret(ssm, '/futurion/payments/qonto-auth');
}

async function getEntitlementSecret() {
  return getSecret(ssm, '/futurion/payments/entitlement-secret');
}

async function getPrivateKey() {
  return getSecret(ssm, '/futurion/trustprompt/cf-private-key');
}

export async function handler(event) {
  try {
    if (event.requestContext?.http?.method !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed' });
    }
    if (!isAllowedOrigin(event)) {
      return jsonResponse(403, { code: 'forbidden' });
    }

    const ip = event.requestContext?.http?.sourceIp || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonResponse(429, { code: 'rate_limited' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { code: 'bad_request' });
    }

    const token = typeof body.token === 'string' ? body.token : '';
    const entitlementSecret = await getEntitlementSecret();
    const payload = verifyToken(token, entitlementSecret);

    if (!payload) {
      return jsonResponse(410, { code: 'token_invalid_or_expired' });
    }

    const invoiceId = payload.inv;
    const sku = payload.sku;
    const entry = CATALOGUE[sku];
    if (!invoiceId || !entry || !entry.download) {
      return jsonResponse(403, { code: 'not_downloadable' });
    }

    // Re-check payment truth on every redemption. A refunded/unmarked-paid
    // invoice must stop downloads immediately even with a valid, unexpired
    // token — this is the only revocation mechanism (tokens can't otherwise
    // be revoked before their 7-day expiry, tmp/payments.md §11).
    const authHeader = await getQontoAuthHeader();
    const qonto = createQontoClient({ baseUrl: process.env.QONTO_API_BASE_URL, authHeader });

    let invoice;
    try {
      const res = await qonto.get(`/v2/client_invoices/${encodeURIComponent(invoiceId)}`);
      invoice = res.client_invoice ?? res;
    } catch (err) {
      console.error('Failed to re-fetch invoice from Qonto during access redemption:', err);
      return jsonResponse(502, { code: 'server_error' });
    }

    if (invoice.status !== 'paid') {
      return jsonResponse(403, { code: 'invoice_not_paid' });
    }

    const artifact = ARTIFACT_MAP[sku];
    if (!artifact) {
      // Missing owner-supplied mapping. Fail closed and log at error level so
      // a CloudWatch alarm on this Lambda's Errors metric can page the
      // owner — this function has no SES permission (least privilege).
      console.error(JSON.stringify({ event: 'access_artifact_map_missing', sku, invoiceId }));
      return jsonResponse(503, { code: 'download_unavailable' });
    }

    let zip;
    try {
      const out = await s3.send(
        new ListObjectsV2Command({ Bucket: artifact.bucket, Prefix: artifact.prefix, MaxKeys: 100 })
      );
      const candidates = (out.Contents ?? []).filter(
        (o) => o.Key.endsWith('.zip') && o.Size > 0 && !o.Key.slice(artifact.prefix.length).includes('/')
      );
      if (candidates.length > 1) {
        candidates.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
      }
      zip = candidates[0];
    } catch (err) {
      console.error('S3 ListObjectsV2 failed:', err);
      return jsonResponse(502, { code: 'server_error' });
    }

    if (!zip) {
      console.error(JSON.stringify({ event: 'access_no_artifact_found', sku, invoiceId }));
      return jsonResponse(503, { code: 'download_unavailable' });
    }

    const filenameRaw = zip.Key.slice(artifact.prefix.length);
    const filename = FILENAME_REGEX.test(filenameRaw) ? filenameRaw : filenameRaw.replace(/[^A-Za-z0-9._-]/g, '_');

    const privateKey = await getPrivateKey();
    const dateLessThan = new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString();

    let url;
    try {
      url = getSignedUrl({
        url: `${DOWNLOAD_HOST}${artifact.urlPath}${encodeURIComponent(filename)}`,
        keyPairId: process.env.CF_KEY_PAIR_ID,
        privateKey,
        dateLessThan,
      });
    } catch (err) {
      console.error('CloudFront signing failed:', err);
      return jsonResponse(500, { code: 'server_error' });
    }

    console.log(JSON.stringify({ event: 'access_granted', sku, invoiceId, filename }));

    return jsonResponse(200, {
      url,
      filename,
      sizeBytes: zip.Size,
      expiresInSeconds: URL_TTL_SECONDS,
    });
  } catch (err) {
    console.error('Unhandled error in payments-access handler:', err);
    return jsonResponse(500, { code: 'server_error' });
  }
}
