import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { getCompany, getCompanyById, registerCompany, updateCompany } from "../controllers/company.controller.js";
import { singleCompanyLogoUpload } from "../middlewares/mutler.js";
import requireRole from "../middlewares/requireRole.js";

const router = express.Router();

router.route("/register").post(isAuthenticated,requireRole("recruiter"),registerCompany);
router.route("/get").get(isAuthenticated,requireRole("recruiter"),getCompany);
router.route("/get/:id").get(isAuthenticated,requireRole("recruiter"),getCompanyById);
router.route("/update/:id").put(isAuthenticated,requireRole("recruiter"),singleCompanyLogoUpload, updateCompany);

export default router;
