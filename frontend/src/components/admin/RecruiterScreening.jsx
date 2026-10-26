import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import { Button } from "../ui/button";
import { JOB_API_END_POINT, APPLICATION_API_END_POINT, AI_API_END_POINT } from "@/utils/constant";

const RecruiterScreening = () => {
    const [jobs, setJobs] = useState([]);
    const [jobId, setJobId] = useState("");
    const [applicants, setApplicants] = useState([]);
    const [analyses, setAnalyses] = useState({});
    const [manualResume, setManualResume] = useState(null);
    const [manualAnalysis, setManualAnalysis] = useState(null);
    const [manualHistory, setManualHistory] = useState([]);
    const [preferredGapChoice, setPreferredGapChoice] = useState("");
    const [customGapYears, setCustomGapYears] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingApplicants, setLoadingApplicants] = useState(false);

    useEffect(() => {
        axios.get(`${JOB_API_END_POINT}/getadminjobs`, { withCredentials: true })
            .then(({ data }) => setJobs(data.jobs || []))
            .catch((error) => toast.error(error.response?.data?.message || "Unable to load your jobs."));
    }, []);

    useEffect(() => {
        if (!jobId) {
            return;
        }
        axios.get(`${APPLICATION_API_END_POINT}/${jobId}/applicants`, { withCredentials: true })
            .then(({ data }) => {
                const currentApplicants = data.job?.applications || [];
                setApplicants(currentApplicants);
                setAnalyses(Object.fromEntries(currentApplicants
                    .filter((application) => application.recruiterAnalysis)
                    .map((application) => [application._id, {
                        ...application.recruiterAnalysis,
                        candidateName: application.fullName || application.applicant?.fullname
                    }])));
            })
            .catch((error) => toast.error(error.response?.data?.message || "Unable to load applicants for this job."))
            .finally(() => setLoadingApplicants(false));
        axios.get(`${AI_API_END_POINT}/recruiter/jobs/${jobId}/manual-analyses`, { withCredentials: true })
            .then(({ data }) => setManualHistory(data.analyses || []))
            .catch((error) => toast.error(error.response?.data?.message || "Unable to load manual resume reports."));
    }, [jobId]);

    const analyzeApplicant = async (application) => {
        setLoading(true);
        try {
            const response = await axios.post(`${AI_API_END_POINT}/recruiter/applications/${application._id}/analyze`, {}, { withCredentials: true });
            setAnalyses((current) => ({
                ...current,
                [application._id]: { ...response.data.analysis, candidateName: response.data.candidateName }
            }));
            toast.success("Resume analysis completed.");
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to analyze this applicant's resume.");
        } finally {
            setLoading(false);
        }
    };

    const saveGapPreference = async () => {
        const maxPreferredEducationGapMonths = preferredGapChoice === "custom"
            ? (customGapYears === "" ? "" : Math.round(Number(customGapYears) * 12))
            : preferredGapChoice;
        try {
            const response = await axios.put(`${JOB_API_END_POINT}/${jobId}/education-gap-preference`, {
                maxPreferredEducationGapMonths
            }, { withCredentials: true });
            setJobs((current) => current.map((job) => job._id === jobId ? response.data.job : job));
            toast.success(response.data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to update this job preference.");
        }
    };

    const analyzeManualResume = async (event) => {
        event.preventDefault();
        if (!jobId || !manualResume) {
            toast.error("Select a job and a PDF resume first.");
            return;
        }
        const data = new FormData();
        data.append("resume", manualResume);
        setLoading(true);
        try {
            const response = await axios.post(`${AI_API_END_POINT}/recruiter/jobs/${jobId}/analyze`, data, { withCredentials: true });
            setManualAnalysis(response.data.analysis);
            setManualHistory((current) => [response.data.analysis, ...current]);
            toast.success("Resume analysis completed.");
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to analyze this resume.");
        } finally {
            setLoading(false);
        }
    };

    const comparedApplicants = useMemo(() => Object.entries(analyses)
        .map(([applicationId, analysis]) => ({ applicationId, ...analysis }))
        .sort((a, b) => b.score - a.score), [analyses]);

    const downloadReport = (analysis, name) => {
        const report = {
            title: jobs.find((job) => job._id === jobId)?.title,
            candidate: name || "Manual resume",
            score: analysis.score,
            components: analysis.components,
            matchedSkills: analysis.matchedSkills,
            missingSkills: analysis.missingSkills,
            experienceAlignment: analysis.experienceAlignment,
            evidence: analysis.evidence,
            feedback: analysis.feedback,
            analyzedAt: analysis.createdAt
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "resume-analysis-report.json";
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
                <header>
                    <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Recruiter workspace</p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-900">AI Resume Screening</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-600">Review evidence-based job matching to support—not replace—your hiring decisions. AI scores never reject or rank candidates automatically.</p>
                </header>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="block max-w-xl space-y-2 text-sm font-medium">Choose one of your jobs
                    <select className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3" value={jobId} onChange={(event) => {
                        const selectedId = event.target.value;
                        const selectedJob = jobs.find((job) => job._id === selectedId);
                        const months = selectedJob?.maxPreferredEducationGapMonths;
                        setJobId(selectedId);
                        setLoadingApplicants(Boolean(selectedId));
                        setApplicants([]);
                        setAnalyses({});
                        setManualHistory([]);
                        setManualAnalysis(null);
                        setPreferredGapChoice(months == null ? "" : [0, 12, 24, 36, 48, 60].includes(months) ? String(months) : "custom");
                        setCustomGapYears(months != null && months > 60 ? (months / 12).toString() : "");
                    }}>
                            <option value="">Select a job</option>
                            {jobs.map((job) => <option key={job._id} value={job._id}>{job.title}</option>)}
                        </select>
                    </label>
                    {jobId && (
                        <div className="mt-4 flex max-w-3xl flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                            <label className="min-w-56 flex-1 space-y-2 text-sm font-medium">Maximum preferred education gap
                                <select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3" value={preferredGapChoice} onChange={(event) => setPreferredGapChoice(event.target.value)}>
                                    <option value="">No Preference</option>
                                    <option value="0">0 Years</option>
                                    <option value="12">1 Year</option>
                                    <option value="24">2 Years</option>
                                    <option value="36">3 Years</option>
                                    <option value="48">4 Years</option>
                                    <option value="60">5 Years</option>
                                    <option value="custom">Custom Duration</option>
                                </select>
                            </label>
                            {preferredGapChoice === "custom" && (
                                <label className="min-w-40 space-y-2 text-sm">Custom years
                                    <input className="h-10 w-full rounded-lg border border-slate-200 px-3" type="number" min="0" max="100" step="0.08" value={customGapYears} onChange={(event) => setCustomGapYears(event.target.value)} />
                                </label>
                            )}
                            <Button variant="outline" onClick={saveGapPreference}>Save preference</Button>
                            <p className="basis-full text-xs text-slate-500">Preference is for review only; applications are never blocked or automatically rejected.</p>
                        </div>
                    )}
                </section>
                {jobId && (
                    <>
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900">Applicants</h2>
                            {loadingApplicants ? <p className="py-8 text-sm text-slate-500">Loading applicants…</p> : applicants.length === 0 ? (
                                <p className="py-8 text-sm text-slate-500">There are no applicants for this job yet.</p>
                            ) : (
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[780px] text-left text-sm">
                                        <thead className="border-b text-xs uppercase text-slate-500">
                                            <tr><th className="p-3">Candidate</th><th className="p-3">Experience</th><th className="p-3">Resume</th><th className="p-3">Analysis</th><th className="p-3">Action</th></tr>
                                        </thead>
                                        <tbody>
                                            {applicants.map((application) => (
                                                <tr key={application._id} className="border-b last:border-0">
                                                    <td className="p-3 font-medium text-slate-800">{application.fullName || application.applicant?.fullname || "Candidate"}</td>
                                                    <td className="p-3 text-slate-600">{application.yearsOfExperience ?? "—"} yrs</td>
                                                    <td className="p-3">
                                                        <a className="text-violet-700 hover:underline" href={application.resumeUrl} target="_blank" rel="noreferrer">{application.resumeOriginalName || "View resume"}</a>
                                                    </td>
                                                    <td className="p-3 font-semibold text-violet-700">{analyses[application._id] ? `${analyses[application._id].score}/100` : "Not analyzed"}</td>
                                                    <td className="p-3">
                                                        <Button size="sm" variant="outline" disabled={loading} onClick={() => analyzeApplicant(application)}>
                                                            {analyses[application._id] ? "Re-analyze" : "Analyze"}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900">Manual resume analysis</h2>
                            <p className="mt-1 text-sm text-slate-600">Upload a PDF you are authorized to process. The file is analyzed in memory and is not made public.</p>
                            <form onSubmit={analyzeManualResume} className="mt-4 flex flex-wrap items-center gap-3">
                                <input type="file" accept=".pdf,application/pdf" onChange={(event) => setManualResume(event.target.files?.[0] || null)} />
                                <Button disabled={loading || !manualResume}>{loading ? "Analyzing…" : "Analyze uploaded resume"}</Button>
                            </form>
                            {manualAnalysis && (
                                <AnalysisReport analysis={manualAnalysis} onDownload={() => downloadReport(manualAnalysis)} />
                            )}
                            {manualHistory.length > 0 && (
                                <div className="mt-5 border-t pt-4">
                                    <h3 className="font-semibold text-slate-800">Previous manual reports</h3>
                                    <div className="mt-2 space-y-2">
                                        {manualHistory.map((analysis) => (
                                            <button type="button" key={analysis._id} onClick={() => setManualAnalysis(analysis)} className="flex w-full flex-wrap justify-between gap-2 rounded-lg border border-slate-200 p-3 text-left text-sm hover:border-violet-300">
                                                <span>{new Date(analysis.createdAt).toLocaleString()}</span>
                                                <span className="font-semibold text-violet-700">{analysis.score}/100 · version {analysis.resumeHash?.slice(0, 8) || "unknown"}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                        {comparedApplicants.length > 0 && (
                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-bold text-slate-900">Applicant comparison</h2>
                                <p className="mt-1 text-xs text-slate-500">Scores summarize job-related evidence only. They are not a hiring decision or a shortlisting probability.</p>
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[650px] text-left text-sm">
                                        <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Candidate</th><th className="p-3">Compatibility</th><th className="p-3">Matched skills</th><th className="p-3">Missing skills</th><th className="p-3">Qualification alignment</th><th className="p-3">Experience</th></tr></thead>
                                        <tbody>{comparedApplicants.map((item) => (
                                            <tr key={item.applicationId} className="border-b last:border-0">
                                                <td className="p-3 font-medium">{item.candidateName || "Candidate"}</td>
                                                <td className="p-3 font-semibold text-violet-700">{item.score}/100</td>
                                                <td className="p-3">{item.matchedSkills?.join(", ") || "No listed matches"}</td>
                                                <td className="p-3">{item.missingSkills?.join(", ") || "None identified"}</td>
                                                <td className="p-3">{item.evidence?.qualificationAlignment || "Not identified"}</td>
                                                <td className="p-3">{item.experienceAlignment}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </section>
                        )}
                        {comparedApplicants.map((item) => (
                            <details key={`detail-${item.applicationId}`} className="rounded-xl border border-slate-200 bg-white p-4">
                                <summary className="cursor-pointer font-semibold text-slate-800">{item.candidateName || "Candidate"} — analysis details</summary>
                                <AnalysisReport analysis={item} onDownload={() => downloadReport(item, item.candidateName)} />
                            </details>
                        ))}
                    </>
                )}
            </main>
        </div>
    );
};

const AnalysisReport = ({ analysis, onDownload }) => (
    <div className="mt-4 space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-900">Estimated Resume–Job Compatibility: <span className="text-violet-700">{analysis.score}/100</span></h3>
            <Button variant="outline" size="sm" onClick={onDownload}>Download report</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
            <p><strong>Matched skills:</strong> {analysis.matchedSkills?.join(", ") || "None identified"}</p>
            <p><strong>Missing skills:</strong> {analysis.missingSkills?.join(", ") || "None identified"}</p>
            <p><strong>Experience alignment:</strong> {analysis.experienceAlignment}</p>
            <p><strong>Qualification alignment:</strong> {analysis.evidence?.qualificationAlignment || "Not available"}</p>
            <p><strong>Relevant projects:</strong> {analysis.evidence?.relevantProjects?.join(" · ") || "No project evidence found in parsed text"}</p>
            <p><strong>Education evidence:</strong> {analysis.evidence?.educationDetails?.join(" · ") || "Not identified in parsed text"}</p>
            <p><strong>Certifications:</strong> {analysis.evidence?.certifications?.join(" · ") || "Not identified in parsed text"}</p>
        </div>
        <p className="text-slate-700">{analysis.feedback}</p>
        <p className="text-xs text-slate-500">Analysis date: {analysis.createdAt ? new Date(analysis.createdAt).toLocaleString() : "Just now"} · Resume version: {analysis.resumeHash?.slice(0, 8) || "current"} · Human review remains required.</p>
    </div>
);

export default RecruiterScreening;
