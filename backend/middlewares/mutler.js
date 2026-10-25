import multer from "multer";

const storage = multer.memoryStorage();
const profilePhotoTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const companyLogoUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error("Logo must be a JPG, PNG, WEBP, or GIF image."));
        }
        callback(null, true);
    }
}).single("file");

const profilePhotoUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (!profilePhotoTypes.includes(file.mimetype)) {
            return callback(new Error("Profile photo must be a JPG, PNG, WEBP, or GIF image."));
        }
        callback(null, true);
    }
}).single("file");

export const singleProfilePhotoUpload = (req, res, next) => {
    profilePhotoUpload(req, res, (error) => {
        if (!error) {
            if (!req.file) {
                return res.status(400).json({
                    message: "Please select a profile photo.",
                    success: false
                });
            }
            return next();
        }

        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Profile photo must be 5 MB or smaller."
                : error.message,
            success: false
        });
    });
};

const profileUpdateUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (file.fieldname === "profilePhoto") {
            if (!profilePhotoTypes.includes(file.mimetype)) {
                return callback(new Error("Profile photo must be a JPG, PNG, WEBP, or GIF image."));
            }
            return callback(null, true);
        }

        if (file.fieldname === "file" && file.mimetype !== "application/pdf") {
            return callback(new Error("Resume must be a PDF file."));
        }
        callback(null, true);
    }
}).fields([{ name: "file", maxCount: 1 }, { name: "profilePhoto", maxCount: 1 }]);

export const profileUpdateUploadMiddleware = (req, res, next) => {
    profileUpdateUpload(req, res, (error) => {
        if (!error) {
            req.file = req.files?.file?.[0];
            req.profilePhoto = req.files?.profilePhoto?.[0];
            return next();
        }

        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Each uploaded file must be 10 MB or smaller."
                : error.message,
            success: false
        });
    });
};

export const singleCompanyLogoUpload = (req, res, next) => {
    companyLogoUpload(req, res, (error) => {
        if (!error) {
            return next();
        }

        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Logo file must be 5 MB or smaller."
                : error.message,
            success: false
        });
    });
};

const applicationResumeUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (file.mimetype !== "application/pdf") {
            return callback(new Error("Resume must be a PDF file."));
        }
        callback(null, true);
    }
}).single("resume");

export const singleApplicationResumeUpload = (req, res, next) => {
    applicationResumeUpload(req, res, (error) => {
        if (!error) {
            return next();
        }

        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Resume file must be 10 MB or smaller."
                : error.message,
            success: false
        });
    });
};