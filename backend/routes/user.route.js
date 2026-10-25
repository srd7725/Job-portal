import express from "express";
import { downloadProfileResume, login, logout, register, updateProfile } from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { profileUpdateUploadMiddleware, singleProfilePhotoUpload } from "../middlewares/mutler.js";
 
const router = express.Router();

router.route("/register").post(singleProfilePhotoUpload,register);
router.route("/login").post(login);
router.route("/logout").get(logout);
router.route("/profile/:id/resume").get(isAuthenticated, downloadProfileResume);
router.route("/profile/update").post(isAuthenticated,profileUpdateUploadMiddleware,updateProfile);

export default router;
