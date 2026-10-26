import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Badge } from './ui/badge'
import { useSelector } from 'react-redux'

const AppliedJobTable = () => {
    const {allAppliedJobs} = useSelector(store=>store.job);
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableCaption>A list of your applied jobs</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Job Role</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Education follow-up</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        allAppliedJobs.length <= 0 ? <span>You haven't applied any job yet.</span> : allAppliedJobs.map((appliedJob) => (
                            <TableRow key={appliedJob._id}>
                                <TableCell>{appliedJob?.createdAt?.split("T")[0]}</TableCell>
                                <TableCell>{appliedJob.job?.title}</TableCell>
                                <TableCell>{appliedJob.job?.company?.name}</TableCell>
                                <TableCell className="text-sm">
                                    <div className="space-y-2">
                                        {appliedJob.clarificationRequest?.requestedAt && (
                                            <span className="block text-amber-700">{appliedJob.clarificationRequest.message}</span>
                                        )}
                                        {appliedJob.resumeAnalysisId && (
                                            <details>
                                            <summary className="cursor-pointer text-violet-700">Resume match: {appliedJob.resumeAnalysisId.score}/100</summary>
                                            <p className="mt-1 max-w-xs text-xs text-slate-600">{appliedJob.resumeAnalysisId.feedback}</p>
                                            <p className="mt-1 max-w-xs text-xs"><strong>Matched:</strong> {appliedJob.resumeAnalysisId.matchedSkills?.join(", ") || "None"}</p>
                                            <p className="mt-1 max-w-xs text-xs"><strong>Missing:</strong> {appliedJob.resumeAnalysisId.missingSkills?.join(", ") || "None"}</p>
                                            <p className="mt-1 max-w-xs text-xs"><strong>Keyword coverage:</strong> {appliedJob.resumeAnalysisId.keywords?.coverage ?? 0}%</p>
                                            <p className="mt-1 max-w-xs text-xs"><strong>Experience alignment:</strong> {appliedJob.resumeAnalysisId.experienceAlignment}</p>
                                            <p className="mt-1 max-w-xs text-xs"><strong>Qualifications:</strong> {appliedJob.resumeAnalysisId.evidence?.qualificationAlignment || "Not identified"}</p>
                                            <p className="mt-1 max-w-xs text-xs"><strong>Relevant projects:</strong> {appliedJob.resumeAnalysisId.evidence?.relevantProjects?.join(" · ") || "Not identified"}</p>
                                            </details>
                                        )}
                                        {!appliedJob.clarificationRequest?.requestedAt && !appliedJob.resumeAnalysisId && "—"}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right"><Badge className={`${appliedJob?.status === "rejected" ? 'bg-red-400' : appliedJob.status === 'pending' ? 'bg-gray-400' : 'bg-green-400'}`}>{appliedJob.status.toUpperCase()}</Badge></TableCell>
                            </TableRow>
                        ))
                    }
                </TableBody>
            </Table>
        </div>
    )
}

export default AppliedJobTable