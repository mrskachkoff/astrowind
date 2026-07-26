/**
 * Lambda handler for gated TrustPrompt model download links.
 *
 * Receives the download form payload via POST, validates it, looks up the
 * current release zip for the requested language in S3 (without ever reading
 * its bytes), and returns a short-lived CloudFront **signed URL** for it.
 * Also sends a lead-notification email via SES, mirroring lambda/contact-form.mjs.
 *
 * Design notes (see /Users/eur-es-testmdm/.claude/plans/this-astrowind-site-on-bubbly-pillow.md):
 *  - The actual file bytes are served by CloudFront distribution E1BY5NEU42NYII
 *    (alias trustprompt.futurion.es) straight from S3 via an Origin Access Control.
 *    This Lambda never touches the object body — it only lists the `dist/`
 *    prefix to discover the current filename, then signs a URL locally.
 *  - The IAM role for this function therefore has NO s3:GetObject at all —
 *    only prefix-scoped s3:ListBucket. CloudFront's OAC does the real read.
 *  - Locale -> S3 prefix is a frozen allowlist. The key is never built from
 *    user input.
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { createHmac, timingSafeEqual } from 'node:crypto';

// The bucket lives in an opt-in region (eu-south-2). The Lambda's ambient
// AWS_REGION is eu-west-3 — a default-region client 301s on ListObjectsV2.
const s3 = new S3Client({ region: 'eu-south-2' });
const ssm = new SSMClient({ region: 'eu-west-3' });
const ses = new SESClient({ region: 'eu-west-3' });

const BUCKET = 'es-futurion-trustprompt';
const DOWNLOAD_HOST = 'https://trustprompt.futurion.es';
const FROM_EMAIL = 'solutions@futurion.es';
const TO_EMAIL = 'solutions@futurion.es';

// Same 4 origins as the deployed contact-form Function URL CORS config —
// kept identical on purpose so the two endpoints never diverge.
const ALLOWED_ORIGINS = new Set([
  'https://solutions.futurion.es',
  'https://futurion.es',
  'https://www.futurion.es',
  'https://main.d1pu1f14n9536.amplifyapp.com',
]);

const URL_TTL_SECONDS = 900; // see plan §4 "TTL" for the 300-vs-900 tradeoff
const RENEW_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Set to '1' to bind each signed URL to the requester's IP (CloudFront custom
// policy). Off by default: mobile/CGNAT/VPN users can legitimately change IP
// mid-download, which would otherwise surface as a confusing 403.
const PIN_TO_IP = process.env.PIN_TO_IP === '1';

// --- Locale allowlist -------------------------------------------------
// Keep in sync with src/i18n/modelLanguages.ts (LOCALE_PREFIX <-> MODEL_LANGUAGES).
// Never build this path from user input — the map is the only source of keys.

const LOCALE_PREFIX = Object.freeze({
  en: 'models/openmed/en/dist/',
  es: 'models/openmed/es/dist/',
  fr: 'models/openmed/fr/dist/',
  de: 'models/openmed/de/dist/',
  it: 'models/openmed/it/dist/',
  nl: 'models/openmed/nl/dist/',
  pt: 'models/openmed/pt/dist/',
  hi: 'models/openmed/hi/dist/',
  te: 'models/openmed/te/dist/',
  ar: 'models/openmed/ar/dist/',
  jp: 'models/openmed/jp/dist/',
  tk: 'models/openmed/tk/dist/',
  cn: 'models/openmed/cn/dist/',
});

function prefixFor(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return null; // shape gate
  if (!Object.hasOwn(LOCALE_PREFIX, code)) return null; // allowlist gate (defeats __proto__ etc.)
  return LOCALE_PREFIX[code];
}

// --- Rate limiting (in-memory, resets on cold start) -------------------
// Same shape as contact-form.mjs, but 5/hour since "generate a new link"
// legitimately re-calls this endpoint.

const ipLimits = new Map();
const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_TRACKED_IPS = 5000;

function checkRateLimit(ip) {
  const now = Date.now();

  // Bound the map: evict expired entries before growing it further.
  if (ipLimits.size > MAX_TRACKED_IPS) {
    for (const [key, record] of ipLimits) {
      if (now > record.resetAt) ipLimits.delete(key);
    }
  }

  const record = ipLimits.get(ip);
  if (!record || now > record.resetAt) {
    ipLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_REQUESTS) return false;
  record.count++;
  return true;
}

// --- Timestamp verification (same window as contact-form.mjs) ----------

const MIN_ELAPSED_MS = 3 * 1000;
const MAX_ELAPSED_MS = 30 * 60 * 1000;

function isTimestampValid(ts) {
  const elapsed = Date.now() - ts;
  return elapsed >= MIN_ELAPSED_MS && elapsed <= MAX_ELAPSED_MS;
}

// --- Validation constants ------------------------------------------------

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_FIELD_LENGTH = 200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FILENAME_REGEX = /^[A-Za-z0-9._-]+$/;

// --- Secrets (fetched once per execution environment, cached module-scope) --

let cachedPrivateKey;
let cachedTokenSecret;

async function getSecret(name) {
  const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  return out.Parameter.Value;
}

async function getPrivateKey() {
  if (!cachedPrivateKey) {
    cachedPrivateKey = await getSecret('/futurion/trustprompt/cf-private-key');
  }
  return cachedPrivateKey;
}

async function getTokenSecret() {
  if (!cachedTokenSecret) {
    cachedTokenSecret = await getSecret('/futurion/trustprompt/download-token-secret');
  }
  return cachedTokenSecret;
}

// --- Renew token ---------------------------------------------------------
// Stateless HMAC over ip|email|locale|exp. Lets "generate a new link" re-call
// this endpoint without re-triggering the timestamp trap, field validation,
// or a duplicate SES lead email.

async function mintRenewToken(ip, email, locale) {
  const secret = await getTokenSecret();
  const exp = Date.now() + RENEW_TOKEN_TTL_MS;
  const payload = `${ip}|${email}|${locale}|${exp}`;
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${mac}`;
}

async function verifyRenewToken(token, ip) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [encodedPayload, mac] = token.split('.');
  const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  const [tokenIp, email, locale, expStr] = payload.split('|');

  const secret = await getTokenSecret();
  const expectedMac = createHmac('sha256', secret).update(payload).digest('base64url');

  const a = Buffer.from(mac || '');
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return null;
  if (tokenIp !== ip) return null;

  return { email, locale };
}

// --- Helpers ---------------------------------------------------------------

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function sanitize(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function buildEmailBody(data) {
  const lines = [
    `New TrustPrompt download request from ${data.source}`,
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Company: ${data.company || 'Not provided'}`,
    `Role: ${data.role || 'Not specified'}`,
    `Model language: ${data.model_locale}`,
    `Page language: ${data.page_language}`,
    `Status: ${data.status}`,
    data.filename ? `File: ${data.filename}` : '',
    data.sizeBytes ? `Size: ${(data.sizeBytes / 1073741824).toFixed(2)} GB` : '',
    '',
    '--- UTM Parameters ---',
    `Source: ${data.utm_source || 'N/A'}`,
    `Medium: ${data.utm_medium || 'N/A'}`,
    `Campaign: ${data.utm_campaign || 'N/A'}`,
    '',
    `Submitted at: ${data.submitted_at}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function buildEmailHtml(data) {
  const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">${data.status === 'WAITLIST' ? 'TrustPrompt Download Waitlist' : 'New TrustPrompt Download'}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.name)}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${escape(data.email)}">${escape(data.email)}</a></td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Company</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.company || 'Not provided')}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Role</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.role || 'Not specified')}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Model language</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.model_locale)}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Status</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.status)}</td></tr>
      </table>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">Submitted at: ${escape(data.submitted_at)}</p>
    </div>
  `;
}

async function sendLeadEmail(data) {
  const subjectPrefix = data.status === 'WAITLIST' ? 'WAITLIST — ' : '';
  const subject = `[TrustPrompt Download] ${subjectPrefix}${data.model_locale.toUpperCase()} — ${data.name}`;

  if (process.env.DRY_RUN_SES === '1') {
    console.log('DRY_RUN_SES=1, skipping SES send:', subject);
    return;
  }

  await ses.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [TO_EMAIL] },
      ReplyToAddresses: [data.email],
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: buildEmailBody(data), Charset: 'UTF-8' },
          Html: { Data: buildEmailHtml(data), Charset: 'UTF-8' },
        },
      },
    })
  );
}

// --- Find the current release zip under a dist/ prefix ---------------------

async function findReleaseZip(prefix) {
  const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: 100 }));

  const candidates = (out.Contents ?? []).filter(
    (o) =>
      o.Key.endsWith('.zip') &&
      o.Size > 0 && // some dist/ prefixes are 0-byte folder markers, not files
      !o.Key.slice(prefix.length).includes('/') // no nested subdirectories
  );

  if (candidates.length === 0) return null;

  if (candidates.length > 1) {
    console.warn('multiple zips found under prefix, picking newest by version/mtime', {
      prefix,
      keys: candidates.map((c) => c.Key),
    });
    const SEMVER = /-(\d+)\.(\d+)\.(\d+)-/;
    candidates.sort((a, b) => {
      const va = a.Key.match(SEMVER);
      const vb = b.Key.match(SEMVER);
      if (va && vb) {
        for (let i = 1; i <= 3; i++) {
          const d = Number(vb[i]) - Number(va[i]);
          if (d) return d;
        }
      } else if (Boolean(va) !== Boolean(vb)) {
        return va ? -1 : 1; // versioned filename wins over unversioned
      }
      return new Date(b.LastModified) - new Date(a.LastModified);
    });
  }

  return candidates[0];
}

// --- Lambda handler ----------------------------------------------------

export async function handler(event) {
  try {
    if (event.requestContext?.http?.method !== 'POST') {
      return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED' });
    }

    const origin = event.headers?.origin || '';
    const referer = event.headers?.referer || '';
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse(403, { error: 'FORBIDDEN' });
    }
    if (!origin && ![...ALLOWED_ORIGINS].some((o) => referer.startsWith(o))) {
      return jsonResponse(403, { error: 'FORBIDDEN' });
    }

    const ip = event.requestContext?.http?.sourceIp || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonResponse(429, { error: 'RATE_LIMITED' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'BAD_REQUEST' });
    }

    // Honeypot — bots fill the hidden "website" field. Fake success, no url.
    if (body.website) {
      console.log('Honeypot triggered, ignoring submission');
      return jsonResponse(200, { ok: true });
    }

    let name;
    let email;
    let company;
    let role;
    let utm_source;
    let utm_medium;
    let utm_campaign;
    let page_language;
    let prefix;
    let locale;
    let skipEmail = false;

    // Renew path: re-issue a link for a previously-validated request without
    // re-running field validation, the timestamp trap, or sending another
    // lead email.
    const renewed = body.dl ? await verifyRenewToken(body.dl, ip) : null;

    if (renewed) {
      email = renewed.email;
      locale = renewed.locale;
      prefix = LOCALE_PREFIX[locale]; // renewed.locale was itself minted from a validated prefixFor() call
      name = sanitize(body.name, MAX_NAME_LENGTH) || 'Returning visitor';
      skipEmail = true;
    } else {
      const ts = Number(body._t);
      if (!ts || !isTimestampValid(ts)) {
        return jsonResponse(403, { error: 'EXPIRED' });
      }

      name = sanitize(body.name, MAX_NAME_LENGTH);
      email = sanitize(body.email, MAX_EMAIL_LENGTH);
      const disclaimerAccepted = body.disclaimer === true || body.disclaimer === 'true' || body.disclaimer === 'on';

      if (!name) return jsonResponse(400, { error: 'VALIDATION' });
      if (!email || !EMAIL_REGEX.test(email)) return jsonResponse(400, { error: 'VALIDATION' });
      if (!disclaimerAccepted) return jsonResponse(400, { error: 'VALIDATION' });

      prefix = prefixFor(body.model_locale);
      if (!prefix) return jsonResponse(400, { error: 'INVALID_LOCALE' });
      locale = body.model_locale.trim().toLowerCase();

      company = sanitize(body.company, MAX_FIELD_LENGTH);
      role = sanitize(body.role, MAX_FIELD_LENGTH);
      utm_source = sanitize(body.utm_source, MAX_FIELD_LENGTH);
      utm_medium = sanitize(body.utm_medium, MAX_FIELD_LENGTH);
      utm_campaign = sanitize(body.utm_campaign, MAX_FIELD_LENGTH);
      page_language = body.language === 'es' ? 'es' : 'en';
    }

    const zip = await findReleaseZip(prefix);

    if (!zip) {
      if (!skipEmail) {
        try {
          await sendLeadEmail({
            source: 'solutions.futurion.es',
            name,
            email,
            company,
            role,
            model_locale: locale,
            page_language,
            status: 'WAITLIST',
            utm_source,
            utm_medium,
            utm_campaign,
            submitted_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('SES send failed (waitlist):', err);
        }
      }
      return jsonResponse(409, { error: 'NOT_AVAILABLE', locale });
    }

    const filenameRaw = zip.Key.slice(prefix.length);
    const filename = FILENAME_REGEX.test(filenameRaw) ? filenameRaw : filenameRaw.replace(/[^A-Za-z0-9._-]/g, '_');

    const privateKey = await getPrivateKey();
    const dateLessThan = new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString();

    const signOptions = {
      url: `${DOWNLOAD_HOST}/openmed/${locale}/dist/${encodeURIComponent(filename)}`,
      keyPairId: process.env.CF_KEY_PAIR_ID,
      privateKey,
      dateLessThan,
    };
    if (PIN_TO_IP && ip !== 'unknown') {
      signOptions.ipAddress = `${ip}/32`;
    }

    let url;
    try {
      url = getSignedUrl(signOptions);
    } catch (err) {
      console.error('CloudFront signing failed:', err);
      return jsonResponse(500, { error: 'SERVER_ERROR' });
    }

    const dl = await mintRenewToken(ip, email, locale);

    if (!skipEmail) {
      try {
        await sendLeadEmail({
          source: 'solutions.futurion.es',
          name,
          email,
          company,
          role,
          model_locale: locale,
          page_language,
          status: 'SENT',
          filename,
          sizeBytes: zip.Size,
          utm_source,
          utm_medium,
          utm_campaign,
          submitted_at: new Date().toISOString(),
        });
      } catch (err) {
        // Do not fail the download because the notification failed — the
        // user did nothing wrong. Diverges from contact-form.mjs on purpose.
        console.error('SES send failed:', err);
      }
    }

    return jsonResponse(200, {
      url,
      filename,
      sizeBytes: zip.Size,
      expiresInSeconds: URL_TTL_SECONDS,
      dl,
    });
  } catch (err) {
    console.error('Unhandled error in trustprompt-download handler:', err);
    return jsonResponse(500, { error: 'SERVER_ERROR' });
  }
}
