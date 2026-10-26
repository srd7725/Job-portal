export const validateInterviewQuestions = (result, expectedCount) => {
    if (!Array.isArray(result?.questions) || result.questions.length !== expectedCount) {
        throw Object.assign(new Error("The AI generated an invalid interview question set. Please try again."), { status: 502 });
    }
    const seen = new Set();
    return result.questions.map((item) => {
        if (typeof item?.question !== "string" || item.question.trim().length < 10 || item.question.length > 1000) {
            throw Object.assign(new Error("The AI generated an invalid interview question. Please try again."), { status: 502 });
        }
        if (!Array.isArray(item.options) || item.options.length !== 4 ||
            item.options.some((option) => typeof option !== "string" || !option.trim() || option.length > 500) ||
            new Set(item.options.map((option) => option.trim().toLowerCase())).size !== 4 ||
            !Number.isInteger(item.correctOption) || item.correctOption < 0 || item.correctOption > 3) {
            throw Object.assign(new Error("The AI generated an invalid multiple-choice question. Please try again."), { status: 502 });
        }
        const normalized = item.question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        if (seen.has(normalized)) {
            throw Object.assign(new Error("The AI generated repetitive interview questions. Please try again."), { status: 502 });
        }
        seen.add(normalized);
        return {
            question: item.question.trim(),
            category: String(item.category || "General").slice(0, 100),
            options: item.options.map((option) => option.trim()),
            correctOption: item.correctOption
        };
    });
};

export const serializeInterview = (interview) => {
    const result = typeof interview?.toObject === "function" ? interview.toObject() : interview;
    if (!result) return result;
    return {
        ...result,
        questions: result.questions?.map(({ correctOption, ...question }) => question) || []
    };
};
