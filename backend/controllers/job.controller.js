import { Job } from "../models/job.model.js";
import { Company } from "../models/company.model.js";
import mongoose from "mongoose";

// admin post krega job
export const postJob = async (req, res) => {
    try {
        const { title, description, requirements, salary, location, jobType, experience, position, companyId, maxPreferredEducationGapMonths } = req.body;
        const userId = req.id;

        if (!title || !description || !requirements || !salary || !location || !jobType || !experience || !position || !companyId) {
            return res.status(400).json({
                message: "Somethin is missing.",
                success: false
            })
        };
        const preferredGap = maxPreferredEducationGapMonths === "" || maxPreferredEducationGapMonths === null || maxPreferredEducationGapMonths === undefined
            ? null
            : Number(maxPreferredEducationGapMonths);
        if (preferredGap !== null && (!Number.isInteger(preferredGap) || preferredGap < 0 || preferredGap > 1200)) {
            return res.status(400).json({
                message: "Preferred education gap must be between 0 and 1200 months.",
                success: false
            });
        }

        const company = await Company.findOne({ _id: companyId, userId, moderationStatus: { $ne: "rejected" } });
        if (!company) {
            return res.status(400).json({
                message: "Select one of your registered companies that is not rejected.",
                success: false
            });
        }
        const job = await Job.create({
            title,
            description,
            requirements: requirements.split(","),
            salary: Number(salary),
            location,
            jobType,
            experienceLevel: experience,
            position,
            company: companyId,
            created_by: userId,
            maxPreferredEducationGapMonths: preferredGap,
            moderationStatus: "pending"
        });
        return res.status(201).json({
            message: "New job created successfully.",
            job,
            success: true
        });
    } catch (error) {
        console.error("Job creation failed:", error);
        return res.status(500).json({
            message: "Unable to create the job right now.",
            success: false
        });
    }
}

export const updateEducationGapPreference = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid job id.", success: false });
    }
    const value = req.body?.maxPreferredEducationGapMonths;
    const preferredGap = value === "" || value === null || value === undefined ? null : Number(value);
    if (preferredGap !== null && (!Number.isInteger(preferredGap) || preferredGap < 0 || preferredGap > 1200)) {
        return res.status(400).json({ message: "Preferred education gap must be between 0 and 1200 months.", success: false });
    }
    try {
        const job = await Job.findOneAndUpdate(
            { _id: req.params.id, created_by: req.id },
            { $set: { maxPreferredEducationGapMonths: preferredGap } },
            { new: true, runValidators: true }
        );
        if (!job) return res.status(404).json({ message: "Job not found or not owned by this recruiter.", success: false });
        return res.status(200).json({ message: "Education gap preference updated.", job, success: true });
    } catch (error) {
        console.error("Education gap preference update failed:", error);
        return res.status(500).json({ message: "Unable to update this preference right now.", success: false });
    }
};

// student k liye
export const getAllJobs = async (req, res) => {
    try {
        const keyword = req.query.keyword || "";
        const query = {
            $and: [
                {
                    $or: [
                        { title: { $regex: keyword, $options: "i" } },
                        { description: { $regex: keyword, $options: "i" } },
                    ]
                },
                {
                    $or: [
                        { moderationStatus: "approved" },
                        { moderationStatus: { $exists: false } }
                    ]
                }
            ]
        };
        const jobs = await Job.find(query).populate({
            path: "company",
            match: {
                $or: [
                    { moderationStatus: "approved" },
                    { moderationStatus: { $exists: false } }
                ]
            }
        }).populate({
            path: "created_by",
            match: { isBlocked: { $ne: true } },
            select: "_id"
        }).sort({ createdAt: -1 });
        const approvedJobs = jobs.filter((job) => job.company && job.created_by);
        return res.status(200).json({
            jobs: approvedJobs,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
// student
export const getJobById = async (req, res) => {
    try {
        const jobId = req.params.id;
        const job = await Job.findOne({
            _id: jobId,
            $or: [
                { moderationStatus: "approved" },
                { moderationStatus: { $exists: false } }
            ]
        }).populate({
            path: "created_by",
            match: { isBlocked: { $ne: true } },
            select: "fullname role"
        }).populate({
            path:"company",
            match: {
                $or: [
                    { moderationStatus: "approved" },
                    { moderationStatus: { $exists: false } }
                ]
            }
        });
        if (job && (!job.company || !job.created_by)) {
            return res.status(404).json({
                message: "Job not found.",
                success: false
            });
        }
        if (!job) {
            return res.status(404).json({
                message: "Jobs not found.",
                success: false
            })
        };
        return res.status(200).json({ job, success: true });
    } catch (error) {
        console.log(error);
    }
}
// admin kitne job create kra hai abhi tk
export const getAdminJobs = async (req, res) => {
    try {
        const adminId = req.id;
        const jobs = await Job.find({ created_by: adminId }).populate({
            path:'company',
            createdAt:-1
        });
        if (!jobs) {
            return res.status(404).json({
                message: "Jobs not found.",
                success: false
            })
        };
        return res.status(200).json({
            jobs,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
