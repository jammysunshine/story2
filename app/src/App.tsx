import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainCreator from './pages/MainCreator';
import SuccessPage from './pages/Success';
import PrintTemplate from './pages/PrintTemplate';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainCreator />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/print/template/:bookId" element={<PrintTemplate />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
