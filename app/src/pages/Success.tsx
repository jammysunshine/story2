import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2, Receipt, FileDown, Star, BookOpen, Sparkles, User as CircleUser, FileText } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://10.202.14.197:3001/api';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('bookId');
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const navigateToTab = (tab: string) => {
    localStorage.setItem('activeTab', tab);
    window.location.href = '/';
  };

  const MagicGlow = ({ color = 'pink' }: { color?: 'pink' | 'amber' | 'blue' | 'purple' | 'green' }) => {
    const colorMap: Record<string, string> = {
      pink: 'from-pink-600/50 to-rose-600/50 border-pink-600/70',
      amber: 'from-amber-600/50 to-orange-600/50 border-amber-600/70',
      blue: 'from-blue-600/50 to-indigo-600/50 border-blue-600/70',
      purple: 'from-purple-600/50 to-indigo-600/50 border-purple-600/70',
      green: 'from-green-600/50 to-emerald-600/50 border-green-600/70'
    };

    return (
      <div className="relative w-48 h-48 mx-auto group">
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes magic-float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }
          @keyframes magic-glow-1 {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.3); opacity: 0.8; }
          }
          @keyframes magic-glow-2 {
            0%, 100% { transform: scale(1.1); opacity: 0.3; }
            50% { transform: scale(1.6); opacity: 0.6; }
          }
          @keyframes magic-pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.1); opacity: 1; }
          }
          .animate-magic-float { animation: magic-float 3s ease-in-out infinite; }
          .animate-magic-glow-1 { animation: magic-glow-1 3s ease-in-out infinite; }
          .animate-magic-glow-2 { animation: magic-glow-2 4s ease-in-out infinite; }
          .animate-magic-pulse { animation: magic-pulse 2s ease-in-out infinite; }
        `}} />
        <div className={`absolute inset-0 bg-gradient-to-tr ${colorMap[color]} rounded-full blur-3xl animate-magic-glow-2`} />
        <div className={`absolute inset-0 bg-gradient-to-tr ${colorMap[color]} rounded-full blur-xl animate-magic-glow-1`} />
        <div className={`relative bg-slate-900/90 backdrop-blur-md border-4 ${colorMap[color].split(' ').pop()} w-full h-full rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.7)] animate-magic-pulse`}>
          <BookOpen className="text-white w-20 h-20 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Set flag so MainCreator knows to refresh book state
    if (bookId) {
      localStorage.setItem('justPaid', 'true');
    }
  }, [bookId]);

  useEffect(() => {
    let intervalId: any = null;

    const pollStatus = async () => {
      if (!bookId) return;
      try {
        const res = await axios.get(`${API_URL}/book-status?bookId=${bookId}`);
        if (res.data.pdfUrl) {
          setPdfUrl(res.data.pdfUrl);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (e) {
        console.error('Success page polling failed:', e);
      }
    };

    if (bookId) {
      pollStatus(); // Run once immediately
      intervalId = setInterval(pollStatus, 10000);
    }

    // Set loading to false after a short delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => {
      if (intervalId) clearInterval(intervalId);
      clearTimeout(timer);
    };
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
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center mb-12 pt-[env(safe-area-inset-top)] gap-6 max-w-7xl mx-auto">
        <h1
          onClick={() => navigateToTab('creator')}
          className="text-2xl font-black tracking-tighter uppercase text-primary flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
        >
          <BookOpen className="text-primary" /> StoryTime
        </h1>

        <nav className="flex items-center bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
          <button
            onClick={() => navigateToTab('creator')}
            className="px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <Sparkles size={14} /> Creator
          </button>
          <button
            onClick={() => navigateToTab('bookshelf')}
            className="px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <BookOpen size={14} /> Bookshelf
          </button>
          <button
            onClick={() => navigateToTab('account')}
            className="px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <CircleUser size={14} /> Account
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user && (
            <div className="bg-slate-800 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-white/10">
              {user.name?.split(' ')[0] || 'Explorer'}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto">
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
                <span className="font-black text-lg">${Number(import.meta.env.VITE_PRINT_PRICE || '25').toFixed(2)} {(import.meta.env.VITE_BASE_CURRENCY || 'aud').toUpperCase()}</span>
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
            <div className="w-full max-w-md text-center space-y-8">
              <MagicGlow color="pink" />
              <div className="space-y-4">
                <p className="text-xl font-black text-white uppercase tracking-wider">Crafting Your PDF</p>
                <p className="text-sm text-slate-400">Assembling your beautifully illustrated book into a high-quality PDF...</p>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest italic">Est. time: 6-8 mins</p>
              </div>
            </div>
          ) : (
            <a href={pdfUrl} target="_blank" className="w-full max-w-md animate-in zoom-in duration-1000">
              <button className="w-full h-24 bg-green-600 text-white rounded-[2rem] font-black text-2xl uppercase tracking-widest shadow-2xl shadow-green-500/30 flex items-center justify-center gap-4 hover:scale-[1.02] transition-all active:scale-95 group hover:shadow-green-500/40">
                <FileDown size={32} className="group-hover:translate-y-1 transition-transform" /> Download PDF
              </button>
            </a>
          )}

          <div className="flex flex-col gap-4 w-full max-w-md">
            <Link
              to="/"
              onClick={() => {
                localStorage.removeItem('book');
                localStorage.setItem('step', '1');
                localStorage.setItem('activeTab', 'creator');
              }}
              className="w-full h-16 bg-white text-slate-900 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 shadow-xl hover:bg-slate-100 active:scale-98 transition-all group hover:shadow-2xl hover:shadow-primary/20"
            >
              Create Another Adventure <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform text-primary" />
            </Link>
            <p className="text-center text-slate-600 font-bold text-[10px] uppercase tracking-[0.3em]">Thank you for your magic!</p>
          </div>
        </div>
      </div>
    </div>
  );
}