import mongoose from "mongoose";

const educationEntrySchema = new mongoose.Schema({
    qualification: { type: String, required: true, trim: true, maxlength: 120 },
    institution: { type: String, trim: true, maxlength: 160, default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    completionYear: { type: Number, min: 1900, max: 2200, default: null },
    status: { type: String, enum: ["ongoing", "completed"], required: true }
}, { _id: true });

const educationTimelineSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    entries: { type: [educationEntrySchema], default: [] },
    confirmed: { type: Boolean, default: false },
    gapExplanation: { type: String, trim: true, maxlength: 1000, default: "" }
}, { timestamps: true });

export const EducationTimeline = mongoose.model("EducationTimeline", educationTimelineSchema);
