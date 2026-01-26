import { User as CircleUser, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import type { Book } from '../types/book';

interface User {
  name: string;
  email: string;
  lastShippingAddress?: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postCode: string;
    country: string;
  };
}

interface AccountSectionProps {
  user: User | null;
  orders: any[];
  library: Book[];
  onLogout: () => void;
  onDeleteRequest: () => void;
  onLogin: () => void;
}

export function AccountSection({
  user,
  orders,
  library,
  onLogout,
  onDeleteRequest,
  onLogin,
}: AccountSectionProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-slate-900/50 p-12 rounded-[3.5rem] border border-white/5 flex flex-col items-center gap-8 text-center shadow-2xl transition-all hover:border-primary/20">
        <div className="w-32 h-32 bg-gradient-to-br from-primary via-purple-600 to-pink-600 rounded-[2.5rem] flex items-center justify-center text-5xl font-black shadow-2xl border-4 border-white/10 rotate-3">
          {user?.name?.[0] || '?'}
        </div>
        <div className="space-y-2">
          <h2 className="text-5xl font-black uppercase tracking-tighter text-white">{user?.name || 'Guest'}</h2>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs underline underline-offset-8 decoration-primary/30">{user?.email || 'Login to sync collections'}</p>
        </div>

        <div className="grid grid-cols-1 w-full gap-6 mt-6">
          <div className="bg-slate-950/50 p-10 rounded-[2.5rem] border border-white/5 space-y-8">
            <h3 className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-600">Adventurer Statistics</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-4xl font-black text-white">{library.length}</p>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Adventures</p>
              </div>
              <div className="space-y-2 border-x border-white/5 px-2">
                <p className="text-4xl font-black text-primary">{library.filter(b => b.isDigitalUnlocked || b.pdfUrl).length}</p>
                <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Unlocked</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-black text-white">{orders.length}</p>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Physical</p>
              </div>
            </div>
          </div>

          {user?.lastShippingAddress && (
            <div className="bg-slate-950/50 p-10 rounded-[2.5rem] border border-white/5 space-y-6 text-left">
              <h3 className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-600">Last Shipping Address</h3>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">{user.lastShippingAddress.firstName} {user.lastShippingAddress.lastName}</p>
                <p className="text-xs text-slate-400">{user.lastShippingAddress.addressLine1}</p>
                {user.lastShippingAddress.addressLine2 && <p className="text-xs text-slate-400">{user.lastShippingAddress.addressLine2}</p>}
                <p className="text-xs text-slate-400">
                  {user.lastShippingAddress.city}, {user.lastShippingAddress.state} {user.lastShippingAddress.postCode}
                </p>
                <p className="text-[10px] font-black uppercase text-slate-600 mt-2">{user.lastShippingAddress.country}</p>
              </div>
            </div>
          )}

          {user ? (
            <div className="space-y-4">
              <button onClick={onLogout} className="w-full h-20 bg-white/5 text-white/50 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 hover:text-white transition-all border border-white/5 flex items-center justify-center gap-3 active:scale-95 group">
                Logout and End Session
              </button>
              <button onClick={onDeleteRequest} className="w-full h-14 bg-red-500/5 text-red-500/50 rounded-xl font-black uppercase tracking-[0.2em] text-[8px] hover:bg-red-500/10 hover:text-red-500 transition-all border border-red-500/10 flex items-center justify-center gap-3 active:scale-95 group">
                <Trash2 size={12} className="group-hover:animate-bounce" /> Delete My Account & Data
              </button>
              <a href="/privacy" target="_blank" className="block text-[8px] font-black uppercase text-slate-600 hover:text-primary transition-colors text-center tracking-widest">
                Terms & Privacy Policy
              </a>
            </div>
          ) : (
            <Button onClick={onLogin} size="lg" className="h-20 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl">Sign In with Google</Button>
          )}
        </div>
      </div>
    </div>
  );
}
