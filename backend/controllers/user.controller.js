import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { deleteLocalProfilePhoto, getProfilePhotoExtension, saveProfilePhotoLocally } from "../utils/profilePhoto.js";
import { deleteLocalProfileResume, getProfileResumePath, isValidPdf, saveProfileResumeLocally } from "../utils/profileResume.js";
import { Application } from "../models/application.model.js";

const cloudinaryConfigured = () => [
    process.env.CLOUD_NAME,
    process.env.API_KEY,
    process.env.API_SECRET,
].every(Boolean);

const saveProfilePhoto = async (file, req) => {
    if (!getProfilePhotoExtension(file)) {
        const error = new Error("Profile photo content is not a valid supported image.");
        error.status = 400;
        throw error;
    }

    if (cloudinaryConfigured()) {
        try {
            const photoDataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
            const cloudResponse = await cloudinary.uploader.upload(photoDataUri, {
                folder: "job-portal/profile-photos"
            });
            return { url: cloudResponse.secure_url };
        } catch (error) {
            console.error("Cloudinary profile photo upload failed; saving locally instead:", error);
        }
    }

    return saveProfilePhotoLocally(file, process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`);
};

export const register = async (req, res) => {
    let savedPhoto;
    try {
        const { fullname, email, phoneNumber, password, role } = req.body || {};
        const requiredFields = { fullname, email, phoneNumber, password, role };
        const missingFields = Object.entries(requiredFields)
            .filter(([, value]) => !value || (typeof value === "string" && !value.trim()))
            .map(([field]) => field);

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(", ")}`,
                missingFields,
                success: false
            });
        }

        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                message: 'User already exist with this email.',
                success: false,
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: "Please select a profile photo.",
                success: false
            });
        }

        savedPhoto = await saveProfilePhoto(req.file, req);
        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            fullname,
            email,
            phoneNumber,
            password: hashedPassword,
            role,
            profile: {
                profilePhoto: savedPhoto.url,
            }
        });

        return res.status(201).json({
            message: "Account created successfully.",
            success: true
        });
    } catch (error) {
        if (savedPhoto?.filePath) {
            await deleteLocalProfilePhoto(savedPhoto.url).catch((cleanupError) => {
                console.error("Failed to clean up profile photo after registration failed:", cleanupError);
            });
        }
        console.error("User registration failed:", error);
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Something went wrong while registering user.",
            success: false,
        });
    }
};
export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        };
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        };
        // check role is correct or not
        if (role !== user.role) {
            return res.status(400).json({
                message: "Account doesn't exist with current role.",
                success: false
            })
        };

        const tokenData = {
            userId: user._id
        }
        const token = await jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: '1d' });

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }

        return res.status(200).cookie("token", token, { maxAge: 1 * 24 * 60 * 60 * 1000, httpsOnly: true, sameSite: 'strict' }).json({
            message: `Welcome back ${user.fullname}`,
            user,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const logout = async (req, res) => {
    try {
        return res.status(200).cookie("token", "", { maxAge: 0 }).json({
            message: "Logged out successfully.",
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const updateProfile = async (req, res) => {
    let savedPhoto;
    let savedResume;
    try {
        const { fullname, email, phoneNumber, bio, skills } = req.body;

        const file = req.file;
        const profilePhotoFile = req.profilePhoto;
        let cloudResponse = null;
        if (file && !isValidPdf(file)) {
            return res.status(400).json({
                message: "Resume content is not a valid PDF file.",
                success: false
            });
        }

        const userId = req.id; // middleware authentication
        let user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found.",
                success: false
            });
        }

        if (profilePhotoFile && profilePhotoFile.size > 5 * 1024 * 1024) {
            return res.status(413).json({
                message: "Profile photo must be 5 MB or smaller.",
                success: false
            });
        }

        if (file && cloudinaryConfigured()) {
            try {
                const fileUri = getDataUri(file);
                if (fileUri) {
                    cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
                        folder: "job-portal/profile-resumes",
                        resource_type: "raw"
                    });
                }
            } catch (error) {
                console.error("Cloudinary profile resume upload failed; saving locally instead:", error);
                savedResume = await saveProfileResumeLocally(file);
            }
        } else if (file) {
            savedResume = await saveProfileResumeLocally(file);
        }

        if (profilePhotoFile) {
            savedPhoto = await saveProfilePhoto(profilePhotoFile, req);
        }

        if (fullname) user.fullname = fullname;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (bio !== undefined) user.profile.bio = bio;
        if (skills !== undefined) user.profile.skills = skills.split(",").map(skill => skill.trim()).filter(Boolean);

        const previousResumeFileName = user.profile.resumeFileName;
        if (cloudResponse) {
            user.profile.resume = cloudResponse.secure_url;
            user.profile.resumeFileName = undefined;
            user.profile.resumeOriginalName = file.originalname;
        } else if (savedResume) {
            const backendUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
            user.profile.resume = `${backendUrl}/api/v1/user/profile/${user._id}/resume`;
            user.profile.resumeFileName = savedResume.filename;
            user.profile.resumeOriginalName = file.originalname;
        }

        const previousPhotoUrl = user.profile.profilePhoto;
        if (savedPhoto) user.profile.profilePhoto = savedPhoto.url;
        await user.save();

        if (savedPhoto?.filePath && previousPhotoUrl && previousPhotoUrl !== savedPhoto.url) {
            await deleteLocalProfilePhoto(previousPhotoUrl).catch((cleanupError) => {
                console.error("Failed to remove previous local profile photo:", cleanupError);
            });
        }
        if (previousResumeFileName && previousResumeFileName !== savedResume?.filename) {
            await deleteLocalProfileResume(previousResumeFileName).catch((cleanupError) => {
                console.error("Failed to remove previous local profile resume:", cleanupError);
            });
        }

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        };

        return res.status(200).json({
            message: "Profile updated successfully.",
            user,
            success: true
        });
    } catch (error) {
        if (savedPhoto?.filePath) {
            await deleteLocalProfilePhoto(savedPhoto.url).catch((cleanupError) => {
                console.error("Failed to clean up profile photo after profile update failed:", cleanupError);
            });
        }
        if (savedResume?.filename) {
            await deleteLocalProfileResume(savedResume.filename).catch((cleanupError) => {
                console.error("Failed to clean up profile resume after profile update failed:", cleanupError);
            });
        }
        console.error("Profile update failed:", error);
        return res.status(error.status || 500).json({
            message: error.status ? error.message : "Something went wrong while updating profile.",
            success: false,
        });
    }
};

export const downloadProfileResume = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("fullname role profile.resumeFileName profile.resumeOriginalName");
        if (!user?.profile?.resumeFileName) {
            return res.status(404).json({
                message: "Resume not found.",
                success: false
            });
        }

        if (user._id.toString() !== req.id) {
            if (user.role !== "student") {
                return res.status(403).json({
                    message: "You are not allowed to access this resume.",
                    success: false
                });
            }

            const applications = await Application.find({ applicant: user._id })
                .populate({ path: "job", select: "created_by" });
            const canRecruiterAccessResume = applications.some(
                (application) => application.job?.created_by?.toString() === req.id
            );
            if (!canRecruiterAccessResume) {
                return res.status(403).json({
                    message: "You are not allowed to access this resume.",
                    success: false
                });
            }
        }

        const resumePath = await getProfileResumePath(user.profile.resumeFileName);
        if (!resumePath) {
            return res.status(404).json({
                message: "Resume file is no longer available.",
                success: false
            });
        }

        const downloadName = (user.profile.resumeOriginalName || "resume.pdf").replace(/[\r\n"]/g, "_");
        return res.download(resumePath, downloadName, (error) => {
            if (error) {
                console.error("Profile resume download failed:", error);
                if (!res.headersSent) {
                    res.status(500).json({
                        message: "Unable to download this resume right now.",
                        success: false
                    });
                }
            }
        });
    } catch (error) {
        console.error("Profile resume download failed:", error);
        return res.status(500).json({
            message: "Unable to download this resume right now.",
            success: false
        });
    }
};