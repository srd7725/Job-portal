import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";

dotenv.config();

const required = ["MONGO_URI", "SUPERADMIN_NAME", "SUPERADMIN_EMAIL", "SUPERADMIN_PHONE", "SUPERADMIN_PASSWORD"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exitCode = 1;
} else if (process.env.SUPERADMIN_PASSWORD.length < 12) {
    console.error("SUPERADMIN_PASSWORD must be at least 12 characters long.");
    process.exitCode = 1;
} else {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const existing = await User.findOne({ email: process.env.SUPERADMIN_EMAIL.trim().toLowerCase() }).select("_id role");
        if (existing) {
            throw new Error("That email already has an account. Seed will not change an existing account.");
        }
        const password = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12);
        await User.create({
            fullname: process.env.SUPERADMIN_NAME.trim(),
            email: process.env.SUPERADMIN_EMAIL.trim().toLowerCase(),
            phoneNumber: process.env.SUPERADMIN_PHONE,
            password,
            role: "superadmin",
            profile: {}
        });
        console.log("Super-admin account created. Remove SUPERADMIN_PASSWORD from the environment after signing in.");
    } catch (error) {
        console.error("Unable to create super-admin account:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}
