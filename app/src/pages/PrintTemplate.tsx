import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

export default function PrintTemplate() {
  const { bookId } = useParams();
  const [book, setBook] = useState<any>(null);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const res = await axios.get(`${API_URL}/book-status?bookId=${bookId}`);
        setBook(res.data);
      } catch (e) {
        console.error('Failed to fetch book for template', e);
      }
    };
    fetchBook();
  }, [bookId]);

  if (!book) return null;

  return (
    <div className="print-container bg-[#FFFEF5] min-h-screen">
      {/* Title Page */}
      <div className="page relative w-[2400px] h-[3300px] overflow-hidden flex flex-col items-center justify-center p-20 border-b border-gray-200">
        <h1 className="text-[120px] font-black uppercase tracking-tighter text-center leading-none mb-12">
          {book.title}
        </h1>
        <p className="text-[40px] font-bold uppercase tracking-[0.2em] text-slate-400">
          A Personalized Adventure
        </p>
      </div>

      {/* Story Pages */}
      {book.pages.map((page: any, i: number) => (
        <div key={i} className="page relative w-[2400px] h-[3300px] overflow-hidden border-b border-gray-200">
          <div className="absolute inset-0">
            {page.imageUrl && (
              <img 
                src={page.imageUrl} 
                className="w-full h-full object-cover" 
                alt="" 
              />
            )}
          </div>
          
          {/* Text Overlay - Restoring exact position/styling from story1 */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md p-24 pt-32 pb-40 text-center">
            <p className="text-[64px] font-medium leading-[1.4] text-slate-900 italic px-20">
              "{page.text}"
            </p>
            <div className="mt-12 text-[32px] font-black text-primary/40 uppercase tracking-widest">
              Page {page.pageNumber}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
