import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { MoreHorizontal } from 'lucide-react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { APPLICATION_API_END_POINT } from '@/utils/constant';
import axios from 'axios';
import ReportDialog from '../ReportDialog';
import { Button } from '../ui/button';

const shortlistingStatus = ["Accepted", "Rejected"];

const ApplicantsTable = () => {
    const { applicants } = useSelector(store => store.application);

    const statusHandler = async (status, id) => {
        try {
            const res = await axios.post(`${APPLICATION_API_END_POINT}/status/${id}/update`, { status }, { withCredentials: true });
            if (res.data.success) {
                toast.success(res.data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to update application status.");
        }
    };

    const requestClarification = async (application) => {
        try {
            const response = await axios.post(`${APPLICATION_API_END_POINT}/${application._id}/clarification`, {
                message: "Please review and clarify your education timeline."
            }, { withCredentials: true });
            if (response.data.success) toast.success(response.data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to request clarification.");
        }
    };

    const preferredGap = applicants?.maxPreferredEducationGapMonths;

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableCaption>A list of your recent applied user</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Full name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Education</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Experience (years)</TableHead>
                        <TableHead>Education Gap</TableHead>
                        <TableHead>Resume</TableHead>
                        <TableHead>Report</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        applicants && applicants?.applications?.map((item) => {
                            const timeline = item?.applicant?.educationTimeline;
                            const gapMonths = item.educationGapMonths ?? (timeline?.confirmed ? timeline.gapAnalysis?.confirmedMonths : null);
                            const gapIsKnown = Number.isInteger(gapMonths);
                            return (
                            <tr key={item._id}>
                                <TableCell>{item?.fullName || item?.applicant?.fullname}</TableCell>
                                <TableCell>{item?.applicant?.email}</TableCell>
                                <TableCell>{item?.phoneNumber || item?.applicant?.phoneNumber || "NA"}</TableCell>
                                <TableCell>{item?.education || "NA"}</TableCell>
                                <TableCell>{item?.city || "NA"}</TableCell>
                                <TableCell>{item?.yearsOfExperience ?? "NA"}</TableCell>
                                <TableCell>
                                    {gapIsKnown ? (
                                        <div>
                                            <span>{Math.floor(gapMonths / 12)}y {gapMonths % 12}m{item.educationGapMonths == null ? " (verified timeline)" : ""}</span>
                                            {Number.isInteger(preferredGap) && gapMonths > preferredGap && (
                                                <span className="mt-1 block rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                                                    Warning: exceeds preferred duration by {gapMonths - preferredGap} months
                                                </span>
                                            )}
                                            {(item.educationGapExplanation || timeline?.gapExplanation) && (
                                                <p className="mt-1 max-w-48 text-xs text-slate-500">{item.educationGapExplanation || timeline.gapExplanation}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Education Timeline Not Verified</span>
                                    )}
                                    <div className="mt-1 text-xs text-slate-500">
                                        Preferred: {Number.isInteger(preferredGap) ? `${Math.floor(preferredGap / 12)}y ${preferredGap % 12}m` : "No preference"}
                                    </div>
                                    {timeline?.entries?.length > 0 && (
                                        <details className="mt-1">
                                            <summary className="cursor-pointer text-xs text-violet-700">Academic timeline</summary>
                                            <ul className="mt-1 space-y-1 text-xs text-slate-600">
                                                {timeline.entries.map((entry) => (
                                                    <li key={entry._id}>{entry.qualification} · {entry.institution || "Institution not provided"} · {entry.startDate ? new Date(entry.startDate).getUTCFullYear() : "Date unknown"}–{entry.status === "ongoing" ? "Present" : entry.endDate ? new Date(entry.endDate).getUTCFullYear() : "Date unknown"}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                    <Button className="mt-2 h-auto px-2 py-1 text-xs" variant="outline" onClick={() => requestClarification(item)}>Request clarification</Button>
                                </TableCell>
                                <TableCell>
                                    {item?.resumeUrl || item?.applicant?.profile?.resume
                                        ? <a className="text-blue-600 cursor-pointer" href={item?.resumeUrl || item?.applicant?.profile?.resume} target="_blank" rel="noopener noreferrer">{item?.resumeOriginalName || item?.applicant?.profile?.resumeOriginalName || "View resume"}</a>
                                        : <span>NA</span>}
                                </TableCell>
                                <TableCell>
                                    {item?.applicant?._id && <ReportDialog userId={item.applicant._id} />}
                                </TableCell>
                                <TableCell>{item?.createdAt?.split("T")[0] || item?.applicant?.createdAt?.split("T")[0] || "NA"}</TableCell>
                                <TableCell className="float-right cursor-pointer">
                                    <Popover>
                                        <PopoverTrigger>
                                            <MoreHorizontal />
                                        </PopoverTrigger>
                                        <PopoverContent className="w-32">
                                            {
                                                shortlistingStatus.map((status, index) => {
                                                    return (
                                                        <div onClick={() => statusHandler(status, item?._id)} key={index} className='flex w-fit items-center my-2 cursor-pointer'>
                                                            <span>{status}</span>
                                                        </div>
                                                    )
                                                })
                                            }
                                        </PopoverContent>
                                    </Popover>

                                </TableCell>

                            </tr>
                        )})
                    }

                </TableBody>

            </Table>
        </div>
    )
}

export default ApplicantsTable