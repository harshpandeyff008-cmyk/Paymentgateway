import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase/auth';
import Footer from '../components/Footer';
import SoftOnboardingModal from '../components/SoftOnboardingModal';
import BecomeClientModal from '../components/BecomeClientModal';
import { 
  Store, 
  Search, 
  Filter, 
  ShieldCheck, 
  Sparkles, 
  Send, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Eye, 
  Flame, 
  Moon, 
  Sun, 
  CheckCircle2, 
  MessageCircle, 
  Phone, 
  Info, 
  Lock, 
  IndianRupee,
  Layers,
  Check,
  X,
  LogIn,
  LogOut,
  KeyRound,
  User,
  ShoppingCart,
  Zap,
  Clock,
  QrCode,
  Copy,
  ArrowLeft,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function PublicStore({ isUserDashboard = false }) {
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBecomeClient, setShowBecomeClient] = useState(false);
  const [showSoftOnboard, setShowSoftOnboard] = useState(false);
  const isPublicDomain = window.location.hostname.toLowerCase().includes('dealsbyshiv') ||
                         window.location.hostname.toLowerCase().includes('garena') ||
                         window.location.hostname.toLowerCase().includes('freefire');
  
  // Super Admin Contact Settings
  const [telegramHandle, setTelegramHandle] = useState('alexccseller');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [brandName, setBrandName] = useState('Free Fire Official Deals');

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'under500', '500to2000', 'above2000', 'videos'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'price_asc', 'price_desc'
  
  // Media Carousel indices per card (itemId -> index)
  const [cardMediaIndices, setCardMediaIndices] = useState({});

  // Selected Detail Modal / Lightbox
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalMediaIndex, setModalMediaIndex] = useState(0);

  // Buy Now Channel Selection Modal State
  const [buyModalItem, setBuyModalItem] = useState(null);

  // UPI Gateway Integration State (defaults to live Render gateway & official pg_live API key)
  const defaultGatewayUrl = import.meta.env.VITE_UPI_GATEWAY_URL || 'https://payment-gateway-ydl1.onrender.com';
  const defaultGatewayKey = import.meta.env.VITE_UPI_GATEWAY_API_KEY || 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0';
  const [gatewayUrl, setGatewayUrl] = useState(defaultGatewayUrl);
  const [gatewayApiKey, setGatewayApiKey] = useState(defaultGatewayKey);

  const [paymentStep, setPaymentStep] = useState('choose'); // 'choose' | 'form' | 'gateway' | 'success'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Lit Terms & Conditions Agreement Popup (Shows on every visit)
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsCheckbox, setTermsCheckbox] = useState(false);
  const [popupPoints, setPopupPoints] = useState([
    {
      title: '1. 100% VERIFIED GAME ASSETS',
      desc: 'EVERY FREE FIRE ACCOUNT LISTED HAS BEEN MANUALLY RECORDED AND VERIFIED WITH VIDEO & PHOTO PROOFS.'
    },
    {
      title: '2. DIRECT ESCROW PROTOCOL',
      desc: 'NO AUTOMATED GATEWAY LEAKS. ALL PAYMENTS & CREDENTIAL TRANSFERS ARE SUPERVISED LIVE VIA OFFICIAL DESK.'
    },
    {
      title: '3. ZERO FRAUD & INSTANT REPLACEMENT',
      desc: 'COMPLETE HANDOVER RECORDING IS REQUIRED UPON PURCHASE. VALIDATED ISSUES RECEIVE 100% REPLACEMENT OR REFUND ASSISTANCE.'
    },
    {
      title: '4. FUTURE TERMS & POLICY AMENDMENTS',
      desc: 'TERMS & CONDITIONS MAY BE UPDATED AT ANY TIME. PROCEEDING BINDS YOU TO ALL PRESENT AND FUTURE MODIFICATIONS AUTOMATICALLY.'
    }
  ]);
  const [futureClauseText, setFutureClauseText] = useState(
    'TERMS & CONDITIONS MAY BE MODIFIED AT ANY TIME. PROCEEDING CONSTITUTES AUTOMATIC BINDING AGREEMENT TO ALL CURRENT AND FUTURE REVISIONS.'
  );

  // Pre-fill user data from account if logged in
  useEffect(() => {
    if (currentUser && userDoc) {
      if (userDoc.name && !customerName) setCustomerName(userDoc.name);
      if (userDoc.phone && !customerPhone) setCustomerPhone(userDoc.phone);
      if (userDoc.role === 'user' && !userDoc.phone) {
        const dismissed = localStorage.getItem(`soft_onboard_dismissed_${currentUser.uid}`);
        if (!dismissed) setShowSoftOnboard(true);
      }
    }
  }, [currentUser, userDoc]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error("Logout note:", err);
    }
  };

  // Real-time listener for Super Admin Contact Channels & Terms Settings
  useEffect(() => {
    const unsubContact = onSnapshot(doc(db, 'system_settings', 'store_contact'), (docSnap) => {
      if (docSnap.exists()) {
        const cd = docSnap.data();
        if (cd.telegram) setTelegramHandle(cd.telegram);
        if (cd.whatsapp) setWhatsappNumber(cd.whatsapp);
        if (cd.brandName) setBrandName(cd.brandName);
      }
    }, (err) => {
      console.warn("Real-time contact sync note:", err);
    });

    const unsubTerms = onSnapshot(doc(db, 'system_settings', 'terms_conditions'), (docSnap) => {
      if (docSnap.exists()) {
        const td = docSnap.data();
        if (Array.isArray(td.popupPoints) && td.popupPoints.length > 0) {
          setPopupPoints(td.popupPoints);
        }
        if (td.futureClause) {
          setFutureClauseText(td.futureClause);
        }
      }
    }, (err) => {
      console.warn("Real-time terms sync note:", err);
    });

    const unsubPayment = onSnapshot(doc(db, 'system_settings', 'payment_gateway'), (docSnap) => {
      if (docSnap.exists()) {
        const pd = docSnap.data();
        if (pd.apiKey) setGatewayApiKey(pd.apiKey);
        if (pd.gatewayUrl) setGatewayUrl(pd.gatewayUrl);
      }
    }, (err) => {
      console.warn("Real-time payment gateway sync note:", err);
    });

    return () => {
      unsubContact();
      unsubTerms();
      unsubPayment();
    };
  }, []);

  // Fetch Public Catalog from Firestore (ff_store) - Converted to Auto Capital & Bold
  useEffect(() => {
    const q = query(collection(db, 'ff_store'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const rawUid = (d.accountUid || '').toString().trim();
        // Strictly protect against any recovery email leakage
        const safeUid = rawUid.includes('@') ? '' : rawUid.toUpperCase();
        
        // Strip any accidental email addresses from public title or description
        const stripEmails = (text) => (text || '').toString().replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[VERIFIED]');

        // Robust price parsing (handles numeric, strings like "₹500", "500/-", "1,500")
        let parsedPrice = 0;
        if (typeof d.price === 'number') {
          parsedPrice = d.price;
        } else if (d.price) {
          parsedPrice = Number(String(d.price).replace(/[^0-9.]/g, '')) || 0;
        }

        // Format media list with accurate video/image type detection
        const rawMediaList = Array.isArray(d.mediaList) && d.mediaList.length > 0
          ? d.mediaList
          : (d.mediaUrl ? [{ url: d.mediaUrl, type: d.mediaType || 'image', name: 'Media' }] : []);

        const normalizedMediaList = rawMediaList.map(m => {
          const url = (m.url || '').toString();
          const isVid = m.type === 'video' || url.includes('/video/') || /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url);
          return {
            ...m,
            url,
            type: isVid ? 'video' : 'image'
          };
        });

        const primaryMedia = normalizedMediaList[0] || { url: d.mediaUrl || '', type: d.mediaType || 'image' };

        // Safe mapping - STRICTLY NO sensitive data, everything capitalized & bolded
        list.push({
          id: docSnap.id,
          title: stripEmails(d.title || 'FREE FIRE VERIFIED ACCOUNT').toUpperCase(),
          description: stripEmails(d.description || '').toUpperCase(),
          price: parsedPrice,
          accountUid: safeUid,
          mediaUrl: primaryMedia.url,
          mediaType: primaryMedia.type,
          mediaList: normalizedMediaList,
          createdAt: d.createdAt || new Date().toISOString()
        });
      });

      // Sort newest first by default
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setItems(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading marketplace listings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Clean contact identifiers
  const cleanTelegram = useMemo(() => {
    return (telegramHandle || 'alexccseller').trim().replace(/^@/, '');
  }, [telegramHandle]);

  const cleanWhatsapp = useMemo(() => {
    return (whatsappNumber || '').trim().replace(/[^0-9]/g, '');
  }, [whatsappNumber]);

  // Brand Name Sanitizer (guarantees FREE FIRE OFFICIAL DEALS even if Firestore has legacy string)
  const displayBrandName = useMemo(() => {
    let name = (brandName || '').trim();
    if (!name || /garena/i.test(name) || /dealsbyshiv/i.test(name)) {
      return 'FREE FIRE OFFICIAL DEALS';
    }
    return name.replace(/garena\s*official/ig, 'Free Fire Official').replace(/garena/ig, 'Free Fire Official');
  }, [brandName]);

  // Generate Telegram Contact Link
  const getTelegramUrl = (item) => {
    const text = item 
      ? encodeURIComponent(`HELLO @${cleanTelegram.toUpperCase()}, I WANT TO BUY THIS FREE FIRE ACCOUNT FROM ${displayBrandName.toUpperCase()}:\n\n🎮 *${item.title.toUpperCase()}*\n💰 PRICE: ₹${item.price}\n🆔 REF ID: ${item.id.toUpperCase()}\n\nPLEASE SHARE PAYMENT & DELIVERY DETAILS.`)
      : encodeURIComponent(`HELLO @${cleanTelegram.toUpperCase()}, I WANT TO BUY A FREE FIRE ACCOUNT FROM ${displayBrandName.toUpperCase()}.`);
    return `https://t.me/${cleanTelegram}?text=${text}`;
  };

  // Generate WhatsApp Contact Link
  const getWhatsAppUrl = (item) => {
    if (!cleanWhatsapp) return '';
    const text = item
      ? encodeURIComponent(`HELLO! I WANT TO BUY THIS FREE FIRE ACCOUNT FROM ${displayBrandName.toUpperCase()}:\n\n🎮 *${item.title.toUpperCase()}*\n💰 PRICE: ₹${item.price}\n🆔 REF ID: ${item.id.toUpperCase()}\n\nPLEASE SHARE PAYMENT AND DELIVERY DETAILS.`)
      : encodeURIComponent(`HELLO! I AM INTERESTED IN BUYING A FREE FIRE ACCOUNT FROM ${displayBrandName.toUpperCase()}.`);
    return `https://wa.me/${cleanWhatsapp}?text=${text}`;
  };

  // View Details & Full Proofs Modal Helper
  const handleOpenDetails = (item) => {
    if (!item) return;
    setSelectedItem(item);
    setModalMediaIndex(0);
  };

  // UPI Gateway Helpers
  const handleOpenBuyModal = (item) => {
    setBuyModalItem(item);
    setPaymentStep('form');
    setOrderError('');
    setCurrentOrder(null);
    setIsPollingPayment(false);
    setCopiedCode(false);
  };

  const handleCloseBuyModal = () => {
    setBuyModalItem(null);
    setPaymentStep('form');
    setOrderError('');
    setCurrentOrder(null);
    setIsPollingPayment(false);
    setCopiedCode(false);
  };

  const handleCopyOrderCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateOrder = async (e) => {
    if (e) e.preventDefault();
    const cleanPhone = (customerPhone || '').trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setOrderError('Please enter a valid 10-digit phone / WhatsApp number');
      return;
    }

    setIsCreatingOrder(true);
    setOrderError('');

    try {
      const payload = {
        amount: Number(buyModalItem.price),
        customerName: (customerName || '').trim() || 'FF Store Customer',
        customerPhone: cleanPhone,
        webhookUrl: window.location.origin + '/api/webhook'
      };

      const res = await fetch(`${gatewayUrl}/api/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': gatewayApiKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.message || data.error || 'Failed to initialize payment gateway order');
      }

      setCurrentOrder(data.order);
      setPaymentStep('gateway');
      setIsPollingPayment(true);
    } catch (err) {
      console.error("UPI Order creation error:", err);
      setOrderError(err.message || 'Payment gateway server is offline. Please make sure the server is running on port 3000.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Real-time polling for payment status
  useEffect(() => {
    if (!isPollingPayment || !currentOrder?.orderCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${gatewayUrl}/api/orders/${currentOrder.orderCode}`, {
          headers: {
            'x-api-key': gatewayApiKey
          }
        });
        const data = await res.json();
        if (data.success && data.order) {
          const st = (data.order.status || '').toUpperCase();
          if (st === 'PAID' || st === 'SUCCESS' || st === 'COMPLETED') {
            setCurrentOrder(prev => ({
              ...prev,
              ...data.order,
              status: 'PAID'
            }));
            setPaymentStep('success');
            setIsPollingPayment(false);
          } else if (st === 'EXPIRED') {
            setCurrentOrder(prev => ({ ...prev, status: 'EXPIRED' }));
            setIsPollingPayment(false);
          }
        }
      } catch (err) {
        console.warn("Order status poll warning:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPollingPayment, currentOrder?.orderCode]);

  const getPaidTelegramUrl = (item, order) => {
    const text = encodeURIComponent(
      `HELLO @${cleanTelegram.toUpperCase()}, I HAVE COMPLETED UPI PAYMENT OF ₹${order?.amount || item?.price} FOR:\n\n🎮 *${item?.title?.toUpperCase()}*\n📦 ORDER CODE: ${order?.orderCode}\n🏦 UTR: ${order?.utr || 'VERIFIED'}\n📞 PHONE: ${order?.customerPhone || customerPhone}\n\nPLEASE VERIFY & PROVIDE GAME LOGIN CREDENTIALS.`
    );
    return `https://t.me/${cleanTelegram}?text=${text}`;
  };

  const getPaidWhatsAppUrl = (item, order) => {
    if (!cleanWhatsapp) return '';
    const text = encodeURIComponent(
      `HELLO! I HAVE COMPLETED UPI PAYMENT OF ₹${order?.amount || item?.price} FOR:\n\n🎮 *${item?.title?.toUpperCase()}*\n📦 ORDER CODE: ${order?.orderCode}\n🏦 UTR: ${order?.utr || 'VERIFIED'}\n📞 PHONE: ${order?.customerPhone || customerPhone}\n\nPLEASE VERIFY AND PROVIDE GAME LOGIN CREDENTIALS.`
    );
    return `https://wa.me/${cleanWhatsapp}?text=${text}`;
  };

  // Dynamic filter counts
  const filterCounts = useMemo(() => {
    let u500 = 0, f500to2000 = 0, a2000 = 0, vids = 0;
    items.forEach(item => {
      if (item.price < 500) u500++;
      if (item.price >= 500 && item.price <= 2000) f500to2000++;
      if (item.price > 2000) a2000++;
      const hasVid = item.mediaList.some(m => m.type === 'video');
      if (hasVid || item.mediaType === 'video') vids++;
    });
    return {
      all: items.length,
      under500: u500,
      from500to2000: f500to2000,
      above2000: a2000,
      videos: vids
    };
  }, [items]);

  // Filter & Sort listings
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search query matching across title, description, UID, price
      const q = (searchQuery || '').toLowerCase().trim();
      if (q) {
        const matchesSearch = 
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.accountUid && item.accountUid.toLowerCase().includes(q)) ||
          (String(item.price).includes(q));

        if (!matchesSearch) return false;
      }

      // Price / Type Filters
      if (selectedFilter === 'under500') return item.price < 500;
      if (selectedFilter === '500to2000') return item.price >= 500 && item.price <= 2000;
      if (selectedFilter === 'above2000') return item.price > 2000;
      if (selectedFilter === 'videos') {
        const hasVid = item.mediaList.some(m => m.type === 'video');
        return hasVid || item.mediaType === 'video';
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [items, searchQuery, selectedFilter, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-955 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200 selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      
      {/* Top Navigation Bar - Ultra-responsive for all mobile screens */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo & Store Title - Never cropped on mobile */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-all p-0.5 border border-emerald-500/30">
              <img src="/garena-logo.png" alt="Free Fire Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-black text-xs sm:text-base md:text-lg tracking-tight uppercase bg-gradient-to-r from-gray-900 via-emerald-800 to-emerald-600 dark:from-white dark:via-gray-100 dark:to-emerald-300 bg-clip-text text-transparent truncate block leading-tight">
                  {displayBrandName}
                </span>
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hidden md:inline-flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  VERIFIED
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate hidden sm:block">
                OFFICIAL FREE FIRE ID &amp; ESCROW MARKETPLACE
              </p>
            </div>
          </Link>

          {/* Right Header Actions - Compact on mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Telegram Direct Support Pill */}
            <a
              href={`https://t.me/${cleanTelegram}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-955/40 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
              title={`Telegram Support @${cleanTelegram}`}
            >
              <Send className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="hidden sm:inline">@{cleanTelegram.toUpperCase()}</span>
              <span className="sm:hidden text-[10.5px] font-black">TG</span>
            </a>

            {/* WhatsApp Support Pill (If configured by Super Admin) */}
            {cleanWhatsapp && (
              <a
                href={getWhatsAppUrl(null)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-955/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                title="WhatsApp Support"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="hidden sm:inline">WHATSAPP</span>
                <span className="sm:hidden text-[10.5px] font-black">WA</span>
              </a>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer shrink-0"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Logged in User / Staff Controls OR Login Link */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {userDoc?.role === 'user' && (
                  <button
                    onClick={() => setShowBecomeClient(true)}
                    className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 sm:gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer shrink-0"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Become a Client</span>
                    <span className="sm:hidden">Upgrade</span>
                  </button>
                )}

                {userDoc?.role === 'client' && (
                  <Link
                    to="/client-dashboard"
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all shrink-0"
                  >
                    Client Panel
                  </Link>
                )}

                {(userDoc?.role === 'admin' || userDoc?.role === 'superadmin' || userDoc?.role === 'employee' || userDoc?.role === 'staff') && (
                  <Link
                    to="/admin-dashboard"
                    className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider transition-all shrink-0"
                  >
                    Admin Panel
                  </Link>
                )}

                {/* Profile Pill & Working Logout */}
                <div className="flex items-center gap-1.5 pl-1.5 border-l border-gray-200 dark:border-gray-800">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase shrink-0">
                    {userDoc?.name ? userDoc.name.charAt(0) : 'U'}
                  </div>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 hidden lg:inline truncate max-w-[100px]">
                    {userDoc?.name || 'Gamer'}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-all cursor-pointer shrink-0"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/25 shrink-0"
                title="Staff & Client Sign In"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent dark:from-indigo-955/20 border-b border-gray-200/60 dark:border-gray-800/60 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider animate-fade-in">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-bounce" />
            <span>100% VERIFIED LEGIT GAMEPLAY & IDS</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 dark:text-white max-w-3xl mx-auto leading-tight uppercase">
            BUY PREMIUM <span className="bg-gradient-to-r from-indigo-600 via-amber-500 to-rose-500 bg-clip-text text-transparent">FREE FIRE ACCOUNTS</span> WITH PROOF
          </h1>

          <p className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed uppercase tracking-wide">
            BROWSE VERIFIED PHOTOS, WEAPON COLLECTIONS, AND GAMEPLAY VIDEO PROOFS. 
            ALL DEALS ARE EXECUTED DIRECTLY VIA OUR OFFICIAL TELEGRAM DESK <strong className="text-indigo-600 dark:text-indigo-400">@{cleanTelegram.toUpperCase()}</strong>
            {cleanWhatsapp && <> OR WHATSAPP <strong className="text-emerald-600 dark:text-emerald-400">+{cleanWhatsapp}</strong></>}.
          </p>

          {/* Quick Trust Highlights */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>FULL VIDEO PROOFS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-indigo-500" />
              <span>DIRECT ESCROW SUPPORT</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-500" />
              <span>INSTANT CONTACT & DELIVERY</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Search, Filter & Sort Controls */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="SEARCH ACCOUNT TITLES, DESCRIPTIONS, OR FREE FIRE UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-black uppercase text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 tracking-wider"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <span className="text-xs font-black text-gray-400 uppercase hidden sm:inline">SORT:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full md:w-auto px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-black uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer tracking-wider"
              >
                <option value="newest">🔥 NEWEST LISTINGS</option>
                <option value="price_asc">💰 PRICE: LOW TO HIGH</option>
                <option value="price_desc">💎 PRICE: HIGH TO LOW</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-black uppercase no-scrollbar tracking-wider">
            <span className="text-[11px] font-black text-gray-400 uppercase mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> FILTER:
            </span>
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-750'
              }`}
            >
              <span>ALL</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${selectedFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {filterCounts.all}
              </span>
            </button>
            <button
              onClick={() => setSelectedFilter('under500')}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === 'under500'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-750'
              }`}
            >
              <span>UNDER ₹500</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${selectedFilter === 'under500' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {filterCounts.under500}
              </span>
            </button>
            <button
              onClick={() => setSelectedFilter('500to2000')}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === '500to2000'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-750'
              }`}
            >
              <span>₹500 - ₹2,000</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${selectedFilter === '500to2000' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {filterCounts.from500to2000}
              </span>
            </button>
            <button
              onClick={() => setSelectedFilter('above2000')}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === 'above2000'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-750'
              }`}
            >
              <span>₹2,000+ (HIGH END)</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${selectedFilter === 'above2000' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {filterCounts.above2000}
              </span>
            </button>
            <button
              onClick={() => setSelectedFilter('videos')}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === 'videos'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-750'
              }`}
            >
              <span>🎬 GAMEPLAY VIDEOS ONLY</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${selectedFilter === 'videos' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {filterCounts.videos}
              </span>
            </button>
          </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-black uppercase text-gray-400 tracking-wider">LOADING VERIFIED FREE FIRE ACCOUNTS...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-12 text-center space-y-3">
            <Store className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto" />
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">NO ACCOUNTS FOUND</h3>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {searchQuery ? `NO LISTINGS MATCH "${searchQuery.toUpperCase()}". TRY A DIFFERENT SEARCH TERM.` : 'NO ACCOUNTS CURRENTLY LISTED IN THIS CATEGORY.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-955/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                CLEAR SEARCH
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const mediaArray = item.mediaList.length > 0 
                ? item.mediaList 
                : [{ url: item.mediaUrl, type: item.mediaType || 'image', name: 'Media' }];
              
              const activeIdx = cardMediaIndices[item.id] || 0;
              const activeMedia = mediaArray[activeIdx] || mediaArray[0];
              const isVideo = activeMedia.type === 'video';

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xs hover:shadow-xl hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-300 flex flex-col group relative"
                >
                  {/* Media Carousel Box */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    {isVideo ? (
                      <video
                        key={activeMedia.url}
                        src={activeMedia.url}
                        controls
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    ) : (
                      <img
                        key={activeMedia.url}
                        src={activeMedia.url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300 cursor-pointer"
                        onClick={() => handleOpenDetails(item)}
                      />
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
                      <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-black/70 backdrop-blur-md text-white border border-white/10 tracking-wider">
                        {activeMedia.type === 'video' ? '🎬 VIDEO' : '📸 PHOTO'}
                      </span>
                      {mediaArray.length > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-indigo-600/90 backdrop-blur-md text-white border border-indigo-400/30">
                          {activeIdx + 1}/{mediaArray.length}
                        </span>
                      )}
                    </div>

                    {/* Price Pill */}
                    <div className="absolute bottom-2.5 right-2.5 px-3 py-1 bg-emerald-600/95 backdrop-blur-md text-white text-xs font-black rounded-full shadow-lg z-20 flex items-center gap-0.5">
                      <span>₹</span>
                      <span>{item.price}</span>
                    </div>

                    {/* Carousel Left/Right Buttons */}
                    {mediaArray.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardMediaIndices(prev => ({
                              ...prev,
                              [item.id]: (activeIdx - 1 + mediaArray.length) % mediaArray.length
                            }));
                          }}
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center shadow transition-all z-20 cursor-pointer"
                          aria-label="Previous Media"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardMediaIndices(prev => ({
                              ...prev,
                              [item.id]: (activeIdx + 1) % mediaArray.length
                            }));
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center shadow transition-all z-20 cursor-pointer"
                          aria-label="Next Media"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Listing Content (100% Bold & Capital) */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4 font-sans">
                    <div className="space-y-2">
                      {/* Account UID or Tag */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-955/40 px-2 py-0.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60">
                          {item.accountUid && !item.accountUid.includes('@') ? `🎮 UID: ${item.accountUid}` : '🎮 VERIFIED SLOT'}
                        </span>
                        <span className="text-[9.5px] font-black uppercase text-gray-400 tracking-wider">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 
                        onClick={() => handleOpenDetails(item)}
                        className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        {item.title}
                      </h3>

                      {/* Description */}
                      {item.description && (
                        <p className="text-[11px] font-black uppercase tracking-wide text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                      {/* BUY NOW Button -> Opens Channel Selection Modal */}
                      <button
                        type="button"
                        onClick={() => handleOpenBuyModal(item)}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 hover:scale-101 transition-all cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>BUY NOW</span>
                      </button>

                      {/* View Details / Lightbox */}
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(item)}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl transition-all cursor-pointer"
                        title="View Full Proofs & Gallery"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Full HD Media Lightbox & Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto font-sans">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden relative space-y-0 my-auto">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-955/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                  {selectedItem.accountUid && !selectedItem.accountUid.includes('@') ? `UID: ${selectedItem.accountUid}` : 'VERIFIED SLOT'}
                </span>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900 dark:text-white truncate">
                  {selectedItem.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Media Box */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {selectedItem.mediaList[modalMediaIndex]?.type === 'video' ? (
                <video
                  key={selectedItem.mediaList[modalMediaIndex].url}
                  src={selectedItem.mediaList[modalMediaIndex].url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  key={selectedItem.mediaList[modalMediaIndex]?.url || selectedItem.mediaUrl}
                  src={selectedItem.mediaList[modalMediaIndex]?.url || selectedItem.mediaUrl}
                  alt={selectedItem.title}
                  className="w-full h-full object-contain"
                />
              )}

              {/* Counter Pill */}
              {selectedItem.mediaList.length > 1 && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-black/70 backdrop-blur-md text-white border border-white/20 tracking-wider">
                  {modalMediaIndex + 1} / {selectedItem.mediaList.length}
                </div>
              )}

              {/* Navigation Arrows */}
              {selectedItem.mediaList.length > 1 && (
                <>
                  <button
                    onClick={() => setModalMediaIndex(prev => (prev - 1 + selectedItem.mediaList.length) % selectedItem.mediaList.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setModalMediaIndex(prev => (prev + 1) % selectedItem.mediaList.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails row */}
            {selectedItem.mediaList.length > 1 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-850 flex items-center gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
                {selectedItem.mediaList.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => setModalMediaIndex(idx)}
                    className={`relative w-16 h-11 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      modalMediaIndex === idx ? 'border-indigo-600 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    {m.type === 'video' ? (
                      <div className="w-full h-full bg-black flex items-center justify-center text-[9px] text-white font-black uppercase">
                        ▶ VIDEO
                      </div>
                    ) : (
                      <img src={m.url} alt="thumb" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Modal Body Info & Buy Action */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-150 dark:border-gray-800">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">FIXED PRICE</span>
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center">
                    <span>₹{selectedItem.price}</span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    const itm = selectedItem;
                    setSelectedItem(null);
                    handleOpenBuyModal(itm);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 hover:scale-102 transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>BUY NOW</span>
                </button>
              </div>

              {/* Description (Bold & Capital) */}
              {selectedItem.description && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">ACCOUNT DETAILS & FEATURES</span>
                  <p className="text-xs font-black uppercase tracking-wide text-gray-900 dark:text-white leading-relaxed whitespace-pre-line bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* Safe Escrow Notice */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-955/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-2 tracking-wide">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>ALL PAYMENTS & TRANSFERS ARE VERIFIED MANUALLY BY ADMIN VIA OFFICIAL DESK TO ENSURE 100% SAFE HANDOVER.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Choose Buy Channel & UPI Payment Gateway Modal */}
      {buyModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full shadow-2xl p-5 sm:p-6 space-y-5 relative my-auto">
            
            {/* Modal Header with Dynamic Step Navigation */}
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                {paymentStep === 'gateway' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStep('form');
                      setOrderError('');
                    }}
                    className="p-1.5 -ml-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                    title="Go Back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  {paymentStep === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : paymentStep === 'gateway' ? (
                    <QrCode className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <QrCode className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    {paymentStep === 'success' ? 'PAYMENT VERIFIED' : paymentStep === 'gateway' ? 'SCAN & PAY VIA UPI' : 'INSTANT UPI CHECKOUT'}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {paymentStep === 'success' ? 'ORDER RECORDED SUCCESSFULLY' : paymentStep === 'gateway' ? 'PERSONAL UPI GATEWAY ACTIVE' : 'AUTOMATED 24/7 SECURE PAYMENT'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseBuyModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Summary Pill */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-150 dark:border-gray-700/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                  {buyModalItem.accountUid && !buyModalItem.accountUid.includes('@') ? `UID: ${buyModalItem.accountUid}` : 'VERIFIED ID'}
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  ₹{buyModalItem.price}
                </span>
              </div>
              <h4 className="text-xs font-black uppercase text-gray-900 dark:text-white truncate">
                {buyModalItem.title}
              </h4>
            </div>

            {/* STEP 2: BUYER DETAILS FORM FOR UPI ORDER */}
            {paymentStep === 'form' && (
              <form onSubmit={handleCreateOrder} className="space-y-4 animate-fade-in">
                {orderError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{orderError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    WhatsApp / Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="10-digit mobile number"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">
                    Used for order delivery verification & receipt.
                  </p>
                </div>

                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40 rounded-xl text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span>Payable Amount:</span>
                  <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{buyModalItem.price}.00
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingOrder}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCreatingOrder ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>INITIALIZING GATEWAY...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>PROCEED TO PAY ₹{buyModalItem.price}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 3: LIVE GATEWAY CHECKOUT IFRAME & UPI INTENT */}
            {paymentStep === 'gateway' && currentOrder && (
              <div className="space-y-3.5 animate-fade-in">
                
                {/* Order Status & Quick Copy Pill */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-black uppercase text-gray-400 block">Order Reference</span>
                    <span className="text-xs font-black font-mono text-gray-900 dark:text-white">
                      {currentOrder.orderCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyOrderCode(currentOrder.orderCode)}
                      className="px-2.5 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <span className="px-2.5 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      WAITING
                    </span>
                  </div>
                </div>

                {/* Direct Action Toolbar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={`${gatewayUrl}${currentOrder.checkoutUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Full Window</span>
                  </a>

                  {currentOrder.upiUri && (
                    <a
                      href={currentOrder.upiUri}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Pay via Mobile UPI App</span>
                    </a>
                  )}
                </div>

                {/* Embedded Live Gateway Checkout Iframe */}
                <div className="w-full h-[460px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-inner bg-white relative">
                  <iframe
                    src={`${gatewayUrl}${currentOrder.checkoutUrl}`}
                    title="Personal UPI Gateway Checkout Frame"
                    className="w-full h-full border-none"
                    allow="payment"
                  />
                </div>

                {/* Real-time Status Pulse Footer */}
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 pt-1">
                  <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
                  <span>Gateway monitoring active. This screen updates automatically upon payment!</span>
                </div>

              </div>
            )}

            {/* STEP 4: PAYMENT SUCCESS SCREEN */}
            {paymentStep === 'success' && currentOrder && (
              <div className="py-4 text-center space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border-2 border-emerald-500/40 animate-bounce shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    🎉 PAYMENT SUCCESSFUL!
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                    Amount Received: <strong className="text-emerald-600 dark:text-emerald-400">₹{currentOrder.amount}</strong>
                  </p>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-left font-mono text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Order Code:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{currentOrder.orderCode}</span>
                  </div>
                  {currentOrder.utr && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Bank UTR:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentOrder.utr}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">VERIFIED &amp; PAID</span>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase leading-relaxed">
                  Click below to send your Order Code &amp; UTR to Super Admin to receive your game login credentials instantly!
                </p>

                <div className="space-y-2 pt-1">
                  <a
                    href={getPaidTelegramUrl(buyModalItem, currentOrder)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Claim Credentials on Telegram</span>
                  </a>

                  {cleanWhatsapp && (
                    <a
                      href={getPaidWhatsAppUrl(buyModalItem, currentOrder)}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Claim Credentials on WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Trust Footer */}
            {paymentStep !== 'gateway' && paymentStep !== 'success' && (
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/40 rounded-xl text-[10px] font-black uppercase text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>100% MANUAL VERIFICATION &amp; SECURE ESCROW HANDOVER</span>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Ultra-Lit Cyber Escrow & Terms Agreement Modal (Shows on every visit) */}
      {!termsAgreed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-xl animate-fade-in font-sans select-none">
          <div className="relative max-w-lg w-full bg-gradient-to-b from-gray-900 via-gray-950 to-black border-2 border-indigo-500/60 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(99,102,241,0.35)] space-y-5 overflow-hidden text-white">
            
            {/* Ambient Cyber Neon Background Accents */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Modal Header */}
            <div className="relative z-10 flex flex-col items-center text-center space-y-2">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 animate-pulse">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-black"></span>
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shadow-inner">
                  ⚡ 256-BIT ESCROW SECURITY & VERIFICATION
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                  ESCROW & TERMS AGREEMENT
                </h2>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                  OFFICIAL RULES & SAFE HANDOVER PROTOCOL — FREE FIRE OFFICIAL DEALS
                </p>
              </div>
            </div>

            {/* Terms Highlights Box */}
            <div className="relative z-10 p-4 bg-gray-900/80 rounded-2xl border border-indigo-500/20 shadow-inner space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
              {popupPoints.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  {idx === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                  {idx === 1 && <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
                  {idx === 2 && <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                  {idx >= 3 && <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />}
                  <div>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-wider">{pt.title}</h4>
                    <p className="text-[10px] font-bold text-gray-300 uppercase leading-relaxed mt-0.5">
                      {pt.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Mandatory Checkbox */}
            <div className="relative z-10 pt-1">
              <label 
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  termsCheckbox
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/20 text-white'
                    : 'bg-gray-900/90 border-gray-800 hover:border-gray-700 text-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={termsCheckbox}
                  onChange={(e) => setTermsCheckbox(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded-lg border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-800 shrink-0 cursor-pointer accent-indigo-500"
                />
                <span className="text-[11px] font-black uppercase leading-snug tracking-wide">
                  I HAVE READ, UNDERSTOOD, AND AGREE TO ALL ESCROW PROTOCOLS, REFUND POLICIES &amp; TERMS OF SERVICE.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 space-y-2.5 pt-1">
              {/* Primary Agree Button - Enabled ONLY when checkbox is checked */}
              <button
                type="button"
                disabled={!termsCheckbox}
                onClick={() => {
                  if (termsCheckbox) {
                    setTermsAgreed(true);
                    try {
                      window.dispatchEvent(new CustomEvent('escrow_terms_agreed'));
                    } catch (e) {
                      // Silent fail
                    }
                  }
                }}
                className={`w-full py-3.5 px-6 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  termsCheckbox
                    ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-amber-500 hover:from-indigo-600 hover:to-amber-600 text-white shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                    : 'bg-gray-800 text-gray-500 border border-gray-700/60 cursor-not-allowed opacity-60'
                }`}
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>{termsCheckbox ? 'I AGREE & ENTER MARKETPLACE' : 'PLEASE TICK CHECKBOX TO ENTER'}</span>
              </button>

              {/* View Terms Link */}
              <div className="text-center pt-1">
                <Link
                  to="/terms-and-conditions"
                  target="_blank"
                  className="text-[10.5px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider underline underline-offset-4 transition-colors"
                >
                  READ FULL LEGAL TERMS & CONDITIONS ↗
                </Link>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />

      {/* Soft Onboarding Modal for New Google Signups */}
      <SoftOnboardingModal
        isOpen={showSoftOnboard}
        onClose={() => setShowSoftOnboard(false)}
      />

      {/* Become a Client License Redemption Modal */}
      <BecomeClientModal
        isOpen={showBecomeClient}
        onClose={() => setShowBecomeClient(false)}
      />

    </div>
  );
}
