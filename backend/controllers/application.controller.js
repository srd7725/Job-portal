import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { User } from "../models/user.model.js";
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { ResumeAnalysis } from "../models/resumeAnalysis.model.js";
import { EducationTimeline } from "../models/educationTimeline.model.js";
import { extractPdfText, hashResume } from "../utils/resumeAnalysis.js";
import { calculateEducationGaps } from "../utils/educationGap.js";

const resumeDirectory = fileURLToPath(new URL("../private/resumes/", import.meta.url));

export const applyJob = async (req, res) => {
    let resumePath;
    try {
        const userId = req.id;
        const jobId = req.params.id;
        if (!jobId) {
            return res.status(400).json({
                message: "Job id is required.",
                success: false
            })
        };
        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({
                message: "Invalid job id.",
                success: false
            });
        }
        const { fullName, education, city, phoneNumber, yearsOfExperience, educationGapMonths, educationGapExplanation } = req.body;
        const requiredFields = { fullName, education, city, phoneNumber, yearsOfExperience };
        const missingFields = Object.entries(requiredFields)
            .filter(([, value]) => value === undefined || value === null || String(value).trim() === "")
            .map(([field]) => field);

        if (missingFields.length || !req.file) {
            return res.status(400).json({
                message: missingFields.length
                    ? `Please provide: ${missingFields.join(", ")}.`
                    : "A PDF resume is required.",
                success: false
            });
        }

        const applicationDetails = {
            fullName: String(fullName).trim(),
            education: String(education).trim(),
            city: String(city).trim(),
            phoneNumber: String(phoneNumber).trim()
        };
        if (
            applicationDetails.fullName.length > 100 ||
            applicationDetails.education.length > 150 ||
            applicationDetails.city.length > 100 ||
            !/^[0-9+().\-\s]{7,20}$/.test(applicationDetails.phoneNumber)
        ) {
            return res.status(400).json({
                message: "Please check the name, education, city, and mobile number fields.",
                success: false
            });
        }

        const applicant = await User.findById(userId);
        if (!applicant || applicant.role !== "student") {
            return res.status(403).json({
                message: "Only student accounts can apply for jobs.",
                success: false
            });
        }

        const experience = Number(yearsOfExperience);
        if (!Number.isFinite(experience) || experience < 0) {
            return res.status(400).json({
                message: "Years of experience must be a number greater than or equal to 0.",
                success: false
            });
        }
        const gapMonths = educationGapMonths === undefined || educationGapMonths === "" || educationGapMonths === null
            ? null
            : Number(educationGapMonths);
        if (gapMonths !== null && (!Number.isInteger(gapMonths) || gapMonths < 0 || gapMonths > 1200)) {
            return res.status(400).json({
                message: "Education gap must be a whole number of months between 0 and 1200.",
                success: false
            });
        }
        if (educationGapExplanation !== undefined &&
            (typeof educationGapExplanation !== "string" || educationGapExplanation.length > 1000)) {
            return res.status(400).json({
                message: "Education gap explanation must be 1000 characters or fewer.",
                success: false
            });
        }

        if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
            return res.status(400).json({
                message: "The selected resume is not a valid PDF file.",
                success: false
            });
        }
        try {
            await extractPdfText(req.file.buffer);
        } catch (error) {
            if (error.status === 422) {
                // Scanned PDFs remain eligible for application, but cannot receive text-based ATS analysis.
            } else if (error.status === 400) {
                return res.status(400).json({
                    message: error.message,
                    success: false
                });
            } else {
                throw error;
            }
        }

        // check if the user has already applied for the job
        const existingApplication = await Application.findOne({ job: jobId, applicant: userId });

        if (existingApplication) {
            return res.status(400).json({
                message: "You have already applied for this jobs",
                success: false
            });
        }

        // check if the jobs exists
        const job = await Job.findOne({
            _id: jobId,
            $or: [
                { moderationStatus: "approved" },
                { moderationStatus: { $exists: false } }
            ]
        }).populate({
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
        });
        if (job && (!job.company || !job.created_by)) {
            return res.status(404).json({
                message: "Job is not available.",
                success: false
            });
        }
        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                success: false
            })
        }

        const extension = ".pdf";
        const filename = `${randomUUID()}${extension}`;
        await mkdir(resumeDirectory, { recursive: true });
        resumePath = join(resumeDirectory, filename);
        await writeFile(resumePath, req.file.buffer, { flag: "wx" });
        const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "") || `${req.protocol}://${req.get("host")}`;

        const newApplication = await Application.create({
            job: jobId,
            applicant: userId,
            ...applicationDetails,
            yearsOfExperience: experience,
            educationGapMonths: gapMonths,
            educationGapExplanation: String(educationGapExplanation || "").trim(),
            resumeUrl: "",
            resumeFileName: filename,
            resumeOriginalName: req.file.originalname
        });

        try {
            const matchingAnalysis = await ResumeAnalysis.findOne({
                student: userId,
                recruiter: null,
                job: jobId,
                resumeHash: hashResume(req.file.buffer)
            }).sort({ createdAt: -1 }).select("_id");
            if (matchingAnalysis) newApplication.resumeAnalysisId = matchingAnalysis._id;
            newApplication.resumeUrl = `${backendUrl}/api/v1/application/${newApplication._id}/resume`;
            await newApplication.save();
            job.applications.push(newApplication._id);
            await job.save();
        } catch (error) {
            await Application.findByIdAndDelete(newApplication._id);
            throw error;
        }

        return res.status(201).json({
            message:"Job applied successfully.",
            application: newApplication,
            success:true
        })
    } catch (error) {
        if (resumePath) {
            await unlink(resumePath).catch((cleanupError) => {
                if (cleanupError.code !== "ENOENT") {
                    console.error("Failed to clean up uploaded resume:", cleanupError);
                }
            });
        }

        console.error("Job application failed:", error);
        if (error?.code === 11000) {
            return res.status(409).json({
                message: "You have already applied for this job.",
                success: false
            });
        }
        return res.status(500).json({
            message: "Unable to submit your application right now.",
            success: false
        });
    }
};

export const downloadResume = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id);
        if (!application || !application.resumeFileName) {
            return res.status(404).json({
                message: "Resume not found.",
                success: false
            });
        }

        const job = await Job.findById(application.job);
        if (!job) {
            return res.status(404).json({
                message: "Job not found.",
                success: false
            });
        }

        if (application.applicant.toString() !== req.id && job.created_by.toString() !== req.id) {
            return res.status(403).json({
                message: "You are not allowed to access this resume.",
                success: false
            });
        }

        if (!/^[\da-f-]{36}\.pdf$/i.test(application.resumeFileName)) {
            return res.status(404).json({
                message: "Resume file is no longer available.",
                success: false
            });
        }
        const resumePath = join(resumeDirectory, application.resumeFileName);
        try {
            await access(resumePath);
        } catch (error) {
            if (error.code === "ENOENT") {
                return res.status(404).json({
                    message: "Resume file is no longer available.",
                    success: false
                });
            }
            throw error;
        }

        const downloadName = (application.resumeOriginalName || "resume.pdf").replace(/[\r\n"]/g, "_");
        return res.download(resumePath, downloadName, (error) => {
            if (error) {
                console.error("Resume download failed:", error);
                if (!res.headersSent) {
                    res.status(500).json({
                        message: "Unable to download this resume right now.",
                        success: false
                    });
                }
            }
        });
    } catch (error) {
        console.error("Resume download failed:", error);
        return res.status(500).json({
            message: "Unable to download this resume right now.",
            success: false
        });
    }
};

export const getAppliedJobs = async (req,res) => {
    try {
        const userId = req.id;
        const application = await Application.find({applicant:userId}).sort({createdAt:-1}).populate({
            path:'job',
            options:{sort:{createdAt:-1}},
            populate:{
                path:'company',
                options:{sort:{createdAt:-1}},
            }
        }).populate("resumeAnalysisId");
        if(!application){
            return res.status(404).json({
                message:"No Applications",
                success:false
            })
        };
        return res.status(200).json({
            application,
            success:true
        })
    } catch (error) {
        console.error("Applied job retrieval failed:", error);
        return res.status(500).json({
            message: "Unable to load your applications right now.",
            success: false
        });
    }
}
// admin dekhega kitna user ne apply kiya hai
export const getApplicants = async (req,res) => {
    try {
        const jobId = req.params.id;
        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({
                message: "Invalid job id.",
                success: false
            });
        }
        const job = await Job.findById(jobId).populate({
            path:'applications',
            select:'applicant fullName education city phoneNumber yearsOfExperience educationGapMonths educationGapExplanation clarificationRequest resumeAnalysisId resumeUrl resumeOriginalName status createdAt',
            options:{sort:{createdAt:-1}},
            populate:{
                path:'applicant',
                select:'fullname email phoneNumber profile.resume profile.resumeOriginalName createdAt'
            }
        });
        if(!job){
            return res.status(404).json({
                message:'Job not found.',
                success:false
            })
        };
        if (job.created_by.toString() !== req.id) {
            return res.status(403).json({
                message: "You are not allowed to view applicants for this job.",
                success: false
            });
        }
        const jobResponse = job.toObject();
        const studentIds = jobResponse.applications.map((application) => application.applicant?._id).filter(Boolean);
        const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "") || `${req.protocol}://${req.get("host")}`;
        const timelines = await EducationTimeline.find({ student: { $in: studentIds } }).select("student entries confirmed gapExplanation");
        const timelinesByStudent = new Map(timelines.map((timeline) => [
            timeline.student.toString(),
            {
                entries: timeline.entries,
                confirmed: timeline.confirmed,
                gapExplanation: timeline.gapExplanation,
                gapAnalysis: calculateEducationGaps(timeline.entries)
            }
        ]));
        for (const application of jobResponse.applications) {
            const timeline = timelinesByStudent.get(application.applicant?._id?.toString());
            if (application.applicant?.profile?.resume) {
                application.applicant.profile.resume = `${backendUrl}/api/v1/user/profile/${application.applicant._id}/resume`;
            }
            if (timeline) application.applicant.educationTimeline = timeline;
        }
        const applicationIds = jobResponse.applications.map((application) => application._id);
        const recruiterAnalyses = await ResumeAnalysis.find({
            application: { $in: applicationIds },
            recruiter: req.id
        }).sort({ createdAt: -1 });
        const latestAnalysisByApplication = new Map();
        for (const analysis of recruiterAnalyses) {
            const key = analysis.application.toString();
            if (!latestAnalysisByApplication.has(key)) latestAnalysisByApplication.set(key, analysis.toObject());
        }
        for (const application of jobResponse.applications) {
            application.recruiterAnalysis = latestAnalysisByApplication.get(application._id.toString()) || null;
        }
        return res.status(200).json({
            job: jobResponse,
            success:true
        });
    } catch (error) {
        console.error("Applicant list retrieval failed:", error);
        return res.status(500).json({
            message: "Unable to load applicants right now.",
            success: false
        });
    }
}

export const requestEducationClarification = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid application id.", success: false });
        }
        const application = await Application.findById(req.params.id);
        if (!application) return res.status(404).json({ message: "Application not found.", success: false });
        const job = await Job.findOne({ _id: application.job, created_by: req.id });
        if (!job) return res.status(403).json({ message: "You are not allowed to request clarification for this application.", success: false });
        const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
        if (message.length > 500) return res.status(400).json({ message: "Clarification message must be 500 characters or fewer.", success: false });
        application.clarificationRequest = {
            requestedAt: new Date(),
            message: message || "Please clarify your education timeline."
        };
        await application.save();
        return res.status(200).json({ message: "Clarification request recorded for the applicant.", success: true });
    } catch (error) {
        console.error("Education clarification request failed:", error);
        return res.status(500).json({ message: "Unable to record the clarification request right now.", success: false });
    }
};

export const updateStatus = async (req,res) => {
    try {
        const {status} = req.body;
        const applicationId = req.params.id;
        const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";
        if(!["accepted", "rejected", "pending"].includes(normalizedStatus)){
            return res.status(400).json({
                message:'Status must be accepted, rejected, or pending.',
                success:false
            })
        };

        // find the application by applicantion id
        const application = await Application.findById(applicationId);
        if(!application){
            return res.status(404).json({
                message:"Application not found.",
                success:false
            })
        };
        const job = await Job.findById(application.job);
        if (!job || job.created_by.toString() !== req.id) {
            return res.status(403).json({
                message: "You are not allowed to update this application.",
                success: false
            });
        }

        // update the status
        application.status = normalizedStatus;
        await application.save();

        return res.status(200).json({
            message:"Status updated successfully.",
            success:true
        });

    } catch (error) {
        console.error("Application status update failed:", error);
        return res.status(500).json({
            message: "Unable to update application status right now.",
            success: false
        });
    }
}