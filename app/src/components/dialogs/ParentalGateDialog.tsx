import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"

interface ParentalGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problem: { q: string; a: number };
  answer: string;
  onAnswerChange: (val: string) => void;
  onVerify: () => void;
}

export function ParentalGateDialog({
  open,
  onOpenChange,
  problem,
  answer,
  onAnswerChange,
  onVerify,
}: ParentalGateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-white/10 text-white rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-center">Parents Only</DialogTitle>
        </DialogHeader>
        <div className="p-6 text-center space-y-6">
          <div className="bg-slate-800 p-8 rounded-3xl border border-white/5 shadow-inner">
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Solve this to continue</p>
            <h3 className="text-4xl font-black text-primary">{problem.q} = ?</h3>
          </div>
          <input
            type="number"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onVerify()}
            className="w-full h-16 bg-slate-800 rounded-2xl text-center text-2xl font-black outline-none border-2 border-transparent focus:border-primary/50 transition-all"
            placeholder="Result"
            autoFocus
          />
          <Button 
            onClick={onVerify}
            className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-primary/20"
          >
            Verify & Order
          </Button>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Verification required for children's app safety</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
