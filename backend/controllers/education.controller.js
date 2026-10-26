import { EducationTimeline } from "../models/educationTimeline.model.js";
import { requestAiJson } from "../utils/aiProvider.js";
import { extractPdfText, sanitizeResumeTextForAi } from "../utils/resumeAnalysis.js";
import { calculateEducationGaps } from "../utils/educationGap.js";

const validEntry = (entry) => {
    const start = entry.startDate ? new Date(entry.startDate) : null;
    const end = entry.endDate ? new Date(entry.endDate) : null;
    const validDateInput = (value) => {
        if (!value) return true;
        const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
        if (!match) return false;
        const [, year, month, day] = match;
        const monthNumber = Number(month);
        if (monthNumber < 1 || monthNumber > 12) return false;
        if (!day) return true;
        const date = new Date(Date.UTC(Number(year), monthNumber - 1, Number(day)));
        return date.getUTCFullYear() === Number(year) &&
            date.getUTCMonth() === monthNumber - 1 &&
            date.getUTCDate() === Number(day);
    };
    return typeof entry.qualification === "string" && entry.qualification.trim().length > 0 &&
        entry.qualification.length <= 120 &&
        (entry.institution === undefined || (typeof entry.institution === "string" && entry.institution.length <= 160)) &&
        ["ongoing", "completed"].includes(entry.status) &&
        validDateInput(entry.startDate) && validDateInput(entry.endDate) &&
        (!start || Number.isFinite(start.getTime())) &&
        (!end || Number.isFinite(end.getTime())) &&
        (!start || !end || start <= end) &&
        (entry.completionYear === undefined || entry.completionYear === null ||
            (Number.isInteger(Number(entry.completionYear)) && Number(entry.completionYear) >= 1900 && Number(entry.completionYear) <= 2200));
};

const normalizeEducationDate = (value, isEndDate = false) => {
    if (typeof value !== "string") return value || null;
    const month = value.match(/^(\d{4})-(\d{2})$/);
    if (!month) return value;
    const [, year, monthNumber] = month;
    if (!isEndDate) return `${year}-${monthNumber}-01`;
    const endDay = new Date(Date.UTC(Number(year), Number(monthNumber), 0)).getUTCDate();
    return `${year}-${monthNumber}-${String(endDay).padStart(2, "0")}`;
};

const serializeTimeline = (timeline) => ({
    ...timeline.toObject(),
    gapAnalysis: calculateEducationGaps(timeline.entries)
});

export const getEducationTimeline = async (req, res) => {
    try {
        const timeline = await EducationTimeline.findOne({ student: req.id });
        return res.status(200).json({
            timeline: timeline ? serializeTimeline(timeline) : {
                student: req.id,
                entries: [],
                confirmed: false,
                gapExplanation: "",
                gapAnalysis: calculateEducationGaps([])
            },
            success: true
        });
    } catch (error) {
        console.error("Education timeline retrieval failed:", error);
        return res.status(500).json({ message: "Unable to load your education timeline right now.", success: false });
    }
};

export const saveEducationTimeline = async (req, res) => {
    const { entries, confirmed, gapExplanation } = req.body || {};
    if (!Array.isArray(entries) || entries.length > 20 || typeof confirmed !== "boolean" ||
        typeof gapExplanation !== "string" || gapExplanation.length > 1000 ||
        entries.some((entry) => !entry || typeof entry !== "object" || !validEntry(entry))) {
        return res.status(400).json({ message: "Please check the education timeline details.", success: false });
    }
    try {
        const timeline = await EducationTimeline.findOneAndUpdate(
            { student: req.id },
            {
                $set: {
                    entries: entries.map((entry) => ({
                        ...entry,
                        startDate: normalizeEducationDate(entry.startDate),
                        endDate: normalizeEducationDate(entry.endDate, true)
                    })),
                    confirmed,
                    gapExplanation
                }
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        return res.status(200).json({ timeline: serializeTimeline(timeline), success: true });
    } catch (error) {
        console.error("Education timeline save failed:", error.message);
        return res.status(500).json({ message: "Unable to save your education timeline right now.", success: false });
    }
};

export const analyzeEducationResume = async (req, res) => {
    try {
        const resumeText = await extractPdfText(req.file.buffer);
        const result = await requestAiJson({
            system: "Extract only education facts explicitly present in the resume. Do not infer or normalize missing dates. Return JSON {entries:[{qualification:string,institution:string,startDate:string|null,endDate:string|null,completionYear:number|null,status:'ongoing'|'completed'}]}. Use ISO dates only when month and year are explicitly available; otherwise use null. Do not claim the extraction is verified.",
            prompt: sanitizeResumeTextForAi(resumeText).slice(0, 12000)
        });
        if (!Array.isArray(result?.entries) || result.entries.length > 20 ||
            result.entries.some((entry) => !entry || !validEntry({
                ...entry,
                qualification: entry.qualification,
                institution: entry.institution || "",
                startDate: normalizeEducationDate(entry.startDate),
                endDate: normalizeEducationDate(entry.endDate, true),
                status: entry.status
            }))) {
            return res.status(502).json({ message: "The AI returned invalid education information. Please enter details manually.", success: false });
        }
        const entries = result.entries.map((entry) => ({
            qualification: entry.qualification.trim().slice(0, 120),
            institution: String(entry.institution || "").trim().slice(0, 160),
            startDate: entry.startDate || null,
            endDate: entry.endDate || null,
            completionYear: entry.completionYear || null,
            status: entry.status
        }));
        return res.status(200).json({
            entries,
            gapAnalysis: calculateEducationGaps(entries),
            verificationRequired: true,
            success: true
        });
    } catch (error) {
        console.error("Education extraction failed:", error.message);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to extract education details right now.", success: false });
    }
};
