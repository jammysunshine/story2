import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2, Receipt, FileDown, Star, BookOpen, Sparkles, User as CircleUser, FileText, Flag } from 'lucide-react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('bookId');
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const reportContent = async (pageNumber: number) => {
    const reason = window.prompt('Please describe why you are reporting this content (e.g., offensive image, inappropriate text):');
    if (!reason) return;

    try {
      await axios.post(`${API_URL}/report-content`, {
        bookId,
        reporterEmail: user?.email || 'anonymous',
        pageNumber,
        reason
      });
      alert("Report Submitted. Thank you. Our safety team will review this content.");
    } catch (e) {
      console.error('Failed to submit report:', e);
    }
  };

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
      
      // AUTO-DEEP LINK logic for Mobile
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        console.log('🚀 Attempting deep link return to app...');
        window.location.href = `com.aistorytime.app://success?bookId=${bookId}`;
      }
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
          onClick={() => {
            localStorage.removeItem('book');
            localStorage.setItem('step', '1');
            navigateToTab('creator');
          }}
          className="text-2xl font-black tracking-tighter uppercase text-primary flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
        >
          <BookOpen className="text-primary" /> WonderStories
        </h1>

        <nav className="flex items-center bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
          <button
            onClick={() => {
              localStorage.removeItem('book');
              localStorage.setItem('step', '1');
              navigateToTab('creator');
            }}
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
                <p className="text-xl font-black text-white uppercase tracking-wider">Painting Your Masterpiece</p>
                <p className="text-sm text-slate-400">Our AI artists are illustrating all 23 pages. This usually takes 5-7 minutes.</p>
                <p className="text-sm font-bold text-primary px-6 py-3 bg-primary/10 rounded-2xl border border-primary/20">
                  ✨ You don't need to wait here! We'll email you at {user?.email || 'your email'} when it's ready.
                </p>
                <button
                  onClick={() => navigateToTab('bookshelf')}
                  className="mt-6 w-full h-14 bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-white/20 active:scale-95 transition-all group"
                >
                  <BookOpen className="text-primary" /> Go to My Bookshelf
                </button>
                <button
                  onClick={() => reportContent(1)}
                  className="mt-4 w-full py-2 text-slate-600 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 opacity-30 hover:opacity-100"
                >
                  <Flag size={8} className="text-red-500 fill-current" /> Report Inappropriate Content
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-6 animate-in zoom-in duration-1000">
              <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-[2rem] text-center">
                <p className="text-green-500 font-black uppercase tracking-widest text-xs mb-2">Success!</p>
                <p className="text-white font-bold">Your high-resolution PDF is ready for download.</p>
              </div>
              <a href={pdfUrl} target="_blank" className="block">
                <button className="w-full h-24 bg-green-600 text-white rounded-[2rem] font-black text-2xl uppercase tracking-widest shadow-2xl shadow-green-500/30 flex items-center justify-center gap-4 hover:scale-[1.02] transition-all active:scale-95 group hover:shadow-green-500/40">
                  <FileDown size={32} className="group-hover:translate-y-1 transition-transform" /> Download PDF
                </button>
              </a>
            </div>
          )}

          <div className="flex flex-col gap-4 w-full max-w-md">
            <Link
              to="/"
              onClick={() => {
                localStorage.removeItem('book');
                localStorage.setItem('step', '1');
                localStorage.setItem('activeTab', 'creator');
              }}
              className="w-full h-20 bg-white text-slate-900 rounded-[1.5rem] font-black uppercase text-lg flex items-center justify-center gap-3 shadow-2xl hover:bg-slate-100 active:scale-95 transition-all group hover:shadow-primary/20"
            >
              <Sparkles className="text-primary animate-pulse" /> Create Another Adventure <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform text-primary" />
            </Link>
            <p className="text-center text-slate-600 font-bold text-[10px] uppercase tracking-[0.3em]">The magic continues in your library</p>
          </div>
        </div>
      </div>
    </div>
  );
}