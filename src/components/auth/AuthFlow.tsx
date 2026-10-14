import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Sparkles, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Phone, 
  Instagram, 
  ArrowRight, 
  ArrowLeft,
  KeyRound
} from 'lucide-react';
import { auth, db, storage, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { StudentAvatar } from '../StudentAvatar';
import { 
  BRANCHES, 
  YEARS, 
  DANCE_VIBES, 
  LOOKING_FOR_OPTIONS, 
  OUTFIT_COLORS,
  DANDIYA_PROMPT_SUGGESTIONS,
  DanceVibe,
  LookingFor
} from '../../types';
import { compressImageToBlob, fileToCompressedDataUrl } from '../../utils/imageUtils';
import { uploadPhotoToCloudinary } from '../../utils/cloudinary';

export function isValidCollegeEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@glbitm\.ac\.in$/.test(normalized);
}

interface AuthFlowProps {
  onSuccess: () => void;
}

export const AuthFlow: React.FC<AuthFlowProps> = ({ onSuccess }) => {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('register');
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Form Data
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 Form Data
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [year, setYear] = useState(YEARS[0]);
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [outfitColor, setOutfitColor] = useState(OUTFIT_COLORS[0].name);
  const [prompt, setPrompt] = useState(DANDIYA_PROMPT_SUGGESTIONS[0]);
  const [danceVibe, setDanceVibe] = useState<DanceVibe>('Full Energy');
  const [lookingFor, setLookingFor] = useState<LookingFor>('Dandiya Partner');
  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // State messages
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 10 MB raw allowed, will be compressed)
      if (file.size > 10 * 1024 * 1024) {
        setError('Photo size must be less than 10 MB.');
        return;
      }

      // Validate image file type
      if (file.type && !file.type.startsWith('image/')) {
        setError('Please upload a valid image file (JPG, JPEG, PNG, or WebP).');
        return;
      }

      setPhotoFile(file);
      try {
        const compressedDataUrl = await fileToCompressedDataUrl(file, 1024, 0.80);
        setPhotoPreview(compressedDataUrl || URL.createObjectURL(file));
      } catch {
        setPhotoPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidCollegeEmail(cleanEmail)) {
      setError('Only GLBITM college email addresses (@glbitm.ac.in) are allowed to register.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setStep(2);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidCollegeEmail(cleanEmail)) {
      setError('Only GLBITM college email addresses (@glbitm.ac.in) are allowed to register.');
      return;
    }

    // Require at least one contact method
    if (!whatsapp.trim() && !instagram.trim()) {
      setError('Please provide at least one contact method (WhatsApp or Instagram) so you can share it with accepted partners.');
      return;
    }

    const startTime = performance.now();
    console.log('[Perf] Starting registration submit flow...');

    setSubmitting(true);

    try {
      // 1. Create Auth Account if user is not already logged in
      const tAuth0 = performance.now();
      let user = auth.currentUser;
      if (!user) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          user = userCredential.user;
          console.log(`[Perf] 1. Firebase Auth user creation: ${(performance.now() - tAuth0).toFixed(1)}ms`);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use' && auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail) {
            user = auth.currentUser;
          } else {
            throw authErr;
          }
        }
      } else {
        console.log('[Perf] 1. Reusing existing authenticated user:', user.uid);
      }

      if (!user) {
        throw new Error('User authentication failed. Please try again.');
      }

      // 2. Compress photo client-side & upload to Cloudinary (with fast fallback)
      const tPhoto0 = performance.now();
      let finalPhotoUrl = '';
      if (photoFile) {
        setUploadingPhoto(true);
        try {
          const idToken = await user.getIdToken();
          finalPhotoUrl = await uploadPhotoToCloudinary(photoFile, idToken);
          console.log(`[Perf] 2. Photo compression & Cloudinary upload: ${(performance.now() - tPhoto0).toFixed(1)}ms`);
        } catch (stErr) {
          console.warn('[Cloudinary Upload Warning - Falling back to compressed Data URL]', stErr);
          finalPhotoUrl = await fileToCompressedDataUrl(photoFile, 1024, 0.80);
          console.log(`[Perf] 2. Photo fallback to Data URL: ${(performance.now() - tPhoto0).toFixed(1)}ms`);
        }
        setUploadingPhoto(false);
      } else {
        console.log('[Perf] 2. Photo upload skipped (no photo selected)');
      }

      const now = new Date().toISOString();

      // 3 & 4. Save Public Profile and Private Contact details concurrently using Promise.all
      const tFirestore0 = performance.now();
      const publicWrite = setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: fullName.trim(),
        email: cleanEmail,
        branch,
        year,
        outfitColor,
        photoUrl: finalPhotoUrl,
        prompt: prompt.trim() || 'Excited for GLBITM Dandiya Night!',
        danceVibe,
        lookingFor,
        isPriority: false,
        isAdmin: false,
        isVerified: false, // Must be false on creation per firestore.rules
        isPublic: true,
        isSuspended: false,
        createdAt: now,
        updatedAt: now,
      });

      const privateWrite = setDoc(doc(db, 'usersPrivate', user.uid), {
        email: cleanEmail,
        whatsapp: whatsapp.trim(),
        whatsappNumber: whatsapp.trim(),
        phoneNumber: whatsapp.trim(),
        instagram: instagram.trim().replace('@', ''),
        shareWhatsapp: true,
        shareInstagram: true,
        blockedUids: [],
        skippedUids: [],
        createdAt: now,
        updatedAt: now,
      });

      await Promise.all([publicWrite, privateWrite]);
      console.log(`[Perf] 3 & 4. Concurrent Firestore writes (users + usersPrivate): ${(performance.now() - tFirestore0).toFixed(1)}ms`);

      // 5. Refresh AuthContext Profile
      const tRefresh0 = performance.now();
      await refreshProfile();
      console.log(`[Perf] 5. AuthContext profile refresh: ${(performance.now() - tRefresh0).toFixed(1)}ms`);

      console.log(`[Perf] TOTAL Registration & Profile Creation Time: ${(performance.now() - startTime).toFixed(1)}ms`);

      onSuccess();
    } catch (err: any) {
      console.error('Registration error:', err);
      handleFirestoreError(err, OperationType.WRITE, 'users/usersPrivate');
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(err.message || 'Failed to complete registration and save details to Firestore.');
      }
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await refreshProfile();
      onSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter your registered college email.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-8 relative z-10 w-full">
      
      {/* Decorative Branding Banner */}
      <div className="text-center mb-4 sm:mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>GLBITM Dandiya Night 2026</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-amber-200 tracking-tight">
          Garba Saathi
        </h2>
        <p className="text-amber-100/70 text-xs sm:text-sm mt-1 max-w-xs sm:max-w-sm mx-auto">
          Find your ideal Garba & Dandiya dance partner for GLBITM campus fest!
        </p>
      </div>

      {/* Main Glass Card */}
      <div className="w-full max-w-md bg-[#2D0510]/90 border border-amber-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md">
        
        {/* Toggle Login vs Register */}
        <div className="flex bg-rose-950/60 p-1 rounded-2xl border border-amber-500/20 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setStep(1);
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 py-2 min-h-[40px] text-xs font-bold rounded-xl transition-all active:scale-98 ${
              mode === 'register'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                : 'text-amber-200/60 hover:text-amber-200'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 py-2 min-h-[40px] text-xs font-bold rounded-xl transition-all active:scale-98 ${
              mode === 'login'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                : 'text-amber-200/60 hover:text-amber-200'
            }`}
          >
            Student Login
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-900/50 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Message Alert */}
        {message && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-900/50 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* --- REGISTER FLOW --- */}
        {mode === 'register' && (
          <div>
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-4 sm:mb-5 px-1">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
                Step {step} of 2
              </span>
              <div className="flex gap-1.5">
                <div className={`w-8 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-amber-400' : 'bg-rose-950'}`} />
                <div className={`w-8 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-amber-400' : 'bg-rose-950'}`} />
              </div>
            </div>

            {/* Step 1: Account Credentials */}
            {step === 1 && (
              <form onSubmit={handleStep1Next} className="space-y-3.5 sm:space-y-4">
                <div>
                  <label className="block text-xs font-bold text-amber-200/90 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3 top-3 text-amber-400/60" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Aarav Sharma"
                      required
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 placeholder-amber-200/30 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-200/90 mb-1">
                    College Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-amber-400/60" />
                    <input
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@glbitm.ac.in"
                      required
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 placeholder-amber-200/30 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <p className="text-[10px] text-amber-200/50 mt-1">
                    Only @glbitm.ac.in emails allowed.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-200/90 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-amber-400/60" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      required
                      className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 placeholder-amber-200/30 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 min-h-[44px] mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 flex items-center justify-center gap-2 transition-all"
                >
                  <span>Next: Dandiya Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Step 2: Student Dandiya Profile */}
            {step === 2 && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 sm:space-y-4 max-h-[62vh] sm:max-h-[70vh] overflow-y-auto pr-1">
                
                {/* Profile Photo */}
                <div className="text-center">
                  <label className="block text-xs font-bold text-amber-200/90 mb-2">
                    Profile Photo (Optional)
                  </label>
                  <div className="flex flex-col items-center gap-2.5">
                    <StudentAvatar
                      name={fullName}
                      photoUrl={photoPreview}
                      className="w-20 h-20"
                      textSize="text-xl"
                    />
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 min-h-[36px] rounded-xl bg-rose-900/60 border border-amber-500/40 text-amber-300 text-xs font-medium cursor-pointer hover:bg-rose-900 flex items-center gap-1.5 active:scale-95">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                      {photoPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoPreview(null);
                          }}
                          className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-rose-950 border border-rose-500/30 text-rose-300 text-xs font-medium hover:bg-rose-900 active:scale-95"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Branch & Year */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-amber-200/90 mb-1">
                      Branch
                    </label>
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full py-2.5 px-2 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                    >
                      {BRANCHES.map((b) => (
                        <option key={b} value={b} className="bg-[#2D0510] text-amber-100">
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-200/90 mb-1">
                      Year
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full py-2.5 px-2 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y} className="bg-[#2D0510] text-amber-100">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* WhatsApp & Instagram */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Contact Details (Private until Request Accepted)
                  </span>
                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">
                      WhatsApp Number
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-3.5 text-amber-400/60" />
                      <input
                        type="tel"
                        inputMode="tel"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">
                      Instagram Handle
                    </label>
                    <div className="relative">
                      <Instagram className="w-3.5 h-3.5 absolute left-3 top-3.5 text-amber-400/60" />
                      <input
                        type="text"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="e.g. @garba_star"
                        className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Outfit Color & Dance Vibe */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-amber-200/90 mb-1">
                      Outfit Color
                    </label>
                    <select
                      value={outfitColor}
                      onChange={(e) => setOutfitColor(e.target.value)}
                      className="w-full py-2.5 px-2 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
                    >
                      {OUTFIT_COLORS.map((c) => (
                        <option key={c.name} value={c.name} className="bg-[#2D0510] text-amber-100">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-200/90 mb-1">
                      Dance Vibe
                    </label>
                    <select
                      value={danceVibe}
                      onChange={(e) => setDanceVibe(e.target.value as DanceVibe)}
                      className="w-full py-2.5 px-2 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
                    >
                      {DANCE_VIBES.map((v) => (
                        <option key={v} value={v} className="bg-[#2D0510] text-amber-100">
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Looking For */}
                <div>
                  <label className="block text-xs font-bold text-amber-200/90 mb-1">
                    Looking For
                  </label>
                  <select
                    value={lookingFor}
                    onChange={(e) => setLookingFor(e.target.value as LookingFor)}
                    className="w-full py-2.5 px-2 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
                  >
                    {LOOKING_FOR_OPTIONS.map((o) => (
                      <option key={o} value={o} className="bg-[#2D0510] text-amber-100">
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                {/* My Dandiya Prompt */}
                <div>
                  <label className="block text-xs font-bold text-amber-200/90 mb-1">
                    My Dandiya Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                    placeholder="Tell partners what you love about Garba..."
                    className="w-full p-2.5 bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {DANDIYA_PROMPT_SUGGESTIONS.slice(0, 2).map((sugg, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPrompt(sugg)}
                        className="text-[10px] text-amber-300/70 hover:text-amber-200 underline truncate max-w-xs text-left"
                      >
                        "{sugg.slice(0, 28)}..."
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-2.5 px-4 min-h-[44px] rounded-xl border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-rose-900/40 active:scale-95"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 flex items-center justify-center gap-2 transition-all"
                  >
                    {submitting ? 'Creating Profile...' : 'Complete Registration'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* --- LOGIN FLOW --- */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">
                College Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-amber-400/60" />
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@glbitm.ac.in"
                  required
                  className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-amber-200/90">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-[10px] text-amber-300 hover:underline min-h-[28px] flex items-center"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-amber-400/60" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 min-h-[44px] mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? 'Signing In...' : 'Sign In to Garba Saathi'}
            </button>
          </form>
        )}

        {/* --- FORGOT PASSWORD FLOW --- */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-amber-200/80 mb-3">
              Enter your college email address and we'll send you a password reset link.
            </p>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">
                College Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-amber-400/60" />
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@glbitm.ac.in"
                  required
                  className="w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 min-h-[44px] rounded-xl bg-amber-500 text-black font-bold text-xs shadow-lg hover:bg-amber-400 active:scale-98 transition-all"
            >
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-center text-xs text-amber-300 hover:underline pt-1 min-h-[36px] flex items-center justify-center"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
