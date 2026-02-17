/**
 * Lambda handler for Contact Form submissions
 *
 * Receives form data via POST, validates inputs, checks honeypot,
 * and sends a structured lead email via AWS SES.
 *
 * From/To: solutions@futurion.es
 * ReplyTo: submitter's email address
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'eu-west-3' });
const FROM_EMAIL = 'solutions@futurion.es';
const TO_EMAIL = 'solutions@futurion.es';
const ALLOWED_ORIGIN = 'https://solutions.futurion.es';

// --- Rate limiting (in-memory, resets on cold start) ---

const ipLimits = new Map();
const MAX_SUBMISSIONS = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const record = ipLimits.get(ip);

  if (!record || now > record.resetAt) {
    ipLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_SUBMISSIONS) {
    return false;
  }

  record.count++;
  return true;
}

// --- Timestamp verification ---
// Form embeds Date.now() at page load. Lambda rejects if:
//  - too fast (< 3s, likely bot)
//  - too old (> 30 min, replay or stale)

const MIN_ELAPSED_MS = 3 * 1000;
const MAX_ELAPSED_MS = 30 * 60 * 1000;

function isTimestampValid(ts) {
  const now = Date.now();
  const elapsed = now - ts;
  return elapsed >= MIN_ELAPSED_MS && elapsed <= MAX_ELAPSED_MS;
}

// --- Validation constants ---

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_FIELD_LENGTH = 200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Helpers ---

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
    `New contact form submission from ${data.source}`,
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Practice/Clinic: ${data.clinic || 'Not provided'}`,
    `Inquiry Type: ${data.inquiry_type || 'Not specified'}`,
    `Language: ${data.language}`,
    '',
    'Message:',
    data.message,
    '',
    '--- UTM Parameters ---',
    `Source: ${data.utm_source || 'N/A'}`,
    `Medium: ${data.utm_medium || 'N/A'}`,
    `Campaign: ${data.utm_campaign || 'N/A'}`,
    '',
    `Submitted at: ${data.submitted_at}`,
    '',
    '--- JSON Payload ---',
    JSON.stringify(data, null, 2),
  ];
  return lines.join('\n');
}

function buildEmailHtml(data) {
  const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">New Contact Form Submission</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.name)}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${escape(data.email)}">${escape(data.email)}</a></td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Practice/Clinic</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.clinic || 'Not provided')}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Inquiry Type</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.inquiry_type || 'Not specified')}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Language</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escape(data.language)}</td></tr>
      </table>
      <h3 style="margin-top: 20px;">Message</h3>
      <p style="background: #f8f9fa; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${escape(data.message)}</p>
      <h3>UTM Parameters</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 4px; font-weight: bold;">Source</td><td style="padding: 4px;">${escape(data.utm_source || 'N/A')}</td></tr>
        <tr><td style="padding: 4px; font-weight: bold;">Medium</td><td style="padding: 4px;">${escape(data.utm_medium || 'N/A')}</td></tr>
        <tr><td style="padding: 4px; font-weight: bold;">Campaign</td><td style="padding: 4px;">${escape(data.utm_campaign || 'N/A')}</td></tr>
      </table>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">Submitted at: ${escape(data.submitted_at)}</p>
      <details style="margin-top: 16px;">
        <summary style="cursor: pointer; color: #666;">JSON Payload</summary>
        <pre style="background: #f8f9fa; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${escape(JSON.stringify(data, null, 2))}</pre>
      </details>
    </div>
  `;
}

// --- Lambda handler ---

export async function handler(event) {
  // Only allow POST
  if (event.requestContext?.http?.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Origin / Referer validation
  const origin = event.headers?.origin || '';
  if (origin && origin !== ALLOWED_ORIGIN) {
    return jsonResponse(403, { error: 'Forbidden' });
  }
  const referer = event.headers?.referer || '';
  if (!origin && !referer.startsWith(ALLOWED_ORIGIN)) {
    return jsonResponse(403, { error: 'Forbidden' });
  }

  // IP-based rate limiting
  const ip = event.requestContext?.http?.sourceIp || 'unknown';
  if (!checkRateLimit(ip)) {
    return jsonResponse(429, { error: 'Too many submissions. Please try again later.' });
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid request body' });
  }

  // Honeypot check — bots fill the hidden "website" field
  if (body.website) {
    console.log('Honeypot triggered, ignoring submission');
    return jsonResponse(200, { success: true });
  }

  // Timestamp verification — rejects bots that skip the page and replays
  const ts = Number(body._t);
  if (!ts || !isTimestampValid(ts)) {
    console.log('Timestamp validation failed:', { ts, now: Date.now() });
    return jsonResponse(403, { error: 'Submission expired or invalid. Please reload the page and try again.' });
  }

  // Required field validation
  const name = sanitize(body.name, MAX_NAME_LENGTH);
  const email = sanitize(body.email, MAX_EMAIL_LENGTH);
  const message = sanitize(body.message, MAX_MESSAGE_LENGTH);
  const disclaimerAccepted = body.disclaimer === true || body.disclaimer === 'true' || body.disclaimer === 'on';

  if (!name) {
    return jsonResponse(400, { error: 'Name is required' });
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return jsonResponse(400, { error: 'A valid email address is required' });
  }
  if (!message) {
    return jsonResponse(400, { error: 'Message is required' });
  }
  if (!disclaimerAccepted) {
    return jsonResponse(400, { error: 'You must accept the privacy disclaimer' });
  }

  // Optional fields
  const clinic = sanitize(body.clinic || body.practice_name, MAX_FIELD_LENGTH);
  const inquiry_type = sanitize(body.inquiry_type, MAX_FIELD_LENGTH);
  const utm_source = sanitize(body.utm_source, MAX_FIELD_LENGTH);
  const utm_medium = sanitize(body.utm_medium, MAX_FIELD_LENGTH);
  const utm_campaign = sanitize(body.utm_campaign, MAX_FIELD_LENGTH);
  const language = body.language === 'es' ? 'es' : 'en';

  const emailData = {
    source: 'solutions.futurion.es',
    name,
    email,
    clinic,
    message,
    inquiry_type,
    utm_source,
    utm_medium,
    utm_campaign,
    submitted_at: new Date().toISOString(),
    language,
  };

  const subject = `[Contact Form] ${inquiry_type || 'General'} - ${name}`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [TO_EMAIL] },
        ReplyToAddresses: [email],
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: buildEmailBody(emailData), Charset: 'UTF-8' },
            Html: { Data: buildEmailHtml(emailData), Charset: 'UTF-8' },
          },
        },
      })
    );

    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error('SES send failed:', err);
    return jsonResponse(500, { error: 'Failed to send message. Please try again later.' });
  }
}
