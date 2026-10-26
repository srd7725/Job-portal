const invalidQuestionSet = (message = "The AI generated an invalid interview question set. Please try again.") =>
    Object.assign(new Error(message), { status: 502 });

export const interviewQuestionMix = (interviewType, totalCount) => {
    const writtenCount = ["Technical Interview", "Mixed Interview"].includes(interviewType)
        ? (totalCount >= 10 ? 3 : totalCount >= 7 ? 2 : 1)
        : 0;
    return { totalCount, writtenCount, mcqCount: totalCount - writtenCount };
};

const shuffleMcq = (options, correctOption) => {
    const indexed = options.map((option, index) => ({ option, index }));
    for (let index = indexed.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [indexed[index], indexed[swapIndex]] = [indexed[swapIndex], indexed[index]];
    }
    return {
        options: indexed.map((item) => item.option),
        correctOption: indexed.findIndex((item) => item.index === correctOption)
    };
};

const isWrittenItem = (item) =>
    item?.questionType === "written" ||
    item?.options == null ||
    (Array.isArray(item?.options) && item.options.length === 0);

export const validateInterviewQuestions = (result, expectedCount, { writtenCount = 0 } = {}) => {
    if (!Array.isArray(result?.questions) || result.questions.length !== expectedCount) {
        throw invalidQuestionSet();
    }
    const mcqCount = expectedCount - writtenCount;
    const seen = new Set();
    return result.questions.map((item, index) => {
        if (typeof item?.question !== "string" || item.question.trim().length < 10 || item.question.length > 1000) {
            throw invalidQuestionSet("The AI generated an invalid interview question. Please try again.");
        }
        const normalized = item.question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        if (seen.has(normalized)) {
            throw invalidQuestionSet("The AI generated repetitive interview questions. Please try again.");
        }
        seen.add(normalized);
        const expectWritten = index >= mcqCount;
        if (expectWritten !== isWrittenItem(item)) {
            throw invalidQuestionSet("The AI generated the wrong mix of multiple-choice and written questions. Please try again.");
        }
        if (expectWritten) {
            return {
                question: item.question.trim(),
                category: String(item.category || "Hands-on").slice(0, 100),
                questionType: "written",
                options: [],
                correctOption: null
            };
        }
        if (!Array.isArray(item.options) || item.options.length !== 4 ||
            item.options.some((option) => typeof option !== "string" || !option.trim() || option.length > 500) ||
            new Set(item.options.map((option) => option.trim().toLowerCase())).size !== 4 ||
            !Number.isInteger(item.correctOption) || item.correctOption < 0 || item.correctOption > 3) {
            throw invalidQuestionSet("The AI generated an invalid multiple-choice question. Please try again.");
        }
        const shuffled = shuffleMcq(item.options.map((option) => option.trim()), item.correctOption);
        return {
            question: item.question.trim(),
            category: String(item.category || "General").slice(0, 100),
            questionType: "mcq",
            options: shuffled.options,
            correctOption: shuffled.correctOption
        };
    });
};

export const isMultipleChoiceQuestion = (question) =>
    question?.questionType === "mcq" ||
    (Array.isArray(question?.options) && question.options.length === 4 && Number.isInteger(question.correctOption));

export const serializeInterview = (interview) => {
    const result = typeof interview?.toObject === "function" ? interview.toObject() : interview;
    if (!result) return result;
    return {
        ...result,
        questions: result.questions?.map(({ correctOption, ...question }) => question) || []
    };
};
