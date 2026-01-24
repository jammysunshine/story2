import { useState, useEffect, useRef } from 'react'
import { Sparkles, Wand2, Loader2, BookOpen, Lock, Palette, Package, ExternalLink, Camera, Trash2, FileText, User as CircleUser, FileDown } from 'lucide-react'
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
import { useCheckout } from "../hooks/useCheckout";

import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'

//console.warn('⚠️⚠️⚠️ MAIN CREATOR FILE LOADED AT:', new Date().toLocaleTimeString());

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const TEASER_LIMIT = parseInt(import.meta.env.VITE_STORY_TEASER_PAGES_COUNT || '7');

// Pricing Constants for UI Display
const STORY_COST = import.meta.env.VITE_STORY_COST || '10';
const IMAGE_COST = import.meta.env.VITE_IMAGE_COST || '2';
const PDF_COST = import.meta.env.VITE_PDF_COST || '9.99';
const BOOK_COST = import.meta.env.VITE_PRINT_PRICE || '49.99';
const BASE_CURRENCY = (import.meta.env.VITE_BASE_CURRENCY || 'usd').toUpperCase();

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
  const [activeTab, setActiveTab] = useState<'creator' | 'bookshelf' | 'account'>('creator')
  const [loading, setLoading] = useState(false)
  interface BookPage {
    pageNumber: number;
    text: string;
    prompt: string;
    imageUrl?: string;
    url?: string;
  }

  interface Book {
    _id?: string;
    bookId?: string;
    title?: string;
    childName?: string;
    pages?: BookPage[];
    status?: string;
    heroBible?: string;
    animalBible?: string;
    finalPrompt?: string;
    photoUrl?: string;
    pdfUrl?: string;
    isDigitalUnlocked?: boolean;
    userId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }

  const [book, setBook] = useState<Book | null>(null)
  const bookRef = useRef<Book | null>(null); // To solve stale closure in poller
  const isHydrated = useRef(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [showPdfToast, setShowPdfToast] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Calculate progress based on images generated
  const calculateProgress = () => {
    if (!book?.pages) return 0;
    const totalTeaserPages = Math.min(TEASER_LIMIT, book.pages.length);
    const teaserPages = book.pages.slice(0, totalTeaserPages);
    const completedPages = teaserPages.filter(p => p.imageUrl && !p.imageUrl.includes('placeholder')).length;
    return Math.round((completedPages / totalTeaserPages) * 100);
  };

  // Calculate progress for full book generation (after payment)
  const calculateFullBookProgress = () => {
    if (!book?.pages) return 0;
    const totalPages = book.pages.length;
    const completedPages = book.pages.filter(p => p.imageUrl && !p.imageUrl.includes('placeholder')).length;
    return Math.round((completedPages / totalPages) * 100);
  };

  const isPaid = () => {
    return ['paid', 'illustrated', 'printing', 'pdf_ready'].includes(book?.status || '');
  };

  // Sync ref with state whenever book changes
  useEffect(() => { bookRef.current = book; }, [book]);

  console.log('MainCreator render: step', step, 'bookId', book?.bookId)
  interface User {
    email: string;
    name: string;
    id?: string;
    token?: string; // Added token
    createdAt?: Date;
    updatedAt?: Date;
    credits?: number;
    storiesCount?: number;
    imagesCount?: number;
    pdfsCount?: number;
    recentBooks?: {
      id: string;
      title: string;
      thumbnailUrl: string;
      status: string;
      isDigitalUnlocked: boolean;
      createdAt: Date;
    }[];
  }

  const [user, setUser] = useState<User | null>(null)

  interface FormData {
    childName: string;
    age: string;
    gender: string;
    skinTone: string;
    hairStyle: string;
    hairColor: string;
    animal: string;
    characterStyle: string;
    location: string;
    lesson: string;
    occasion: string;
  }

  const { createCheckoutSession, loading: checkoutLoading } = useCheckout();

  useEffect(() => {
    const isWeb = Capacitor.getPlatform() === 'web';
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    console.warn(`🔍 AUTH CHECK: Platform=${Capacitor.getPlatform()}, ClientID=${clientId ? '✅' : '❌'}`);

    // ONLY initialize the Capacitor plugin on Native (iOS/Android)
    if (!isWeb && clientId) {
      GoogleAuth.initialize({
        clientId: clientId,
        scopes: ['profile', 'email'],
      });
    }

    // 1. RESTORE STATE
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      console.warn('👤 Restored User:', parsedUser.email);
      // Auto-fetch orders for returning user
      fetchOrders(parsedUser.token);
      fetchLibrary(parsedUser.token);
    }

    const savedBook = localStorage.getItem('book');
    if (savedBook) {
      const parsedBook = JSON.parse(savedBook);
      setBook(parsedBook);
      console.warn('📖 Restored Book:', parsedBook.bookId);
    }

    const savedStep = localStorage.getItem('step');
    if (savedStep) {
      const parsedStep = parseInt(savedStep);
      setStep(parsedStep);
      console.warn('📍 Restored Step:', parsedStep);
    }

    const savedTab = localStorage.getItem('activeTab') as 'creator' | 'bookshelf' | 'account';
    if (savedTab) {
      setActiveTab(savedTab);
      console.warn('📍 Restored Tab:', savedTab);
    }

    // Check if user just returned from payment
    const justPaid = localStorage.getItem('justPaid');
    if (justPaid && savedBook) {
      console.warn('🔓 Payment detected, refreshing book state...');
      localStorage.removeItem('justPaid');
      // Force refresh from server
      const refreshBook = async () => {
        try {

          // 2. LOCK HYDRATION (Wait a frame to ensure state is restored before persistence wakes up)
          setTimeout(() => {
            isHydrated.current = true;
            console.warn('💎 Hydration Complete: state restored from memory');
          }, 100);
          const res = await axios.get(`${API_URL}/book-status?bookId=${JSON.parse(savedBook).bookId}`);
          const updated = { ...JSON.parse(savedBook), ...res.data, bookId: JSON.parse(savedBook).bookId };
          setBook(updated);
          localStorage.setItem('book', JSON.stringify(updated));
          console.warn('✅ Book refreshed, unlock status:', res.data.isDigitalUnlocked);
        } catch (e) {
          console.error('Failed to refresh book:', e);
        }
      };
      refreshBook();
    }

    // Background PDF monitoring
    if (savedBook) {
      const monitorPdf = async () => {
        try {
          const res = await axios.get(`${API_URL}/book-status?bookId=${JSON.parse(savedBook).bookId}`);
          if (res.data.pdfUrl && !pdfReady) {
            setPdfReady(true);
            setShowPdfToast(true);
            setTimeout(() => setShowPdfToast(false), 10000);
          }
        } catch (e) {
          console.error('PDF monitoring failed:', e);
        }
      };
      const pdfInterval = setInterval(monitorPdf, 15000);
      return () => clearInterval(pdfInterval);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated.current) return;
    if (book) localStorage.setItem('book', JSON.stringify(book));
  }, [book]);

  useEffect(() => {
    if (!isHydrated.current) return;
    localStorage.setItem('step', step.toString());
  }, [step]);

  useEffect(() => {
    if (!isHydrated.current) return;
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const login = async () => {
    const isWeb = Capacitor.getPlatform() === 'web';
    console.warn(`🗝️ Attempting Google Sign-In (${isWeb ? 'Web Engine' : 'Native Engine'})...`);

    try {
      let token;
      if (isWeb) {
        // --- WEB ENGINE (GSI) ---
        token = await new Promise((resolve, reject) => {
          if (!(window as any).google) return reject(new Error('Google Library not loaded'));
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            scope: 'email profile',
            callback: (resp: any) => {
              if (resp.error) {
                console.error('❌ GSI Error:', resp.error);
                return reject(resp);
              }
              console.warn('📡 Token received from Web Engine');
              resolve(resp.access_token);
            },
          });
          client.requestAccessToken();
        });
      } else {
        // --- NATIVE ENGINE (Capacitor Plugin) ---
        const googleUser = await GoogleAuth.signIn();
        console.warn('📡 Token received from Native Engine');
        token = googleUser.authentication.idToken;
      }

      console.warn('📡 Sending token to backend for verification...');
      const res = await axios.post(`${API_URL}/auth/social`, { token, provider: 'google' });
      if (res.data.success) {
        const userData = { ...res.data.user, token };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        toast({ title: "Welcome back!", description: `Logged in as ${res.data.user.name}` });
        return userData;
      }
    } catch (err: any) {
      console.error('Login failed', err);
      toast({ title: "Login Failed", description: err.message || "Authentication error", variant: "destructive" });
    }
    return null;
  };

  const logout = async () => {
    console.warn('🚿 Logging out...');
    const isWeb = Capacitor.getPlatform() === 'web';

    try {
      if (!isWeb) {
        await GoogleAuth.signOut().catch(() => { });
      }
    } catch (err) {
      // Ignore provider errors
    }

    setUser(null);
    localStorage.removeItem('user');
    toast({ title: "Logged out", description: "You have been signed out." });
  };

  const [photoUrl, setPhotoUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  interface Order {
    _id: string;
    bookId: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
    trackingUrl?: string; // Added trackingUrl
    shippingAddress: {
      firstName: string;
      lastName: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      postCode: string;
      country: string;
      email: string;
    };
    createdAt: Date;
    updatedAt: Date;
  }

  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  const [formData, setFormData] = useState<FormData>({
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

  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    console.warn('--- POLLING USEEFFECT TRIGGERED ---');
    console.warn('Current Step:', step, 'Book ID:', book?.bookId);

    // Cleanup any existing interval before starting a new one
    if (pollingRef.current) {
      console.warn('🧹 Cleaning up old zombie poller');
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (step === 3 && book?.bookId) {
      console.warn('✅ Polling condition MET. Starting loop.');

      const poll = async () => {
        console.log('--- POLLER TICK ---');
        try {
          const res = await axios.get(`${API_URL}/book-status?bookId=${book.bookId}`);
          const newStatus = res.data.status;
          const newPages = res.data.pages || [];

          // SAFETY: If API returns empty pages for a book we know should have pages, ABORT
          if (newPages.length === 0 && bookRef.current?.pages && bookRef.current.pages.length > 0) {
            console.warn('⚠️ API returned 0 pages for existing book. Ignoring to prevent UI collapse.');
            return;
          }

          const newPaintedCount = newPages.filter((p: BookPage) => p.imageUrl && !p.imageUrl.includes('placeholder')).length;

          setBook((prev: Book | null) => {
            if (!prev) return null;

            const prevPaintedCount = prev.pages?.filter((p: BookPage) => p.imageUrl && !p.imageUrl.includes('placeholder')).length || 0;

            // CRITICAL: Prevent "downgrade" regression
            // If new count is LESS than what we have, REJECT it unless status changed significantly
            if (newPaintedCount < prevPaintedCount && newStatus !== 'preview') {
              console.warn(`🚨 BLOCKED REGRESSION: UI has ${prevPaintedCount}, API said ${newPaintedCount}. Ignoring API.`);
              return prev;
            }

            if (prevPaintedCount !== newPaintedCount || prev.status !== newStatus) {
              console.warn(`✨ Updating UI: ${prevPaintedCount} -> ${newPaintedCount} images. Status: ${newStatus}`);
              return { ...prev, status: newStatus, pages: [...newPages] };
            }

            return prev;
          });

          // Stop polling if we reached a final state
          // NOTE: We don't stop on 'paid', 'preview', or 'generating' anymore since image generation happens after these statuses
          // We continue polling during image generation phases
          if (['illustrated', 'printing', 'printing_test', 'pdf_ready'].includes(newStatus) ||
            (newStatus === 'teaser_ready' && calculateProgress() === 100)) {
            console.warn('🏁 STOPPING POLL. Final Status Reached:', newStatus);
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
          console.error('❌ Polling failed:', errorMessage);
        }
      };

      poll();
      pollingRef.current = setInterval(poll, 4000);
    }

    return () => {
      if (pollingRef.current) {
        console.warn('🧹 Component Cleanup: Clearing poller');
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [step, book?.bookId]);

  const fetchOrders = async (explicitToken?: string) => {
    const token = explicitToken || user?.token;
    if (!token || token.length < 10) return;
    setOrdersLoading(true);
    try {
      const res = await axios.get(`${API_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data.orders);
    } catch (err: unknown) {
      console.error('Failed to fetch orders', err);
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

  const fetchLibrary = async (explicitToken?: string) => {
    const token = explicitToken || user?.token;
    if (!token || token.length < 10) return;
    setLibraryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/user/library`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLibrary(res.data.books || []);
    } catch (e) {
      console.error('Library fetch failed:', e);
    } finally {
      setLibraryLoading(false);
    }
  };

  const generateStory = async () => {
    console.warn('🚀 FRONTEND: generateStory CALLED');
    console.warn('Payload:', { ...formData, photoUrl, email: user?.email });
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/generate-story`, { ...formData, photoUrl, email: user?.email })
      console.warn('✅ FRONTEND: Story Generated Successfully', res.data);
      // Ensure we have a consistent bookId key
      const bookData = { ...res.data, bookId: res.data.bookId || res.data._id || res.data.id };
      setBook(bookData)
      setStep(2)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ FRONTEND: Story Generation Failed', errorMessage);
      alert(`Failed to generate story: ${errorMessage}`)
    }
    finally { setLoading(false) }
  }

  const startPainting = async () => {
    console.warn('🎨 FRONTEND: startPainting CALLED');
    if (!book || !book.bookId) {
      console.error('❌ FRONTEND: No book ID found');
      return;
    }
    console.warn('Book ID:', book.bookId);
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/generate-images`, { bookId: book.bookId })
      console.warn('✅ FRONTEND: Painting Started Successfully', res.data);
      setStep(3)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ FRONTEND: Painting Failed to Start', errorMessage);
      alert(`Failed to start painting: ${errorMessage}`)
    }
    finally { setLoading(false) }
  }

  const resetCreator = () => {
    setBook(null);
    setStep(1);
    setPhotoUrl('');
    setFormData({
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
    });
    setActiveTab('creator');
    localStorage.removeItem('book');
    toast({
      title: "✨ Home Sweet Home",
      description: "Ready for a new adventure?",
    });
  };

  const renderSelect = (label: string, field: keyof typeof formData, choices: string[]) => (
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">{label}</label>
      <select
        value={formData[field]}
        onChange={e => setFormData({ ...formData, [field]: e.target.value })}
        className="w-full bg-slate-800 rounded-xl h-12 px-4 outline-none font-bold text-sm border border-transparent focus:border-primary/30 transition-all shadow-sm focus:shadow-lg focus:shadow-primary/10"
      >
        {choices.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )

  const MagicGlow = ({ color = 'pink' }: { color?: 'pink' | 'blue' | 'amber' | 'purple' | 'green' }) => {
    const colorMap: Record<string, string> = {
      pink: 'from-pink-600/50 to-rose-600/50 border-pink-600/70',
      blue: 'from-blue-600/50 to-indigo-600/50 border-blue-600/70',
      amber: 'from-amber-600/50 to-orange-600/50 border-amber-600/70',
      purple: 'from-purple-600/50 to-indigo-600/50 border-purple-600/70',
      green: 'from-green-600/50 to-emerald-600/50 border-green-600/70'
    };

    return (
      <div className="relative w-48 h-48 mx-auto group">
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes magic-float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }
          @keyframes magic-glow-1 {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.3); opacity: 0.8; }
          }
          @keyframes magic-glow-2 {
            0%, 100% { transform: scale(1.1); opacity: 0.3; }
            50% { transform: scale(1.6); opacity: 0.6; }
          }
          @keyframes magic-pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.1); opacity: 1; }
          }
          .animate-magic-float { animation: magic-float 3s ease-in-out infinite; }
          .animate-magic-glow-1 { animation: magic-glow-1 3s ease-in-out infinite; }
          .animate-magic-glow-2 { animation: magic-glow-2 4s ease-in-out infinite; }
          .animate-magic-pulse { animation: magic-pulse 2s ease-in-out infinite; }
        `}} />
        <div className={`absolute inset-0 bg-gradient-to-tr ${colorMap[color]} rounded-full blur-3xl animate-magic-glow-2`} />
        <div className={`absolute inset-0 bg-gradient-to-tr ${colorMap[color]} rounded-full blur-xl animate-magic-glow-1`} />
        <div className={`relative bg-slate-900/90 backdrop-blur-md border-4 ${colorMap[color].split(' ').pop()} w-full h-full rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.7)] animate-magic-pulse`}>
          {(color === 'pink' || color === 'blue') ? <Palette className="text-white w-20 h-20 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" /> :
            (color === 'amber' || color === 'green') ? <FileText className="text-white w-20 h-20 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" /> :
              <Package className="text-white w-20 h-20 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" />}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans pb-20">
      {/* PDF Ready Toast */}
      {showPdfToast && (
        <div className="fixed top-6 right-6 z-[9999] animate-in slide-in-from-top-5 duration-500">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-green-500/30 flex items-center gap-4 max-w-md">
            <FileDown className="w-6 h-6 animate-bounce" />
            <div className="flex-1">
              <p className="font-black text-sm uppercase tracking-wide">Your PDF is Ready!</p>
              <p className="text-xs opacity-90">Click to download your book</p>
            </div>
            <button
              onClick={() => {
                const pdfUrl = book?.pdfUrl;
                if (pdfUrl) {
                  const link = document.createElement('a');
                  link.href = pdfUrl;
                  link.download = `${book.title || 'story'}.pdf`;
                  link.click();
                }
                setShowPdfToast(false);
              }}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all"
            >
              Download
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center mb-12 pt-[env(safe-area-inset-top)] gap-6">
        <h1
          onClick={resetCreator}
          className="text-2xl font-black tracking-tighter uppercase text-primary flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
        >
          <BookOpen className="text-primary" /> StoryTime
        </h1>

        <nav className="flex items-center bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
          <button
            onClick={() => setActiveTab('creator')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'creator' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'
              }`}
          >
            <Sparkles size={14} /> Creator
          </button>
          <button
            onClick={() => setActiveTab('bookshelf')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'bookshelf' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'
              }`}
          >
            <BookOpen size={14} /> Bookshelf
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'account' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'
              }`}
          >
            <CircleUser size={14} /> Account
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-white/10">{user.name.split(' ')[0]}</div>
              <button onClick={logout} className="text-[10px] font-black text-slate-500 uppercase hover:text-red-400 transition-colors hover:underline">Logout</button>
            </div>
          ) : (
            <button onClick={async () => { await login(); }} className="bg-primary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all hover:shadow-primary/30 hover:scale-[1.02]">Login</button>
          )}
        </div>
      </header>

      {activeTab === 'creator' && (
        <div className="space-y-8">

          {step === 1 && (
            <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex flex-col items-center gap-4 text-center">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white">The Hero</h2>
                <Button
                  variant="outline"
                  onClick={randomizeFormData}
                  className="rounded-full border-primary/30 text-primary hover:bg-primary/10 h-10 px-6 text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Surprise Me
                </Button>
              </div>

              <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-2xl space-y-6">
                {/* Magic Photo Scan */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`bg-slate-950/50 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center p-8 text-center group transition-all cursor-pointer relative overflow-hidden ${photoUrl ? 'border-green-500/50' : 'border-white/10 hover:border-primary/30'
                    } hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-transform`}
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
                    <input value={formData.childName} onChange={e => setFormData({ ...formData, childName: e.target.value })} className="w-full bg-slate-800 rounded-xl h-14 px-6 outline-none font-black text-lg focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary/30 shadow-sm focus:shadow-lg focus:shadow-primary/10" placeholder="e.g. Henry" />
                  </div>

                  {renderSelect('Age', 'age', ['3', '4', '5', '6', '7', '8', '9', '10'])}
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

              <button onClick={generateStory} disabled={loading} className="w-full h-20 bg-primary text-white rounded-[1.5rem] font-black text-xl shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 hover:shadow-primary/30 hover:scale-[1.02]">
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="relative w-6 h-6">
                      <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
                      <div className="relative bg-white w-full h-full rounded-full flex items-center justify-center">
                        <Wand2 className="text-primary w-3 h-3" />
                      </div>
                    </div>
                    <span>Weaving Magic...</span>
                  </div>
                ) : (
                  <>
                    <Wand2 />
                    Write My Story
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Premium Story Generation Value: ${STORY_COST} {BASE_CURRENCY}</p>
            </div>
          )}

          {step === 2 && book && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-500">
              <div className="text-center">
                <h2 className="text-3xl font-black uppercase text-white">{book.title}</h2>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Draft Preview</p>
              </div>
              <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 max-h-[50vh] overflow-y-auto space-y-8 shadow-inner custom-scrollbar">
                {book.pages?.map((p: BookPage) => (
                  <div key={p.pageNumber} className="relative pl-8">
                    <span className="absolute left-0 top-0 text-[10px] font-black text-primary opacity-50">{p.pageNumber}</span>
                    <p className="text-xl text-slate-200 italic leading-relaxed">"{p.text}"</p>
                  </div>
                ))}
              </div>
              <button onClick={startPainting} disabled={loading} className="w-full h-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-[1.5rem] font-black text-xl shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 hover:shadow-blue-500/30 hover:scale-[1.02]">
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Approve & Illustrate
              </button>
              <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Full Book Illustration Value: ${parseInt(IMAGE_COST) * 23} {BASE_CURRENCY}</p>
              <button onClick={() => setStep(1)} className="w-full py-4 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:text-slate-400 transition-colors">Edit Hero Details</button>
            </div>
          )}

          {step === 3 && book && (
            <div className="max-w-lg mx-auto space-y-12 animate-in fade-in duration-1000">
              {/* Check if we're in the painting phase (not all teaser images are done yet) */}
              {(book.status === 'generating' || book.status === 'teaser_generating' || book.status === 'preview' ||
                (book.status !== 'teaser_ready' && calculateProgress() < 100)) ? (
                // Show centralized loading animation when teaser images are being generated
                <div className="py-20 text-center space-y-10">
                  {(() => { console.log("DEBUG: Rendering teaser generation animation. Status:", book.status, "Progress:", calculateProgress()); return null; })()}
                  <MagicGlow color="pink" />
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Creating Teaser Illustrations</h2>
                    <p className="text-slate-400 text-lg font-medium">Generating {Math.min(TEASER_LIMIT, book.pages?.length || TEASER_LIMIT)} stunning AI illustrations...</p>
                  </div>
                  <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-amber-500 transition-all duration-1000 ease-out"
                      style={{
                        width: `${calculateProgress()}%`
                      }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Estimated Time: 2-3 Minutes
                  </p>
                </div>
              ) : book.status === 'teaser_ready' && calculateProgress() < 100 ? (
                // Special case: if status is teaser_ready but progress is still < 100%, show loading
                <div className="py-20 text-center space-y-10">
                  <MagicGlow color="pink" />
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Finishing Teaser Illustrations</h2>
                    <p className="text-slate-400 text-lg font-medium">Finalizing {Math.min(TEASER_LIMIT, book.pages?.length || TEASER_LIMIT)} teaser illustrations...</p>
                  </div>
                  <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-amber-500 transition-all duration-1000 ease-out"
                      style={{
                        width: `${calculateProgress()}%`
                      }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Almost Ready!
                  </p>
                </div>
              ) : book.status === 'paid' && calculateFullBookProgress() < 100 ? (
                // Show centralized loading animation when full book images are being generated after payment
                <div className="py-20 text-center space-y-10">
                  {(() => { console.log("DEBUG: Rendering full book generation animation. Status:", book.status, "Full progress:", calculateFullBookProgress()); return null; })()}
                  <MagicGlow color="blue" />
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Completing Your Full Book</h2>
                    <p className="text-slate-400 text-lg font-medium">Generating all {book.pages?.length || 23} illustrations for your full book...</p>
                  </div>
                  <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
                      style={{
                        width: `${calculateFullBookProgress()}%`
                      }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Estimated Time: 5-8 Minutes
                  </p>
                </div>
              ) : book.status === 'paid' && !book.pdfUrl ? (
                // Show loading animation when PDF is being generated
                <div className="py-20 text-center space-y-10">
                  {(() => { console.log("DEBUG: Rendering PDF generation animation. Status:", book.status, "PDF URL exists:", !!book.pdfUrl); return null; })()}
                  <MagicGlow color="amber" />
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Preparing Your High-Resolution PDF</h2>
                    <p className="text-slate-400 text-lg font-medium">Assembling your beautifully illustrated book into a high-quality PDF...</p>
                  </div>
                  <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000 ease-out"
                      style={{
                        width: '75%' // PDF generation is typically quick once images are ready
                      }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    EST. TIME: 6-8 MINS
                  </p>
                </div>
              ) : book.status === 'pdf_ready' && !book.pdfUrl ? (
                // Show loading animation when PDF is being prepared for download
                <div className="py-20 text-center space-y-10">
                  <MagicGlow color="green" />
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Finalizing Your PDF</h2>
                    <p className="text-slate-400 text-lg font-medium">Your PDF is ready! Preparing download link...</p>
                  </div>
                  <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000 ease-out"
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Almost Ready!
                  </p>
                </div>
              ) : book.status === 'printing' ? (
                // Show loading animation when book is being printed
                <div className="py-20 text-center space-y-10">
                  <MagicGlow color="purple" />
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Printing Your Book</h2>
                    <p className="text-slate-400 text-lg font-medium">Your hardcover book is being professionally printed and will ship soon!</p>
                  </div>
                  <div className="max-w-md mx-auto w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000 ease-out"
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    On Its Way To You!
                  </p>
                </div>
              ) : (
                // Show the book preview with individual page placeholders
                <>
                  <div className="text-center">
                    <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-none">Your Adventure <br /> Is Coming To Life</h2>
                    <p className="text-slate-400 mt-4">We're painting the first {TEASER_LIMIT} pages for free!</p>
                  </div>

                  <div className="space-y-20">
                    {book.pages?.map((p: BookPage, i: number) => (
                      <div key={`${i}-${p.imageUrl || 'no-image'}`} className="space-y-6">
                        <div className="aspect-square bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white ring-1 ring-black/10 relative">
                          {(i < TEASER_LIMIT || isPaid()) ? (
                            p.imageUrl && !p.imageUrl.includes('placeholder') ? (
                              <img
                                key={p.imageUrl}
                                src={p.imageUrl}
                                className="w-full h-full object-cover"
                                alt={`Page ${i + 1}`}
                                onError={() => {
                                  console.error(`Failed to load image: ${p.imageUrl}`);
                                  // If image fails to load, it might be an expired signed URL
                                  // We can't easily trigger a single page refresh here without complex state,
                                  // but the poller will eventually get a new one.
                                  // For now, let's just log it.
                                }}
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
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 text-center shadow-lg">
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
                      <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">Digital PDF Edition: ${PDF_COST} {BASE_CURRENCY}</p>
                    </div>
                  )}

                  {!isPaid() && (
                    <button
                      onClick={async () => {
                        let currentUser = user;
                        if (!currentUser) {
                          toast({ title: "Login Required", description: "Please sign in to order your book!" });
                          currentUser = await login();
                          if (!currentUser) return; // User cancelled login
                        }

                        if (book && book.bookId && book.title) {
                          createCheckoutSession(book.bookId, book.title, currentUser?.email);
                        } else {
                          toast({
                            title: "Error",
                            description: "Book information not available. Please try again.",
                            variant: "destructive"
                          });
                        }
                      }}
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
                          Order Hardcover (${BOOK_COST} {BASE_CURRENCY})
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
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">PDF Ready</p>
                          </div>
                        </div>
                        <FileDown className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bookshelf' && (
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-between items-center">
            <h2 className="text-5xl font-black uppercase tracking-tighter text-white">My Bookshelf</h2>
            <div className="flex gap-4">
              <Sheet onOpenChange={(open) => open && fetchOrders()}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="rounded-2xl border-white/5 text-slate-400 hover:text-white bg-slate-900/50 h-14 px-6 font-black uppercase tracking-widest text-[10px]">
                    <Package size={18} className="mr-3" /> Recent Orders
                    {orders.length > 0 && <span className="ml-3 w-2 h-2 bg-primary rounded-full animate-pulse" />}
                  </Button>
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
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${order.status === 'Shipped' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
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
            </div>
          </div>

          {!user ? (
            <div className="bg-slate-900/50 p-20 rounded-[3rem] border border-dashed border-white/10 text-center space-y-8">
              <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-2xl rotate-3">
                <Lock className="text-slate-500" size={40} />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black uppercase tracking-tight text-white">Login to see your shelf</h3>
                <p className="text-slate-400 max-w-sm mx-auto font-medium text-lg leading-relaxed">To view your adventures and track your deliveries, please sign in.</p>
              </div>
              <Button onClick={() => login()} size="lg" className="h-20 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-lg shadow-2xl shadow-primary/30 active:scale-95 transition-all">Sign In with Google</Button>
            </div>
          ) : library.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {library.map((b) => (
                <div key={`${b._id}-${b.status}`} onClick={() => {
                  setBook({ ...b, bookId: b._id });
                  setStep(3);
                  setActiveTab('creator');
                }} className="group cursor-pointer space-y-4">
                  <div className="aspect-[3/4] bg-slate-900 rounded-[2.5rem] overflow-hidden border-8 border-white/5 shadow-2xl group-hover:border-primary/50 group-hover:scale-[1.02] transition-all relative">
                    {b.pages?.[0]?.imageUrl ? (
                      <img src={b.pages[0].imageUrl} className="w-full h-full object-cover" alt={b.title} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Palette className="text-slate-700 w-16 h-16 animate-pulse" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-8 pt-20">
                      <Badge className="mb-3 bg-primary/20 text-primary border-primary/20 uppercase text-[10px] font-black px-3 py-1">{b.status}</Badge>
                      <h4 className="text-lg font-black uppercase tracking-tighter text-white leading-tight line-clamp-2">{b.title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Click to View Adventure</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900/50 p-20 rounded-[3rem] border border-dashed border-white/10 text-center space-y-8">
              <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-2xl -rotate-3">
                <BookOpen className="text-slate-500" size={40} />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black uppercase tracking-tight text-white">Your shelf is empty</h3>
                <p className="text-slate-400 max-w-sm mx-auto font-medium text-lg leading-relaxed">Every great library starts with a single story. Let's create your first adventure!</p>
              </div>
              <Button onClick={() => setActiveTab('creator')} size="lg" className="h-20 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-lg shadow-2xl shadow-primary/30 active:scale-95 transition-all">Start My First Story</Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'account' && (
        <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-slate-900/50 p-12 rounded-[3.5rem] border border-white/5 flex flex-col items-center gap-8 text-center shadow-2xl transition-all hover:border-primary/20">
            <div className="w-32 h-32 bg-gradient-to-br from-primary via-purple-600 to-pink-600 rounded-[2.5rem] flex items-center justify-center text-5xl font-black shadow-2xl border-4 border-white/10 rotate-3">
              {user?.name?.[0] || '?'}
            </div>
            <div className="space-y-2">
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white">{user?.name || 'Guest'}</h2>
              <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs underline underline-offset-8 decoration-primary/30">{user?.email || 'Login to sync collections'}</p>
            </div>

            <div className="grid grid-cols-1 w-full gap-6 mt-6">
              <div className="bg-slate-950/50 p-10 rounded-[2.5rem] border border-white/5 space-y-8">
                <h3 className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-600">Adventurer Statistics</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-4xl font-black text-white">{user?.recentBooks?.length || 0}</p>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Adventures</p>
                  </div>
                  <div className="space-y-2 border-x border-white/5 px-2">
                    <p className="text-4xl font-black text-primary">{user?.recentBooks?.filter(b => b.isDigitalUnlocked).length || 0}</p>
                    <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Unlocked</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-4xl font-black text-white">{orders?.length || 0}</p>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Physical</p>
                  </div>
                </div>
              </div>

              {user ? (
                <button onClick={logout} className="w-full h-20 bg-red-500/5 text-red-500/50 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-red-500/10 hover:text-red-500 transition-all border border-red-500/10 flex items-center justify-center gap-3 active:scale-95 group">
                  <Trash2 size={16} className="group-hover:animate-bounce" /> Logout and End Session
                </button>
              ) : (
                <Button onClick={() => login()} size="lg" className="h-20 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl">Sign In with Google</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Separator() {
  return <div className="h-px bg-white/10 w-full my-6" />;
}
