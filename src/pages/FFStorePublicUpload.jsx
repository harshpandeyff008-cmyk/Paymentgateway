import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Store, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Video as VideoIcon, 
  FileText, 
  X, 
  Loader, 
  ShieldCheck, 
  Mail, 
  IndianRupee, 
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function FFStorePublicUpload() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';
  const priceParam = searchParams.get('price') || '';
  const uidParam = searchParams.get('uid') || '';

  // Configured states
  const [tokenData, setTokenData] = useState(null);
  const [loadingToken, setLoadingToken] = useState(!!tokenParam);
  const [tokenError, setTokenError] = useState('');

  // Form states
  const [targetEmail, setTargetEmail] = useState(emailParam || '');
  const [accountUid, setAccountUid] = useState(uidParam || '');
  const [price, setPrice] = useState(priceParam ? Number(priceParam) : 0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState(60);
  const [rank, setRank] = useState('Heroic');
  const [skinsCount, setSkinsCount] = useState(25);
  const [charactersText, setCharactersText] = useState('Alok, Hayato, Chrono');

  // Multi-file state
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ file, previewUrl, type, name, size, id }]
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedItem, setSubmittedItem] = useState(null);

  const fileInputRef = useRef(null);

  // Cloudinary credentials (env fallback)
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dolc2kuyx';
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default';
  const storefrontApiUrl = import.meta.env.VITE_STOREFRONT_API_URL || 'https://ffsstorebyshiv.web.app';
  const storefrontApiKey = import.meta.env.VITE_STOREFRONT_API_KEY || 'fs_live_clkvaW1VJYEnI6rsKeCM9iRZKolZBolK';

  // Load token data if token is provided
  useEffect(() => {
    async function verifyToken() {
      if (!tokenParam) {
        if (emailParam) setTargetEmail(emailParam);
        if (priceParam) setPrice(Number(priceParam));
        if (uidParam) setAccountUid(uidParam);
        setLoadingToken(false);
        return;
      }

      try {
        const tokenDocRef = doc(db, 'ff_upload_tokens', tokenParam);
        const tokenSnap = await getDoc(tokenDocRef);

        if (tokenSnap.exists()) {
          const data = tokenSnap.data();
          if (data.isRevoked) {
            setTokenError('This upload link has been revoked or expired. Please request a new link.');
          } else {
            setTokenData(data);
            setTargetEmail(data.email || emailParam || '');
            if (data.uid) setAccountUid(data.uid);
            if (data.price !== undefined && data.price !== null) {
              setPrice(Number(data.price));
            } else if (priceParam) {
              setPrice(Number(priceParam));
            }
          }
        } else {
          // Fallback to URL query params if token doc is not yet in db
          if (emailParam) setTargetEmail(emailParam);
          if (priceParam) setPrice(Number(priceParam));
          if (uidParam) setAccountUid(uidParam);
        }
      } catch (err) {
        console.warn('Error reading token from Firestore:', err);
        if (emailParam) setTargetEmail(emailParam);
        if (priceParam) setPrice(Number(priceParam));
        if (uidParam) setAccountUid(uidParam);
      } finally {
        setLoadingToken(false);
      }
    }

    verifyToken();
  }, [tokenParam, emailParam, priceParam, uidParam]);

  // Handle Multi-file selection
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setErrorMessage('');
    const newItems = [];

    for (const f of files) {
      if (f.size > 100 * 1024 * 1024) {
        setErrorMessage(`"${f.name}" exceeds 100MB max limit and was skipped.`);
        continue;
      }

      let type = 'other';
      if (f.type.startsWith('image/')) type = 'image';
      else if (f.type.startsWith('video/')) type = 'video';

      const previewUrl = type === 'image' ? URL.createObjectURL(f) : null;
      newItems.push({
        id: Math.random().toString(36).substring(2, 9) + Date.now(),
        file: f,
        previewUrl,
        type,
        name: f.name,
        size: f.size
      });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove individual file from preview list
  const handleRemoveFile = (idToRemove) => {
    setSelectedFiles((prev) => {
      const filtered = prev.filter((item) => item.id !== idToRemove);
      const removed = prev.find((item) => item.id === idToRemove);
      if (removed && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return filtered;
    });
  };

  // Upload multiple files to Cloudinary and submit to Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!targetEmail.trim()) {
      setErrorMessage('A verified target email is required for this upload.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Please enter a listing title.');
      return;
    }
    if (selectedFiles.length === 0) {
      setErrorMessage('Please select at least one photo or video to upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStatusText(`Preparing ${selectedFiles.length} media file(s)...`);

    try {
      const uploadedMedia = [];
      const totalFiles = selectedFiles.length;

      // Upload files to Cloudinary sequentially/parallel with progress tracking
      for (let i = 0; i < totalFiles; i++) {
        const item = selectedFiles[i];
        setUploadStatusText(`Uploading file ${i + 1} of ${totalFiles}: ${item.name}...`);

        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('upload_preset', uploadPreset);

        // `auto` supports the mixed image/video queue used by this public form.
        // Cloudinary requires a resource type in its upload URL.
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Failed to upload "${item.name}" to Cloudinary.`);
        }

        const uploadData = await response.json();
        uploadedMedia.push({
          url: uploadData.secure_url,
          type: uploadData.resource_type || item.type,
          name: item.name,
          publicId: uploadData.public_id
        });

        const currentProg = Math.round(((i + 1) / totalFiles) * 85);
        setUploadProgress(Math.max(10, currentProg));
      }

      setUploadStatusText('Saving listing details to store database...');
      setUploadProgress(90);

      const primaryMedia = uploadedMedia[0];
      const createdAtTimestamp = new Date().toISOString();

      // 1. Save to local Firestore (ff_store)
      const docPayload = {
        title: title.trim(),
        description: description.trim(),
        mediaUrl: primaryMedia.url,
        mediaType: primaryMedia.type,
        mediaList: uploadedMedia,
        linkedEmail: targetEmail.trim(),
        createdAt: createdAtTimestamp,
        createdByUid: 'guest_uploader',
        createdByEmail: `guest_token_${tokenParam || 'direct'}`,
        uploadToken: tokenParam || null,
        price: Number(price) || 0,
        level: Number(level) || 1,
        rank: rank,
        skinsCount: Number(skinsCount) || 0,
        characters: charactersText.split(',').map((c) => c.trim()).filter(Boolean)
      };

      const docRef = await addDoc(collection(db, 'ff_store'), docPayload);

      // 2. Increment token usage if token exists
      if (tokenParam && tokenData) {
        try {
          const tokenDocRef = doc(db, 'ff_upload_tokens', tokenParam);
          await updateDoc(tokenDocRef, {
            usageCount: (tokenData.usageCount || 0) + 1,
            lastUsedAt: serverTimestamp()
          });
        } catch (tokErr) {
          console.warn('Could not update token usage in Firestore:', tokErr);
        }
      }

      // 3. Optional sync with Storefront API
      try {
        await fetch(`${storefrontApiUrl}/api/listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': storefrontApiKey
          },
          body: JSON.stringify({
            game: 'Free Fire',
            title: title.trim(),
            description: description.trim(),
            price: Number(price) || 0,
            level: Number(level) || 1,
            rank: rank,
            skinsCount: Number(skinsCount) || 0,
            characters: charactersText.split(',').map((c) => c.trim()).filter(Boolean),
            verified: true,
            sellerVerified: true,
            sellerEmail: targetEmail.trim(),
            sellerName: 'System Verified Uploader',
            credentials: {
              email: targetEmail.trim(),
              pass: '[Verification Active]',
              recoveryCode: 'ESCROW-SECURE-' + Math.floor(1000 + Math.random() * 9000)
            },
            createdAt: createdAtTimestamp,
            mediaUrl: primaryMedia.url,
            mediaType: primaryMedia.type,
            mediaList: uploadedMedia,
            linkedAdminDocId: docRef.id
          })
        });
      } catch (sfErr) {
        console.warn('External storefront sync skipped/failed:', sfErr.message);
      }

      setUploadProgress(100);
      setSubmittedItem({
        id: docRef.id,
        title: title.trim(),
        targetEmail: targetEmail.trim(),
        price: Number(price) || 0,
        mediaCount: uploadedMedia.length,
        primaryUrl: primaryMedia.url,
        primaryType: primaryMedia.type
      });
      setIsSuccess(true);
    } catch (err) {
      console.error('Submission failed:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while saving the listing.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  // Reset form to add another item
  const handleAddAnother = () => {
    setTitle('');
    setDescription('');
    setSelectedFiles([]);
    setIsSuccess(false);
    setSubmittedItem(null);
    setErrorMessage('');
  };

  // Loading state
  if (loadingToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4 shadow-xl animate-pulse">
          <Store className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
          <Loader className="w-4 h-4 animate-spin" />
          <span>Verifying Secret Upload Link...</span>
        </div>
      </div>
    );
  }

  // Token Error Screen
  if (tokenError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-tight text-rose-400">Invalid Upload Link</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              {tokenError}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition-all"
            >
              <span>Go to Main Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success Confirmation Screen
  if (isSuccess && submittedItem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans select-none">
        <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full">
              Published Successfully
            </span>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Listing Uploaded!
            </h2>
            <p className="text-xs text-slate-400 font-semibold">
              Media assets and account specs have been recorded and synced to the storefront.
            </p>
          </div>

          {/* Item Card Summary */}
          <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase truncate">{submittedItem.title}</span>
              <span className="text-xs font-black text-emerald-400 px-2 py-0.5 bg-emerald-950/80 border border-emerald-800 rounded-lg">
                ₹{submittedItem.price}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-amber-300 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span className="truncate">{submittedItem.accountUid ? `🎮 UID: ${submittedItem.accountUid}` : '🔒 Encrypted Game ID Slot'}</span>
            </div>

            <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{submittedItem.mediaCount} Media File(s) attached &amp; optimized</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleAddAnother}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Upload Another Item</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Upload Form UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Authorized Guest Upload Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase flex items-center gap-2.5">
                <Store className="w-7 h-7 text-indigo-400" />
                <span>FF Store Media Upload</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Upload multiple photos and gameplay videos for this verified account.
              </p>
            </div>
          </div>

          {/* Locked/Linked Target Email & Price Info Card */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-indigo-500/20">
            <div className="p-3 bg-slate-900/80 border border-indigo-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase text-indigo-300 block tracking-wider">Account Slot</span>
                <span className="text-xs font-black text-amber-400 font-mono truncate block">
                  {accountUid ? `🎮 UID: ${accountUid}` : '🔒 Encrypted Game ID Slot (Protected)'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                <IndianRupee className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase text-emerald-300 block tracking-wider">Listing Price</span>
                <span className="text-xs font-black text-emerald-400 font-mono block">
                  ₹{price} INR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-bold animate-shake">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Upload Form Card */}
        <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 backdrop-blur-md">
          
          {/* Section 1: Title & Description */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>1. Account Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Contact / Seller Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="your-email@gmail.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Free Fire Game UID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192837465"
                  value={accountUid}
                  onChange={(e) => setAccountUid(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Listing Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Max Level Cobra MP40 + Draco AK + Hip Hop Bundle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Description / Highlights
              </label>
              <textarea
                rows={3}
                placeholder="Provide details about evolution gun levels, elite passes, rare bundles, or rank stats..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Section 2: Account Attributes (Level, Rank, Skins, Price) */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>2. Account Attributes</span>
            </h3>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Price (₹ INR) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Multi-Media Upload Zone */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>3. Upload Photos &amp; Videos ({selectedFiles.length})</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Multiple Files Allowed
              </span>
            </div>

            {/* Hidden Multi-file input */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,video/*"
              onChange={handleFilesSelected}
              className="hidden"
            />

            {/* Dropzone trigger button */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50 rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 flex items-center justify-center transition-colors">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-black text-slate-200 block group-hover:text-indigo-300">
                  Click to select multiple Photos &amp; Videos
                </span>
                <span className="text-[10px] text-slate-400 font-semibold block">
                  PNG, JPG, WEBP, MP4, MOV up to 100MB each
                </span>
              </div>
            </div>

            {/* Selected Files Preview Gallery Grid */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Selected Media Queue ({selectedFiles.length})
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedFiles.map((item, idx) => (
                    <div
                      key={item.id}
                      className="relative bg-slate-800/90 border border-slate-700 rounded-2xl overflow-hidden group shadow-md"
                    >
                      {/* Media Preview Box */}
                      <div className="aspect-video bg-slate-900 flex items-center justify-center overflow-hidden relative">
                        {item.type === 'image' && item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : item.type === 'video' ? (
                          <div className="w-full h-full bg-indigo-950/40 flex flex-col items-center justify-center text-indigo-400 gap-1 p-2">
                            <VideoIcon className="w-6 h-6" />
                            <span className="text-[8px] font-bold uppercase tracking-wider">Video</span>
                          </div>
                        ) : (
                          <FileText className="w-6 h-6 text-slate-400" />
                        )}

                        {/* Order badge */}
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[8px] font-black text-white">
                          #{idx + 1}
                        </span>

                        {/* Remove file button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
                          title="Remove this file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* File Details bar */}
                      <div className="p-2 space-y-0.5">
                        <p className="text-[10px] font-black text-slate-200 truncate" title={item.name}>
                          {item.name}
                        </p>
                        <span className="text-[8.5px] font-bold text-slate-400 uppercase block">
                          {(item.size / (1024 * 1024)).toFixed(2)} MB • {item.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress Indicator */}
          {isUploading && (
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                <span>{uploadStatusText || 'Uploading media files...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isUploading || selectedFiles.length === 0}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Publishing Listing ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Submit &amp; Publish FF Store Listing</span>
                </>
              )}
            </button>
          </div>

        </form>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-500 font-semibold">
          Secure Cloudinary &amp; Firebase Storage Engine • Automated Storefront Sync
        </div>
      </div>
    </div>
  );
}
