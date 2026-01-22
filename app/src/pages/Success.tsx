import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2, Receipt, FileDown, Star } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('bookId');
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (bookId) {
      setLoading(false); // Set loading to false immediately after setting up the interval
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/book-status?bookId=${bookId}`);
          if (res.data.pdfUrl) {
            setPdfUrl(res.data.pdfUrl);
            clearInterval(interval);
          }
        } catch (e: any) {
          console.error('Polling failed', e);
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p className="text-slate-400 font-medium tracking-wide">Confirming your order...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 bg-slate-950 min-h-screen text-white font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center mb-16 space-y-6"
      >
        <div className="flex justify-center gap-3">
          <Star className="text-amber-400 fill-current animate-pulse" />
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-500/10 rounded-full text-green-500 shadow-inner">
            <CheckCircle2 size={48} />
          </div>
          <Star className="text-amber-400 fill-current animate-pulse delay-75" />
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Magic Confirmed!</h1>
          <p className="text-xl text-slate-400 font-medium">Your book is being handcrafted right now.</p>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-slate-900/50 rounded-[2.5rem] p-10 border border-white/5 shadow-2xl space-y-8">
          <h2 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
            <Receipt className="text-primary" /> Order Summary
          </h2>
          <div className="space-y-6 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Product</span>
              <span className="font-bold">Hardcover Storybook</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Total Paid</span>
              <span className="font-black text-lg">$25.00 AUD</span>
            </div>
            <div className="pt-6 border-t border-white/5 flex justify-between items-center">
              <span className="px-4 py-1.5 bg-green-500/10 text-green-500 rounded-full font-black text-[10px] uppercase tracking-widest ring-1 ring-green-500/20">Verified Paid</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/30 rounded-[2.5rem] p-10 border border-white/5 shadow-inner space-y-8">
          <h2 className="font-black text-xl uppercase tracking-tighter">The Journey</h2>
          <div className="space-y-8">
            <div className="flex gap-5">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-lg">1</div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-widest text-primary mb-1">Painting</h3>
                <p className="text-sm text-slate-400 leading-relaxed">AI is illustrating all 23 pages of your unique story.</p>
              </div>
            </div>
            <div className="flex gap-5 opacity-50">
              <div className="w-12 h-12 bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center font-black text-xl shrink-0">2</div>
              <div>
                <h3 className="font-black uppercase text-xs tracking-widest mb-1">Printing</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Your book will be printed and bound locally.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-10 mt-16 pb-20">
        {!pdfUrl ? (
          <div className="w-full max-w-md bg-gradient-to-br from-primary/10 to-purple-500/10 p-10 rounded-[3rem] border border-primary/20 text-center shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 animate-pulse" />
            <Loader2 className="animate-spin text-primary mx-auto mb-6 relative z-10" size={40} />
            <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] relative z-10">
              Preparing your <br/> High-Resolution PDF...
            </p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-4 relative z-10 italic">Est. time: 6-8 mins</p>
          </div>
        ) : (
          <a href={pdfUrl} target="_blank" className="w-full max-w-md animate-in zoom-in duration-1000">
            <button className="w-full h-24 bg-green-600 text-white rounded-[2rem] font-black text-2xl uppercase tracking-widest shadow-2xl shadow-green-500/30 flex items-center justify-center gap-4 hover:scale-[1.02] transition-all active:scale-95 group hover:shadow-green-500/40">
              <FileDown size={32} className="group-hover:translate-y-1 transition-transform" /> Download PDF
            </button>
          </a>
        )}

        <div className="flex flex-col gap-4 w-full max-w-md">
          <Link to="/" className="w-full h-16 bg-white text-slate-900 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 shadow-xl hover:bg-slate-100 active:scale-98 transition-all group hover:shadow-2xl hover:shadow-primary/20">
            Create Another Adventure <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform text-primary" />
          </Link>
          <p className="text-center text-slate-600 font-bold text-[10px] uppercase tracking-[0.3em]">Thank you for your magic!</p>
        </div>
      </div>
    </div>
  );
}