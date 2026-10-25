import mongoose from "mongoose";
import { Job } from "../models/job.model.js";
import { Report } from "../models/report.model.js";
import { User } from "../models/user.model.js";

const allowedReasons = ["fraud", "misleading", "harassment", "spam", "other"];

export const createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason, details = "" } = req.body;
        if (!["job", "user"].includes(targetType) || !mongoose.isValidObjectId(targetId)) {
            return res.status(400).json({ message: "Select a valid job or user to report.", success: false });
        }
        if (!allowedReasons.includes(reason) || typeof details !== "string" || details.length > 1000) {
            return res.status(400).json({ message: "Please select a reason and keep details under 1000 characters.", success: false });
        }

        const reportData = {
            reporter: req.id,
            targetType,
            reason,
            details: details.trim()
        };
        if (targetType === "job") {
            if (!await Job.exists({ _id: targetId })) {
                return res.status(404).json({ message: "Job not found.", success: false });
            }
            reportData.targetJob = targetId;
        } else {
            if (targetId === req.id) {
                return res.status(400).json({ message: "You cannot report your own account.", success: false });
            }
            const targetUser = await User.findOne({ _id: targetId, role: { $in: ["student", "recruiter"] } }).select("_id");
            if (!targetUser) return res.status(404).json({ message: "User not found.", success: false });
            reportData.targetUser = targetId;
        }

        const report = await Report.create(reportData);
        return res.status(201).json({
            message: "Report submitted for admin review.",
            report,
            success: true
        });
    } catch (error) {
        console.error("Report submission failed:", error);
        return res.status(500).json({ message: "Unable to submit your report.", success: false });
    }
};
