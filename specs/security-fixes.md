# Security Fixes Spec

Issues covered: C2, H1, H2, M1, M3, M4.
Not covered here: C1 (auth), M2 (magic bytes), L1–L4 — separate decisions needed.

---

## C2 — Wildcard CORS

### Current problem
`app.use(cors())` with no options defaults to `Access-Control-Allow-Origin: *`.
Any page the user has open in a browser can make cross-origin requests to
`http://localhost:3000` and the browser will complete them. Combined with no
authentication, this means a malicious tab can read the user's CV, overwrite it,
or trigger paid LLM calls silently.

### Exact fix
Replace the wildcard with an explicit allowlist restricted to the Angular dev
server origin. In production (single-user local tool) the frontend is always
`http://localhost:4200`.

```ts
// src/server.ts
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
```

No other origins should be added unless there is a concrete reason.

### Acceptance criteria
- Browser request from `http://localhost:4200` succeeds (2xx, CORS headers present).
- Browser request from any other origin (e.g. `http://evil.com`, `http://localhost:3001`)
  receives no `Access-Control-Allow-Origin` header and the browser blocks it.
- `curl` from the same machine still works (curl ignores CORS — this is correct
  behaviour, CORS is a browser control only).

---

## H1 — SSRF in `POST /fetch-jd`

### Current problem
`fetchAndCleanJD(url)` calls `axios.get(url)` after only validating URL format.
No check is made against the resolved hostname or IP. Supplying any of the
following bypasses the portal blocklist and causes the server to make an
outbound request the caller controls:

- `http://169.254.169.254/latest/meta-data/` — cloud instance metadata
- `http://localhost:3000/cv` — reads the CV through the server itself
- `http://0.0.0.0/`, `http://[::1]/` — loopback variants
- `http://192.168.x.x/`, `http://10.x.x.x/` — internal network

### Exact fix
Add a hostname/IP guard in `classifyPortal` or as a dedicated `assertSafeUrl`
function called before `axios.get`. The check must cover:

1. Scheme must be `http` or `https` — reject `file://`, `ftp://`, etc.
2. Hostname must not resolve to a private/loopback address. Since DNS resolution
   happens inside `axios`, the practical approach is to block known private
   hostname patterns and reserved IP literals before the request:
   - Loopback: `localhost`, `127.x.x.x`, `::1`, `0.0.0.0`
   - Link-local: `169.254.x.x`, `fe80::`
   - Private ranges: `10.x.x.x`, `172.16–31.x.x`, `192.168.x.x`
   - Internal `.local` hostnames

```ts
// src/server.ts — add before fetchAndCleanJD call

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1$|fe80:)/i;

function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  const host = parsed.hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    PRIVATE_IP_RE.test(host)
  ) {
    throw new Error('Requests to private/internal addresses are not allowed');
  }
}
```

Call `assertSafeUrl(url)` at the top of the `POST /fetch-jd` handler, before
`classifyPortal` and before `fetchAndCleanJD`. Return 400 on failure.

### Acceptance criteria
- `http://169.254.169.254/...` → 400, no outbound request made.
- `http://localhost:3000/cv` → 400, no outbound request made.
- `http://192.168.1.1/` → 400, no outbound request made.
- `http://0.0.0.0/` → 400, no outbound request made.
- `file:///etc/passwd` → 400, no outbound request made.
- Legitimate HTTPS job URLs (e.g. `https://boards.greenhouse.io/...`) → proceeds
  to portal classification and fetch as before.

---

## H2 — No rate limiting

### Current problem
No endpoint has a rate limit. The costly endpoints are:

| Endpoint | LLM calls per request |
|---|---|
| `POST /analyze` | ~4 (researcher + analyst + matcher + summary) |
| `POST /generate-materials` | ~3 (writer + interviewer + cover letter) |
| `POST /analyze/batch` | up to 10 × above + 10 summaries in parallel |

An attacker (or a runaway frontend loop) can exhaust Anthropic API credits with
a trivial script.

### Exact fix
Use `express-rate-limit` (already a common Express utility, no exotic dependency).
Apply separate limiters per endpoint category — the LLM endpoints need much
tighter limits than the cheap endpoints.

```ts
import rateLimit from 'express-rate-limit';

// Cheap endpoints: CV save/read, JD fetch
const standardLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

// LLM endpoints: analyze, generate-materials
const llmLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

app.use('/cv', standardLimiter);
app.use('/fetch-jd', standardLimiter);
app.post('/analyze/batch', llmLimiter);   // before /analyze to match correctly
app.post('/analyze', llmLimiter);
app.post('/generate-materials', llmLimiter);
```

`express-rate-limit` must be added as a dependency (`npm install express-rate-limit`).
Since the project rules require explicit approval before adding packages, this
must be approved before implementation.

### Acceptance criteria
- 6 rapid `POST /analyze` calls within 1 minute → the 6th returns 429 with
  `{ error: 'Too many requests', code: 'RATE_LIMITED' }`.
- 6 rapid `POST /generate-materials` calls within 1 minute → same.
- 31 rapid `GET /cv` calls within 1 minute → the 31st returns 429.
- Normal usage (1–2 analyses per minute) is never rate-limited.
- Rate-limit window resets correctly after 1 minute.

---

## M1 — Raw `error.message` in 500 responses

### Current problem
Three error handlers concatenate the raw exception message into the response body:

```ts
// server.ts:397
res.status(500).json({ error: 'Analysis failed: ' + error.message });

// server.ts:429
res.status(500).json({ error: 'Material generation failed: ' + error.message });

// server.ts:552
res.status(500).json({ error: 'Batch analysis failed: ' + error.message });
```

`error.message` from internal libraries can expose file system paths, library
names, SDK internals, or partial stack details. For example, a file-not-found
error would leak the absolute path of `data/candidate-cv.md`.

### Exact fix
Return a static user-facing message. Keep the detail in `console.error` (already
present) for server-side diagnosis.

```ts
// POST /analyze catch
console.error('Analysis failed:', error);
res.status(500).json({ error: 'Analysis failed. Check server logs.' });

// POST /generate-materials catch
console.error('Material generation failed:', error);
res.status(500).json({ error: 'Material generation failed. Check server logs.' });

// POST /analyze/batch catch
console.error('Batch analysis failed:', error);
res.status(500).json({ error: 'Batch analysis failed. Check server logs.' });
```

### Acceptance criteria
- When the LLM client throws any error, the response body contains only the
  static string — no file paths, no library names, no SDK messages.
- `console.error` still receives the full error object for server-side debugging.
- The frontend can display the static message without change (it already renders
  `error.error` from the response).

---

## M3 — No size cap on text input fields

### Current problem
`POST /cv` and `POST /analyze` accept arbitrary-length strings. Express's default
`json()` body limit is 100kb, but it is not explicitly configured here — a
future middleware change or a library update could raise or remove it silently.
Beyond that, a 100kb job description fed to `POST /analyze` triggers an expensive
LLM call with no guard. There is also no minimum length check that would catch
accidental empty-string submissions before they reach the LLM.

### Exact fix
Set an explicit `express.json()` limit and add per-field length validation in the
two affected endpoints.

**1. Set explicit body parser limit:**
```ts
// src/server.ts
app.use(express.json({ limit: '200kb' }));
```

**2. Field-level guards:**
```ts
// POST /cv
const CV_MIN = 100;
const CV_MAX = 50_000; // ~12,500 words, generous for any real CV

if (typeof cvText !== 'string' || cvText.length < CV_MIN) {
  return res.status(400).json({ error: 'cvText is too short', code: 'CV_TOO_SHORT' });
}
if (cvText.length > CV_MAX) {
  return res.status(400).json({ error: 'cvText exceeds maximum length', code: 'CV_TOO_LONG' });
}
```

```ts
// POST /analyze
const JD_MIN = 100;
const JD_MAX = 20_000; // ~5,000 words, covers any realistic job description

if (typeof jobDescription !== 'string' || jobDescription.length < JD_MIN) {
  return res.status(400).json({ error: 'jobDescription is too short', code: 'JD_TOO_SHORT' });
}
if (jobDescription.length > JD_MAX) {
  return res.status(400).json({ error: 'jobDescription exceeds maximum length', code: 'JD_TOO_LONG' });
}
```

Apply the same JD guards to each item inside the `POST /analyze/batch` jobs loop.

### Acceptance criteria
- `POST /cv` with `cvText` of 50,001 characters → 400, `CV_TOO_LONG`.
- `POST /cv` with `cvText` of 50 characters → 400, `CV_TOO_SHORT`.
- `POST /cv` with `cvText` of 500 characters → 200, saved normally.
- `POST /analyze` with `jobDescription` of 20,001 characters → 400, `JD_TOO_LONG`.
- `POST /analyze` with `jobDescription` of 50 characters → 400, `JD_TOO_SHORT`.
- Body larger than 200kb → 413 from Express before handlers run.

---

## M4 — Predictable session IDs

### Current problem
Session IDs are generated as `session-${Date.now()}` (and `session-${Date.now()}-${index}`
for batch). `Date.now()` returns a millisecond timestamp. Anyone who knows
approximately when an analysis was run can guess the session ID within a narrow
window and call `POST /generate-materials` to trigger LLM calls against that
session.

### Exact fix
Replace `Date.now()` with `crypto.randomUUID()` (Node built-in since v14.17,
no new dependency required).

```ts
import { randomUUID } from 'crypto';

// POST /analyze
const sessionId = randomUUID();

// POST /analyze/batch (inside map)
const sessionId = randomUUID();
```

`crypto` is already imported in `server.ts` via `require('crypto')` — consolidate
to a top-level import.

### Acceptance criteria
- Two consecutive calls to `POST /analyze` produce session IDs that share no
  predictable pattern (UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`).
- `POST /generate-materials` with a fabricated timestamp-style ID returns 404.
- `POST /generate-materials` with a valid UUID session ID returns the materials.
