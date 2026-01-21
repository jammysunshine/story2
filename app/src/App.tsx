import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainCreator from './pages/MainCreator';
import SuccessPage from './pages/Success';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainCreator />} />
        <Route path="/success" element={<SuccessPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
