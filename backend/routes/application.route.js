import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { applyJob, downloadResume, getApplicants, getAppliedJobs, updateStatus } from "../controllers/application.controller.js";
import { singleApplicationResumeUpload } from "../middlewares/mutler.js";
 
const router = express.Router();

router.route("/apply/:id").post(isAuthenticated, singleApplicationResumeUpload, applyJob);
router.route("/get").get(isAuthenticated, getAppliedJobs);
router.route("/:id/resume").get(isAuthenticated, downloadResume);
router.route("/:id/applicants").get(isAuthenticated, getApplicants);
router.route("/status/:id/update").post(isAuthenticated, updateStatus);
 

export default router;
