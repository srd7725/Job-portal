import { randomUUID } from "node:crypto";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const resumeDirectory = fileURLToPath(new URL("../private/profile-resumes/", import.meta.url));

export const isValidPdf = (file) => {
    if (!Buffer.isBuffer(file?.buffer)) return false;
    const header = file.buffer.subarray(0, Math.min(file.buffer.length, 1024)).toString("latin1");
    return header.includes("%PDF-");
};

export const saveProfileResumeLocally = async (file) => {
    if (!isValidPdf(file)) {
        const error = new Error("Resume content is not a valid PDF file.");
        error.status = 400;
        throw error;
    }

    const filename = `${randomUUID()}.pdf`;
    await mkdir(resumeDirectory, { recursive: true });
    const filePath = join(resumeDirectory, filename);
    await writeFile(filePath, file.buffer, { flag: "wx" });
    return { filePath, filename };
};

export const getProfileResumePath = async (filename) => {
    if (typeof filename !== "string" || !/^[\da-f-]{36}\.pdf$/i.test(filename)) {
        return null;
    }

    const filePath = join(resumeDirectory, filename);
    try {
        await access(filePath);
        return filePath;
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
};

export const deleteLocalProfileResume = async (filename) => {
    const filePath = await getProfileResumePath(filename);
    if (!filePath) return;
    await unlink(filePath);
};
