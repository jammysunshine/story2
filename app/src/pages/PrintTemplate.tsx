import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://10.202.14.197:3001/api';

interface Page {
  pageNumber: number;
  type: 'photo' | 'story';
  text: string;
  imageUrl?: string;
  url?: string;
  prompt: string;
}

interface Book {
  _id: string;
  title: string;
  childName: string;
  pages: Page[];
  status: string;
  photoUrl?: string;
  pdfUrl?: string;
}

export default function PrintTemplate() {
  const { bookId } = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);

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

  useEffect(() => {
    if (book) {
      const autofit = () => {
        document.querySelectorAll('.story-page-text-area').forEach(container => {
          const text = container.querySelector('.story-text') as HTMLElement;
          if (!text) return;
          let fontSize = 45;
          text.style.fontSize = fontSize + 'pt';
          while (text.scrollHeight > container.clientHeight && fontSize > 10) {
            fontSize -= 0.5;
            text.style.fontSize = fontSize + 'pt';
          }
        });
      };
      autofit();
      window.addEventListener('load', autofit);
      if (document.readyState === 'complete') autofit();
      return () => window.removeEventListener('load', autofit);
    }
  }, [book]);

  if (!book) return null;

  const appUrl = 'https://ai-storytime.app';

  return (
    <div className="print-body">
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,800;1,400&display=swap" rel="stylesheet" />
      <style>{`
        header, nav, footer, .header-container, #header, button, .sign-in-btn { 
          display: none !important; 
        }
        @page { size: 8in 11in; margin: 0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
        html, body { 
          margin: 0 !important; 
          padding: 0 !important; 
          background: white; 
          width: 8in; 
          overflow: visible !important;
          font-family: 'EB Garamond', serif;
        }
        .page {
          width: 8in;
          height: 11in;
          position: relative;
          overflow: hidden;
          display: block;
          margin: 0 !important;
          padding: 0.5in !important;
          page-break-after: always;
          background-color: #FFFEF5;
        }
        .page::before {
          content: "";
          position: absolute;
          top: 0.4in;
          left: 0.4in;
          right: 0.4in;
          bottom: 0.3in;
          border: 1px solid #E5E7EB;
          background-color: transparent;
          pointer-events: none;
          border-radius: 0.25in;
          z-index: 1;
        }
        .title-page-content {
          height: 9.5in;
          width: 7in;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border: 4px double #E5E7EB;
          border-radius: 1in;
          padding: 0.5in;
          background: linear-gradient(135deg, rgba(255, 253, 245, 0.9) 0%, rgba(255, 255, 255, 0.9) 100%);
          position: relative;
          z-index: 10;
        }
        .story-page-text-area {
          height: 3.0in;
          width: 7in;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0.2in;
          margin-bottom: 0.1in;
          overflow: hidden;
          background-color: rgba(255, 253, 245, 0.7);
          background-image: radial-gradient(#E5E7EB 0.7px, transparent 0.7px);
          background-size: 15px 15px;
          border: 1px solid #E5E7EB;
          border-radius: 1.5rem;
          position: relative;
          z-index: 10;
        }
        .story-page-image-area {
          width: 7in;
          height: 7in;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 10;
          background-color: white;
          overflow: hidden;
          border-radius: 1.5rem;
        }
        .inner-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border-radius: 1.5rem;
          border: 10px solid white;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .footer-area {
          position: absolute;
          bottom: 0.12in;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 100;
        }
        .page-number {
          color: #9CA3AF;
          font-size: 8pt;
          font-family: sans-serif;
          letter-spacing: 0.2em;
          font-weight: bold;
          text-transform: uppercase;
        }
        .footer-separator {
          color: #E5E7EB;
          font-size: 8pt;
        }
        .app-link {
          color: #4F46E5;
          font-size: 10pt;
          font-family: sans-serif;
          text-decoration: none;
          letter-spacing: 0.05em;
          font-weight: 900;
        }
        .story-text {
          font-family: 'EB Garamond', serif;
          line-height: 1.1;
          color: #111827;
          margin: 0;
          font-weight: 500;
          font-size: 45pt;
        }
        .main-title {
          font-family: 'EB Garamond', serif;
          font-size: 60pt;
          color: #111827;
          line-height: 1.1;
          margin-bottom: 0.5in;
          font-weight: 900;
        }
        .created-for {
          font-family: sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          color: #9CA3AF;
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 0.2in;
        }
        .child-name-pop {
          font-family: 'EB Garamond', serif;
          color: #4F46E5;
          font-size: 48pt;
          font-weight: 900;
          margin: 0;
          letter-spacing: 0.1em;
        }
      `}</style>

      {/* RENDER TITLE PAGE */}
      <div className="page">
        <div className="title-page-content">
          <h1 className="main-title">{book.title}</h1>
          <p className="created-for">Created for</p>
          <p className="child-name-pop">{book.childName}</p>
        </div>
        <div className="footer-area">
          <div className="page-number">TITLE PAGE</div>
          <span className="footer-separator">•</span>
          <span className="app-link">{appUrl.replace('https://', '')}</span>
        </div>
      </div>

      {/* RENDER PAGES */}
      {book.pages.map((p: Page, i: number) => (
        <div key={i} className="page">
          {p.type === 'photo' ? (
            <>
              <div className="title-page-content" style={{ borderStyle: 'solid', borderWidth: '1px', borderColor: '#E5E7EB' }}>
                <p className="created-for" style={{ marginBottom: '0.5in' }}>The Magic Behind the Story</p>
                <div className="story-page-image-area" style={{ width: '5in', height: '5in' }}>
                  <img 
                    src={p.imageUrl || p.url} 
                    alt="The Hero" 
                    className="inner-image" 
                    style={{ borderRadius: '50%' }} 
                    crossOrigin="anonymous"
                  />
                </div>
                <p className="child-name-pop" style={{ marginTop: '0.5in' }}>{book.childName}</p>
                <p className="story-text" style={{ fontSize: '18pt', marginTop: '0.2in', color: '#9CA3AF' }}>Our Little Storyteller</p>
              </div>
              <div className="footer-area">
                <div className="page-number">MEMORIES</div>
                <span className="footer-separator">•</span>
                <span className="app-link">{appUrl.replace('https://', '')}</span>
              </div>
            </>
          ) : (
            <>
              <div className="story-page-text-area">
                <p className="story-text">{p.text}</p>
              </div>
              <div className="story-page-image-area">
                <img
                  src={p.imageUrl}
                  alt={`Page ${p.pageNumber}`}
                  className="inner-image"
                  crossOrigin="anonymous"
                />
              </div>
              <div className="footer-area">
                <div className="page-number">PAGE {p.pageNumber}</div>
                <span className="footer-separator">•</span>
                <span className="app-link">{appUrl.replace('https://', '')}</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}