import test from "node:test";
import assert from "node:assert/strict";
import { extractPdfText, scoreResumeAgainstJob, sanitizeResumeTextForAi } from "../utils/resumeAnalysis.js";
import {
    describeAiProviderError,
    fetchWithRateLimitRetry,
    getAiRetryDelayMs
} from "../utils/aiProvider.js";

const createTextPdf = (text) => {
    const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    ];
    let document = "%PDF-1.4\n";
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
        offsets.push(Buffer.byteLength(document));
        document += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(document);
    document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    document += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
    document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(document, "binary");
};

test("normalizes equivalent skill names and explains missing job skills", () => {
    const result = scoreResumeAgainstJob({
        resumeText: "Built projects using React.js and JavaScript. Education: Bachelor degree.",
        job: {
            title: "Frontend Developer",
            description: "Build web applications using React and Node.js.",
            requirements: ["React.js", "Node.js", "JavaScript"]
        }
    });

    assert.deepEqual(result.matchedSkills, ["React", "JavaScript"]);
    assert.deepEqual(result.missingSkills, ["Node.js"]);
    assert.equal(Number.isInteger(result.score), true);
    assert.equal(result.score >= 0 && result.score <= 100, true);
});

test("resume scoring is deterministic for identical evidence", () => {
    const input = {
        resumeText: "Python, SQL, data analysis, built reporting projects.",
        job: { title: "Data Analyst", description: "Python and SQL required", requirements: ["Python", "SQL"] }
    };
    assert.deepEqual(scoreResumeAgainstJob(input), scoreResumeAgainstJob(input));
});

test("redacts common contact information before sending resume text to an AI provider", () => {
    const sanitized = sanitizeResumeTextForAi("Contact: name@example.com\nPhone: +1 (555) 123-4567\nPython and data projects.");
    assert.equal(sanitized.includes("name@example.com"), false);
    assert.equal(sanitized.includes("555"), false);
    assert.equal(sanitized.includes("Python"), true);
});

test("parses selectable PDF text and rejects image-only or invalid files", async () => {
    const text = await extractPdfText(createTextPdf("A sufficiently long resume sample with JavaScript and project experience."));
    assert.match(text, /JavaScript/);
    await assert.rejects(
        extractPdfText(createTextPdf("Short sample.")),
        (error) => error.status === 422
    );
    await assert.rejects(
        extractPdfText(Buffer.from("not a pdf")),
        (error) => error.status === 400
    );
});

test("distinguishes AI quota exhaustion from temporary provider rate limits", () => {
    const quotaError = describeAiProviderError(429, "insufficient_quota");
    assert.equal(quotaError.status, 503);
    assert.match(quotaError.message, /billing, credits, and usage limits/);

    const rateLimit = describeAiProviderError(429, "rate_limit_exceeded", "12.4");
    assert.equal(rateLimit.status, 429);
    assert.match(rateLimit.message, /13 seconds/);

    const invalidKey = describeAiProviderError(401, "invalid_api_key");
    assert.equal(invalidKey.status, 503);
    assert.match(invalidKey.message, /rejected the API key/);
});

test("uses bounded exponential delays and respects Retry-After up to the cap", () => {
    assert.equal(getAiRetryDelayMs(0), 500);
    assert.equal(getAiRetryDelayMs(1), 1000);
    assert.equal(getAiRetryDelayMs(2), 2000);
    assert.equal(getAiRetryDelayMs(5), 4000);
    assert.equal(getAiRetryDelayMs(0, 2), 2000);
    assert.equal(getAiRetryDelayMs(0, 20), 4000);
});

test("retries temporary rate limits with exponential backoff until the provider succeeds", async () => {
    let calls = 0;
    const delays = [];
    const response = await fetchWithRateLimitRetry("https://example.test", {}, {
        fetchImplementation: async () => {
            calls += 1;
            return calls < 3
                ? new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429 })
                : new Response("ok", { status: 200 });
        },
        sleepImplementation: async (delay) => delays.push(delay)
    });

    assert.equal(response.status, 200);
    assert.equal(calls, 3);
    assert.deepEqual(delays, [500, 1000]);
});

test("does not retry an exhausted quota or an unclassified 429", async () => {
    let calls = 0;
    const rateLimitedFetch = async (body) => fetchWithRateLimitRetry("https://example.test", {}, {
        fetchImplementation: async () => {
            calls += 1;
            return new Response(JSON.stringify({ error: body }), { status: 429 });
        },
        sleepImplementation: async () => assert.fail("Non-retryable errors must not wait.")
    });

    await assert.rejects(rateLimitedFetch({ code: "insufficient_quota" }), (error) => error.status === 503);
    await assert.rejects(rateLimitedFetch({ code: "billing_hard_limit_reached" }), (error) => error.status === 503);
    await assert.rejects(rateLimitedFetch({ code: "unknown_error" }), (error) => error.status === 429 && !error.retryable);
    assert.equal(calls, 3);
});
