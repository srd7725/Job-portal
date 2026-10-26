# Backend setup

## Create the first super-admin

Super-admin accounts cannot be created through public signup. Configure these
variables in the backend environment before running the one-time seed command:

```text
MONGO_URI=your-mongodb-connection-string
SUPERADMIN_NAME=Portal Administrator
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PHONE=1234567890
SUPERADMIN_PASSWORD=use-a-unique-password-at-least-12-characters-long
```

From the `backend` directory, run:

```text
npm run seed:admin
```

The command creates a new super-admin and refuses to modify an account if the
email is already registered. Remove `SUPERADMIN_PASSWORD` from the environment
after setup. Sign in through the regular login screen using the **Super Admin**
role; the protected dashboard is at `/super-admin`.

## Moderation behavior

- Companies and jobs created after moderation is enabled start as pending.
- Existing records with no moderation status remain visible and are treated as
  approved.
- Pending or rejected company/job listings are excluded from public job search.
- Only super-admin accounts can access admin data and moderation endpoints.
- Students and recruiters can report job listings. Recruiters can also report
  applicants; reports are reviewed from the admin dashboard.

## AI interview, resume matching, and education timeline

Configure the mock interview provider and other AI-backed features separately.
Keys are used only by the backend and must not be added to Vite environment
variables or committed to source control.

The PDF parser currently requires Node.js `>=20.16` or `>=22.3`.

```text
# Mock interview: Google Gemini API (get a key at https://aistudio.google.com/apikey)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_REQUEST_TIMEOUT_MS=30000

# Resume feedback and education extraction retain the existing OpenAI-compatible provider
AI_API_KEY=your-provider-api-key
AI_MODEL=gpt-4o-mini
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_REQUEST_TIMEOUT_MS=30000
```

`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`, a low-latency model that
supports structured JSON output. The retired `gemini-2.5-flash` setting is
automatically migrated to this default. Free-tier access and quotas can vary by
account, region, and availability; review Google AI Studio's model and usage
page if the provider reports quota exhaustion. Interview
question generation, answer evaluation, scoring, and interview reports use
Google's official `@google/genai` SDK. Install it from the `backend` directory
with `npm install @google/genai`.

`AI_API_URL` remains optional when using the default OpenAI-compatible endpoint.
Text-based PDF parsing and deterministic resume/job matching work without an
AI key; in that case the ATS report explicitly identifies AI feedback as
unavailable, and applying remains possible. Mock interview generation,
evaluation, and AI education extraction require a configured provider. Resume
text is processed in memory, common contact details are removed before AI
feedback/extraction requests, and extracted resume text is not persisted.
If Gemini requests return a quota error, review the Google AI Studio usage and
free-tier limits. Temporary Gemini rate limits and service outages are retried
with bounded backoff; exhausted quota, invalid keys, and unavailable models are
reported without repeated retries. For the remaining OpenAI-compatible features,
check that provider's API billing, available credits, usage limits, and model
access. ChatGPT subscriptions do not include OpenAI API usage.

Optional ATS weight overrides are numeric percentages; they are normalized
before scoring, so they do not need to sum to 100:

```text
ATS_WEIGHT_REQUIRED_SKILLS=45
ATS_WEIGHT_KEYWORDS=25
ATS_WEIGHT_EXPERIENCE=15
ATS_WEIGHT_QUALIFICATIONS=10
ATS_WEIGHT_PROJECTS=5
```

The backend should listen on the URL configured by the frontend API constants
(the current frontend defaults to `http://localhost:8000`). Set `PORT=8000` in
the backend environment or update the frontend constants for your deployment.

New protected endpoints:

- `POST /api/v1/ai/interviews`
- `POST /api/v1/ai/interviews/:id/answer`
- `POST /api/v1/ai/interviews/:id/complete`
- `GET /api/v1/ai/interviews` and `GET /api/v1/ai/interviews/:id`
- `POST /api/v1/ai/resume/analyze/:jobId` and `GET /api/v1/ai/resume/analyses`
- `POST /api/v1/ai/recruiter/applications/:applicationId/analyze`
- `GET /api/v1/ai/recruiter/applications/:applicationId/analysis`
- `POST /api/v1/ai/recruiter/jobs/:jobId/analyze` (authorized manual PDF analysis)
- `GET /api/v1/ai/recruiter/jobs/:jobId/manual-analyses`
- `GET /api/v1/education/timeline`, `PUT /api/v1/education/timeline`
- `POST /api/v1/education/analyze`
- `PUT /api/v1/job/:id/education-gap-preference`
- `POST /api/v1/application/:id/clarification`

Run backend utility tests with `npm test` from this directory. Tests use mocked
provider calls and do not require API keys.
