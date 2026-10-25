import { useState } from "react";
import axios from "axios";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { REPORT_API_END_POINT } from "@/utils/constant";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

const ReportDialog = ({ jobId, userId }) => {
    const [open, setOpen] = useState(false);
    const [targetType, setTargetType] = useState(jobId ? "job" : "user");
    const [reason, setReason] = useState("misleading");
    const [details, setDetails] = useState("");
    const [loading, setLoading] = useState(false);

    const submitReport = async (event) => {
        event.preventDefault();
        const targetId = targetType === "job" ? jobId : userId;
        if (!targetId) {
            toast.error("The selected item is not available to report.");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(REPORT_API_END_POINT, {
                targetType,
                targetId,
                reason,
                details
            }, { withCredentials: true });
            if (response.data.success) {
                toast.success(response.data.message);
                setOpen(false);
                setDetails("");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Unable to submit this report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                <Flag className="mr-2 h-4 w-4" /> Report
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 bg-white sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Report a concern</DialogTitle>
                        <DialogDescription>Reports are reviewed by the portal administrator.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitReport} className="space-y-4">
                        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                            Report
                            <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                                {jobId && <option value="job">This job listing</option>}
                                {userId && <option value="user">This recruiter</option>}
                            </select>
                        </label>
                        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                            Reason
                            <select value={reason} onChange={(event) => setReason(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                                <option value="fraud">Fraud or scam</option>
                                <option value="misleading">False or misleading information</option>
                                <option value="harassment">Harassment or unsafe conduct</option>
                                <option value="spam">Spam</option>
                                <option value="other">Other</option>
                            </select>
                        </label>
                        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                            Additional details (optional)
                            <textarea
                                value={details}
                                onChange={(event) => setDetails(event.target.value)}
                                maxLength={1000}
                                rows={4}
                                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                                placeholder="Describe what should be reviewed."
                            />
                        </label>
                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Submitting..." : "Submit report"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ReportDialog;
