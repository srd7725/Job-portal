import { Company } from "../models/company.model.js";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const companyLogoDirectory = fileURLToPath(new URL("../uploads/companies/", import.meta.url));
const logoExtensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
};

export const registerCompany = async (req, res) => {
    try {
        const { companyName } = req.body;
        if (!companyName) {
            return res.status(400).json({
                message: "Company name is required.",
                success: false
            });
        }
        let company = await Company.findOne({ name: companyName });
        if (company) {
            if (company.userId.toString() === req.id) {
                return res.status(200).json({
                    message: "This company is already registered.",
                    company,
                    success: true
                });
            }

            return res.status(400).json({
                message: "A company with this name is already registered.",
                success: false
            });
        };
        company = await Company.create({
            name: companyName,
            userId: req.id
        });

        return res.status(201).json({
            message: "Company registered successfully.",
            company,
            success: true
        })
    } catch (error) {
        console.error("Company registration failed:", error);

        if (error?.code === 11000 && error.keyPattern?.name) {
            return res.status(409).json({
                message: "A company with this name is already registered.",
                success: false
            });
        }

        return res.status(500).json({
            message: "Unable to register the company right now.",
            success: false
        });
    }
}
export const getCompany = async (req, res) => {
    try {
        const userId = req.id; // logged in user id
        const companies = await Company.find({ userId });
        if (!companies) {
            return res.status(404).json({
                message: "Companies not found.",
                success: false
            })
        }
        return res.status(200).json({
            companies,
            success:true
        })
    } catch (error) {
        console.log(error);
    }
}
// get company by id
export const getCompanyById = async (req, res) => {
    try {
        const companyId = req.params.id;
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                message: "Company not found.",
                success: false
            })
        }
        return res.status(200).json({
            company,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}

export const updateCompany = async (req, res) => {
    try {
        const { name, description, website, location } = req.body;

        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (website !== undefined) updateData.website = website;
        if (location !== undefined) updateData.location = location;

        if (req.file) {
            const fileUri = getDataUri(req.file);

            if (!fileUri?.content || !logoExtensions[req.file.mimetype]) {
                return res.status(400).json({
                    message: "Invalid logo file.",
                    success: false
                });
            }

            const cloudinaryConfigured = [
                process.env.CLOUD_NAME,
                process.env.API_KEY,
                process.env.API_SECRET,
            ].every(Boolean);

            if (cloudinaryConfigured) {
                try {
                    const cloudResponse = await cloudinary.uploader.upload(fileUri.content);
                    updateData.logo = cloudResponse.secure_url;
                } catch (error) {
                    console.error("Company logo upload failed:", error);
                }
            }

            if (!updateData.logo) {
                const filename = `${randomUUID()}${logoExtensions[req.file.mimetype]}`;
                await mkdir(companyLogoDirectory, { recursive: true });
                await writeFile(join(companyLogoDirectory, filename), req.file.buffer, { flag: "wx" });
                const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "") || `${req.protocol}://${req.get("host")}`;
                updateData.logo = `${backendUrl}/uploads/companies/${filename}`;
            }
        }

        const company = await Company.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!company) {
            return res.status(404).json({
                message: "Company not found.",
                success: false
            });
        }
        return res.status(200).json({
            message: "Company information updated.",
            company,
            success: true
        });

    } catch (error) {
        console.log(error);

        if (error?.code === 11000 && error.keyPattern?.name) {
            return res.status(409).json({
                message: "A company with this name already exists.",
                success: false
            });
        }

        return res.status(500).json({
            message: "Internal server error",
            success: false
        });
    }
};
