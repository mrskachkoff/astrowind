/**
 * Medical Chat API Route
 *
 * Proxies requests to the MedGemma 4B cloud-based model via dr7.ai.
 * This is a DEMONSTRATION endpoint for evaluation purposes only.
 *
 * Model: MedGemma 4B (cloud-based, NOT fine-tuned on customer/clinical data)
 * Purpose: Demonstration / evaluation only
 * This is NOT the on-prem MedCore Private AI deployment.
 *
 * Data protection:
 * - No personal data accepted
 * - No PHI processed
 * - No conversations logged or persisted
 * - API key remains server-side only
 */

export const prerender = false;

import type { APIRoute } from 'astro';

const MEDGEMMA_API_KEY = import.meta.env.MEDGEMMA_API_KEY;
const MEDGEMMA_MODEL = import.meta.env.MEDGEMMA_MODEL || 'medgemma-4b-it';
const ENDPOINT = 'https://dr7.ai/api/v1/medical/chat/completions';

const SYSTEM_PROMPT =
  'You are MedGemma 4B, a cloud-based medical language model used for demonstration purposes only. ' +
  'You are not fine-tuned on clinical or patient-specific data. ' +
  'You provide general, educational medical information only. ' +
  'You must not request, infer, or process any personal or identifiable patient data. ' +
  'You do not provide diagnoses, prescriptions, or clinical decisions. ' +
  'Always state limitations and recommend consultation with a licensed physician.';

// --- Rate limiting (in-memory, resets on cold start) ---

interface RateRecord {
  count: number;
  resetAt: number;
}

const ipLimits = new Map<string, RateRecord>();
const sessionLimits = new Map<string, RateRecord>();
const cookieLimits = new Map<string, RateRecord>();

const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(map: Map<string, RateRecord>, key: string): boolean {
  const now = Date.now();
  const record = map.get(key);

  if (!record || now > record.resetAt) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// Periodically clean expired entries to prevent memory growth
function cleanExpired(map: Map<string, RateRecord>): void {
  const now = Date.now();
  for (const [key, record] of map) {
    if (now > record.resetAt) {
      map.delete(key);
    }
  }
}

setInterval(() => {
  cleanExpired(ipLimits);
  cleanExpired(sessionLimits);
  cleanExpired(cookieLimits);
}, 10 * 60 * 1000); // Clean every 10 minutes

// --- Input validation ---

const MAX_MESSAGE_LENGTH = 2000;

// Patterns that suggest personal/identifiable data
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{9}\b/, // 9-digit IDs
  /\b[A-Z]{2}\d{6,8}\b/i, // ID numbers
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/, // Date of birth patterns
];

function containsPotentialPHI(text: string): boolean {
  return PHI_PATTERNS.some((pattern) => pattern.test(text));
}

// --- API Route Handler ---

export const POST: APIRoute = async ({ request, cookies }) => {
  // CORS and method check
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify API key is configured
  if (!MEDGEMMA_API_KEY) {
    return new Response(JSON.stringify({ error: 'Service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract client IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

  // Check IP rate limit
  if (!checkRateLimit(ipLimits, ip)) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded. This demo allows 5 queries per hour.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Session tracking via cookie
  let sessionId = cookies.get('medchat_session')?.value;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    cookies.set('medchat_session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600,
    });
  }

  // Check session rate limit
  if (!checkRateLimit(sessionLimits, sessionId)) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded. This demo allows 5 queries per session.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Cookie-based rate limit (uses same session cookie value as key)
  if (!checkRateLimit(cookieLimits, `cookie:${sessionId}`)) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded. This demo allows 5 queries per hour.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse and validate request body
  let userText: string;
  try {
    const body = await request.json();
    userText = typeof body.message === 'string' ? body.message.trim() : '';
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!userText) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (userText.length > MAX_MESSAGE_LENGTH) {
    return new Response(
      JSON.stringify({
        error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check for potential PHI
  if (containsPotentialPHI(userText)) {
    return new Response(
      JSON.stringify({
        error:
          'Your message appears to contain personal identifiers. This demo does not accept personal or patient data. Please use only hypothetical or anonymized text.',
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build payload — EXACT required structure. Do NOT weaken this.
  const payload = {
    model: MEDGEMMA_MODEL,
    messages: [
      { role: 'assistant', content: '' },
      { role: 'user', content: userText },
      { role: 'system', content: SYSTEM_PROMPT },
    ],
    max_tokens: 1000,
    temperature: 0.7,
    stream: false,
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MEDGEMMA_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Accept-Encoding': 'gzip',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const status = response.status >= 500 ? 502 : response.status;
      return new Response(JSON.stringify({ error: 'Model service unavailable. Please try again later.' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No response generated.';

    // Return response — do NOT log or persist any content
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to reach model service. Please try again later.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
