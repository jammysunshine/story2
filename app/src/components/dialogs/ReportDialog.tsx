import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Loader2, Flag } from "lucide-react"

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (val: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function ReportDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  loading,
}: ReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 border-red-900/50 text-white rounded-[2rem] shadow-[0_0_50px_rgba(220,38,38,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-red-500 text-center flex items-center justify-center gap-2">
            <Flag size={24} className="fill-current" /> Safety Intervention
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-6">
          <div className="bg-red-950/20 p-6 rounded-2xl border border-red-900/30 text-center">
            <p className="text-red-200/70 text-xs font-bold uppercase tracking-widest leading-relaxed">
              You are about to flag content as inappropriate. This action will trigger a formal human review of the story and associated AI models.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nature of Concern</label>
            <textarea 
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              className="w-full h-32 bg-slate-900 rounded-2xl p-4 text-sm outline-none border-2 border-transparent focus:border-red-600/50 transition-all resize-none placeholder:text-slate-700"
              placeholder="Describe the violation in detail..."
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={onSubmit}
              disabled={loading}
              className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-red-900/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : "File Formal Report"}
            </Button>
            <button 
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
