import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import MainCreator from './pages/MainCreator';
import SuccessPage from './pages/Success';
import PrintTemplate from './pages/PrintTemplate';

function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    CapApp.addListener('appUrlOpen', (event: any) => {
      // Example: com.aistorytime.app://success?bookId=123
      const url = new URL(event.url);
      const bookId = url.searchParams.get('bookId');
      
      if (url.host === 'success' || url.pathname.includes('success')) {
        navigate(`/success?bookId=${bookId}`);
      }
    });
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<MainCreator />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/print/template/:bookId" element={<PrintTemplate />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
