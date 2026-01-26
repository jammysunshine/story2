import { Sparkles, Loader2, Flag } from 'lucide-react';

interface BookPage {
  pageNumber: number;
  text: string;
}

interface Book {
  title?: string;
  pages?: BookPage[];
}

interface Step2PreviewProps {
  book: Book;
  onStartPainting: () => void;
  loading: boolean;
  onEdit: () => void;
  onReportContent: (pageNumber: number) => void;
}

export function Step2Preview({
  book,
  onStartPainting,
  loading,
  onEdit,
  onReportContent,
}: Step2PreviewProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-black uppercase text-white">{book.title}</h2>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Draft Preview</p>
      </div>
      <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 max-h-[50vh] overflow-y-auto space-y-8 shadow-inner custom-scrollbar relative">
        {book.pages?.map((p: BookPage) => (
          <div key={p.pageNumber} className="relative pl-8">
            <span className="absolute left-0 top-0 text-[10px] font-black text-primary opacity-50">{p.pageNumber}</span>
            <p className="text-xl text-slate-200 italic leading-relaxed">"{p.text}"</p>
          </div>
        ))}
        
        <div className="pt-12 pb-4 flex justify-center">
          <button
            onClick={() => onReportContent(1)}
            className="text-slate-600 hover:text-red-400 text-[8px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 opacity-20 hover:opacity-100"
          >
            <Flag size={8} className="text-red-500 fill-current" /> Report Inappropriate Story Content
          </button>
        </div>
      </div>
      <button onClick={onStartPainting} disabled={loading} className="w-full h-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-[1.5rem] font-black text-xl shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 hover:shadow-blue-500/30 hover:scale-[1.02]">
        {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Approve & Illustrate
      </button>

      <button onClick={onEdit} className="w-full py-4 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:text-slate-400 transition-colors">Edit Hero Details</button>
    </div>
  );
}
