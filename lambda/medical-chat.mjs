/**
 * Lambda handler for Medical Chat API
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
 * - API key remains server-side only (Lambda env var)
 */

const MEDGEMMA_API_KEY = process.env.MEDGEMMA_API_KEY;
const MEDGEMMA_MODEL = process.env.MEDGEMMA_MODEL || 'medgemma-4b-it';
const ENDPOINT = 'https://dr7.ai/api/v1/medical/chat/completions';
const ALLOWED_ORIGIN = 'https://solutions.futurion.es';

const SYSTEM_PROMPT =
  'You are MedGemma 4B, a cloud-based medical language model used for demonstration purposes only. ' +
  'You are not fine-tuned on clinical or patient-specific data. ' +
  'You provide general, educational medical information only. ' +
  'You must not request, infer, or process any personal or identifiable patient data. ' +
  'You do not provide diagnoses, prescriptions, or clinical decisions. ' +
  'Always state limitations and recommend consultation with a licensed physician.';

// --- Rate limiting (in-memory, resets on cold start) ---

const ipLimits = new Map();
const sessionLimits = new Map();

const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(map, key) {
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

// --- Input validation ---

const MAX_MESSAGE_LENGTH = 2000;

// Patterns that suggest personal/identifiable data
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,        // SSN
  /\b\d{9}\b/,                      // 9-digit IDs
  /\b[A-Z]{2}\d{6,8}\b/i,           // ID numbers
  /\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b/, // Date of birth patterns
];

function containsPotentialPHI(text) {
  return PHI_PATTERNS.some((pattern) => pattern.test(text));
}

// --- CORS helpers ---

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}

// --- Lambda handler ---

export async function handler(event) {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  // Only allow POST
  if (event.requestContext?.http?.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Verify API key is configured
  if (!MEDGEMMA_API_KEY) {
    return jsonResponse(503, { error: 'Service not configured' });
  }

  // Extract client IP from Lambda Function URL event
  const ip = event.requestContext?.http?.sourceIp || 'unknown';

  // Check IP rate limit
  if (!checkRateLimit(ipLimits, ip)) {
    return jsonResponse(429, {
      error: 'Rate limit exceeded. This demo allows 5 queries per hour.',
    });
  }

  // Session tracking via X-Session-ID header
  const sessionId = event.headers?.['x-session-id'] || '';
  if (sessionId) {
    if (!checkRateLimit(sessionLimits, sessionId)) {
      return jsonResponse(429, {
        error: 'Rate limit exceeded. This demo allows 5 queries per session.',
      });
    }
  }

  // Parse and validate request body
  let userText;
  try {
    const body = JSON.parse(event.body || '{}');
    userText = typeof body.message === 'string' ? body.message.trim() : '';
  } catch {
    return jsonResponse(400, { error: 'Invalid request body' });
  }

  if (!userText) {
    return jsonResponse(400, { error: 'Message is required' });
  }

  if (userText.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse(400, {
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    });
  }

  // Check for potential PHI
  if (containsPotentialPHI(userText)) {
    return jsonResponse(422, {
      error:
        'Your message appears to contain personal identifiers. This demo does not accept personal or patient data. Please use only hypothetical or anonymized text.',
    });
  }

  // Build payload -- EXACT required structure. Do NOT weaken this.
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
      return jsonResponse(status, { error: 'Model service unavailable. Please try again later.' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No response generated.';

    // Return response -- do NOT log or persist any content
    return jsonResponse(200, { reply });
  } catch {
    return jsonResponse(502, { error: 'Failed to reach model service. Please try again later.' });
  }
}
