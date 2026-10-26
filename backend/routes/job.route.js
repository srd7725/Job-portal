import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { getAdminJobs, getAllJobs, getJobById, postJob, updateEducationGapPreference } from "../controllers/job.controller.js";
import requireRole from "../middlewares/requireRole.js";

const router = express.Router();

router.route("/post").post(isAuthenticated, requireRole("recruiter"), postJob);
router.route("/get").get(isAuthenticated, requireRole("student", "recruiter", "superadmin"), getAllJobs);
router.route("/getadminjobs").get(isAuthenticated, requireRole("recruiter"), getAdminJobs);
router.route("/:id/education-gap-preference").put(isAuthenticated, requireRole("recruiter"), updateEducationGapPreference);
router.route("/get/:id").get(isAuthenticated, requireRole("student", "recruiter"), getJobById);

export default router;
