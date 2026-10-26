import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import requireRole from "../middlewares/requireRole.js";
import aiRateLimit from "../middlewares/aiRateLimit.js";
import aiResumeUpload from "../middlewares/aiResumeUpload.js";
import { analyzeEducationResume, getEducationTimeline, saveEducationTimeline } from "../controllers/education.controller.js";

const router = express.Router();
router.use(isAuthenticated, requireRole("student"));
router.get("/timeline", getEducationTimeline);
router.put("/timeline", saveEducationTimeline);
router.post("/analyze", aiRateLimit, aiResumeUpload, analyzeEducationResume);

export default router;
