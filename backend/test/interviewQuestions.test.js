import test from "node:test";
import assert from "node:assert/strict";
import { interviewQuestionMix, validateInterviewQuestions } from "../utils/interviewQuestions.js";

const mcq = (question, correctOption = 0) => ({
    question,
    category: "Java",
    questionType: "mcq",
    options: ["final int x = 1;", "const int x = 1;", "immutable int x = 1;", "static int x = 1;"],
    correctOption
});

test("technical interviews add written questions only at the end", () => {
    assert.deepEqual(interviewQuestionMix("Technical Interview", 4), { totalCount: 4, writtenCount: 1, mcqCount: 3 });
    assert.deepEqual(interviewQuestionMix("Technical Interview", 7), { totalCount: 7, writtenCount: 2, mcqCount: 5 });
    assert.deepEqual(interviewQuestionMix("Technical Interview", 10), { totalCount: 10, writtenCount: 3, mcqCount: 7 });
    assert.deepEqual(interviewQuestionMix("HR Interview", 4), { totalCount: 4, writtenCount: 0, mcqCount: 4 });
});

test("accepts an all-MCQ set and keeps the correct option after shuffle", () => {
    const questions = [
        mcq("Which of the following is the correct way to declare an immutable constant in Java?"),
        mcq("Which collection preserves insertion order in Java?", 1)
    ];
    const validated = validateInterviewQuestions({ questions }, 2);
    assert.equal(validated.length, 2);
    assert.equal(validated[0].questionType, "mcq");
    assert.equal(validated[0].options[validated[0].correctOption], "final int x = 1;");
    assert.equal(validated[1].options[validated[1].correctOption], "const int x = 1;");
});

test("accepts technical MCQs followed by written SQL or pseudocode items", () => {
    const questions = [
        mcq("Which HTTP status code means a resource was created?"),
        mcq("Which SQL clause filters grouped rows?", 2),
        {
            question: "Write a SQL query that returns employees hired after 2020.",
            category: "SQL",
            questionType: "written",
            options: [],
            correctOption: null
        }
    ];
    const validated = validateInterviewQuestions({ questions }, 3, { writtenCount: 1 });
    assert.equal(validated.filter((item) => item.questionType === "mcq").length, 2);
    assert.equal(validated[2].questionType, "written");
    assert.deepEqual(validated[2].options, []);
    assert.equal(validated[2].correctOption, null);
});

test("rejects a written question in the MCQ section", () => {
    assert.throws(() => validateInterviewQuestions({
        questions: [
            {
                question: "Write a SQL query that returns all users.",
                questionType: "written",
                options: [],
                correctOption: null
            },
            mcq("Which keyword creates a class in Java?")
        ]
    }, 2, { writtenCount: 1 }));
});
