import mongoose from "mongoose";

const resumeAnalysisSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", default: null },
    resumeHash: { type: String, required: true },
    score: { type: Number, min: 0, max: 100, required: true },
    components: { type: mongoose.Schema.Types.Mixed, required: true },
    matchedSkills: [String],
    missingSkills: [String],
    keywords: { type: mongoose.Schema.Types.Mixed, required: true },
    experienceAlignment: { type: String, required: true },
    evidence: { type: mongoose.Schema.Types.Mixed, required: true },
    feedback: { type: String, default: "" },
    aiFeedbackAvailable: { type: Boolean, default: false }
}, { timestamps: true });

resumeAnalysisSchema.index({ student: 1, job: 1, createdAt: -1 });
export const ResumeAnalysis = mongoose.model("ResumeAnalysis", resumeAnalysisSchema);
