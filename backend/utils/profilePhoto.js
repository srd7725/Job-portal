import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const profilePhotoDirectory = fileURLToPath(new URL("../uploads/profiles/", import.meta.url));
const imageExtensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
};

const hasValidImageSignature = (file) => {
    const { buffer, mimetype } = file;
    if (mimetype === "image/jpeg") {
        return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimetype === "image/png") {
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (mimetype === "image/webp") {
        return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    }
    if (mimetype === "image/gif") {
        const signature = buffer.toString("ascii", 0, 6);
        return signature === "GIF87a" || signature === "GIF89a";
    }
    return false;
};

export const getProfilePhotoExtension = (file) => {
    const extension = imageExtensions[file?.mimetype];
    if (!extension || !file.buffer || !hasValidImageSignature(file)) {
        return null;
    }
    return extension;
};

export const saveProfilePhotoLocally = async (file, backendUrl) => {
    const extension = getProfilePhotoExtension(file);
    if (!extension) {
        throw new Error("Profile photo content is not a valid supported image.");
    }

    const filename = `${randomUUID()}${extension}`;
    await mkdir(profilePhotoDirectory, { recursive: true });
    const filePath = join(profilePhotoDirectory, filename);
    await writeFile(filePath, file.buffer, { flag: "wx" });
    return {
        filePath,
        url: `${backendUrl.replace(/\/+$/, "")}/uploads/profiles/${filename}`
    };
};

export const deleteLocalProfilePhoto = async (photoUrl) => {
    if (typeof photoUrl !== "string") return;

    let filename;
    try {
        const pathname = new URL(photoUrl).pathname;
        const match = pathname.match(/^\/uploads\/profiles\/([\da-f-]{36}\.(?:jpg|png|webp|gif))$/i);
        filename = match?.[1];
    } catch {
        return;
    }

    if (!filename || extname(filename).length === 0) return;

    try {
        await unlink(join(profilePhotoDirectory, filename));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
};
