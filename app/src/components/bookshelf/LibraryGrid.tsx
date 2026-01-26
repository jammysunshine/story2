import { Palette, FileDown, Flag, BookOpen } from 'lucide-react';
import { Badge } from '../ui/badge';

interface BookPage {
  pageNumber: number;
  imageUrl?: string;
}

interface Book {
  _id: string;
  title: string;
  status: string;
  pdfUrl?: string;
  pages?: BookPage[];
}

interface LibraryGridProps {
  library: Book[];
  onSelectBook: (book: Book) => void;
  onReportContent: (pageNumber: number, bookId: string) => void;
}

export function LibraryGrid({ library, onSelectBook, onReportContent }: LibraryGridProps) {
  if (library.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
      {library.map((b) => (
        <div key={`${b._id}-${b.status}`} className="group space-y-4">
          <div
            onClick={() => onSelectBook(b)}
            className="aspect-[3/4] bg-slate-900 rounded-[2.5rem] overflow-hidden border-8 border-white/5 shadow-2xl group-hover:border-primary/50 group-hover:scale-[1.02] transition-all relative cursor-pointer"
          >
            {b.pages?.[0]?.imageUrl ? (
              <img src={b.pages[0].imageUrl} className="w-full h-full object-cover" alt={b.title} />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800">
                <Palette className="text-slate-700 w-16 h-16 animate-pulse" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-8 pt-20">
              <div className="flex flex-wrap gap-2 mb-3">
                {b.pdfUrl ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 uppercase text-[10px] font-black px-3 py-1">✅ Ready</Badge>
                ) : b.status === 'printing' ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 uppercase text-[10px] font-black px-3 py-1">🖨️ Book print in progress</Badge>
                ) : b.status === 'paid' ? (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 uppercase text-[10px] font-black px-3 py-1 animate-pulse">🎨 Painting...</Badge>
                ) : (
                  <Badge className="bg-primary/20 text-primary border-primary/20 uppercase text-[10px] font-black px-3 py-1">{b.status}</Badge>
                )}
              </div>
              <h4 className="text-lg font-black uppercase tracking-tighter text-white leading-tight line-clamp-2">{b.title}</h4>
            </div>
          </div>

          <div className="flex gap-2">
            {/* Direct Download Button for bookshelf cards */}
            {b.pdfUrl && (
              <a
                href={b.pdfUrl}
                target="_blank"
                className="flex-1 h-12 bg-white/5 hover:bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10 group-hover:border-primary/50"
              >
                <FileDown size={14} /> Download PDF
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReportContent(1, b._id); 
              }}
              className="w-12 h-12 bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-xl transition-all flex items-center justify-center border border-white/10 opacity-20 hover:opacity-100"
              title="Report Inappropriate Content"
            >
              <Flag size={10} className="text-red-500 fill-current" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
