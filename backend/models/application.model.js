import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
    job:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Job',
        required:true
    },
    applicant:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    fullName:{
        type:String,
        trim:true
    },
    education:{
        type:String,
        trim:true
    },
    city:{
        type:String,
        trim:true
    },
    phoneNumber:{
        type:String,
        trim:true
    },
    yearsOfExperience:{
        type:Number,
        min:0
    },
    educationGapMonths: {
        type: Number,
        min: 0,
        default: null
    },
    educationGapExplanation: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    clarificationRequest: {
        requestedAt: { type: Date, default: null },
        message: { type: String, trim: true, maxlength: 500, default: "" }
    },
    resumeAnalysisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ResumeAnalysis",
        default: null
    },
    resumeUrl:{
        type:String
    },
    resumeFileName:{
        type:String
    },
    resumeOriginalName:{
        type:String
    },
    status:{
        type:String,
        enum:['pending', 'accepted', 'rejected'],
        default:'pending'
    }
},{timestamps:true});
export const Application  = mongoose.model("Application", applicationSchema);