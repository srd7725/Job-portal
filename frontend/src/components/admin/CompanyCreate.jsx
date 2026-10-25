import { useState } from 'react'
import Navbar from '../shared/Navbar'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { COMPANY_API_END_POINT } from '@/utils/constant'
import { toast } from 'sonner'
import { useDispatch } from 'react-redux'
import { setSingleCompany } from '@/redux/companySlice'
import { Loader2 } from 'lucide-react'

const CompanyCreate = () => {
    const navigate = useNavigate();
    const [companyName, setCompanyName] = useState("");
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();
    const registerNewCompany = async () => {
        const trimmedCompanyName = companyName.trim();
        if (!trimmedCompanyName) {
            toast.error("Please enter a company name.");
            return;
        }

        try {
            setLoading(true);
            const res = await axios.post(`${COMPANY_API_END_POINT}/register`, { companyName: trimmedCompanyName }, {
                headers:{
                    'Content-Type':'application/json'
                },
                withCredentials:true
            });
            if(res?.data?.success){
                dispatch(setSingleCompany(res.data.company));
                toast.success(res.data.message);
                const companyId = res?.data?.company?._id;
                navigate(`/admin/companies/${companyId}`);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.response?.data?.message || "Unable to create the company. Please try again.");
        } finally {
            setLoading(false);
        }
    }
    return (
        <div>
            <Navbar />
            <div className='mx-auto max-w-4xl px-4 py-6 sm:py-10'>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8">
                <div className='my-10'>
                    <h1 className='text-2xl font-bold tracking-tight text-slate-900'>Your company name</h1>
                    <p className='mt-2 text-slate-500'>Choose a name for your company. You can update the details later.</p>
                </div>

                <Label>Company Name</Label>
                <Input
                    type="text"
                    className="my-2"
                    placeholder="JobHunt, Microsoft etc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                />
                <div className='flex items-center gap-2 my-10'>
                    <Button variant="outline" onClick={() => navigate("/admin/companies")}>Cancel</Button>
                    <Button onClick={registerNewCompany} disabled={loading}>
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait</> : "Continue"}
                    </Button>
                </div>
                </div>
            </div>
        </div>
    )
}

export default CompanyCreate