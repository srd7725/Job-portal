import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Interview } from "../models/interview.model.js";
import { Job } from "../models/job.model.js";
import { Application } from "../models/application.model.js";
import { ResumeAnalysis } from "../models/resumeAnalysis.model.js";
import { requestAiJson } from "../utils/aiProvider.js";
import { requestGeminiJson } from "../utils/geminiProvider.js";
import { serializeInterview, validateInterviewQuestions } from "../utils/interviewQuestions.js";
import { extractPdfText, hashResume, sanitizeResumeTextForAi, scoreResumeAgainstJob } from "../utils/resumeAnalysis.js";

const resumeDirectory = fileURLToPath(new URL("../private/resumes/", import.meta.url));
const interviewTypes = ["Technical Interview", "HR Interview", "Behavioral Interview", "Mixed Interview"];
const allowedDifficulties = ["Beginner", "Intermediate", "Advanced"];

export const createInterview = async (req, res) => {
    try {
        const { role, interviewType, difficulty, experienceLevel, durationMinutes } = req.body || {};
        if (typeof role !== "string" || role.trim().length < 2 || role.length > 100 ||
            !interviewTypes.includes(interviewType) || !allowedDifficulties.includes(difficulty) ||
            !["Fresher", "0–1 years", "1–3 years", "3+ years"].includes(experienceLevel) ||
            ![10, 20, 30].includes(Number(durationMinutes))) {
            return res.status(400).json({ message: "Please provide valid interview setup details.", success: false });
        }
        const count = Number(durationMinutes) === 10 ? 4 : Number(durationMinutes) === 20 ? 7 : 10;
        const previousInterviews = await Interview.find({ student: req.id, status: "completed" })
            .sort({ completedAt: -1 })
            .limit(3)
            .select("role interviewType report.strongTopics report.weakTopics");
        const result = await requestGeminiJson({
            system: "Create practical multiple-choice interview questions. Return JSON {questions:[{question:string,category:string,options:[string,string,string,string],correctOption:number}]}. Every question must have exactly four distinct plausible options and exactly one correct option. correctOption is the zero-based index of the correct option. Do not add explanations or repeat questions from the supplied context. All questions must fit the specified role, interview type, and difficulty. Beginner questions test fundamentals, intermediate questions test application and trade-offs, and advanced questions test deeper reasoning and edge cases.",
            prompt: JSON.stringify({
                role: role.trim(),
                interviewType,
                difficulty,
                experienceLevel,
                count,
                previousContext: previousInterviews.map((item) => ({
                    role: item.role,
                    interviewType: item.interviewType,
                    strongTopics: item.report?.strongTopics || [],
                    weakTopics: item.report?.weakTopics || []
                }))
            })
        });
        const questions = validateInterviewQuestions(result, count);
        const interview = await Interview.create({
            student: req.id,
            role: role.trim(),
            interviewType,
            difficulty,
            experienceLevel,
            durationMinutes: Number(durationMinutes),
            questions
        });
        return res.status(201).json({ interview: serializeInterview(interview), success: true });
    } catch (error) {
        console.error("Interview creation failed:", error.message);
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to start the interview right now.",
            success: false
        });
    }
};

const ownsInterview = async (id, student) => {
    if (!mongoose.isValidObjectId(id)) return null;
    return Interview.findOne({ _id: id, student }).select("+questions.correctOption");
};

export const evaluateInterviewAnswer = async (req, res) => {
    try {
        const interview = await ownsInterview(req.params.id, req.id);
        if (!interview) return res.status(404).json({ message: "Interview not found.", success: false });
        if (interview.status !== "in_progress") return res.status(409).json({ message: "This interview is already complete.", success: false });
        const { questionId, answer } = req.body || {};
        if (typeof answer !== "string" || answer.trim().length < 2 || answer.length > 10000) {
            return res.status(400).json({ message: "Enter an answer between 2 and 10,000 characters.", success: false });
        }
        const question = interview.questions.id(questionId);
        if (!question || question.answer) return res.status(400).json({ message: "This question is not available for an answer.", success: false });
        const isMultipleChoice = Array.isArray(question.options) && question.options.length === 4 &&
            Number.isInteger(question.correctOption);
        if (isMultipleChoice && !question.options.includes(answer.trim())) {
            return res.status(400).json({ message: "Select one of the available answer choices.", success: false });
        }
        const result = await requestGeminiJson({
            system: isMultipleChoice
                ? "Evaluate the selected multiple-choice answer against the provided correct answer. State clearly whether it is correct and explain why using only the supplied question and options. Return JSON with numeric score (0-100), technicalAccuracy, completeness, relevance, clarity, suggestedImprovements (array of strings), exampleImprovedAnswer, and followUpQuestion (always null). Give practice feedback, not hiring conclusions."
                : "Evaluate interview answers fairly and constructively. Never claim facts not present. Return JSON with numeric score (0-100), technicalAccuracy, completeness, relevance, clarity, suggestedImprovements (array of strings), exampleImprovedAnswer, and followUpQuestion (always null). Give practice feedback, not hiring conclusions.",
            prompt: JSON.stringify({
                role: interview.role,
                interviewType: interview.interviewType,
                difficulty: interview.difficulty,
                question: question.question,
                options: question.options,
                correctAnswer: isMultipleChoice ? question.options[question.correctOption] : undefined,
                previousContext: interview.questions.filter((item) => item.answer).map((item) => ({ question: item.question, answer: item.answer })),
                answer: answer.trim()
            })
        });
        if (!Number.isFinite(result?.score) || result.score < 0 || result.score > 100 ||
            !["technicalAccuracy", "completeness", "relevance", "clarity", "exampleImprovedAnswer"].every((key) => typeof result[key] === "string") ||
            !Array.isArray(result.suggestedImprovements)) {
            return res.status(502).json({ message: "The AI returned an invalid evaluation. Please try again.", success: false });
        }
        question.answer = answer.trim();
        question.evaluation = {
            score: isMultipleChoice
                ? (answer.trim() === question.options[question.correctOption] ? 100 : 0)
                : Math.round(result.score),
            ...(isMultipleChoice ? {
                isCorrect: answer.trim() === question.options[question.correctOption],
                correctAnswer: question.options[question.correctOption]
            } : {}),
            technicalAccuracy: result.technicalAccuracy.slice(0, 1200),
            completeness: result.completeness.slice(0, 1200),
            relevance: result.relevance.slice(0, 1200),
            clarity: result.clarity.slice(0, 1200),
            suggestedImprovements: result.suggestedImprovements.slice(0, 6).map((item) => String(item).slice(0, 500)),
            exampleImprovedAnswer: result.exampleImprovedAnswer.slice(0, 3000)
        };
        if (!isMultipleChoice && typeof result.followUpQuestion === "string" &&
            result.followUpQuestion.trim().length >= 10 &&
            interview.questions.length < 12 &&
            !interview.questions.some((item) =>
                item.question.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ===
                result.followUpQuestion.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
            )) {
            interview.questions.push({
                question: result.followUpQuestion.trim().slice(0, 1000),
                category: `Follow-up: ${question.category}`
            });
        }
        await interview.save();
        const nextQuestion = interview.questions.find((item) => !item.answer);
        return res.status(200).json({
            evaluation: question.evaluation,
            nextQuestion: nextQuestion ? serializeInterview({ questions: [nextQuestion] }).questions[0] : null,
            success: true
        });
    } catch (error) {
        console.error("Interview answer evaluation failed:", error.message);
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to evaluate this answer right now.",
            success: false
        });
    }
};

export const completeInterview = async (req, res) => {
    try {
        const interview = await ownsInterview(req.params.id, req.id);
        if (!interview) return res.status(404).json({ message: "Interview not found.", success: false });
        if (interview.status === "completed") return res.status(200).json({ interview, success: true });
        const evaluated = interview.questions.filter((item) => item.evaluation);
        const result = await requestGeminiJson({
            system: "Create an evidence-based interview practice summary. Return JSON {overallSummary:string,strongTopics:string[],weakTopics:string[],preparationTopics:string[],recommendations:string[]}. Do not claim employability or invent evidence.",
            prompt: JSON.stringify({
                role: interview.role,
                questions: evaluated.map((item) => ({ question: item.question, answer: item.answer, evaluation: item.evaluation }))
            })
        });
        if (!["overallSummary"].every((key) => typeof result?.[key] === "string") ||
            !["strongTopics", "weakTopics", "preparationTopics", "recommendations"].every((key) => Array.isArray(result?.[key]))) {
            return res.status(502).json({ message: "The AI returned an invalid interview report.", success: false });
        }
        const scores = evaluated.map((item) => item.evaluation.score);
        interview.report = {
            overallScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
            questionsAttempted: scores.length,
            overallSummary: result.overallSummary.slice(0, 2000),
            strongTopics: result.strongTopics.slice(0, 10).map((item) => String(item).slice(0, 300)),
            weakTopics: result.weakTopics.slice(0, 10).map((item) => String(item).slice(0, 300)),
            preparationTopics: result.preparationTopics.slice(0, 10).map((item) => String(item).slice(0, 300)),
            recommendations: result.recommendations.slice(0, 10).map((item) => String(item).slice(0, 500)),
            disclaimer: "Practice feedback only; this is not a verified measure of employability."
        };
        interview.status = "completed";
        interview.completedAt = new Date();
        await interview.save();
        return res.status(200).json({ interview: serializeInterview(interview), success: true });
    } catch (error) {
        console.error("Interview completion failed:", error.message);
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to complete the interview right now.",
            success: false
        });
    }
};

export const getInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find({ student: req.id }).select("-questions.answer -questions.evaluation").sort({ createdAt: -1 }).limit(100);
        return res.status(200).json({ interviews, success: true });
    } catch (error) {
        console.error("Interview history retrieval failed:", error);
        return res.status(500).json({ message: "Unable to load interview history right now.", success: false });
    }
};

export const getInterview = async (req, res) => {
    try {
        const interview = await ownsInterview(req.params.id, req.id);
        if (!interview) return res.status(404).json({ message: "Interview not found.", success: false });
        return res.status(200).json({ interview: serializeInterview(interview), success: true });
    } catch (error) {
        console.error("Interview retrieval failed:", error);
        return res.status(500).json({ message: "Unable to load this interview right now.", success: false });
    }
};

const createAnalysis = async ({ resumeText, buffer, job, student, recruiter, application }) => {
    const score = scoreResumeAgainstJob({ resumeText, job });
    let feedback = "AI-generated feedback is unavailable. This report shows deterministic skills and keyword matching only.";
    let aiFeedbackAvailable = false;
    try {
        const generated = await requestAiJson({
            system: "Give concise evidence-based resume feedback for the job. Only use supplied resume text and job criteria. Return JSON {feedback:string}. Do not infer personal traits, protected characteristics, or unsupported experience.",
            prompt: JSON.stringify({
                job: { title: job.title, description: job.description, requirements: job.requirements },
                extractedSkills: score.matchedSkills,
                missingSkills: score.missingSkills,
                resumeEvidence: sanitizeResumeTextForAi(resumeText).slice(0, 12000)
            })
        });
        if (typeof generated?.feedback === "string") {
            feedback = generated.feedback.slice(0, 3000);
            aiFeedbackAvailable = true;
        }
    } catch (error) {
        console.error("AI resume feedback unavailable:", error.message);
    }
    return ResumeAnalysis.create({
        student,
        recruiter,
        job: job._id,
        application,
        resumeHash: hashResume(buffer),
        ...score,
        feedback,
        aiFeedbackAvailable
    });
};

export const analyzeStudentResume = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id.", success: false });
        const job = await Job.findOne({
            _id: req.params.jobId,
            $or: [
                { moderationStatus: "approved" },
                { moderationStatus: { $exists: false } }
            ]
        });
        if (!job) return res.status(404).json({ message: "Job not found.", success: false });
        const resumeText = await extractPdfText(req.file.buffer);
        const analysis = await createAnalysis({ resumeText, buffer: req.file.buffer, job, student: req.id });
        return res.status(201).json({ analysis, success: true });
    } catch (error) {
        console.error("Student resume analysis failed:", error.message);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to analyze this resume right now.", success: false });
    }
};

export const getStudentAnalyses = async (req, res) => {
    try {
        const analyses = await ResumeAnalysis.find({ student: req.id, recruiter: null }).populate("job", "title company").sort({ createdAt: -1 }).limit(100);
        return res.status(200).json({ analyses, success: true });
    } catch (error) {
        console.error("Resume analysis history retrieval failed:", error);
        return res.status(500).json({ message: "Unable to load resume analysis history right now.", success: false });
    }
};

const readApplicationPdf = async (application) => {
    if (!/^[\da-f-]{36}\.pdf$/i.test(application.resumeFileName || "")) {
        const error = new Error("The application resume is not available for analysis.");
        error.status = 404;
        throw error;
    }
    const path = join(resumeDirectory, application.resumeFileName);
    await access(path);
    const buffer = await readFile(path);
    return { buffer, text: await extractPdfText(buffer) };
};

export const analyzeRecruiterApplication = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.applicationId)) return res.status(400).json({ message: "Invalid application id.", success: false });
        const application = await Application.findById(req.params.applicationId).populate("applicant", "fullname");
        if (!application) return res.status(404).json({ message: "Application not found.", success: false });
        const job = await Job.findOne({ _id: application.job, created_by: req.id });
        if (!job) return res.status(403).json({ message: "You are not allowed to analyze this application.", success: false });
        const { buffer, text } = await readApplicationPdf(application);
        const analysis = await createAnalysis({
            resumeText: text,
            buffer,
            job,
            student: application.applicant?._id || application.applicant,
            recruiter: req.id,
            application: application._id
        });
        return res.status(201).json({ analysis, candidateName: application.fullName || application.applicant?.fullname, success: true });
    } catch (error) {
        console.error("Recruiter resume analysis failed:", error.message);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to analyze this resume right now.", success: false });
    }
};

export const analyzeRecruiterUpload = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id.", success: false });
        const job = await Job.findOne({ _id: req.params.jobId, created_by: req.id });
        if (!job) return res.status(404).json({ message: "Job not found or not owned by this recruiter.", success: false });
        const resumeText = await extractPdfText(req.file.buffer);
        const analysis = await createAnalysis({
            resumeText,
            buffer: req.file.buffer,
            job,
            recruiter: req.id
        });
        return res.status(201).json({ analysis, success: true });
    } catch (error) {
        console.error("Manual recruiter resume analysis failed:", error.message);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to analyze this resume right now.", success: false });
    }
};

export const getRecruiterAnalysis = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.applicationId)) return res.status(400).json({ message: "Invalid application id.", success: false });
        const analysis = await ResumeAnalysis.findOne({ application: req.params.applicationId, recruiter: req.id }).sort({ createdAt: -1 });
        if (!analysis) return res.status(404).json({ message: "No resume analysis is available.", success: false });
        const job = await Job.findOne({ _id: analysis.job, created_by: req.id }).select("_id");
        if (!job) return res.status(403).json({ message: "You are not allowed to view this analysis.", success: false });
        return res.status(200).json({ analysis, success: true });
    } catch (error) {
        console.error("Recruiter resume analysis retrieval failed:", error);
        return res.status(500).json({ message: "Unable to load this analysis right now.", success: false });
    }
};

export const getManualRecruiterAnalyses = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id.", success: false });
        const job = await Job.findOne({ _id: req.params.jobId, created_by: req.id }).select("_id");
        if (!job) return res.status(404).json({ message: "Job not found or not owned by this recruiter.", success: false });
        const analyses = await ResumeAnalysis.find({
            job: job._id,
            recruiter: req.id,
            application: null
        }).sort({ createdAt: -1 }).limit(50);
        return res.status(200).json({ analyses, success: true });
    } catch (error) {
        console.error("Manual resume report retrieval failed:", error);
        return res.status(500).json({ message: "Unable to load manual resume reports right now.", success: false });
    }
};
