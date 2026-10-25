import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    targetType: {
        type: String,
        enum: ["job", "user"],
        required: true
    },
    targetJob: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job"
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    reason: {
        type: String,
        enum: ["fraud", "misleading", "harassment", "spam", "other"],
        required: true
    },
    details: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: ""
    },
    status: {
        type: String,
        enum: ["open", "reviewed", "resolved", "dismissed"],
        default: "open"
    }
}, { timestamps: true });

reportSchema.index({ createdAt: -1 });
reportSchema.index({ reporter: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
