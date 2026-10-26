import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { applyJob, downloadResume, getApplicants, getAppliedJobs, requestEducationClarification, updateStatus } from "../controllers/application.controller.js";
import { singleApplicationResumeUpload } from "../middlewares/mutler.js";
import requireRole from "../middlewares/requireRole.js";
 
const router = express.Router();

router.route("/apply/:id").post(isAuthenticated, requireRole("student"), singleApplicationResumeUpload, applyJob);
router.route("/get").get(isAuthenticated, requireRole("student"), getAppliedJobs);
router.route("/:id/resume").get(isAuthenticated, requireRole("student", "recruiter"), downloadResume);
router.route("/:id/applicants").get(isAuthenticated, requireRole("recruiter"), getApplicants);
router.route("/:id/clarification").post(isAuthenticated, requireRole("recruiter"), requestEducationClarification);
router.route("/status/:id/update").post(isAuthenticated, requireRole("recruiter"), updateStatus);
 

export default router;
