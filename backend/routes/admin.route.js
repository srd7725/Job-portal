import express from "express";
import { getDashboard, updateCompanyModeration, updateJobModeration, updateReportStatus, updateUserBlockStatus } from "../controllers/admin.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import requireRole from "../middlewares/requireRole.js";

const router = express.Router();
router.use(isAuthenticated, requireRole("superadmin"));
router.get("/dashboard", getDashboard);
router.patch("/users/:id/block", updateUserBlockStatus);
router.patch("/companies/:id/status", updateCompanyModeration);
router.patch("/jobs/:id/status", updateJobModeration);
router.patch("/reports/:id/status", updateReportStatus);

export default router;
