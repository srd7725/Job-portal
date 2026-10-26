import multer from "multer";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (file.mimetype !== "application/pdf") {
            return callback(new Error("Resume must be a PDF file."));
        }
        callback(null, true);
    }
}).single("resume");

const aiResumeUpload = (req, res, next) => {
    upload(req, res, (error) => {
        if (!error) {
            if (!req.file) {
                return res.status(400).json({ message: "A PDF resume is required.", success: false });
            }
            return next();
        }
        return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
            message: error.code === "LIMIT_FILE_SIZE" ? "Resume file must be 10 MB or smaller." : error.message,
            success: false
        });
    });
};

export default aiResumeUpload;
