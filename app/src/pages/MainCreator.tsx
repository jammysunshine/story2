import { useState, useEffect, useRef } from 'react'
import { Sparkles, Wand2, Loader2, BookOpen, Lock, Palette, Package, ExternalLink, Camera, Trash2 } from 'lucide-react'
import axios from 'axios'
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { useToast } from "../hooks/use-toast"

import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'

const API_URL = 'http://localhost:3001/api'
const TEASER_LIMIT = 7;

const options = {
  genders: ['Boy', 'Girl'],
  skinTones: ['Fair', 'Light', 'Medium', 'Tan', 'Deep'],
  hairStyles: [
    'Short', 'Long', 'Curly', 'Wavy', 'Straight', 'Braids', 'Bald', 
    'Pigtails', 'Ponytail', 'Bun', 'Bob cut', 'Pixie cut', 'Afro', 'Space buns'
  ],
  hairColors: ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White'],
  styles: [
    'Studio Ghibli style', 'Disney-inspired 3D render', 'Classic watercolor', 
    'Pixar character design', 'Hayao Miyazaki illustration', 'Papercut art', 
    'Oil painting style', 'Chalk drawing'
  ],
  locations: [
    'Magical Forest', 'Deep Ocean', 'Outer Space', 'Castle', 'Dinosaur Jungle',
    'Jungle', 'Mountain', 'Desert', 'Garden', 'Village', 'Zoo', 
    'Underwater City', 'Cloud Kingdom', 'Ice Palace', 'Magical Library'
  ]
}

const randomNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'James', 'Isabella', 'Benjamin', 'Mia', 'Lucas', 'Charlotte', 'Henry', 'Amelia', 'Theo', 'Luna', 'Leo', 'Zoe', 'Jack'];
const randomAnimals = ['Lion', 'Tiger', 'Elephant', 'Panda', 'Rabbit', 'Fox', 'Wolf', 'Bear', 'Owl', 'Dragon', 'Unicorn', 'Penguin', 'Giraffe', 'Monkey', 'Koala', 'Dolphin', 'Cat', 'Dog', 'Squirrel', 'Hedgehog', 'Turtle', 'Frog', 'Horse', 'Deer', 'Raccoon', 'Otter', 'Peacock', 'Parrot', 'Eagle', 'Hawk', 'Kangaroo', 'Cheetah', 'Leopard', 'Zebra', 'Gorilla', 'Chimpanzee', 'Crocodile', 'Alligator', 'Snake', 'Lizard', 'Butterfly', 'Bee', 'Crab', 'Octopus', 'Whale', 'Seal', 'Polar Bear', 'Camel', 'Rhino', 'Hippopotamus', 'Flamingo'];
const randomLessons = ['Kindness', 'Courage', 'Friendship', 'Honesty', 'Respect', 'Responsibility', 'Patience', 'Generosity', 'Perseverance', 'Empathy', 'Sharing', 'Gratitude', 'Self-belief', 'Curiosity', 'Listening'];
const randomOccasions = ['Everyday Adventure', 'Birthday Party', 'Christmas Eve', 'Thanksgiving Dinner', 'New Year\'s Celebration', 'First Day of School', 'Final Exams', 'Play Date', 'Summer Vacation', 'Bedtime Story', 'Rainy Day Fun', 'Grandparents\' Visit', 'Halloween Night', 'Easter Egg Hunt', 'Losing a First Tooth'];

const getRandomItem = (array: string[]) => array[Math.floor(Math.random() * array.length)];

export default function MainCreator() {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [book, setBook] = useState<any>(null)

  console.log('MainCreator render: step', step, 'bookId', book?.bookId)
  const [user, setUser] = useState<any>(null)
  
  useEffect(() => {
    GoogleAuth.initialize();
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
    const savedBook = localStorage.getItem('book');
    if (savedBook) setBook(JSON.parse(savedBook));
    const savedStep = localStorage.getItem('step');
    if (savedStep) setStep(parseInt(savedStep));
    console.log('Loaded from localStorage: book', !!savedBook, 'step', savedStep);
  }, []);

  useEffect(() => {
    if (book) localStorage.setItem('book', JSON.stringify(book));
    console.log('Saved book to localStorage');
  }, [book]);

  useEffect(() => {
    localStorage.setItem('step', step.toString());
    console.log('Saved step to localStorage:', step);
  }, [step]);

  const login = async () => {
    try {
      const googleUser = await GoogleAuth.signIn();
      const res = await axios.post(`${API_URL}/auth/social`, {
        token: googleUser.authentication.idToken,
        provider: 'google'
      });
      if (res.data.success) {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast({ title: "Welcome back!", description: `Logged in as ${res.data.user.name}` });
      }
    } catch (err) {
      console.error('Login failed', err);
      toast({ title: "Login Failed", description: "Could not sign in with Google", variant: "destructive" });
    }
  };

  const logout = async () => {
    await GoogleAuth.signOut();
    setUser(null);
    localStorage.removeItem('user');
  };

  const [photoUrl, setPhotoUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    childName: 'Emma',
    age: '5',
    gender: 'Girl',
    skinTone: 'Fair',
    hairStyle: 'Long',
    hairColor: 'Blonde',
    animal: 'Lion',
    characterStyle: 'Disney-inspired 3D render',
    location: 'Magical Forest',
    lesson: 'Kindness',
    occasion: 'Everyday Adventure'
  })

  const randomizeFormData = () => {
    setFormData({
      childName: getRandomItem(randomNames),
      age: (Math.floor(Math.random() * 8) + 3).toString(),
      gender: getRandomItem(options.genders),
      skinTone: getRandomItem(options.skinTones),
      hairStyle: getRandomItem(options.hairStyles),
      hairColor: getRandomItem(options.hairColors),
      animal: getRandomItem(randomAnimals),
      characterStyle: getRandomItem(options.styles),
      location: getRandomItem(options.locations),
      lesson: getRandomItem(randomLessons),
      occasion: getRandomItem(randomOccasions)
    });
    toast({
      title: "✨ Magic Applied!",
      description: "We've picked some fun traits for you.",
    });
  };

  useEffect(() => {
    console.log('Polling useEffect triggered, step:', step, 'bookId:', book?.bookId);
    let interval: any;
    if (step === 3 && book?.bookId) {
      console.log('Starting polling for bookId:', book.bookId);
      const poll = async () => {
        console.log('Polling book status for:', book.bookId);
        try {
          const res = await axios.get(`${API_URL}/book-status?bookId=${book.bookId}`);
          // Update book data whenever we get pages, regardless of status string
          setBook((prev: any) => {
            if (!prev) return null;
            return { ...prev, status: res.data.status, pages: res.data.pages };
          });
          
          // Stop polling if we reached a final state
          if (['preview', 'illustrated', 'paid', 'printing', 'teaser_ready'].includes(res.data.status)) {
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Polling failed', e);
        }
      };
      poll();
      interval = setInterval(poll, 5000);
    }
    return () => clearInterval(interval);
  }, [step, book?.bookId]);

  const fetchOrders = async () => {
    if (!user?.email) return;
    setOrdersLoading(true);
    try {
      const res = await axios.get(`${API_URL}/orders?email=${user.email}`);
      setOrders(res.data.orders);
    } catch (err) {
      console.error('Failed to fetch orders');
    } finally {
      setOrdersLoading(false);
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/upload`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.url) {
        setPhotoUrl(res.data.url);
        toast({
          title: "✨ Magic Link Established!",
          description: "Your child's photo has been scanned.",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Upload Failed",
        description: "Please try again with a smaller image.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const generateStory = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/generate-story`, { ...formData, photoUrl, email: user?.email })
      setBook(res.data)
      setStep(2)
    } catch (err) { alert('Failed to generate story.') }
    finally { setLoading(false) }
  }

  const startPainting = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_URL}/generate-images`, { bookId: book.bookId })
      setStep(3)
    } catch (err) { alert('Failed to start painting.') }
    finally { setLoading(false) }
  }

  const renderSelect = (label: string, field: string, choices: string[]) => (
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">{label}</label>
      <select 
        value={(formData as any)[field]} 
        onChange={e => setFormData({...formData, [field]: e.target.value})}
        className="w-full bg-slate-800 rounded-xl h-12 px-4 outline-none font-bold text-sm"
      >
        {choices.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans pb-20">
      <header className="flex justify-between items-center mb-12 pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-black tracking-tighter uppercase text-primary flex items-center gap-2">
          <BookOpen className="text-primary" /> StoryTime
        </h1>
        <div className="flex items-center gap-3">
          {user && (
            <Sheet onOpenChange={(open) => open && fetchOrders()}>
              <SheetTrigger asChild>
                <button className="p-2 bg-slate-800 rounded-xl border border-white/5 relative">
                  <Package size={18} />
                  {orders.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-slate-900 border-white/5 text-white w-full sm:max-w-md z-[100]">
                <SheetHeader className="pb-6 border-b border-white/5">
                  <SheetTitle className="text-white font-black uppercase flex items-center gap-2">
                    <Package className="text-primary" /> Your Orders
                  </SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-4 overflow-y-auto max-h-[80vh]">
                  {ordersLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-bold uppercase text-xs tracking-widest">No orders yet</div>
                  ) : (
                    orders.map((order) => (
                      <div key={order._id} className="bg-slate-800/50 p-5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-sm uppercase tracking-tight">Hardcover Book</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                            order.status === 'Shipped' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500 animate-pulse'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                          <p className="font-black text-primary text-lg">${order.amount.toFixed(2)}</p>
                          {order.trackingUrl && (
                            <a href={order.trackingUrl} target="_blank" className="flex items-center gap-1 text-[10px] font-black text-blue-400 hover:underline">
                              TRACKING <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-white/10">{user.name.split(' ')[0]}</div>
              <button onClick={logout} className="text-[10px] font-black text-slate-500 uppercase hover:text-red-400 transition-colors">Logout</button>
            </div>
          ) : (
            <button onClick={login} className="bg-primary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all">Login</button>
          )}
        </div>
      </header>

      {step === 1 && (
        <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white">The Hero</h2>
            <Button
              variant="outline"
              onClick={randomizeFormData}
              className="rounded-full border-primary/30 text-primary hover:bg-primary/10 h-10 px-6 text-xs font-black uppercase tracking-widest"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Surprise Me
            </Button>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-2xl space-y-6">
            {/* Magic Photo Scan */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`bg-slate-950/50 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center p-8 text-center group transition-all cursor-pointer relative overflow-hidden ${
                photoUrl ? 'border-green-500/50' : 'border-white/10 hover:border-primary/30'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                className="hidden" 
                accept="image/*" 
              />
              
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="animate-spin text-primary mb-4" size={32} />
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Scanning Magic Features...</p>
                </div>
              ) : photoUrl ? (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-500 mb-4 shadow-lg shadow-green-500/20">
                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-sm font-black text-green-400 uppercase tracking-widest mb-1">Magic Link Established</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Character will sync with this photo</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPhotoUrl(''); }}
                    className="mt-4 text-[8px] font-black uppercase text-red-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={10} /> REMOVE PHOTO
                  </button>
                </div>
              ) : (
                 <>
                   <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg border border-white/5">
                     <Camera className="text-slate-400 group-hover:text-primary transition-colors" size={32} />
                   </div>
                   <h4 className="text-lg font-black text-white uppercase tracking-widest mb-2">Magic Photo Scan</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed max-w-[200px]">Upload a photo to sync your child's features with the AI character.</p>
                   <Badge variant="outline" className="mt-4 border-amber-500/30 text-amber-500 text-[8px] font-black uppercase bg-amber-500/5">Enable Character Sync</Badge>
                 </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Hero's Name</label>
                <input value={formData.childName} onChange={e => setFormData({...formData, childName: e.target.value})} className="w-full bg-slate-800 rounded-xl h-14 px-6 outline-none font-black text-lg focus:ring-2 focus:ring-primary transition-all" placeholder="e.g. Henry" />
              </div>
              
              {renderSelect('Age', 'age', ['3','4','5','6','7','8','9','10'])}
              {renderSelect('Gender', 'gender', options.genders)}
              {renderSelect('Skin Tone', 'skinTone', options.skinTones)}
              {renderSelect('Hair Style', 'hairStyle', options.hairStyles)}
              {renderSelect('Hair Color', 'hairColor', options.hairColors)}
              {renderSelect('Animal Friend', 'animal', randomAnimals)}
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4">
              {renderSelect('Art Style', 'characterStyle', options.styles)}
              {renderSelect('Story Location', 'location', options.locations)}
              {renderSelect('Life Lesson', 'lesson', randomLessons)}
            </div>
          </div>

          <button onClick={generateStory} disabled={loading} className="w-full h-20 bg-primary text-white rounded-[1.5rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" /> : <Wand2 />} 
            Write My Story
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-500">
          <div className="text-center">
            <h2 className="text-3xl font-black uppercase text-white">{book.title}</h2>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Draft Preview</p>
          </div>
          <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 max-h-[50vh] overflow-y-auto space-y-8 shadow-inner custom-scrollbar">
            {book.pages.map((p: any) => (
              <div key={p.pageNumber} className="relative pl-8">
                <span className="absolute left-0 top-0 text-[10px] font-black text-primary opacity-50">{p.pageNumber}</span>
                <p className="text-xl text-slate-200 italic leading-relaxed">"{p.text}"</p>
              </div>
            ))}
          </div>
          <button onClick={startPainting} disabled={loading} className="w-full h-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-[1.5rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} 
            Approve & Illustrate
          </button>
          <button onClick={() => setStep(1)} className="w-full py-4 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Edit Hero Details</button>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-lg mx-auto space-y-12 animate-in fade-in duration-1000">
          <div className="text-center">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-none">Your Adventure <br /> Is Coming To Life</h2>
            <p className="text-slate-400 mt-4">We're painting the first {TEASER_LIMIT} pages for free!</p>
          </div>
          
          <div className="space-y-20">
            {book.pages.map((p: any, i: number) => (
              <div key={i} className="space-y-6">
                <div className="aspect-square bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white ring-1 ring-black/10 relative">
                  {i < TEASER_LIMIT ? (
                    p.imageUrl ? (
                      <img key={p.imageUrl} src={p.imageUrl} className="w-full h-full object-cover" alt="" />
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
                <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 text-center shadow-lg">
                  <p className="text-xl font-medium text-slate-200 leading-relaxed italic">"{p.text}"</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-primary/20 text-center shadow-2xl sticky bottom-6">
            <h3 className="text-xl font-black uppercase mb-2">Love the story?</h3>
            <p className="text-slate-400 text-sm mb-6 font-medium">Order the full book to unlock all 23 illustrations and get a physical hardcover copy.</p>
            <button className="w-full h-20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-2xl font-black text-xl shadow-xl hover:shadow-primary/20 active:scale-[0.98] transition-all">
              Order Hardcover ($25)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Separator() {
  return <div className="h-px bg-white/5 w-full my-4" />;
}
