import { useEffect, useState } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { APPLICATION_API_END_POINT, JOB_API_END_POINT } from '@/utils/constant';
import { setSingleJob } from '@/redux/jobSlice';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2 } from 'lucide-react';
import ReportDialog from './ReportDialog';

const JobDescription = () => {
    const {singleJob} = useSelector(store => store.job);
    const {user} = useSelector(store=>store.auth);
    const isIntiallyApplied = singleJob?.applications?.some(application => (application.applicant?._id || application.applicant) === user?._id) || false;
    const [isApplied, setIsApplied] = useState(isIntiallyApplied);
    const [applicationDialogOpen, setApplicationDialogOpen] = useState(false);
    const [applicationLoading, setApplicationLoading] = useState(false);
    const [resume, setResume] = useState(null);
    const [applicationForm, setApplicationForm] = useState({
        fullName: user?.fullname || "",
        education: "",
        city: "",
        phoneNumber: user?.phoneNumber?.toString() || "",
        yearsOfExperience: ""
    });

    const params = useParams();
    const jobId = params.id;
    const dispatch = useDispatch();

    const applicationFieldChangeHandler = (event) => {
        setApplicationForm({ ...applicationForm, [event.target.name]: event.target.value });
    };

    const applyJobHandler = async (event) => {
        event.preventDefault();

        if (!resume) {
            toast.error("Please attach your resume as a PDF.");
            return;
        }

        const formData = new FormData();
        Object.entries(applicationForm).forEach(([field, value]) => formData.append(field, value));
        formData.append("resume", resume);

        try {
            setApplicationLoading(true);
            const res = await axios.post(`${APPLICATION_API_END_POINT}/apply/${jobId}`, formData, {withCredentials:true});
            
            if(res.data.success){
                setIsApplied(true);
                setApplicationDialogOpen(false);
                const updatedSingleJob = {
                    ...singleJob,
                    applications: [...(singleJob?.applications || []), { applicant: user?._id }]
                };
                dispatch(setSingleJob(updatedSingleJob));
                toast.success(res.data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.response?.data?.message || "Unable to submit your application. Please try again.");
        } finally {
            setApplicationLoading(false);
        }
    }

    const handleApplyClick = () => {
        if (!user) {
            toast.error("Please log in as a student to apply.");
            return;
        }
        if (user.role !== "student") {
            toast.error("Only student accounts can apply for jobs.");
            return;
        }
        setApplicationDialogOpen(true);
    };

    useEffect(()=>{
        const fetchSingleJob = async () => {
            try {
                const res = await axios.get(`${JOB_API_END_POINT}/get/${jobId}`,{withCredentials:true});
                if(res.data.success){
                    dispatch(setSingleJob(res.data.job));
                    setIsApplied(res.data.job.applications.some(application => (application.applicant?._id || application.applicant) === user?._id));
                }
            } catch (error) {
                console.log(error);
            }
        }
        fetchSingleJob(); 
    },[jobId,dispatch, user?._id]);

    return (
        <div className='max-w-7xl mx-auto my-10'>
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <h1 className='font-bold text-xl'>{singleJob?.title}</h1>
                    <div className='flex items-center gap-2 mt-4'>
                        <Badge className={'text-blue-700 font-bold'} variant="ghost">{singleJob?.postion} Positions</Badge>
                        <Badge className={'text-[#F83002] font-bold'} variant="ghost">{singleJob?.jobType}</Badge>
                        <Badge className={'text-[#7209b7] font-bold'} variant="ghost">{singleJob?.salary}LPA</Badge>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {user && ["student", "recruiter"].includes(user.role) && singleJob?.created_by?._id !== user._id && (
                        <ReportDialog jobId={singleJob?._id} userId={singleJob?.created_by?._id} />
                    )}
                    <Button
                        onClick={handleApplyClick}
                        disabled={isApplied}
                        className={`rounded-lg ${isApplied ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#7209b7] hover:bg-[#5f32ad]'}`}>
                        {isApplied ? 'Already Applied' : 'Apply Now'}
                    </Button>
                </div>
            </div>
            <Dialog open={applicationDialogOpen} onOpenChange={(open) => {
                setApplicationDialogOpen(open);
                if (!open) setResume(null);
            }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 bg-white sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-slate-900">Apply for {singleJob?.title}</DialogTitle>
                        <DialogDescription>Fill in your details and attach a PDF resume to submit your application.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={applyJobHandler} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="application-full-name">Full name</Label>
                            <Input id="application-full-name" name="fullName" value={applicationForm.fullName} onChange={applicationFieldChangeHandler} required maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="application-education">Education</Label>
                            <Input id="application-education" name="education" value={applicationForm.education} onChange={applicationFieldChangeHandler} placeholder="e.g. B.Tech in Computer Science" required maxLength={150} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="application-city">City</Label>
                            <Input id="application-city" name="city" value={applicationForm.city} onChange={applicationFieldChangeHandler} required maxLength={100} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="application-phone">Mobile number</Label>
                            <Input id="application-phone" name="phoneNumber" type="tel" value={applicationForm.phoneNumber} onChange={applicationFieldChangeHandler} required minLength={7} maxLength={20} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="application-experience">Years of experience</Label>
                            <Input id="application-experience" name="yearsOfExperience" type="number" min="0" step="0.5" value={applicationForm.yearsOfExperience} onChange={applicationFieldChangeHandler} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="application-resume">Resume (PDF, max 10 MB)</Label>
                            <Input id="application-resume" type="file" accept=".pdf,application/pdf" onChange={(event) => setResume(event.target.files?.[0] || null)} required />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={applicationLoading}>
                                {applicationLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting</> : "Submit application"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <h1 className='border-b-2 border-b-gray-300 font-medium py-4'>Job Description</h1>
            <div className='my-4'>
                <h1 className='font-bold my-1'>Role: <span className='pl-4 font-normal text-gray-800'>{singleJob?.title}</span></h1>
                <h1 className='font-bold my-1'>Location: <span className='pl-4 font-normal text-gray-800'>{singleJob?.location}</span></h1>
                <h1 className='font-bold my-1'>Description: <span className='pl-4 font-normal text-gray-800'>{singleJob?.description}</span></h1>
                <h1 className='font-bold my-1'>Experience: <span className='pl-4 font-normal text-gray-800'>{singleJob?.experienceLevel} yrs</span></h1>
                <h1 className='font-bold my-1'>Salary: <span className='pl-4 font-normal text-gray-800'>{singleJob?.salary}LPA</span></h1>
                <h1 className='font-bold my-1'>Total Applicants: <span className='pl-4 font-normal text-gray-800'>{singleJob?.applications?.length}</span></h1>
                <h1 className='font-bold my-1'>Posted Date: <span className='pl-4 font-normal text-gray-800'>{singleJob?.createdAt.split("T")[0]}</span></h1>
            </div>
        </div>
    )
}

export default JobDescription