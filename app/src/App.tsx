import { useState, useEffect } from 'react'
import { Sparkles, Wand2, Loader2, BookOpen, Image as ImageIcon, Layout, LogIn, User, LogOut, Camera } from 'lucide-react'
import axios from 'axios'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera'

const API_URL = 'http://localhost:3001/api'

function App() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [book, setBook] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [library, setLibrary] = useState<any[]>([])
  const [photoUrl, setPhotoUrl] = useState('')
  
  const [formData, setFormData] = useState({
    childName: 'Emma',
    age: '5',
    animal: 'Lion',
    characterStyle: 'Disney-inspired 3D render',
    location: 'Magical Forest'
  })

  // ... (previous effects)

  const handleTakePhoto = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt
      });

      if (image.base64String) {
        setLoading(true);
        // Convert base64 to Blob for upload
        const byteCharacters = atob(image.base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/png'});

        const fd = new FormData();
        formData.append('file', blob, 'child_photo.png');

        const res = await axios.post(`${API_URL}/upload`, fd);
        setPhotoUrl(res.data.url);
        setLoading(false);
      }
    } catch (err) {
      console.error('Photo failed:', err);
      setLoading(false);
    }
  }

  const generateStory = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/generate-story`, { 
        ...formData, 
        photoUrl,
        email: user?.email 
      })
      setBook(res.data)
      setStep(2)
    } catch (err) {
      alert('Failed to generate story.')
    } finally {
      setLoading(false)
    }
  }

  const generateImages = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/generate-images`, { bookId: book.bookId })
      setBook({ ...book, pages: res.data.pages })
      setStep(3)
    } catch (err) {
      alert('Failed to generate images.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      <header className="flex justify-between items-center mb-12 pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-black tracking-tighter uppercase text-primary">AI StoryTime v2</h1>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-white/5">
              <User size={16} className="text-primary" />
              <span className="text-xs font-bold">{user.name.split(' ')[0]}</span>
              <button onClick={() => setUser(null)} className="ml-1"><LogOut size={14} className="text-slate-500" /></button>
            </div>
          ) : (
            <button 
              onClick={() => setStep(0)} // Go to Login Step
              className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-white/5"
            >
              <LogIn size={16} /> Sign In
            </button>
          )}
        </div>
      </header>

      {step === 0 && (
        <div className="max-w-md mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <h2 className="text-4xl font-black mb-2 uppercase tracking-tighter">Welcome</h2>
            <p className="text-slate-400">Sign in to sync your stories and purchases.</p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              className="w-full h-16 bg-white text-slate-900 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt=""/>
              Sign in with Google
            </button>
            <button 
              onClick={handleAppleLogin}
              className="w-full h-16 bg-black text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl border border-white/10 active:scale-95 transition-transform"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              Sign in with Apple
            </button>
            <button 
              onClick={() => setStep(1)}
              className="w-full py-4 text-slate-500 font-bold uppercase tracking-widest text-[10px]"
            >
              Continue as Guest
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center">
            <h2 className="text-4xl font-black mb-2 uppercase tracking-tighter">New Adventure</h2>
            <p className="text-slate-400">Fill in the details to start the magic.</p>
          </div>

          <div className="space-y-4 bg-slate-900/50 p-6 rounded-[2rem] border border-white/5">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-2 ml-1">Child's Name</label>
              <input 
                value={formData.childName}
                onChange={e => setFormData({...formData, childName: e.target.value})}
                className="w-full bg-slate-800 border-none rounded-2xl h-14 px-6 focus:ring-2 focus:ring-primary outline-none font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-2 ml-1">Favorite Animal</label>
              <input 
                value={formData.animal}
                onChange={e => setFormData({...formData, animal: e.target.value})}
                className="w-full bg-slate-800 border-none rounded-2xl h-14 px-6 focus:ring-2 focus:ring-primary outline-none font-bold"
              />
            </div>

            <div className="pt-2">
              <button 
                onClick={handleTakePhoto}
                disabled={loading}
                className={`w-full h-16 border-2 border-dashed rounded-2xl flex items-center justify-center gap-3 transition-all ${photoUrl ? 'border-green-500 bg-green-500/5 text-green-500' : 'border-slate-700 text-slate-400 hover:border-primary/50'}`}
              >
                {loading ? <Loader2 className="animate-spin" /> : photoUrl ? <Sparkles /> : <Camera size={20} />}
                {photoUrl ? 'Magic Photo Linked!' : 'Add Magic Photo'}
              </button>
              {photoUrl && (
                <p className="text-[10px] text-center mt-2 text-slate-500 font-bold uppercase tracking-widest">Character will look like the photo</p>
              )}
            </div>
          </div>

          <button 
            onClick={generateStory}
            disabled={loading}
            className="w-full h-20 bg-primary text-white rounded-[1.5rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {loading ? 'Crafting...' : 'Write My Story'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-500">
          <h2 className="text-3xl font-black uppercase text-center">{book.title}</h2>
          <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 max-h-[50vh] overflow-y-auto space-y-6">
            {book.pages.map((p: any) => (
              <p key={p.pageNumber} className="text-lg text-slate-300 italic">"{p.text}"</p>
            ))}
          </div>
          <button 
            onClick={generateImages}
            disabled={loading}
            className="w-full h-20 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-[1.5rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
            {loading ? 'Painting...' : 'Illustrate & Finish'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-lg mx-auto space-y-12 pb-20 animate-in fade-in duration-1000">
          <div className="text-center">
            <h2 className="text-4xl font-black uppercase mb-2">Magic Ready!</h2>
            <p className="text-slate-400">Swipe to read your story.</p>
          </div>
          
          <div className="space-y-20">
            {book.pages.map((p: any) => (
              <div key={p.pageNumber} className="space-y-6">
                <div className="aspect-square bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white ring-1 ring-black/10">
                  <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 text-center">
                  <p className="text-xl font-medium text-slate-200">{p.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await axios.post(`${API_URL}/create-checkout`, { 
                    bookId: book.bookId,
                    bookTitle: book.title 
                  });
                  window.location.href = res.data.url;
                } catch (err) {
                  alert('Checkout failed.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full h-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-[1.5rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Order Hardcover ($25)
            </button>
            <button 
              onClick={() => setStep(1)}
              className="w-full h-16 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-700"
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App