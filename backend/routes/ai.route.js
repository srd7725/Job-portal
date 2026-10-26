import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import requireRole from "../middlewares/requireRole.js";
import aiRateLimit from "../middlewares/aiRateLimit.js";
import aiResumeUpload from "../middlewares/aiResumeUpload.js";
import {
    analyzeRecruiterApplication,
    analyzeStudentResume,
    analyzeRecruiterUpload,
    completeInterview,
    createInterview,
    evaluateInterviewAnswer,
    getInterview,
    getInterviews,
    getRecruiterAnalysis,
    getManualRecruiterAnalyses,
    getStudentAnalyses
} from "../controllers/ai.controller.js";

const router = express.Router();
router.use(isAuthenticated);
router.post("/interviews", requireRole("student"), aiRateLimit, createInterview);
router.post("/interviews/:id/answer", requireRole("student"), aiRateLimit, evaluateInterviewAnswer);
router.post("/interviews/:id/complete", requireRole("student"), aiRateLimit, completeInterview);
router.get("/interviews", requireRole("student"), getInterviews);
router.get("/interviews/:id", requireRole("student"), getInterview);
router.post("/resume/analyze/:jobId", requireRole("student"), aiRateLimit, aiResumeUpload, analyzeStudentResume);
router.get("/resume/analyses", requireRole("student"), getStudentAnalyses);
router.post("/recruiter/applications/:applicationId/analyze", requireRole("recruiter"), aiRateLimit, analyzeRecruiterApplication);
router.post("/recruiter/jobs/:jobId/analyze", requireRole("recruiter"), aiRateLimit, aiResumeUpload, analyzeRecruiterUpload);
router.get("/recruiter/jobs/:jobId/manual-analyses", requireRole("recruiter"), getManualRecruiterAnalyses);
router.get("/recruiter/applications/:applicationId/analysis", requireRole("recruiter"), getRecruiterAnalysis);

export default router;
