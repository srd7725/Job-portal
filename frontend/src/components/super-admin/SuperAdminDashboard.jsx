import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { BadgeCheck, BriefcaseBusiness, Building2, ChartNoAxesCombined, CircleAlert, GraduationCap, Loader2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import { Button } from "../ui/button";
import { ADMIN_API_END_POINT } from "@/utils/constant";

const sections = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "companies", label: "Companies" },
    { id: "jobs", label: "Jobs" },
    { id: "applications", label: "Applications" },
    { id: "reports", label: "Reports" }
];

const dateLabel = (date) => date ? new Date(date).toLocaleDateString() : "—";

const Status = ({ value }) => {
    const styles = {
        approved: "bg-emerald-50 text-emerald-700",
        resolved: "bg-emerald-50 text-emerald-700",
        accepted: "bg-emerald-50 text-emerald-700",
        pending: "bg-amber-50 text-amber-700",
        open: "bg-rose-50 text-rose-700",
        rejected: "bg-rose-50 text-rose-700",
        dismissed: "bg-slate-100 text-slate-600",
        reviewed: "bg-blue-50 text-blue-700",
        blocked: "bg-rose-50 text-rose-700",
        active: "bg-emerald-50 text-emerald-700"
    };
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[value] || "bg-slate-100 text-slate-600"}`}>{value || "approved"}</span>;
};

const EmptyState = ({ children }) => (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">{children}</div>
);

const TableFrame = ({ headers, children }) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
    </div>
);

const SuperAdminDashboard = () => {
    const [section, setSection] = useState("overview");
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState("");

    const loadDashboard = useCallback(async () => {
        try {
            const response = await axios.get(`${ADMIN_API_END_POINT}/dashboard`, { withCredentials: true });
            if (response.data.success) setDashboard(response.data);
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to load the admin dashboard.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void Promise.resolve().then(loadDashboard);
    }, [loadDashboard]);

    const update = async (id, path, payload) => {
        setBusyId(id);
        try {
            const response = await axios.patch(`${ADMIN_API_END_POINT}/${path}`, payload, { withCredentials: true });
            if (response.data.success) {
                toast.success(response.data.message);
                await loadDashboard();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to save this change.");
        } finally {
            setBusyId("");
        }
    };

    const statCards = [
        { label: "Students", value: dashboard?.stats?.students, icon: GraduationCap, color: "text-violet-700 bg-violet-50" },
        { label: "Recruiters", value: dashboard?.stats?.recruiters, icon: Users, color: "text-blue-700 bg-blue-50" },
        { label: "Companies", value: dashboard?.stats?.companies, icon: Building2, color: "text-indigo-700 bg-indigo-50" },
        { label: "Jobs", value: dashboard?.stats?.jobs, icon: BriefcaseBusiness, color: "text-fuchsia-700 bg-fuchsia-50" },
        { label: "Applications", value: dashboard?.stats?.applications, icon: BadgeCheck, color: "text-emerald-700 bg-emerald-50" },
        { label: "Company approvals", value: dashboard?.stats?.pendingCompanies, icon: Building2, color: "text-amber-700 bg-amber-50" },
        { label: "Job approvals", value: dashboard?.stats?.pendingJobs, icon: BriefcaseBusiness, color: "text-orange-700 bg-orange-50" },
        { label: "Open reports", value: dashboard?.stats?.openReports, icon: CircleAlert, color: "text-rose-700 bg-rose-50" }
    ];

    const renderOverview = () => {
        const analytics = [
            { title: "New users", data: dashboard?.analytics?.userGrowth || [], color: "bg-violet-500" },
            { title: "Job postings", data: dashboard?.analytics?.jobGrowth || [], color: "bg-blue-500" },
            { title: "Applications", data: dashboard?.analytics?.hiringGrowth || [], color: "bg-emerald-500" }
        ];
        return (
            <div className="space-y-7">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {statCards.map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-500">{label}</p>
                                <span className={`rounded-xl p-2 ${color}`}><Icon className="h-5 w-5" /></span>
                            </div>
                            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value ?? "—"}</p>
                        </div>
                    ))}
                </div>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-center gap-2">
                        <ChartNoAxesCombined className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-slate-900">Activity — last 7 days</h2>
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                        {analytics.map(({ title, data, color }) => {
                            const countsByDate = new Map(data.map((entry) => [entry._id, entry.count]));
                            const days = Array.from({ length: 7 }, (_, index) => {
                                const date = new Date();
                                date.setDate(date.getDate() - (6 - index));
                                const key = date.toISOString().slice(0, 10);
                                return { key, count: countsByDate.get(key) || 0 };
                            });
                            const max = Math.max(1, ...days.map((day) => day.count));
                            return (
                                <div key={title}>
                                    <p className="mb-3 text-sm font-medium text-slate-700">{title}</p>
                                    <div className="flex h-28 items-end gap-2 border-b border-slate-100">
                                        {days.map((day) => (
                                            <div key={day.key} title={`${day.key}: ${day.count}`} className="flex h-full flex-1 items-end">
                                                <div className={`w-full rounded-t-md ${color}`} style={{ height: `${Math.max(day.count ? 12 : 4, (day.count / max) * 100)}%` }} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                                        {days.map((day) => <span key={day.key}>{new Date(`${day.key}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span>)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        );
    };

    const renderUsers = () => (
        dashboard?.users?.length ? (
            <TableFrame headers={["Name", "Email", "Phone", "Role", "Joined", "Access"]}>
                {dashboard.users.map((user) => (
                    <tr key={user._id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{user.fullname}</td>
                        <td className="px-4 py-3 text-slate-600">{user.email}</td>
                        <td className="px-4 py-3 text-slate-600">{user.phoneNumber}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{user.role}</td>
                        <td className="px-4 py-3 text-slate-600">{dateLabel(user.createdAt)}</td>
                        <td className="px-4 py-3">
                            <Button size="sm" variant={user.isBlocked ? "outline" : "destructive"} disabled={busyId === user._id} onClick={() => update(user._id, `users/${user._id}/block`, { blocked: !user.isBlocked })}>
                                {user.isBlocked ? "Unblock" : "Block"}
                            </Button>
                        </td>
                    </tr>
                ))}
            </TableFrame>
        ) : <EmptyState>No student or recruiter accounts found.</EmptyState>
    );

    const renderCompanies = () => (
        dashboard?.companies?.length ? (
            <TableFrame headers={["Company", "Recruiter", "Location", "Status", "Created", "Moderation"]}>
                {dashboard.companies.map((company) => {
                    const status = company.moderationStatus || "approved";
                    return (
                        <tr key={company._id}>
                            <td className="px-4 py-3 font-medium text-slate-900">{company.name}</td>
                            <td className="px-4 py-3 text-slate-600">{company.userId?.fullname || company.userId?.email || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{company.location || "—"}</td>
                            <td className="px-4 py-3"><Status value={status} /></td>
                            <td className="px-4 py-3 text-slate-600">{dateLabel(company.createdAt)}</td>
                            <td className="px-4 py-3">
                                <div className="flex gap-2">
                                    <Button size="sm" disabled={busyId === company._id || status === "approved"} onClick={() => update(company._id, `companies/${company._id}/status`, { status: "approved" })}>Approve</Button>
                                    <Button size="sm" variant="outline" disabled={busyId === company._id || status === "rejected"} onClick={() => update(company._id, `companies/${company._id}/status`, { status: "rejected" })}>Reject</Button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </TableFrame>
        ) : <EmptyState>No registered companies found.</EmptyState>
    );

    const renderJobs = () => (
        dashboard?.jobs?.length ? (
            <TableFrame headers={["Job", "Company", "Recruiter", "Location", "Status", "Posted", "Moderation"]}>
                {dashboard.jobs.map((job) => {
                    const status = job.moderationStatus || "approved";
                    return (
                        <tr key={job._id}>
                            <td className="px-4 py-3 font-medium text-slate-900">{job.title}</td>
                            <td className="px-4 py-3 text-slate-600">{job.company?.name || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{job.created_by?.fullname || job.created_by?.email || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{job.location}</td>
                            <td className="px-4 py-3"><Status value={status} /></td>
                            <td className="px-4 py-3 text-slate-600">{dateLabel(job.createdAt)}</td>
                            <td className="px-4 py-3">
                                <div className="flex gap-2">
                                    <Button size="sm" disabled={busyId === job._id || status === "approved"} onClick={() => update(job._id, `jobs/${job._id}/status`, { status: "approved" })}>Approve</Button>
                                    <Button size="sm" variant="outline" disabled={busyId === job._id || status === "rejected"} onClick={() => update(job._id, `jobs/${job._id}/status`, { status: "rejected" })}>Reject / hide</Button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </TableFrame>
        ) : <EmptyState>No jobs found.</EmptyState>
    );

    const renderApplications = () => (
        dashboard?.applications?.length ? (
            <TableFrame headers={["Applicant", "Email", "Job", "Company", "Education", "City", "Experience", "Status", "Applied"]}>
                {dashboard.applications.map((application) => (
                    <tr key={application._id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{application.fullName || application.applicant?.fullname || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{application.applicant?.email || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{application.job?.title || "Job removed"}</td>
                        <td className="px-4 py-3 text-slate-600">{application.job?.company?.name || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{application.education || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{application.city || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{application.yearsOfExperience ?? "—"}</td>
                        <td className="px-4 py-3"><Status value={application.status} /></td>
                        <td className="px-4 py-3 text-slate-600">{dateLabel(application.createdAt)}</td>
                    </tr>
                ))}
            </TableFrame>
        ) : <EmptyState>No applications found.</EmptyState>
    );

    const renderReports = () => (
        dashboard?.reports?.length ? (
            <TableFrame headers={["Reported item", "Reported by", "Reason", "Details", "Status", "Date", "Review"]}>
                {dashboard.reports.map((report) => {
                    const isJob = report.targetType === "job";
                    const targetLabel = isJob ? report.targetJob?.title : report.targetUser?.fullname || report.targetUser?.email;
                    return (
                        <tr key={report._id}>
                            <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{targetLabel || "Removed item"}</p>
                                <p className="text-xs capitalize text-slate-500">{report.targetType}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{report.reporter?.fullname || report.reporter?.email || "—"}</td>
                            <td className="px-4 py-3 capitalize text-slate-600">{report.reason}</td>
                            <td className="max-w-56 truncate px-4 py-3 text-slate-600" title={report.details}>{report.details || "—"}</td>
                            <td className="px-4 py-3"><Status value={report.status} /></td>
                            <td className="px-4 py-3 text-slate-600">{dateLabel(report.createdAt)}</td>
                            <td className="px-4 py-3">
                                <select
                                    value={report.status}
                                    disabled={busyId === report._id}
                                    onChange={(event) => update(report._id, `reports/${report._id}/status`, { status: event.target.value })}
                                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                                    aria-label={`Review report for ${targetLabel || report.targetType}`}
                                >
                                    <option value="open" disabled>Open</option>
                                    <option value="reviewed">Reviewed</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="dismissed">Dismissed</option>
                                </select>
                            </td>
                        </tr>
                    );
                })}
            </TableFrame>
        ) : <EmptyState>No reports have been submitted.</EmptyState>
    );

    const sectionContent = {
        overview: renderOverview,
        users: renderUsers,
        companies: renderCompanies,
        jobs: renderJobs,
        applications: renderApplications,
        reports: renderReports
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                            <ShieldCheck className="h-4 w-4" /> Super Admin
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Portal dashboard</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage accounts, verify listings, and review reports.</p>
                    </div>
                    <Button variant="outline" onClick={loadDashboard} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Refresh data
                    </Button>
                </div>

                <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    {sections.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSection(item.id)}
                            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${section === item.id ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {loading && !dashboard ? (
                    <div className="flex min-h-64 items-center justify-center text-primary"><Loader2 className="h-7 w-7 animate-spin" /></div>
                ) : dashboard ? (
                    sectionContent[section]()
                ) : (
                    <EmptyState>Dashboard data could not be loaded. Use Refresh data to try again.</EmptyState>
                )}
            </main>
        </div>
    );
};

export default SuperAdminDashboard;
