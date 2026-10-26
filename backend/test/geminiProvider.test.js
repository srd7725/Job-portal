import test from "node:test";
import assert from "node:assert/strict";
import {
    describeGeminiProviderError,
    generateWithGeminiRetries,
    getGeminiRetryDelayMs,
    resolveGeminiModel
} from "../utils/geminiProvider.js";

test("uses the current Gemini Flash model and migrates the retired 2.5 model setting", () => {
    assert.equal(resolveGeminiModel(undefined), "gemini-3.1-flash-lite");
    assert.equal(resolveGeminiModel(""), "gemini-3.1-flash-lite");
    assert.equal(resolveGeminiModel("gemini-2.5-flash"), "gemini-3.1-flash-lite");
    assert.equal(resolveGeminiModel("gemini-3.8-flash"), "gemini-3.8-flash");
    assert.equal(resolveGeminiModel(" gemini-3.1-flash-lite "), "gemini-3.1-flash-lite");
});

test("classifies Gemini temporary throttling separately from exhausted quota", () => {
    const throttled = describeGeminiProviderError({
        status: 429,
        message: "Quota exceeded for requests per minute."
    });
    assert.equal(throttled.retryable, true);
    assert.equal(throttled.status, 429);

    const exhausted = describeGeminiProviderError({
        status: 429,
        message: "Quota exceeded for free_tier_requests. Check your plan and billing."
    });
    assert.equal(exhausted.retryable, false);
    assert.equal(exhausted.status, 503);
    assert.match(exhausted.message, /quota is exhausted/);
});

test("reports invalid keys and model configuration without retrying", () => {
    assert.match(
        describeGeminiProviderError({ status: 401, message: "Invalid API key" }).message,
        /GEMINI_API_KEY/
    );
    assert.match(
        describeGeminiProviderError({ status: 404, message: "Not found" }).message,
        /GEMINI_MODEL=gemini-3\.1-flash-lite/
    );
    assert.equal(describeGeminiProviderError({ status: 403 }).retryable, false);
});

test("retries transient Gemini errors with bounded exponential backoff", async () => {
    assert.equal(getGeminiRetryDelayMs(0), 2000);
    assert.equal(getGeminiRetryDelayMs(1), 4000);
    assert.equal(getGeminiRetryDelayMs(5), 8000);

    let calls = 0;
    const delays = [];
    const result = await generateWithGeminiRetries(async () => {
        calls += 1;
        if (calls < 3) {
            throw { status: 429, message: "Requests per minute rate limit exceeded" };
        }
        return "generated";
    }, { sleepImplementation: async (delay) => delays.push(delay) });

    assert.equal(result, "generated");
    assert.equal(calls, 3);
    assert.deepEqual(delays, [2000, 4000]);
});

test("does not retry exhausted quota and caps retries for temporary failures", async () => {
    let quotaCalls = 0;
    await assert.rejects(
        generateWithGeminiRetries(async () => {
            quotaCalls += 1;
            throw { status: 429, message: "Quota exceeded for free_tier_requests" };
        }, { sleepImplementation: async () => assert.fail("Quota errors should not be retried.") }),
        (error) => error.status === 503 && /quota is exhausted/.test(error.message)
    );
    assert.equal(quotaCalls, 1);

    let transientCalls = 0;
    await assert.rejects(
        generateWithGeminiRetries(async () => {
            transientCalls += 1;
            throw { status: 503, message: "Service unavailable" };
        }, { sleepImplementation: async () => {} }),
        (error) => error.status === 503 && /temporarily unavailable/.test(error.message)
    );
    assert.equal(transientCalls, 3);
});
