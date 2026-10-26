import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import Navbar from "./shared/Navbar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EDUCATION_API_END_POINT } from "@/utils/constant";

const emptyEntry = () => ({
    qualification: "",
    institution: "",
    startDate: "",
    endDate: "",
    completionYear: "",
    status: "completed"
});

const monthValue = (value) => {
    if (!value) return "";
    const match = String(value).match(/^(\d{4}-\d{2})/);
    return match ? match[1] : "";
};

const formEntry = (entry = {}) => ({
    qualification: entry.qualification || "",
    institution: entry.institution || "",
    startDate: monthValue(entry.startDate),
    endDate: monthValue(entry.endDate),
    completionYear: entry.completionYear ?? "",
    status: entry.status === "ongoing" ? "ongoing" : "completed"
});

const EducationTimeline = () => {
    const [entries, setEntries] = useState([]);
    const [confirmed, setConfirmed] = useState(false);
    const [gapExplanation, setGapExplanation] = useState("");
    const [resume, setResume] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gapAnalysis, setGapAnalysis] = useState({ gaps: [], confirmedMonths: null, hasPossibleGap: false });

    useEffect(() => {
        axios.get(`${EDUCATION_API_END_POINT}/timeline`, { withCredentials: true })
            .then(({ data }) => {
                const timeline = data.timeline;
                setEntries((timeline.entries || []).map(formEntry));
                setConfirmed(Boolean(timeline.confirmed));
                setGapExplanation(timeline.gapExplanation || "");
                setGapAnalysis(timeline.gapAnalysis || { gaps: [], confirmedMonths: null, hasPossibleGap: false });
            })
            .catch((error) => toast.error(error.response?.data?.message || "Unable to load your education timeline."))
            .finally(() => setLoading(false));
    }, []);

    const setEntry = (index, field, value) => {
        setEntries((current) => current.map((entry, itemIndex) => {
            if (itemIndex !== index) return entry;
            const next = { ...entry, [field]: value };
            if (field === "status" && value === "ongoing") next.endDate = "";
            return next;
        }));
        setConfirmed(false);
        setGapAnalysis({ gaps: [], confirmedMonths: null, hasPossibleGap: true });
    };

    const analyzeResume = async () => {
        if (!resume) {
            toast.error("Select a text-based PDF resume first.");
            return;
        }
        const data = new FormData();
        data.append("resume", resume);
        setSaving(true);
        try {
            const response = await axios.post(`${EDUCATION_API_END_POINT}/analyze`, data, { withCredentials: true });
            setEntries(response.data.entries.map(formEntry));
            setGapAnalysis(response.data.gapAnalysis);
            setConfirmed(false);
            toast.success("Review the extracted education details before confirming them.");
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to analyze this resume.");
        } finally {
            setSaving(false);
        }
    };

    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        const normalized = entries.map((entry) => {
            const startDate = monthValue(entry.startDate) || null;
            const endDate = entry.status === "ongoing" ? null : (monthValue(entry.endDate) || null);
            return {
                qualification: String(entry.qualification || "").trim(),
                institution: String(entry.institution || "").trim(),
                startDate,
                endDate,
                completionYear: entry.completionYear === "" || entry.completionYear == null
                    ? null
                    : Number(entry.completionYear),
                status: entry.status
            };
        });
        try {
            const response = await axios.put(`${EDUCATION_API_END_POINT}/timeline`, {
                entries: normalized,
                confirmed,
                gapExplanation
            }, { withCredentials: true });
            setGapAnalysis(response.data.timeline.gapAnalysis);
            setEntries((response.data.timeline.entries || []).map(formEntry));
            toast.success("Education timeline saved.");
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to save your education timeline.");
        } finally {
            setSaving(false);
        }
    };

    const gapLabel = (months) => `${Math.floor(months / 12)} years${months % 12 ? ` ${months % 12} months` : ""}`;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <main className="mx-auto max-w-5xl px-4 py-8">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Student profile</p>
                            <h1 className="mt-1 text-2xl font-bold text-slate-900">Education timeline</h1>
                            <p className="mt-2 max-w-2xl text-sm text-slate-600">Review your academic history. AI-extracted details are unverified until you correct and confirm them.</p>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                            <Upload className="h-4 w-4" /> Upload resume
                            <input className="sr-only" type="file" accept=".pdf,application/pdf" onChange={(event) => setResume(event.target.files?.[0] || null)} />
                        </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="max-w-sm truncate text-sm text-slate-500">{resume?.name || "PDF upload is optional; you can enter education manually."}</span>
                        <Button type="button" variant="outline" disabled={saving || !resume} onClick={analyzeResume}>{saving ? "Analyzing…" : "Extract education details"}</Button>
                    </div>
                    {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading your timeline…</p> : (
                        <form onSubmit={save} className="mt-7 space-y-6">
                            <div className="space-y-4">
                                {entries.map((entry, index) => (
                                    <article key={entry._id || index} className="rounded-xl border border-slate-200 p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h2 className="font-semibold text-slate-800">Qualification {index + 1}</h2>
                                            <button type="button" aria-label="Remove education entry" className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => { setEntries(entries.filter((_, itemIndex) => itemIndex !== index)); setConfirmed(false); setGapAnalysis({ gaps: [], confirmedMonths: null, hasPossibleGap: true }); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="space-y-1 text-sm">Qualification
                                                <Input required maxLength={120} placeholder="e.g. Bachelor of Technology" value={entry.qualification} onChange={(event) => setEntry(index, "qualification", event.target.value)} />
                                            </label>
                                            <label className="space-y-1 text-sm">Institution
                                                <Input maxLength={160} value={entry.institution || ""} onChange={(event) => setEntry(index, "institution", event.target.value)} />
                                            </label>
                                            <label className="space-y-1 text-sm">Start month
                                                <Input type="month" value={monthValue(entry.startDate)} onChange={(event) => setEntry(index, "startDate", event.target.value)} />
                                            </label>
                                            <label className="space-y-1 text-sm">End month
                                                <Input type="month" value={entry.status === "ongoing" ? "" : monthValue(entry.endDate)} onChange={(event) => setEntry(index, "endDate", event.target.value)} disabled={entry.status === "ongoing"} />
                                            </label>
                                            <label className="space-y-1 text-sm">Completion year (if known)
                                                <Input type="number" min="1900" max="2200" value={entry.completionYear || ""} onChange={(event) => setEntry(index, "completionYear", event.target.value)} />
                                            </label>
                                            <label className="space-y-1 text-sm">Status
                                                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={entry.status} onChange={(event) => setEntry(index, "status", event.target.value)}>
                                                    <option value="completed">Completed</option>
                                                    <option value="ongoing">Ongoing</option>
                                                </select>
                                            </label>
                                        </div>
                                    </article>
                                ))}
                                <Button type="button" variant="outline" onClick={() => { setEntries([...entries, emptyEntry()]); setConfirmed(false); setGapAnalysis({ gaps: [], confirmedMonths: null, hasPossibleGap: true }); }}><Plus className="mr-2 h-4 w-4" />Add education</Button>
                            </div>
                            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                <h2 className="font-semibold text-slate-900">Academic breaks</h2>
                                {gapAnalysis.gaps.length > 0 ? gapAnalysis.gaps.map((gap, index) => (
                                    <p key={index} className="mt-2 text-sm text-slate-700">
                                        {gap.status === "confirmed" && confirmed
                                            ? `Confirmed gap: ${gapLabel(gap.months)}`
                                            : gap.months === null
                                                ? "Possible gap: add complete dates to calculate duration."
                                                : `Possible gap: ${gapLabel(gap.months)} — confirm the education dates.`}
                                    </p>
                                )) : <p className="mt-2 text-sm text-slate-600">
                                    {gapAnalysis.hasPossibleGap
                                        ? "Education Timeline Not Verified — some dates are missing."
                                        : gapAnalysis.confirmedMonths === null
                                            ? "Add at least two dated qualifications before a gap duration can be calculated."
                                            : "No confirmed gaps found in the dates provided."}
                                </p>}
                                <label className="mt-4 block space-y-1 text-sm">Optional explanation
                                    <textarea className="min-h-20 w-full rounded-lg border border-slate-200 bg-white p-3" maxLength={1000} value={gapExplanation} onChange={(event) => setGapExplanation(event.target.value)} placeholder="Share any context about an education break (optional)." />
                                </label>
                            </section>
                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                                I reviewed these details and confirm they accurately represent my education history.
                            </label>
                            <Button disabled={saving}>{saving ? "Saving…" : "Save education timeline"}</Button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
};

export default EducationTimeline;
