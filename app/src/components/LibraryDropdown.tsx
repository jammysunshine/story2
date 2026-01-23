import { useState } from 'react';
import { Book, ChevronDown, Download, Eye, Loader2, Trash2, ShoppingCart, CheckCircle2, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useToast } from "../hooks/use-toast";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function LibraryDropdown({ user }: { user: any }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'none' | 'story' | 'images'>('none');
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [books, setBooks] = useState<any[]>([]);

  const fetchBooks = async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/orders`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      // ENHANCEMENT: Fetch thumbnails and titles for each order
      const ordersWithData = await Promise.all((res.data.orders || []).map(async (order: any) => {
        try {
          const bookRes = await axios.get(`${API_URL}/book-status?bookId=${order.bookId}`);
          return {
            ...order,
            bookTitle: bookRes.data.pages?.[0]?.title || 'Adventure Story',
            thumbnailUrl: bookRes.data.pages?.[0]?.imageUrl || ''
          };
        } catch (e) {
          return order;
        }
      }));

      setBooks(ordersWithData);
    } catch (err) {
      console.error('Failed to fetch library', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (generatingId) return;
    
    setGeneratingId(bookId);
    toast({
      title: "Preparing PDF",
      description: "Fetching your high-resolution storybook...",
    });

    try {
      const res = await axios.post(`${API_URL}/generate-pdf`, { bookId });
      if (res.data.pdfUrl) {
        window.open(res.data.pdfUrl, '_blank');
        toast({ title: "PDF Ready", description: "Your download has started." });
      }
    } catch (err) {
      toast({ title: "Download Failed", description: "Could not generate PDF.", variant: "destructive" });
    } finally {
      setGeneratingId(null);
    }
  };

  const loadBookDetails = async (bookId: string, mode: 'story' | 'images') => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/book-status?bookId=${bookId}`);
      setSelectedBook({ ...res.data, id: bookId });
      setViewMode(mode);
      setIsOpen(false);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load story details." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => {
            const newOpen = !isOpen;
            setIsOpen(newOpen);
            if (newOpen) fetchBooks();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-bold text-xs uppercase tracking-widest border border-white/5 shadow-lg"
        >
          <Book size={16} className="text-primary" />
          My Stories
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute right-0 mt-3 w-80 bg-slate-900 rounded-2xl shadow-2xl border border-white/10 z-[100] overflow-hidden flex flex-col"
            >
              <div className="p-4 bg-slate-800/50 font-black text-[10px] text-slate-400 uppercase tracking-[0.2em] flex justify-between items-center border-b border-white/5">
                <span>Recent Adventures</span>
                {loading && <Loader2 size={12} className="animate-spin text-primary" />}
              </div>
              
              <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                {books.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 italic text-xs font-bold uppercase tracking-widest">No stories yet</div>
                ) : (
                  books.map((order: any) => (
                    <div key={order._id} className="p-5 border-b border-white/5 hover:bg-white/5 transition-colors group">
                      <div className="flex gap-4 mb-4">
                        {/* Thumbnail Preview */}
                        <div className="w-16 h-16 bg-slate-800 rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-lg">
                          {order.thumbnailUrl ? (
                            <img src={order.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900">
                              <Book size={24} className="text-slate-700" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <div className="font-black text-white text-sm line-clamp-1 truncate">{order.bookTitle || 'Storybook'}</div>
                            <Badge className="bg-green-500/10 text-green-500 border-none px-2 py-0 h-5 text-[8px] font-black uppercase shrink-0">PAID</Badge>
                          </div>
                          <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => loadBookDetails(order.bookId, 'story')}
                          className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 border border-white/5 rounded-lg text-[9px] font-black text-slate-300 hover:text-white hover:bg-slate-700 transition-all uppercase"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button 
                          onClick={(e) => handleDownload(order.bookId, e)} 
                          disabled={!!generatingId}
                          className="flex items-center justify-center gap-1.5 py-2 bg-primary/10 border border-primary/20 rounded-lg text-[9px] font-black text-primary hover:bg-primary/20 transition-all uppercase"
                        >
                          {generatingId === order.bookId ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                          PDF
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={viewMode !== 'none'} onOpenChange={(open) => !open && setViewMode('none')}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 bg-slate-950 border-slate-800 shadow-2xl rounded-[2.5rem] overflow-hidden text-white">
          <DialogHeader className="p-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
            <DialogTitle className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
              <Sparkles className="text-primary" /> {selectedBook?.status === 'pdf_ready' ? 'Your Finished Story' : 'Story Preview'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar space-y-12">
            {selectedBook?.pages?.map((page: any) => (
              <div key={page.pageNumber} className="group space-y-6">
                <div className="relative aspect-square max-w-lg mx-auto rounded-[2rem] overflow-hidden shadow-2xl border-[10px] border-slate-900 ring-1 ring-white/10">
                  <img src={page.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-4 left-4">
                    <span className="px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-white font-black uppercase tracking-widest border border-white/10">Page {page.pageNumber}</span>
                  </div>
                </div>
                <div className="max-w-2xl mx-auto bg-white/5 p-8 rounded-2xl border border-white/5 text-center">
                  <p className="text-xl text-slate-200 leading-relaxed font-medium italic">"{page.text}"</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-8 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 flex justify-center items-center gap-6">
            <button 
              onClick={(e) => handleDownload(selectedBook?.id, e)} 
              disabled={!!generatingId}
              className="px-10 py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3 active:scale-95"
            >
              {generatingId ? <Loader2 className="animate-spin" /> : <Download size={18} />}
              Download High-Res PDF
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
