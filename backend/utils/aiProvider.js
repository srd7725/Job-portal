const AI_API_URL = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 30000;
const MAX_RATE_LIMIT_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 4000;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const describeAiProviderError = (status, providerCode, retryAfter, providerMessage = "") => {
    const code = typeof providerCode === "string" ? providerCode.toLowerCase() : "";
    const message = typeof providerMessage === "string" ? providerMessage.toLowerCase() : "";
    const quotaError = ["insufficient_quota", "billing_hard_limit_reached", "quota_exceeded"].includes(code) ||
        /quota|billing|credits/.test(message);

    if (status === 429 && quotaError) {
        return {
            status: 503,
            retryable: false,
            retryAfterSeconds: null,
            message: "OpenAI API credits or quota are exhausted. Check your billing, credits, and usage limits."
        };
    }

    if (status === 429) {
        const numericRetryAfter = Number(retryAfter);
        const parsedRetryAfter = retryAfter ? Date.parse(retryAfter) : NaN;
        const seconds = Number.isFinite(numericRetryAfter)
            ? numericRetryAfter
            : Number.isFinite(parsedRetryAfter)
                ? Math.max(0, (parsedRetryAfter - Date.now()) / 1000)
                : null;
        const retryable = ["rate_limit_exceeded", "rate_limit_error"].includes(code) ||
            (!code && /rate.?limit|too many requests/.test(message));
        return {
            status: 429,
            retryable,
            retryAfterSeconds: seconds,
            message: Number.isFinite(seconds) && seconds > 0
                ? `The AI provider rate limit was reached. Please retry in about ${Math.ceil(seconds)} seconds.`
                : retryable
                    ? "The AI provider rate limit was reached after automatic retries. Please wait a little and try again."
                    : "OpenAI returned HTTP 429 without identifying a temporary rate limit. Check the backend logs and your API account quota."
        };
    }

    if (status === 401) {
        return { status: 503, retryable: false, message: "The AI provider rejected the API key. Check AI_API_KEY on the backend." };
    }
    if (status === 403) {
        return { status: 503, retryable: false, message: "The AI provider denied access. Check the API key permissions and model access." };
    }
    return { status: 502, retryable: false, message: "The AI provider could not complete the request. Please try again later." };
};

export const getAiRetryDelayMs = (retryNumber, retryAfterSeconds) => {
    const exponentialDelay = Math.min(BASE_RETRY_DELAY_MS * (2 ** retryNumber), MAX_RETRY_DELAY_MS);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return Math.min(Math.max(exponentialDelay, retryAfterSeconds * 1000), MAX_RETRY_DELAY_MS);
    }
    return exponentialDelay;
};

const readProviderError = async (response) => {
    let body = {};
    try {
        body = await response.json();
    } catch {
        body = {};
    }
    const providerCode = body?.error?.code || body?.error?.type || "";
    const details = describeAiProviderError(
        response.status,
        providerCode,
        response.headers.get("retry-after"),
        body?.error?.message
    );
    const error = new Error(details.message);
    error.status = details.status;
    error.retryable = details.retryable;
    error.retryAfterSeconds = details.retryAfterSeconds;
    error.providerCode = providerCode;
    return error;
};

export const fetchWithRateLimitRetry = async (
    url,
    options,
    { fetchImplementation = fetch, sleepImplementation = sleep, maxRetries = MAX_RATE_LIMIT_RETRIES } = {}
) => {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const response = await fetchImplementation(url, options);
        if (response.status !== 429) return response;

        const error = await readProviderError(response.clone());
        if (!error.retryable || attempt === maxRetries) throw error;

        const delay = getAiRetryDelayMs(attempt, error.retryAfterSeconds);
        console.warn(`OpenAI temporary rate limit; retrying (${maxRetries - attempt} retries remaining).`);
        await sleepImplementation(delay);
    }
    throw new Error("OpenAI rate-limit retry attempts were exhausted.");
};

export const requestAiJson = async ({ system, prompt }) => {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
        throw Object.assign(new Error("AI features are not configured. Set AI_API_KEY on the backend."), { status: 503 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetchWithRateLimitRetry(AI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            }),
            signal: controller.signal
        });
        if (!response.ok) throw await readProviderError(response);

        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
            throw Object.assign(new Error("The AI provider returned an empty response. Please try again."), { status: 502 });
        }
        try {
            return JSON.parse(content);
        } catch {
            throw Object.assign(new Error("The AI provider returned an invalid response. Please try again."), { status: 502 });
        }
    } catch (error) {
        if (error.name === "AbortError") {
            throw Object.assign(new Error("The AI provider request timed out. Please try again."), { status: 504 });
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};
