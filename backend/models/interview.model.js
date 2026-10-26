import mongoose from "mongoose";

const interviewQuestionSchema = new mongoose.Schema({
    question: { type: String, required: true, maxlength: 1000 },
    category: { type: String, default: "General", maxlength: 100 },
    questionType: { type: String, enum: ["mcq", "written"], default: "mcq" },
    options: { type: [String], default: [] },
    correctOption: { type: Number, min: 0, max: 3, default: null, select: false },
    answer: { type: String, default: "", maxlength: 10000 },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: true });

const interviewSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, required: true, maxlength: 100 },
    interviewType: { type: String, required: true, enum: ["Technical Interview", "HR Interview", "Behavioral Interview", "Mixed Interview"] },
    difficulty: { type: String, required: true, enum: ["Beginner", "Intermediate", "Advanced"] },
    experienceLevel: { type: String, required: true, maxlength: 50 },
    durationMinutes: { type: Number, required: true, enum: [10, 20, 30] },
    questions: { type: [interviewQuestionSchema], required: true },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    report: { type: mongoose.Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null }
}, { timestamps: true });

export const Interview = mongoose.model("Interview", interviewSchema);
