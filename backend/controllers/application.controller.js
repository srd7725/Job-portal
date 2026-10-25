import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { User } from "../models/user.model.js";
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

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
        const { fullName, education, city, phoneNumber, yearsOfExperience } = req.body;
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

        if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
            return res.status(400).json({
                message: "The selected resume is not a valid PDF file.",
                success: false
            });
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
        const job = await Job.findById(jobId);
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
            resumeUrl: "",
            resumeFileName: filename,
            resumeOriginalName: req.file.originalname
        });

        try {
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
        });
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
        console.log(error);
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
            select:'applicant fullName education city phoneNumber yearsOfExperience resumeUrl resumeOriginalName status createdAt',
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
        return res.status(200).json({
            job, 
            success:true
        });
    } catch (error) {
        console.log(error);
    }
}
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
        console.log(error);
    }
}