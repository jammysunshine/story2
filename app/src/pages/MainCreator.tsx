import { useState, useEffect, useRef } from 'react'
import { Sparkles, Wand2, Loader2, BookOpen, Lock, Palette, Package, ExternalLink, Camera, Trash2, FileText, User as CircleUser, FileDown, Flag } from 'lucide-react'
import axios from 'axios'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { useToast } from "../hooks/use-toast"
import { useCheckout } from "../hooks/useCheckout";
import { MagicGallery } from "../components/MagicGallery";
import { MagicGlow } from "../components/MagicGlow";
import { Separator } from "../components/UIComponents";
import { ParentalGateDialog } from "../components/dialogs/ParentalGateDialog";
import { ReportDialog } from "../components/dialogs/ReportDialog";
import { DeleteAccountDialog } from "../components/dialogs/DeleteAccountDialog";
import { OrderTracker } from "../components/bookshelf/OrderTracker";
import { LibraryGrid } from "../components/bookshelf/LibraryGrid";
import { AccountSection } from "../components/AccountSection";
import { Step1Hero } from "../components/creator/Step1Hero";
import { Step2Preview } from "../components/creator/Step2Preview";
import { Step3Painting } from "../components/creator/Step3Painting";

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

export default function MainCreator() {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [activeTab, setActiveTab] = useState<'creator' | 'bookshelf' | 'account'>('creator')
  const [loading, setLoading] = useState(false)

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
    lastShippingAddress?: {
      firstName: string;
      lastName: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      postCode: string;
      country: string;
    };
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
        console.log('🌐 Starting Web GSI Auth...');
        token = await new Promise((resolve, reject) => {
          if (!(window as any).google) {
            console.error('❌ Google script NOT LOADED on window');
            return reject(new Error('Google Library not loaded'));
          }
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            scope: 'email profile',
            callback: (resp: any) => {
              if (resp.error) {
                console.error('❌ GSI Callback Error:', resp.error);
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
        console.log('📱 Starting Native Capacitor Auth...');
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
      console.error('🔥 Login CRASH:', err);
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
      age: (Math.floor(Math.random() * 23) + 3).toString(),
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

            if (prevPaintedCount !== newPaintedCount || prev.status !== newStatus || (res.data.pdfUrl && !prev.pdfUrl)) {
              console.warn(`✨ Updating UI: ${prevPaintedCount} -> ${newPaintedCount} images. Status: ${newStatus}`);
              return { ...prev, ...res.data, pages: [...newPages] };
            }

            return prev;
          });

          // Stop polling if we reached a final state
          // NOTE: We don't stop on 'paid', 'preview', or 'generating' anymore since image generation happens after these statuses
          // We continue polling during image generation phases
          if (['illustrated', 'printing', 'printing_test', 'shipped'].includes(newStatus) ||
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

  const [showParentalGate, setShowParentalGate] = useState(false);
  const [parentalAnswer, setParentalGateAnswer] = useState('');
  const [parentalProblem, setParentalGateProblem] = useState({ q: '', a: 0 });

  const startParentalGate = () => {
    const num1 = Math.floor(Math.random() * 10) + 5;
    const num2 = Math.floor(Math.random() * 10) + 5;
    setParentalGateProblem({ q: `${num1} + ${num2}`, a: num1 + num2 });
    setShowParentalGate(true);
  };

  const verifyParentalGate = async () => {
    if (parseInt(parentalAnswer) === parentalProblem.a) {
      setShowParentalGate(false);
      setParentalGateAnswer('');
      
      // Proceed to checkout logic
      let currentUser = user;
      if (!currentUser) {
        currentUser = await login();
        if (!currentUser) return;
      }

      if (book && book.bookId && book.title) {
        createCheckoutSession(book.bookId, book.title, currentUser?.email);
      }
    } else {
      toast({ title: "Incorrect", description: "Parents only, please!", variant: "destructive" });
      startParentalGate(); // Refresh problem
    }
  };

  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportData, setReportData] = useState({ pageNumber: 1, reason: '', bookId: '' });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const reportContent = (pageNumber: number, specificBookId?: string) => {
    setReportData({ 
      pageNumber, 
      reason: '', 
      bookId: specificBookId || book?.bookId || '' 
    });
    setShowReportDialog(true);
  };

  const submitReport = async () => {
    if (!reportData.reason.trim()) {
      toast({ title: "Reason Required", description: "Please describe the issue.", variant: "destructive" });
      return;
    }

    if (!reportData.bookId) {
      toast({ title: "Error", description: "Could not identify which book to report.", variant: "destructive" });
      return;
    }

    setIsSubmittingReport(true);
    try {
      await axios.post(`${API_URL}/report-content`, {
        bookId: reportData.bookId,
        reporterEmail: user?.email || 'anonymous',
        pageNumber: reportData.pageNumber,
        reason: reportData.reason
      });
      setShowReportDialog(false);
      toast({ title: "Incident Logged", description: "Our safety team has been alerted." });
    } catch (e) {
      toast({ title: "Submission Failed", description: "Please try again later.", variant: "destructive" });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast({ title: "Termination Aborted", description: "Confirmation text did not match.", variant: "destructive" });
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await axios.delete(`${API_URL}/user/account`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (res.data.success) {
        setShowDeleteDialog(false);
        toast({ title: "Account Terminated", description: "Your data has been wiped." });
        logout();
      }
    } catch (e) {
      toast({ title: "Termination Failed", description: "Please try logging out and in again.", variant: "destructive" });
    } finally {
      setIsDeletingAccount(false);
    }
  };


  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<number | null>(null);

  const activateReviewerMode = async () => {
    console.warn('🕵️‍♀️ Activating Reviewer Test Mode...');
    const reviewerBookId = import.meta.env.VITE_REVIEWER_BOOK_ID;
    let loadedBook: Book | null = null;

    if (reviewerBookId) {
      toast({
        title: "🕵️‍♀️ Loading Reviewer Book...",
        description: `Attempting to fetch real book: ${reviewerBookId}`,
        duration: 3000,
      });
      try {
        // Attempt to fetch a real book from the backend
        const res = await axios.get(`${API_URL}/book-status?bookId=${reviewerBookId}`, {
          headers: { Authorization: user?.token ? `Bearer ${user.token}` : '' }
        });
        loadedBook = { ...res.data, bookId: reviewerBookId, status: 'pdf_ready', isDigitalUnlocked: true };
        if (loadedBook) {
          toast({
            title: "🕵️‍♀️ Reviewer Test Mode Activated",
            description: `Loaded real book: ${loadedBook.title}`,
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Failed to fetch reviewer book, falling back to dummy:', error);
        toast({
          title: "⚠️ Reviewer Mode Fallback",
          description: "Failed to load real book, using dummy content.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }

    if (!loadedBook) {
      // Fallback to dummy book if no reviewerBookId or fetch failed
      const dummyBookId = 'reviewer-test-book-' + Date.now();
      const dummyPdfUrl = 'https://www.africau.edu/images/default/sample.pdf'; // Sample PDF

      loadedBook = {
        _id: dummyBookId,
        bookId: dummyBookId,
        title: "The Reviewer's Grand Adventure",
        childName: "Gemini",
        status: "pdf_ready",
        photoUrl: "https://via.placeholder.com/150/FF0000/FFFFFF?text=REVIEWER",
        pdfUrl: dummyPdfUrl,
        isDigitalUnlocked: true,
        pages: Array.from({ length: 23 }, (_, i) => ({
          pageNumber: i + 1,
          text: `In a land far away, the brave hero Gemini embarked on an adventure. On page ${i + 1}, our hero discovered a magical artifact!`,
          prompt: `Reviewer test prompt for page ${i + 1}`,
          imageUrl: `https://via.placeholder.com/600x800/00FF00/000000?text=Page+${i + 1}`
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      toast({
        title: "🕵️‍♀️ Reviewer Test Mode Activated",
        description: "A dummy 'PDF Ready' book has been loaded.",
        duration: 5000,
      });
    }

    // Log the final loadedBook for debugging
    console.log("🐛 Reviewer Mode: Final loadedBook object:", loadedBook);

    setBook(loadedBook);
    setStep(3); // Jump to the preview/payment step
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
          onClick={() => {
            tapCountRef.current += 1;
            if (tapTimeoutRef.current) {
              clearTimeout(tapTimeoutRef.current);
            }

            if (tapCountRef.current === 3) {
              console.log("Triple tap detected!");
              tapCountRef.current = 0; // Reset immediately after triple tap
              if (tapTimeoutRef.current) {
                clearTimeout(tapTimeoutRef.current);
              }
              activateReviewerMode(); // Call the new function
            } else {
              tapTimeoutRef.current = setTimeout(() => {
                tapCountRef.current = 0;
                resetCreator(); // Reset if not a triple tap within the timeout
              }, 300);
            }
          }}
          className="text-2xl font-black tracking-tighter uppercase text-primary flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
        >
          <BookOpen className="text-primary" /> WonderStories
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
            onClick={() => {
              setActiveTab('bookshelf');
              if (user?.token) {
                fetchLibrary(user.token);
                fetchOrders(user.token);
              }
            }}
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

                        <Step1Hero 

                          loading={loading}

                          formData={formData}

                          setFormData={setFormData}

                          onRandomize={randomizeFormData}

                          onPhotoUpload={handlePhotoUpload}

                          isUploading={isUploading}

                          photoUrl={photoUrl}

                          setPhotoUrl={setPhotoUrl}

                          onGenerate={generateStory}

                          fileInputRef={fileInputRef}

                          options={options}

                          randomAnimals={randomAnimals}

                          randomLessons={randomLessons}

                          randomOccasions={randomOccasions}

                        />

                      )}

            

                      {step === 2 && book && (

                        <Step2Preview 

                          book={book}

                          onStartPainting={startPainting}

                          loading={loading}

                          onEdit={() => setStep(1)}

                          onReportContent={reportContent}

                        />

                      )}

          {step === 3 && book && (
            <Step3Painting 
              book={book}
              teaserLimit={TEASER_LIMIT}
              isPaid={isPaid()}
              progress={calculateProgress()}
              fullProgress={calculateFullBookProgress()}
              onReportContent={reportContent}
              onStartParentalGate={startParentalGate}
              checkoutLoading={checkoutLoading}
              bookCost={BOOK_COST}
              baseCurrency={BASE_CURRENCY}
              library={library}
            />
          )}
        </div>
      )}

      {activeTab === 'bookshelf' && (
        <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-between items-center">
            <h2 className="text-5xl font-black uppercase tracking-tighter text-white">My Bookshelf</h2>
          </div>

          {/* Active Deliveries Tracker */}
          <OrderTracker 
            orders={orders}
            activeLibraryBooks={library.filter(b => ['paid', 'illustrated', 'printing'].includes(b.status))}
          />

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
            <LibraryGrid 
              library={library}
              onSelectBook={(b) => {
                setBook({ ...b, bookId: b._id });
                setStep(3);
                setActiveTab('creator');
              }}
              onReportContent={reportContent}
            />
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
        <AccountSection 
          user={user}
          orders={orders}
          library={library}
          onLogout={logout}
          onDeleteRequest={() => setShowDeleteDialog(true)}
          onLogin={login}
        />
      )}
      {/* Parental Gate Modal */}
      <ParentalGateDialog 
        open={showParentalGate}
        onOpenChange={setShowParentalGate}
        problem={parentalProblem}
        answer={parentalAnswer}
        onAnswerChange={setParentalGateAnswer}
        onVerify={verifyParentalGate}
      />

      {/* Ominous Report Dialog */}
      <ReportDialog 
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        reason={reportData.reason}
        onReasonChange={(val) => setReportData({ ...reportData, reason: val })}
        onSubmit={submitReport}
        loading={isSubmittingReport}
      />

      {/* Ominous Account Termination Dialog */}
      <DeleteAccountDialog 
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        confirmation={deleteConfirmation}
        onConfirmationChange={setDeleteConfirmation}
        onDelete={deleteAccount}
        loading={isDeletingAccount}
      />
    </div>
  )
}


