import { Palette, Lock, Flag, ExternalLink, Loader2, FileDown, FileText, Package } from 'lucide-react';
import { MagicGlow } from '../MagicGlow';
import { Button } from '../ui/button';

interface BookPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
}

interface Book {
  status: string;
  pdfUrl?: string;
  pages?: BookPage[];
}

interface Step3PaintingProps {
  book: Book;
  teaserLimit: number;
  isPaid: boolean;
  progress: number;
  fullProgress: number;
  onReportContent: (pageNumber: number) => void;
  onStartParentalGate: () => void;
  checkoutLoading: boolean;
  bookCost: string;
  baseCurrency: string;
  library: any[];
}

export function Step3Painting({
  book,
  teaserLimit,
  isPaid,
  progress,
  fullProgress,
  onReportContent,
  onStartParentalGate,
  checkoutLoading,
  bookCost,
  baseCurrency,
  library,
}: Step3PaintingProps) {
  return (
    <div className="max-w-lg mx-auto space-y-12 animate-in fade-in duration-1000">
      {/* Check if we're in the painting phase (not all teaser images are done yet) */}
      {(book.status === 'generating' || book.status === 'teaser_generating' || book.status === 'preview' ||
        (book.status !== 'teaser_ready' && progress < 100)) ? (
        <div className="py-20 text-center space-y-10">
          <MagicGlow color="pink" />
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Creating Teaser Illustrations</h2>
            <p className="text-slate-400 text-lg font-medium">Generating {Math.min(teaserLimit, book.pages?.length || teaserLimit)} stunning AI illustrations...</p>
          </div>
          <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-amber-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Estimated Time: 2-3 Minutes</p>
        </div>
      ) : book.status === 'teaser_ready' && progress < 100 ? (
        <div className="py-20 text-center space-y-10">
          <MagicGlow color="pink" />
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Finishing Teaser Illustrations</h2>
            <p className="text-slate-400 text-lg font-medium">Finalizing {Math.min(teaserLimit, book.pages?.length || teaserLimit)} teaser illustrations...</p>
          </div>
          <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-amber-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Almost Ready!</p>
        </div>
      ) : book.status === 'paid' && fullProgress < 100 ? (
        <div className="py-20 text-center space-y-10">
          <MagicGlow color="blue" />
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Completing Your Full Book</h2>
            <p className="text-slate-400 text-lg font-medium">Generating all {book.pages?.length || 23} illustrations for your full book...</p>
          </div>
          <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
              style={{ width: `${fullProgress}%` }}
            />
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Estimated Time: 5-8 Minutes</p>
        </div>
      ) : book.status === 'paid' && !book.pdfUrl ? (
        <div className="py-20 text-center space-y-10">
          <MagicGlow color="amber" />
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Preparing Your High-Resolution PDF</h2>
            <p className="text-slate-400 text-lg font-medium">Assembling your beautifully illustrated book into a high-quality PDF...</p>
          </div>
          <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000 ease-out"
              style={{ width: '75%' }}
            />
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">EST. TIME: 6-8 MINS</p>
        </div>
      ) : book.status === 'pdf_ready' && !book.pdfUrl ? (
        <div className="py-20 text-center space-y-10">
          <MagicGlow color="green" />
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Finalizing Your PDF</h2>
            <p className="text-slate-400 text-lg font-medium">Your PDF is ready! Preparing download link...</p>
          </div>
          <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000 ease-out"
              style={{ width: '100%' }}
            />
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Almost Ready!</p>
        </div>
      ) : book.status === 'printing' ? (
        <div className="py-20 text-center space-y-10">
          <MagicGlow color="purple" />
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Printing Your Book</h2>
            <p className="text-slate-400 text-lg font-medium">Your hardcover book is being professionally printed and will ship soon!</p>
          </div>
          <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000 ease-out"
              style={{ width: '100%' }}
            />
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">On Its Way To You!</p>
        </div>
      ) : (
        <>
          <div className="text-center">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-none">Your Adventure <br /> Is Coming To Life</h2>
            <p className="text-slate-400 mt-4">We're painting the first {teaserLimit} pages for free!</p>
          </div>

          <div className="space-y-20">
            {book.pages?.map((p: BookPage, i: number) => (
              <div key={`${i}-${p.imageUrl || 'no-image'}`} className="space-y-6">
                <div className="aspect-square bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white ring-1 ring-black/10 relative">
                  {(i < teaserLimit || isPaid) ? (
                    p.imageUrl && !p.imageUrl.includes('placeholder') ? (
                      <img
                        key={p.imageUrl}
                        src={p.imageUrl}
                        className="w-full h-full object-cover"
                        alt={`Page ${i + 1}`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-900 animate-pulse">
                        <Palette className="text-slate-700 w-12 h-12" />
                        <p className="text-[10px] font-black uppercase text-slate-700 tracking-widest text-center px-8">AI is painting this page...</p>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-900 text-slate-700">
                      <Lock size={48} />
                      <p className="text-[10px] font-black uppercase tracking-widest">Order to Unlock Illustration</p>
                    </div>
                  )}
                </div>
                <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 text-center shadow-lg relative">
                  <button
                    onClick={() => onReportContent(p.pageNumber)}
                    className="absolute top-4 right-4 text-[8px] font-black uppercase text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1 opacity-20 hover:opacity-100"
                  >
                    <Flag size={8} className="text-red-500 fill-current" /> Report Inappropriate Content
                  </button>
                  <p className="text-xl font-medium text-slate-200 leading-relaxed italic">"{p.text}"</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-primary/20 text-center shadow-2xl sticky bottom-6">
        <h3 className="text-xl font-black uppercase mb-2">Love the story?</h3>
        <p className="text-slate-400 text-sm mb-6 font-medium">Order the full book to unlock all 23 illustrations and get a physical hardcover copy.</p>

        <div className="flex flex-col gap-4">
          {book.pdfUrl && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.open(book.pdfUrl, '_blank')}
                className="w-full h-14 bg-slate-800 text-white rounded-xl font-bold text-lg border border-white/10 hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <ExternalLink size={20} />
                View Digital PDF
              </button>
              <p className="text-center text-[8px] text-slate-500 font-bold uppercase tracking-widest">Digital copy included with every physical book</p>
            </div>
          )}

          {!isPaid && (
            <button
              onClick={onStartParentalGate}
              disabled={checkoutLoading}
              className="w-full h-20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-2xl font-black text-xl shadow-xl hover:shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Order Hardcover (${bookCost} {baseCurrency})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-950/50 p-10 rounded-[2.5rem] border border-white/5 space-y-6">
        <div className="flex items-center gap-3">
          <FileDown className="text-primary w-6 h-6" />
          <h3 className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-600">Your Downloads</h3>
        </div>
        {library.filter(b => b.pdfUrl).length === 0 ? (
          <p className="text-sm text-slate-500">No PDFs available yet</p>
        ) : (
          <div className="space-y-3">
            {library.filter(b => b.pdfUrl).map(book => (
              <a
                key={book._id}
                href={book.pdfUrl}
                download={`${book.title}.pdf`}
                className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-white/5 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-primary w-5 h-5" />
                  <div>
                    <p className="font-bold text-sm text-white group-hover:text-primary transition-colors">{book.title}</p>
                    <p className={`text-[10px] uppercase tracking-wider ${
                      (book.status === 'pdf_ready' || book.status === 'printing') ? 'text-green-500' : 'text-slate-500'
                    }`}>
                      {book.status === 'printing' ? 'Book print in progress' : 'Ready'}
                    </p>
                  </div>
                </div>
                <FileDown className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
