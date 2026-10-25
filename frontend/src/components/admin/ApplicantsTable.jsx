import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { MoreHorizontal } from 'lucide-react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { APPLICATION_API_END_POINT } from '@/utils/constant';
import axios from 'axios';
import ReportDialog from '../ReportDialog';

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
    }

    return (
        <div>
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
                        <TableHead>Resume</TableHead>
                        <TableHead>Report</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        applicants && applicants?.applications?.map((item) => (
                            <tr key={item._id}>
                                <TableCell>{item?.fullName || item?.applicant?.fullname}</TableCell>
                                <TableCell>{item?.applicant?.email}</TableCell>
                                <TableCell>{item?.phoneNumber || item?.applicant?.phoneNumber || "NA"}</TableCell>
                                <TableCell>{item?.education || "NA"}</TableCell>
                                <TableCell>{item?.city || "NA"}</TableCell>
                                <TableCell>{item?.yearsOfExperience ?? "NA"}</TableCell>
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
                        ))
                    }

                </TableBody>

            </Table>
        </div>
    )
}

export default ApplicantsTable