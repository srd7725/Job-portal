import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { LogOut, User2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'
import { USER_API_END_POINT } from '@/utils/constant'
import { setUser } from '@/redux/authSlice'
import { toast } from 'sonner'

const Navbar = () => {
    const { user } = useSelector(store => store.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const logoutHandler = async () => {
        try {
            const res = await axios.get(`${USER_API_END_POINT}/logout`, { withCredentials: true });
            if (res.data.success) {
                navigate("/");
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message || "Could not log out.");
            }
        } catch (error) {
            console.log(error);
            toast.error(error.response?.data?.message || "Could not reach the server. You have been signed out on this device.");
        } finally {
            dispatch(setUser(null));
            navigate("/");
        }
    }
    return (
        <div className='bg-white'>
            <div className='mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2'>
                <div>
                    <h1 className='text-2xl font-bold'>Job<span className='text-[#F83002]'>Portal</span></h1>
                </div>
                <div className='flex items-center gap-5'>
                    <ul className='flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm font-medium lg:gap-5'>
                        {
                            user && user.role === 'superadmin' ? (
                                <li><Link to="/super-admin">Admin Dashboard</Link></li>
                            ) : user && user.role === 'recruiter' ? (
                                <>
                                    <li><Link to="/admin/companies">Companies</Link></li>
                                    <li><Link to="/admin/jobs">Jobs</Link></li>
                                    <li><Link to="/admin/ai-screening">AI Screening</Link></li>
                                </>
                            ) : (
                                <>
                                    <li><Link to="/">Home</Link></li>
                                    <li><Link to="/jobs">Jobs</Link></li>
                                    <li><Link to="/browse">Browse</Link></li>
                                    {user?.role === "student" && <li><Link to="/student/mock-interview">Mock Interview</Link></li>}
                                    {user?.role === "student" && <li><Link to="/student/education">Education</Link></li>}
                                </>
                            )
                        }


                    </ul>
                    {
                        !user ? (
                            <div className='flex items-center gap-2'>
                                <Link to="/login"><Button variant="outline">Login</Button></Link>
                                <Link to="/signup"><Button className="bg-[#6A38C2] hover:bg-[#5b30a6]">Signup</Button></Link>
                            </div>
                        ) : (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Avatar className="mr-5 cursor-pointer" aria-label="Open account menu">
                                        <AvatarImage src={user?.profile?.profilePhoto} alt={user?.fullname || "User"} />
                                        <AvatarFallback>{user?.fullname?.trim()?.charAt(0)?.toUpperCase() || <User2 className="h-5 w-5" />}</AvatarFallback>
                                    </Avatar>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                    <div className=''>
                                        <div className='flex gap-2 space-y-2'>
                                            <Avatar className="cursor-pointer">
                                                <AvatarImage src={user?.profile?.profilePhoto} alt={user?.fullname || "User"} />
                                                <AvatarFallback>{user?.fullname?.trim()?.charAt(0)?.toUpperCase() || <User2 className="h-5 w-5" />}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h4 className='font-medium'>{user?.fullname}</h4>
                                                <p className='text-sm text-muted-foreground'>{user?.profile?.bio}</p>
                                            </div>
                                        </div>
                                        <div className='flex flex-col my-2 text-gray-600'>
                                            <Link to="/profile" className='flex w-fit items-center gap-2 text-sm text-primary hover:underline'>
                                                <User2 className="h-4 w-4" />
                                                <span>View Profile</span>
                                            </Link>

                                            <div className='flex w-fit items-center gap-2 cursor-pointer'>
                                                <LogOut />
                                                <Button onClick={logoutHandler} variant="link">Logout</Button>
                                            </div>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )
                    }

                </div>
            </div>

        </div>
    )
}

export default Navbar