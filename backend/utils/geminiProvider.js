import { GoogleGenAI } from "@google/genai";

const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 8000;
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const RETIRED_MODEL = "gemini-2.5-flash";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const resolveGeminiModel = (configuredModel) => {
    const model = typeof configuredModel === "string" ? configuredModel.trim() : "";
    return !model || model === RETIRED_MODEL ? DEFAULT_MODEL : model;
};

export const describeGeminiProviderError = (providerError) => {
    const status = Number(providerError?.status || providerError?.response?.status);
    const providerMessage = typeof providerError?.message === "string" ? providerError.message : "";
    const message = providerMessage.toLowerCase();

    if (status === 429) {
        const temporaryRateLimit = /rate.?limit|too many requests|per minute|per second|retry(?:\s|[-_])?after|retry in/.test(message);
        return {
            status: temporaryRateLimit ? 429 : 503,
            retryable: temporaryRateLimit,
            message: temporaryRateLimit
                ? "Gemini is temporarily rate-limiting requests. Please wait briefly and try again."
                : "Gemini API quota is exhausted or unavailable for this model. Check your Google AI Studio usage, free-tier limits, and model access."
        };
    }

    if (status === 401 || /api.?key.{0,20}(invalid|not valid|expired)/.test(message)) {
        return { status: 503, retryable: false, message: "Gemini rejected the API key. Check GEMINI_API_KEY in the backend environment." };
    }
    if (status === 403) {
        return { status: 503, retryable: false, message: "Gemini denied access. Check API key permissions, region availability, and model access." };
    }
    if (status === 404) {
        return {
            status: 503,
            retryable: false,
            message: `The configured Gemini model is unavailable. Set GEMINI_MODEL=${DEFAULT_MODEL} in the backend environment.`
        };
    }
    if (status === 503 || status === 502 || status === 504) {
        return { status: 503, retryable: true, message: "Gemini is temporarily unavailable. Please try again shortly." };
    }
    return { status: 502, retryable: false, message: "Gemini could not complete the request. Check the backend configuration and try again." };
};

export const getGeminiRetryDelayMs = (retryNumber) =>
    Math.min(BASE_RETRY_DELAY_MS * (2 ** retryNumber), MAX_RETRY_DELAY_MS);

const providerError = (details) => Object.assign(new Error(details.message), {
    status: details.status,
    retryable: details.retryable
});

export const generateWithGeminiRetries = async (
    generate,
    { sleepImplementation = sleep, maxRetries = MAX_RETRIES } = {}
) => {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            return await generate();
        } catch (error) {
            console.error("Gemini API diagnostic:", {
                status: error?.status || error?.response?.status,
                message: error?.message
            });
            const details = error?.name === "AbortError"
                ? { status: 504, retryable: true, message: "Gemini is temporarily unavailable. Please try again shortly." }
                : describeGeminiProviderError(error);
            if (!details.retryable || attempt === maxRetries) throw providerError(details);

            console.warn(`Gemini temporary provider error; retrying (${maxRetries - attempt} retries remaining).`);
            await sleepImplementation(getGeminiRetryDelayMs(attempt));
        }
    }
    throw new Error("Gemini retry attempts were exhausted.");
};

export const requestGeminiJson = async ({ system, prompt }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw Object.assign(new Error("AI features are not configured. Set GEMINI_API_KEY on the backend."), { status: 503 });
    }

    const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
            timeout: Number(process.env.GEMINI_REQUEST_TIMEOUT_MS) || 30000,
            retryOptions: { attempts: 1 }
        }
    });

    const configuredModel = process.env.GEMINI_MODEL;
    const model = resolveGeminiModel(configuredModel);
    if (configuredModel?.trim() === RETIRED_MODEL) {
        console.warn(`GEMINI_MODEL=${RETIRED_MODEL} is no longer available to new users; using ${DEFAULT_MODEL}.`);
    }

    const response = await generateWithGeminiRetries(() => ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction: system,
            responseMimeType: "application/json"
        }
    }));
    if (typeof response.text !== "string" || !response.text.trim()) {
        throw Object.assign(new Error("Gemini returned an empty response. Please try again."), { status: 502 });
    }
    try {
        return JSON.parse(response.text);
    } catch {
        throw Object.assign(new Error("Gemini returned an invalid response. Please try again."), { status: 502 });
    }
};
