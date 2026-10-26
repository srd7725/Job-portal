import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Navbar from "./shared/Navbar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AI_API_END_POINT } from "@/utils/constant";

const INITIAL_SETUP = {
    role: "Full Stack Developer",
    interviewType: "Technical Interview",
    difficulty: "Intermediate",
    experienceLevel: "Fresher",
    durationMinutes: "10"
};
const isMcqQuestion = (question) =>
    question?.questionType === "mcq" || (Array.isArray(question?.options) && question.options.length === 4);

const JOB_ROLES = [
    "Full Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "MERN Stack Developer",
    "Java Developer",
    "Python Developer",
    "Software Engineer",
    "DevOps Engineer",
    "Cloud Engineer",
    "Data Analyst",
    "Other"
];

const MockInterview = () => {
    const [setup, setSetup] = useState(INITIAL_SETUP);
    const [customRole, setCustomRole] = useState("");
    const [interview, setInterview] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [currentEvaluation, setCurrentEvaluation] = useState(null);
    const [pendingNextQuestion, setPendingNextQuestion] = useState(null);
    const [answer, setAnswer] = useState("");
    const [history, setHistory] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const startingInterview = useRef(false);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [timedSession, setTimedSession] = useState(false);
    const timerExpired = timedSession && interview?.status === "in_progress" && secondsLeft === 0;

    const loadHistory = async () => {
        try {
            const response = await axios.get(`${AI_API_END_POINT}/interviews`, { withCredentials: true });
            setHistory(response.data.interviews || []);
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to load interview history.");
        }
    };

    useEffect(() => {
        axios.get(`${AI_API_END_POINT}/interviews`, { withCredentials: true })
            .then(({ data }) => setHistory(data.interviews || []))
            .catch((error) => toast.error(error.response?.data?.message || "Unable to load interview history."));
    }, []);
    useEffect(() => {
        if (!interview || interview.status !== "in_progress" || secondsLeft <= 0) return undefined;
        const timer = window.setInterval(() => setSecondsLeft((time) => Math.max(0, time - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [interview, secondsLeft]);
    const startInterview = async (event) => {
        event.preventDefault();
        if (startingInterview.current) return;
        const role = setup.role === "Other" ? customRole.trim() : setup.role;
        if (!role) {
            toast.error("Enter a custom job role.");
            return;
        }
        startingInterview.current = true;
        setLoading(true);
        try {
            const response = await axios.post(`${AI_API_END_POINT}/interviews`, { ...setup, role }, { withCredentials: true });
            setInterview(response.data.interview);
            setCurrentQuestion(response.data.interview.questions[0] || null);
            setCurrentEvaluation(null);
            setPendingNextQuestion(null);
            setReport(null);
            setAnswer("");
            setSecondsLeft(Number(setup.durationMinutes) * 60);
            setTimedSession(true);
            await loadHistory();
        } catch (error) {
            toast.error(error.response?.data?.message || (
                error.request
                    ? "Unable to reach the backend API. Start the backend and check its API URL and port."
                    : "Unable to start an interview."
            ));
        } finally {
            startingInterview.current = false;
            setLoading(false);
        }
    };

    const submitAnswer = async (event) => {
        event.preventDefault();
        if (!currentQuestion || !answer.trim()) return;
        setLoading(true);
        try {
            const response = await axios.post(`${AI_API_END_POINT}/interviews/${interview._id}/answer`, {
                questionId: currentQuestion._id,
                answer
            }, { withCredentials: true });
            setInterview((current) => ({
                ...current,
                questions: [
                    ...current.questions.map((item) => item._id === currentQuestion._id
                        ? { ...item, answer, evaluation: response.data.evaluation }
                        : item),
                    ...(response.data.nextQuestion && !current.questions.some((item) => item._id === response.data.nextQuestion._id)
                        ? [response.data.nextQuestion]
                        : [])
                ]
            }));
            setCurrentEvaluation(response.data.evaluation);
            setPendingNextQuestion(response.data.nextQuestion);
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to evaluate the answer.");
        } finally {
            setLoading(false);
        }
    };

    const finishInterview = async () => {
        if (!interview?._id) return;
        try {
            const response = await axios.post(`${AI_API_END_POINT}/interviews/${interview._id}/complete`, {}, { withCredentials: true });
            setInterview(response.data.interview);
            setReport(response.data.interview.report);
            setCurrentQuestion(null);
            setTimedSession(false);
            await loadHistory();
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to complete the interview.");
        }
    };

    const openHistory = async (id) => {
        try {
            const response = await axios.get(`${AI_API_END_POINT}/interviews/${id}`, { withCredentials: true });
            setInterview(response.data.interview);
            setReport(response.data.interview.report);
            setCurrentQuestion(response.data.interview.status === "in_progress"
                ? response.data.interview.questions.find((item) => !item.answer) || null
                : null);
            setCurrentEvaluation(null);
            setPendingNextQuestion(null);
            setAnswer("");
            setSecondsLeft(0);
            setTimedSession(false);
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to open this interview.");
        }
    };

    const startVoiceInput = () => {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
            toast.error("Speech recognition is not supported in this browser. You can still type your answer.");
            return;
        }
        const recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.onresult = (event) => setAnswer((value) => `${value} ${event.results[0][0].transcript}`.trim());
        recognition.onerror = () => toast.error("Microphone access failed. Please check browser permissions.");
        recognition.start();
    };

    const formatTime = (total) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-6">
                        <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Practice studio</p>
                        <h1 className="mt-1 text-2xl font-bold text-slate-900">AI Mock Interview</h1>
                        <p className="mt-2 text-sm text-slate-600">Practice with multiple-choice questions matched to your difficulty level. Technical and mixed interviews end with 1–3 short written SQL or pseudocode tasks.</p>
                    </div>
                    {!interview && (
                        <form onSubmit={startInterview} className="grid gap-4 sm:grid-cols-2">
                            <label className="space-y-1 text-sm font-medium">Job role
                                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={setup.role} onChange={(event) => setSetup({ ...setup, role: event.target.value })}>
                                    {JOB_ROLES.map((role) => <option key={role}>{role}</option>)}
                                </select>
                            </label>
                            {setup.role === "Other" && (
                                <label className="space-y-1 text-sm font-medium">Custom job role
                                    <Input value={customRole} maxLength={100} onChange={(event) => setCustomRole(event.target.value)} required />
                                </label>
                            )}
                            <label className="space-y-1 text-sm font-medium">Interview type
                                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={setup.interviewType} onChange={(event) => setSetup({ ...setup, interviewType: event.target.value })}>
                                    {["Technical Interview", "HR Interview", "Behavioral Interview", "Mixed Interview"].map((item) => <option key={item}>{item}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1 text-sm font-medium">Difficulty
                                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={setup.difficulty} onChange={(event) => setSetup({ ...setup, difficulty: event.target.value })}>
                                    {["Beginner", "Intermediate", "Advanced"].map((item) => <option key={item}>{item}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1 text-sm font-medium">Experience level
                                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={setup.experienceLevel} onChange={(event) => setSetup({ ...setup, experienceLevel: event.target.value })}>
                                    {["Fresher", "0–1 years", "1–3 years", "3+ years"].map((item) => <option key={item}>{item}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1 text-sm font-medium sm:col-span-2">Duration
                                <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3" value={setup.durationMinutes} onChange={(event) => setSetup({ ...setup, durationMinutes: event.target.value })}>
                                    {["10", "20", "30"].map((item) => <option key={item} value={item}>{item} minutes</option>)}
                                </select>
                            </label>
                            <Button disabled={loading} className="sm:col-span-2">{loading ? "Preparing interview…" : "Generate interview questions"}</Button>
                        </form>
                    )}
                    {interview && currentQuestion && (
                        <div>
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-sm font-medium text-slate-600">Question {interview.questions.findIndex((item) => item._id === currentQuestion._id) + 1} of {interview.questions.length}</span>
                                <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">{timedSession ? `Time left ${formatTime(secondsLeft)}` : "Session resumed"}</span>
                            </div>
                            {timerExpired && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Time is up. Your submitted answers are saved; complete the interview to view your report.</p>}
                            <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${((interview.questions.filter((item) => item.answer).length) / interview.questions.length) * 100}%` }} />
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{currentQuestion.category}</p>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                    {isMcqQuestion(currentQuestion) ? "Multiple choice" : "Written"}
                                </span>
                            </div>
                            <h2 className="mb-6 text-xl font-semibold text-slate-900">{currentQuestion.question}</h2>
                            {currentEvaluation ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="font-semibold text-slate-900">Answer feedback</h3>
                                            <span className="font-bold text-violet-700">Practice score: {currentEvaluation.score}/100</span>
                                        </div>
                                        {typeof currentEvaluation.isCorrect === "boolean" && (
                                            <p className={`mt-2 text-sm font-medium ${currentEvaluation.isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                                                {currentEvaluation.isCorrect ? "Correct." : `Incorrect. Correct option: ${currentEvaluation.correctAnswer}`}
                                            </p>
                                        )}
                                        {["technicalAccuracy", "completeness", "relevance", "clarity"].map((key) => (
                                            <p key={key} className="mt-2 text-sm text-slate-700"><strong className="capitalize">{key.replace(/([A-Z])/g, " $1")}:</strong> {currentEvaluation[key]}</p>
                                        ))}
                                        {currentEvaluation.suggestedImprovements?.length > 0 && (
                                            <ul className="mt-2 list-inside list-disc text-sm text-slate-700">{currentEvaluation.suggestedImprovements.map((item, index) => <li key={index}>{item}</li>)}</ul>
                                        )}
                                        <p className="mt-3 text-sm text-slate-700"><strong>Example improved answer:</strong> {currentEvaluation.exampleImprovedAnswer}</p>
                                    </div>
                                    <div className="flex flex-wrap justify-between gap-3">
                                        <Button type="button" variant="outline" onClick={finishInterview} disabled={loading}>End interview</Button>
                                        {pendingNextQuestion
                                            ? <Button type="button" disabled={loading} onClick={() => {
                                                setCurrentQuestion(pendingNextQuestion);
                                                setPendingNextQuestion(null);
                                                setCurrentEvaluation(null);
                                                setAnswer("");
                                            }}>Next question</Button>
                                            : <Button type="button" disabled={loading} onClick={finishInterview}>Complete interview</Button>}
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={submitAnswer} className="space-y-4">
                                    {isMcqQuestion(currentQuestion) ? (
                                        <fieldset className="space-y-2" disabled={timerExpired}>
                                            <legend className="sr-only">Choose one option</legend>
                                            {currentQuestion.options.map((option, index) => (
                                                <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${answer === option ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-200"}`}>
                                                    <input
                                                        type="radio"
                                                        className="mt-1"
                                                        name="mock-interview-option"
                                                        value={option}
                                                        checked={answer === option}
                                                        onChange={() => setAnswer(option)}
                                                        required
                                                    />
                                                    <span><span className="mr-2 font-semibold text-violet-700">{String.fromCharCode(65 + index)}.</span>{option}</span>
                                                </label>
                                            ))}
                                        </fieldset>
                                    ) : (
                                        <textarea className="min-h-44 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write a short SQL query, code snippet, or pseudocode…" maxLength={10000} required disabled={timerExpired} />
                                    )}
                                    <div className="flex flex-wrap justify-between gap-3">
                                        {!isMcqQuestion(currentQuestion) && (
                                            <Button type="button" variant="outline" onClick={startVoiceInput} disabled={timerExpired}>Use voice input</Button>
                                        )}
                                        <div className={`flex gap-2 ${isMcqQuestion(currentQuestion) ? "ml-auto" : ""}`}>
                                            <Button type="button" variant="outline" onClick={finishInterview} disabled={loading}>End interview</Button>
                                            <Button disabled={loading || timerExpired || !answer.trim()}>{loading ? "Evaluating…" : "Submit answer"}</Button>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                    {interview && !currentQuestion && report && (
                        <div className="space-y-5">
                            <div className="rounded-xl bg-violet-50 p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="text-xl font-bold text-slate-900">Interview report</h2>
                                    <span className="text-2xl font-bold text-violet-700">{report.overallScore}/100</span>
                                </div>
                                <p className="mt-2 text-sm text-slate-700">{report.overallSummary}</p>
                                <p className="mt-3 text-xs text-slate-500">{report.disclaimer}</p>
                            </div>
                            <p className="text-sm text-slate-600">Questions attempted: {report.questionsAttempted}</p>
                            {["strongTopics", "weakTopics", "preparationTopics", "recommendations"].map((key) => (
                                <div key={key}>
                                    <h3 className="font-semibold capitalize text-slate-800">{key.replace(/([A-Z])/g, " $1")}</h3>
                                    <ul className="mt-1 list-inside list-disc text-sm text-slate-600">{(report[key] || []).map((item, index) => <li key={`${key}-${index}`}>{item}</li>)}</ul>
                                </div>
                            ))}
                            <div className="space-y-3 border-t pt-4">
                                {interview.questions.map((item, index) => (
                                    <article key={item._id} className="rounded-xl border border-slate-200 p-4">
                                        <p className="font-medium text-slate-900">{index + 1}. {item.question}</p>
                                        {isMcqQuestion(item) ? (
                                            <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                                {item.options.map((option, optionIndex) => {
                                                    const selected = item.answer === option;
                                                    const correct = item.evaluation?.correctAnswer === option;
                                                    return (
                                                        <li key={option} className={correct ? "font-medium text-emerald-700" : selected ? "font-medium text-slate-800" : ""}>
                                                            {String.fromCharCode(65 + optionIndex)}. {option}
                                                            {selected ? " — your answer" : ""}
                                                            {correct ? " — correct" : ""}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.answer || "No answer submitted."}</p>
                                        )}
                                        {item.evaluation && (
                                            <div className="mt-3 space-y-1 text-sm text-slate-600">
                                                <p className="font-medium text-violet-700">Practice score: {item.evaluation.score}/100</p>
                                                <p><strong>Accuracy:</strong> {item.evaluation.technicalAccuracy}</p>
                                                <p><strong>Completeness:</strong> {item.evaluation.completeness}</p>
                                                <p><strong>Relevance:</strong> {item.evaluation.relevance}</p>
                                                <p><strong>Clarity:</strong> {item.evaluation.clarity}</p>
                                                <p><strong>Suggested improvements:</strong> {item.evaluation.suggestedImprovements?.join(" · ")}</p>
                                                <p><strong>Example improved answer:</strong> {item.evaluation.exampleImprovedAnswer}</p>
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                            <Button onClick={() => { setInterview(null); setReport(null); }}>Start another interview</Button>
                        </div>
                    )}
                    {interview?.status === "in_progress" && !currentQuestion && !report && (
                        <div className="space-y-3">
                            <p className="text-slate-700">This interview is still in progress.</p>
                            <Button onClick={finishInterview} disabled={loading}>Complete interview</Button>
                        </div>
                    )}
                </section>
                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">Interview history</h2>
                    {history.filter((item) => item.report).length >= 2 && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                            <strong>Practice comparison:</strong> latest completed score {history.find((item) => item.report)?.report.overallScore}/100
                            {" · "}
                            previous {history.filter((item) => item.report)[1].report.overallScore}/100
                        </div>
                    )}
                    <div className="mt-4 space-y-3">
                        {history.length === 0 && <p className="text-sm text-slate-500">Your completed practice sessions will appear here.</p>}
                        {history.map((item) => (
                            <button key={item._id} type="button" onClick={() => openHistory(item._id)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-violet-300">
                                <span className="block font-medium text-slate-800">{item.role}</span>
                                <span className="mt-1 block text-xs text-slate-500">{item.interviewType} · {new Date(item.createdAt).toLocaleDateString()}</span>
                                <span className="mt-1 block text-xs font-medium text-violet-700">{item.report ? `${item.report.overallScore}/100` : "In progress"}</span>
                            </button>
                        ))}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default MockInterview;
