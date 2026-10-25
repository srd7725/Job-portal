import mongoose from "mongoose";
import { Application } from "../models/application.model.js";
import { Company } from "../models/company.model.js";
import { Job } from "../models/job.model.js";
import { Report } from "../models/report.model.js";
import { User } from "../models/user.model.js";

const validModerationStatuses = ["approved", "rejected"];
const validReportStatuses = ["reviewed", "resolved", "dismissed"];

export const getDashboard = async (_req, res) => {
    try {
        const [
            students,
            recruiters,
            companies,
            jobs,
            applications,
            pendingCompanies,
            pendingJobs,
            openReports,
            usersList,
            companiesList,
            jobsList,
            applicationsList,
            reportsList,
            userGrowth,
            jobGrowth,
            hiringGrowth
        ] = await Promise.all([
            User.countDocuments({ role: "student" }),
            User.countDocuments({ role: "recruiter" }),
            Company.countDocuments(),
            Job.countDocuments(),
            Application.countDocuments(),
            Company.countDocuments({ moderationStatus: "pending" }),
            Job.countDocuments({ moderationStatus: "pending" }),
            Report.countDocuments({ status: "open" }),
            User.find({ role: { $in: ["student", "recruiter"] } })
                .select("fullname email phoneNumber role isBlocked createdAt")
                .sort({ createdAt: -1 }).limit(100).lean(),
            Company.find()
                .select("name website location moderationStatus createdAt userId")
                .populate("userId", "fullname email").sort({ createdAt: -1 }).limit(100).lean(),
            Job.find()
                .select("title location jobType moderationStatus createdAt company created_by")
                .populate("company", "name moderationStatus")
                .populate("created_by", "fullname email")
                .sort({ createdAt: -1 }).limit(100).lean(),
            Application.find()
                .select("fullName education city phoneNumber yearsOfExperience status createdAt applicant job")
                .populate("applicant", "fullname email")
                .populate({ path: "job", select: "title company", populate: { path: "company", select: "name" } })
                .sort({ createdAt: -1 }).limit(100).lean(),
            Report.find()
                .populate("reporter", "fullname email")
                .populate("targetUser", "fullname email role")
                .populate("targetJob", "title")
                .sort({ createdAt: -1 }).limit(100).lean(),
            User.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) }, role: { $in: ["student", "recruiter"] } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Job.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Application.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ])
        ]);

        return res.status(200).json({
            success: true,
            stats: { students, recruiters, companies, jobs, applications, pendingCompanies, pendingJobs, openReports },
            users: usersList,
            companies: companiesList,
            jobs: jobsList,
            applications: applicationsList,
            reports: reportsList,
            analytics: { userGrowth, jobGrowth, hiringGrowth }
        });
    } catch (error) {
        console.error("Super-admin dashboard load failed:", error);
        return res.status(500).json({
            message: "Unable to load the admin dashboard.",
            success: false
        });
    }
};

export const updateUserBlockStatus = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid user id.", success: false });
        }
        if (req.params.id === req.id) {
            return res.status(400).json({ message: "You cannot block your own account.", success: false });
        }
        const { blocked } = req.body;
        if (typeof blocked !== "boolean") {
            return res.status(400).json({ message: "A valid blocked status is required.", success: false });
        }
        const user = await User.findOneAndUpdate(
            { _id: req.params.id, role: { $in: ["student", "recruiter"] } },
            { isBlocked: blocked },
            { returnDocument: "after", select: "fullname email role isBlocked" }
        );
        if (!user) return res.status(404).json({ message: "Student or recruiter not found.", success: false });
        return res.status(200).json({
            message: blocked ? "User blocked successfully." : "User unblocked successfully.",
            user,
            success: true
        });
    } catch (error) {
        console.error("Admin user moderation failed:", error);
        return res.status(500).json({ message: "Unable to update user access.", success: false });
    }
};

const updateModerationStatus = async (Model, req, res, label) => {
    const { status } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: `Invalid ${label} id.`, success: false });
    }
    if (!validModerationStatuses.includes(status)) {
        return res.status(400).json({ message: "Status must be approved or rejected.", success: false });
    }
    const record = await Model.findByIdAndUpdate(
        req.params.id,
        { moderationStatus: status },
        { returnDocument: "after", runValidators: true }
    );
    if (!record) return res.status(404).json({ message: `${label} not found.`, success: false });
    return res.status(200).json({
        message: `${label} ${status} successfully.`,
        record,
        success: true
    });
};

export const updateCompanyModeration = async (req, res) => {
    try {
        return await updateModerationStatus(Company, req, res, "Company");
    } catch (error) {
        console.error("Admin company moderation failed:", error);
        return res.status(500).json({ message: "Unable to update company verification.", success: false });
    }
};

export const updateJobModeration = async (req, res) => {
    try {
        return await updateModerationStatus(Job, req, res, "Job");
    } catch (error) {
        console.error("Admin job moderation failed:", error);
        return res.status(500).json({ message: "Unable to update job moderation.", success: false });
    }
};

export const updateReportStatus = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid report id.", success: false });
        }
        if (!validReportStatuses.includes(req.body.status)) {
            return res.status(400).json({
                message: "Report status must be reviewed, resolved, or dismissed.",
                success: false
            });
        }
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { returnDocument: "after", runValidators: true }
        );
        if (!report) return res.status(404).json({ message: "Report not found.", success: false });
        return res.status(200).json({ message: "Report status updated.", report, success: true });
    } catch (error) {
        console.error("Admin report review failed:", error);
        return res.status(500).json({ message: "Unable to update report status.", success: false });
    }
};
