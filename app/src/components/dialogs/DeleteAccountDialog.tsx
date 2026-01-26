import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Loader2, Trash2 } from "lucide-react"

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmation: string;
  onConfirmationChange: (val: string) => void;
  onDelete: () => void;
  loading: boolean;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  confirmation,
  onConfirmationChange,
  onDelete,
  loading,
}: DeleteAccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 border-red-900/50 text-white rounded-[2rem] shadow-[0_0_50px_rgba(220,38,38,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-red-500 text-center flex items-center justify-center gap-2">
            <Trash2 size={24} /> Account Termination
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-6">
          <div className="bg-red-950/20 p-6 rounded-2xl border border-red-900/30 text-center">
            <p className="text-red-200/70 text-xs font-bold uppercase tracking-widest leading-relaxed">
              This process is irreversible. All of your stories, images, and profile data will be permanently wiped from our secure vault.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Confirm Identity</label>
            <p className="text-[10px] text-slate-400 mb-2">Please type <span className="text-red-500 font-black italic">DELETE</span> to confirm your intent.</p>
            <input 
              type="text"
              value={confirmation}
              onChange={(e) => onConfirmationChange(e.target.value)}
              className="w-full h-16 bg-slate-900 rounded-2xl text-center text-xl font-black outline-none border-2 border-transparent focus:border-red-600/50 transition-all placeholder:text-slate-800"
              placeholder="---"
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={onDelete}
              disabled={loading || confirmation !== 'DELETE'}
              className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-red-900/20 active:scale-[0.98] transition-all disabled:opacity-20"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Terminate Account"}
            </Button>
            <button 
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Cancel and Stay
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
