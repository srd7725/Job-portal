import { PDFParse } from "pdf-parse";
import { createHash } from "node:crypto";

export const extractPdfText = async (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.subarray(0, 5).toString() !== "%PDF-") {
        const error = new Error("The uploaded file is not a valid PDF.");
        error.status = 400;
        throw error;
    }
    const parser = new PDFParse({ data: buffer });
    let parsed;
    try {
        parsed = await parser.getText();
    } catch {
        const error = new Error("The uploaded file is a malformed or unreadable PDF.");
        error.status = 400;
        throw error;
    } finally {
        await parser.destroy();
    }
    const text = parsed.text.split(/\r?\n/)
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
    if (text.length < 40) {
        const error = new Error("This PDF has no readable text. Please upload a text-based PDF resume.");
        error.status = 422;
        throw error;
    }
    return text.slice(0, 30000);
};

export const hashResume = (buffer) => createHash("sha256").update(buffer).digest("hex");

export const sanitizeResumeTextForAi = (text) => {
    const lines = String(text)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
        .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone removed]")
        .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]")
        .split(/\r?\n/)
        .filter((line) => !/^\s*(?:name|email|phone|mobile|address|date of birth|dob|gender|nationality|marital status|citizenship|age|photo)\s*:/i.test(line));
    return lines.join("\n").slice(0, 16000);
};

const SKILL_ALIASES = new Map([
    ["react.js", "React"], ["reactjs", "React"], ["react", "React"],
    ["node.js", "Node.js"], ["nodejs", "Node.js"], ["node", "Node.js"],
    ["javascript", "JavaScript"], ["js", "JavaScript"],
    ["typescript", "TypeScript"], ["ts", "TypeScript"],
    ["mongodb", "MongoDB"], ["mongo", "MongoDB"],
    ["express.js", "Express"], ["express", "Express"],
    ["restful api", "REST API"], ["rest api", "REST API"], ["rest api's", "REST API"],
    ["aws", "AWS"], ["amazon web services", "AWS"],
    ["postgresql", "PostgreSQL"], ["postgres", "PostgreSQL"],
    ["python", "Python"], ["java", "Java"], ["docker", "Docker"],
    ["kubernetes", "Kubernetes"], ["git", "Git"], ["sql", "SQL"],
    ["html", "HTML"], ["css", "CSS"], ["next.js", "Next.js"],
    ["redux", "Redux"], ["firebase", "Firebase"], ["linux", "Linux"]
]);

const skillPattern = new RegExp(
    `(?<![a-z0-9])(?:${[...SKILL_ALIASES.keys()].sort((a, b) => b.length - a.length)
        .map((skill) => skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})(?![a-z0-9])`,
    "gi"
);

const extractSkills = (text) => {
    const found = new Set();
    for (const match of text.matchAll(skillPattern)) {
        const normalized = SKILL_ALIASES.get(match[0].toLowerCase());
        if (normalized) found.add(normalized);
    }
    return [...found];
};

const tokens = (text) => [...new Set((text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [])
    .filter((word) => !["with", "and", "the", "for", "you", "your", "our", "are", "will", "this", "that", "from", "have", "has", "years", "year", "work", "role", "job"].includes(word)))];

export const scoreResumeAgainstJob = ({ resumeText, job }) => {
    const jobText = `${job.title} ${job.description} ${(job.requirements || []).join(" ")}`;
    const resumeSkills = extractSkills(resumeText);
    const jobSkills = extractSkills(jobText);
    const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
    const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));
    const jobKeywords = tokens(jobText).filter((word) => word.length > 3).slice(0, 80);
    const matchedKeywords = jobKeywords.filter((word) => resumeText.toLowerCase().includes(word));
    const keywordCoverage = jobKeywords.length ? Math.round(matchedKeywords.length / jobKeywords.length * 100) : 0;
    const projectEvidence = /project|portfolio|built|developed|implemented/i.test(resumeText);
    const relevantProjects = (resumeText.match(/.{0,60}(?:project|portfolio|built|developed|implemented).{0,160}/gi) || [])
        .slice(0, 5)
        .map((item) => item.trim());
    const qualificationTerms = ["bachelor", "b.tech", "btech", "b.e.", "master", "m.tech", "mtech", "mba", "diploma", "computer science", "degree", "phd", "certification"];
    const requiredQualifications = qualificationTerms.filter((term) => jobText.toLowerCase().includes(term));
    const matchedQualifications = requiredQualifications.filter((term) => resumeText.toLowerCase().includes(term));
    const educationEvidence = /bachelor|master|degree|diploma|university|college|education/i.test(resumeText);
    const qualificationScore = requiredQualifications.length
        ? matchedQualifications.length / requiredQualifications.length * 100
        : 50;
    const projectScore = projectEvidence ? 100 : 0;
    const configuredWeights = {
        skills: Number(process.env.ATS_WEIGHT_REQUIRED_SKILLS ?? 45),
        keywords: Number(process.env.ATS_WEIGHT_KEYWORDS ?? 25),
        experience: Number(process.env.ATS_WEIGHT_EXPERIENCE ?? 15),
        qualifications: Number(process.env.ATS_WEIGHT_QUALIFICATIONS ?? 10),
        projects: Number(process.env.ATS_WEIGHT_PROJECTS ?? 5)
    };
    const weightTotal = Object.values(configuredWeights).reduce((sum, weight) => sum + weight, 0);
    if (Object.values(configuredWeights).some((weight) => !Number.isFinite(weight) || weight < 0) || weightTotal <= 0) {
        const error = new Error("Resume match weights must be non-negative numbers with a positive total.");
        error.status = 500;
        throw error;
    }
    const yearsMatch = resumeText.match(/(\d+(?:\.\d+)?)\+?\s+years?/i);
    const candidateYears = yearsMatch ? Number(yearsMatch[1]) : null;
    const requiredYears = Number(job.experienceLevel);
    let experienceAlignment = "Not enough resume evidence to estimate";
    let experienceScore = 50;
    if (candidateYears !== null && Number.isFinite(requiredYears)) {
        experienceAlignment = candidateYears >= requiredYears
            ? "Resume indicates experience at or above the job's stated level"
            : "Resume indicates less experience than the job's stated level";
        experienceScore = requiredYears === 0 ? 100 : Math.min(100, Math.round(candidateYears / requiredYears * 100));
    }
    const skillScore = jobSkills.length ? matchedSkills.length / jobSkills.length * 100 : 50;
    const score = Math.round((
        skillScore * configuredWeights.skills +
        keywordCoverage * configuredWeights.keywords +
        experienceScore * configuredWeights.experience +
        qualificationScore * configuredWeights.qualifications +
        projectScore * configuredWeights.projects
    ) / weightTotal);
    const experienceEvidence = (resumeText.match(/.{0,50}(?:experience|employment|worked at|developer at).{0,150}/gi) || [])
        .slice(0, 5)
        .map((item) => item.trim());
    const educationDetails = (resumeText.match(/.{0,40}(?:education|bachelor|master|diploma|university|college|degree).{0,140}/gi) || [])
        .slice(0, 5)
        .map((item) => item.trim());
    const certifications = (resumeText.match(/.{0,40}(?:certification|certified|certificate|licen[cs]e).{0,140}/gi) || [])
        .slice(0, 5)
        .map((item) => item.trim());
    return {
        score: Math.max(0, Math.min(100, score)),
        components: {
            requiredSkills: Math.round(skillScore),
            jobKeywordCoverage: keywordCoverage,
            experienceAlignment: Math.round(experienceScore),
            qualificationAlignment: Math.round(qualificationScore),
            relevantProjectEvidence: Math.round(projectScore)
        },
        matchedSkills,
        missingSkills,
        keywords: { matched: matchedKeywords.slice(0, 30), total: jobKeywords.length, coverage: keywordCoverage },
        experienceAlignment,
        evidence: {
            projectsMentioned: projectEvidence,
            relevantProjects,
            experienceYears: candidateYears,
            experienceDetails: experienceEvidence,
            educationDetails,
            certifications,
            educationMentioned: educationEvidence,
            requiredQualifications,
            matchedQualifications,
            qualificationAlignment: requiredQualifications.length
                ? `${matchedQualifications.length} of ${requiredQualifications.length} listed qualification terms found`
                : "No specific qualification requirement found in the job description"
        }
    };
};
