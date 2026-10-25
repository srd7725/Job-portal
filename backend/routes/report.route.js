import express from "express";
import { createReport } from "../controllers/report.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import requireRole from "../middlewares/requireRole.js";

const router = express.Router();
router.post("/", isAuthenticated, requireRole("student", "recruiter"), createReport);

export default router;
