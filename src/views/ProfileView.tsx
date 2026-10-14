import React, { useState, useRef, useEffect } from 'react';
import { compressImageToBlob, fileToCompressedDataUrl } from '../utils/imageUtils';
import { uploadPhotoToCloudinary } from '../utils/cloudinary';
import { 
  User, 
  Edit3, 
  Lock, 
  Eye, 
  EyeOff, 
  LogOut, 
  Shield, 
  Phone, 
  Instagram, 
  Check, 
  Sparkles, 
  Upload, 
  Trash2,
  Ban,
  KeyRound,
  GraduationCap,
  Shirt,
  Flame,
  Smile,
  AlertCircle,
  Crop,
  CheckCircle2
} from 'lucide-react';
import { updateDoc, doc, arrayRemove, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, storage, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { StudentAvatar } from '../components/StudentAvatar';
import { 
  BRANCHES, 
  YEARS, 
  DANCE_VIBES, 
  LOOKING_FOR_OPTIONS, 
  OUTFIT_COLORS, 
  DanceVibe, 
  LookingFor
} from '../types';

export const ProfileView: React.FC = () => {
  const { currentUser, userPublic, userPrivate, isAdmin, refreshProfile, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit fields
  const [fullName, setFullName] = useState(userPublic?.fullName || '');
  const [branch, setBranch] = useState(userPublic?.branch || BRANCHES[0]);
  const [year, setYear] = useState(userPublic?.year || YEARS[0]);
  const [outfitColor, setOutfitColor] = useState(userPublic?.outfitColor || OUTFIT_COLORS[0].name);
  const [prompt, setPrompt] = useState(userPublic?.prompt || '');
  const [danceVibe, setDanceVibe] = useState<DanceVibe>(userPublic?.danceVibe || 'Full Energy');
  const [lookingFor, setLookingFor] = useState<LookingFor>(userPublic?.lookingFor || 'Dandiya Partner');
  const [isPublic, setIsPublic] = useState(userPublic?.isPublic ?? true);

  // Private fields
  const [whatsapp, setWhatsapp] = useState(userPrivate?.whatsapp || '');
  const [instagram, setInstagram] = useState(userPrivate?.instagram || '');
  const [shareWhatsapp, setShareWhatsapp] = useState(userPrivate?.shareWhatsapp ?? true);
  const [shareInstagram, setShareInstagram] = useState(userPrivate?.shareInstagram ?? true);

  // Photo upload & Crop modal states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(userPublic?.photoUrl || null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [confirmRemoveModal, setConfirmRemoveModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userPublic) {
      setFullName(userPublic.fullName || '');
      setBranch(userPublic.branch || BRANCHES[0]);
      setYear(userPublic.year || YEARS[0]);
      setOutfitColor(userPublic.outfitColor || OUTFIT_COLORS[0].name);
      setPrompt(userPublic.prompt || '');
      setDanceVibe(userPublic.danceVibe || 'Full Energy');
      setLookingFor(userPublic.lookingFor || 'Dandiya Partner');
      setIsPublic(userPublic.isPublic ?? true);
      if (!photoFile) {
        setPhotoPreview(userPublic.photoUrl || null);
      }
    }
    if (userPrivate) {
      setWhatsapp(userPrivate.whatsapp || (userPrivate as any).whatsappNumber || (userPrivate as any).phoneNumber || '');
      setInstagram(userPrivate.instagram || '');
      setShareWhatsapp(userPrivate.shareWhatsapp ?? true);
      setShareInstagram(userPrivate.shareInstagram ?? true);
    }
  }, [userPublic, userPrivate, isEditing]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // 1. Validate file size (5 MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Photo size must be less than 5 MB.');
        return;
      }

      // 2. Validate file format (JPG, JPEG, PNG, WebP)
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        setErrorMsg('Invalid file format. Please upload a JPG, JPEG, PNG, or WebP image.');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setPhotoFile(file);
      setRawImageSrc(objectUrl);
      setShowCropModal(true);
    }
  };

  // Confirm square cropped image selection
  const handleConfirmCrop = () => {
    if (!rawImageSrc || !photoFile) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height);
      canvas.width = 400;
      canvas.height = 400;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        ctx.drawImage(img, startX, startY, size, size, 0, 0, 400, 400);

        canvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], photoFile.name, { type: 'image/jpeg' });
            setPhotoFile(croppedFile);
            setPhotoPreview(URL.createObjectURL(blob));
            setShowCropModal(false);
          }
        }, 'image/jpeg', 0.9);
      }
    };
    img.src = rawImageSrc;
  };

  const handleRemovePhotoClick = () => {
    setConfirmRemoveModal(true);
  };

  const executeRemovePhoto = async () => {
    if (!currentUser) return;
    setDeletingPhoto(true);
    setMessage(null);
    setErrorMsg(null);

    try {
      if (userPublic?.photoUrl && (userPublic.photoUrl.includes('profilePhotos') || userPublic.photoUrl.includes('profile_photos'))) {
        try {
          const storageRef = ref(storage, userPublic.photoUrl);
          await deleteObject(storageRef);
        } catch (stErr) {
          console.warn('[Storage Delete Notice]', stErr);
        }
      }

      const now = new Date().toISOString();
      await updateDoc(doc(db, 'users', currentUser.uid), {
        photoUrl: '',
        updatedAt: now,
      });

      setPhotoFile(null);
      setPhotoPreview(null);
      setConfirmRemoveModal(false);

      await refreshProfile();
      setMessage('Profile photo removed. Initials avatar is now displayed.');
    } catch (err: any) {
      console.error('Error removing photo:', err);
      setErrorMsg(err.message || 'Failed to remove photo.');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setErrorMsg(null);

    try {
      let finalPhotoUrl = userPublic?.photoUrl || '';

      if (photoFile) {
        try {
          const idToken = await currentUser.getIdToken();
          finalPhotoUrl = await uploadPhotoToCloudinary(photoFile, idToken);
        } catch (stErr) {
          console.warn('[Cloudinary Upload Warning - Falling back to compressed Data URL]', stErr);
          finalPhotoUrl = await fileToCompressedDataUrl(photoFile, 1024, 0.80);
        }
      }

      const now = new Date().toISOString();

      const publicFields = {
        fullName: fullName.trim(),
        branch,
        year,
        outfitColor,
        photoUrl: finalPhotoUrl,
        prompt: prompt.trim(),
        danceVibe,
        lookingFor,
        isPublic,
        updatedAt: now,
      };

      const publicWrite = userPublic
        ? updateDoc(doc(db, 'users', currentUser.uid), publicFields)
        : setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email || '',
            isPriority: false,
            isAdmin: false,
            isVerified: false,
            isSuspended: false,
            createdAt: now,
            ...publicFields,
          });

      const privateWrite = setDoc(doc(db, 'usersPrivate', currentUser.uid), {
        email: currentUser.email || '',
        whatsapp: whatsapp.trim(),
        whatsappNumber: whatsapp.trim(),
        phoneNumber: whatsapp.trim(),
        instagram: instagram.trim().replace('@', ''),
        shareWhatsapp,
        shareInstagram,
        updatedAt: now,
      }, { merge: true });

      await Promise.all([publicWrite, privateWrite]);
      await refreshProfile();

      setMessage('Profile and photo updated successfully!');
      setIsEditing(false);
      setPhotoFile(null);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
      setErrorMsg(error.message || 'Failed to save profile changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!currentUser || !userPublic) return;
    try {
      const newVis = !userPublic.isPublic;
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isPublic: newVis,
      });
      await refreshProfile();
      setMessage(`Discovery visibility set to ${newVis ? 'Visible' : 'Hidden'}.`);
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const handleUnblock = async (uidToUnblock: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'usersPrivate', currentUser.uid), {
        blockedUids: arrayRemove(uidToUnblock),
      });
      await refreshProfile();
      setMessage('User unblocked.');
    } catch (error) {
      console.error('Error unblocking:', error);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setMessage('Password reset email sent to ' + currentUser.email);
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  const handleCreateInitialProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!whatsapp.trim() && !instagram.trim()) {
      setErrorMsg('Please provide at least one contact method (WhatsApp or Instagram).');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setErrorMsg(null);

    try {
      let finalPhotoUrl = '';
      if (photoFile) {
        try {
          const idToken = await currentUser.getIdToken();
          finalPhotoUrl = await uploadPhotoToCloudinary(photoFile, idToken);
        } catch (stErr) {
          console.warn('[Cloudinary Upload Warning - Falling back to compressed Data URL]', stErr);
          finalPhotoUrl = await fileToCompressedDataUrl(photoFile, 1024, 0.80);
        }
      }

      const now = new Date().toISOString();

      const publicWrite = setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        fullName: fullName.trim(),
        email: currentUser.email || '',
        branch,
        year,
        outfitColor,
        photoUrl: finalPhotoUrl,
        prompt: prompt.trim() || 'Excited for GLBITM Dandiya Night!',
        danceVibe,
        lookingFor,
        isVerified: false,
        isPublic: true,
        isSuspended: false,
        createdAt: now,
        updatedAt: now,
      });

      const privateWrite = setDoc(doc(db, 'usersPrivate', currentUser.uid), {
        email: currentUser.email || '',
        whatsapp: whatsapp.trim(),
        whatsappNumber: whatsapp.trim(),
        phoneNumber: whatsapp.trim(),
        instagram: instagram.trim().replace('@', ''),
        shareWhatsapp: true,
        shareInstagram: true,
        blockedUids: [],
        skippedUids: [],
        updatedAt: now,
      }, { merge: true });

      await Promise.all([publicWrite, privateWrite]);
      await refreshProfile();

      setMessage('Registration completed successfully! Welcome to Garba Saathi.');
    } catch (err: any) {
      console.error('Error completing profile:', err);
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      setErrorMsg(err.message || 'Failed to save profile registration details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!userPublic) {
    if (isAdmin) {
      return (
        <div className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-28 text-amber-100">
          <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-amber-200">Administrator Portal</h2>
              <p className="text-xs text-amber-100/60 mt-1 font-mono truncate">{currentUser?.email}</p>
            </div>

            <div className="p-3 bg-rose-950/60 border border-amber-500/20 rounded-2xl text-xs text-amber-200/80 leading-relaxed">
              You are signed in with administrator privileges for GLBITM Dandiya Night.
            </div>

            {message && (
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-medium">
                {message}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handlePasswordReset}
                className="w-full py-3 px-3 min-h-[44px] rounded-xl bg-rose-950/60 border border-amber-500/20 text-amber-200 font-bold text-xs hover:bg-rose-900 active:scale-98 flex items-center justify-center gap-2 transition-all"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Send Password Reset Email</span>
              </button>

              <button
                onClick={logout}
                className="w-full py-3 px-3 min-h-[44px] rounded-xl bg-rose-900/60 border border-rose-500/40 text-rose-200 font-bold text-xs hover:bg-rose-900 active:scale-98 flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Interactive Student Profile Completion Form
    return (
      <div className="max-w-md mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 text-amber-100">
        <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Complete Your Student Profile</span>
            </div>
            <h2 className="text-xl font-serif font-bold text-amber-200">Student Registration</h2>
            <p className="text-xs text-amber-100/60 mt-0.5 truncate">{currentUser?.email}</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-900/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {message && (
            <div className="p-3 rounded-xl bg-emerald-900/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleCreateInitialProfile} className="space-y-3.5">
            {/* Photo Upload */}
            <div className="text-center">
              <StudentAvatar
                name={fullName || 'Student'}
                photoUrl={photoPreview}
                className="w-20 h-20 mx-auto mb-2"
                textSize="text-xl"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 min-h-[38px] rounded-xl bg-rose-900/80 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-rose-900 inline-flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Profile Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                required
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-amber-200/90 mb-1">Branch</label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b} className="bg-[#2D0510] text-amber-100">{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200/90 mb-1">Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y} className="bg-[#2D0510] text-amber-100">{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">WhatsApp Number</label>
              <input
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="10-digit phone e.g. 9876543210"
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">Instagram Handle</label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="e.g. @garba_star"
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-amber-200/90 mb-1">Outfit Color</label>
                <select
                  value={outfitColor}
                  onChange={(e) => setOutfitColor(e.target.value)}
                  className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
                >
                  {OUTFIT_COLORS.map((c) => (
                    <option key={c.name} value={c.name} className="bg-[#2D0510] text-amber-100">{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200/90 mb-1">Dance Vibe</label>
                <select
                  value={danceVibe}
                  onChange={(e) => setDanceVibe(e.target.value as DanceVibe)}
                  className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
                >
                  {DANCE_VIBES.map((v) => (
                    <option key={v} value={v} className="bg-[#2D0510] text-amber-100">{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">Looking For</label>
              <select
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value as LookingFor)}
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
              >
                {LOOKING_FOR_OPTIONS.map((o) => (
                  <option key={o} value={o} className="bg-[#2D0510] text-amber-100">{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">My Dandiya Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="Tell partners what you love about Garba..."
                className="w-full p-2.5 bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 min-h-[44px] mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? 'Saving Student Details...' : 'Complete Registration & Join Discovery'}
            </button>
          </form>

          <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
            <button
              onClick={handlePasswordReset}
              className="text-xs text-amber-300 hover:underline flex items-center gap-1 min-h-[36px]"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Reset Password</span>
            </button>

            <button
              onClick={logout}
              className="text-xs text-rose-400 hover:underline flex items-center gap-1 min-h-[36px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-28 sm:pb-24 text-amber-100">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-amber-200 flex items-center gap-2">
            <span>My Profile</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </h2>
          <p className="text-xs text-amber-100/60">Manage your Dandiya persona & photo</p>
        </div>

        <button
          onClick={() => {
            setIsEditing(!isEditing);
            setMessage(null);
            setErrorMsg(null);
          }}
          className="px-3 py-1.5 min-h-[36px] rounded-xl bg-amber-500 text-black font-bold text-xs shadow-md hover:bg-amber-400 active:scale-95 flex items-center gap-1.5 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs text-center font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-rose-900/80 border border-rose-500/50 text-rose-200 text-xs text-center font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isEditing ? (
        /* EDIT PROFILE FORM */
        <form onSubmit={handleSaveProfile} className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
          <h3 className="font-serif font-bold text-amber-200 text-sm border-b border-amber-500/20 pb-2">
            Edit Student Details & Photo
          </h3>

          {/* Photo Management Section */}
          <div className="text-center space-y-2">
            <StudentAvatar
              name={fullName || userPublic.fullName}
              photoUrl={photoPreview}
              className="w-24 h-24 mx-auto"
              textSize="text-2xl"
            />

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 min-h-[38px] rounded-xl bg-rose-900/80 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-rose-900 active:scale-95 flex items-center gap-1.5 shadow-md"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Change Photo</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {(photoPreview || userPublic.photoUrl) && (
                <button
                  type="button"
                  onClick={handleRemovePhotoClick}
                  className="px-3 py-2 min-h-[38px] rounded-xl bg-rose-950 border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-900 active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>

            <p className="text-[10px] text-amber-200/50">
              Supports JPG, PNG, or WebP up to 5 MB.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-200/90 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">Branch</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b} className="bg-[#2D0510] text-amber-100">{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} className="bg-[#2D0510] text-amber-100">{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">Outfit Color</label>
              <select
                value={outfitColor}
                onChange={(e) => setOutfitColor(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
              >
                {OUTFIT_COLORS.map((c) => (
                  <option key={c.name} value={c.name} className="bg-[#2D0510] text-amber-100">{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-200/90 mb-1">Dance Vibe</label>
              <select
                value={danceVibe}
                onChange={(e) => setDanceVibe(e.target.value as DanceVibe)}
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
              >
                {DANCE_VIBES.map((v) => (
                  <option key={v} value={v} className="bg-[#2D0510] text-amber-100">{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-200/90 mb-1">Looking For</label>
            <select
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value as LookingFor)}
              className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
            >
              {LOOKING_FOR_OPTIONS.map((o) => (
                <option key={o} value={o} className="bg-[#2D0510] text-amber-100">{o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-200/90 mb-1">My Dandiya Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
            />
          </div>

          {/* Private Contact Settings */}
          <div className="pt-2 border-t border-amber-500/20 space-y-3">
            <span className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
              Private Contact Details
            </span>

            <div>
              <label className="block text-xs text-amber-200/80 mb-1">WhatsApp Number</label>
              <input
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-amber-200/80 mb-1">Instagram Handle</label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-200">
                <input
                  type="checkbox"
                  checked={shareWhatsapp}
                  onChange={(e) => setShareWhatsapp(e.target.checked)}
                  className="rounded border-amber-500/40 text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span>Share WhatsApp with accepted partners</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-200">
                <input
                  type="checkbox"
                  checked={shareInstagram}
                  onChange={(e) => setShareInstagram(e.target.checked)}
                  className="rounded border-amber-500/40 text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span>Share Instagram with accepted partners</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 min-h-[44px] rounded-xl bg-amber-500 text-black font-bold text-xs shadow-lg hover:bg-amber-400 active:scale-98 flex items-center justify-center gap-2 transition-all"
          >
            {submitting ? 'Saving Changes & Photo...' : 'Save Changes'}
          </button>
        </form>
      ) : (
        /* DISPLAY PROFILE VIEW */
        <div className="space-y-4">
          
          {/* Card Summary */}
          <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center">
            <StudentAvatar
              name={userPublic.fullName}
              photoUrl={userPublic.photoUrl}
              className="w-24 h-24 mb-3"
              textSize="text-2xl"
            />
            <h3 className="font-serif font-bold text-amber-200 text-xl">
              {userPublic.fullName}
            </h3>
            <p className="text-xs text-amber-100/80 mt-0.5 flex items-center justify-center gap-1">
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <span>{userPublic.branch} • {userPublic.year}</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
                Outfit: {userPublic.outfitColor}
              </span>
              <span className="px-3 py-1 bg-rose-900/40 border border-amber-500/30 text-amber-200 text-xs font-bold rounded-full">
                Vibe: {userPublic.danceVibe}
              </span>
            </div>

            <div className="mt-4 p-3 bg-rose-950/60 border border-amber-500/20 rounded-2xl w-full text-xs italic text-amber-100">
              "{userPublic.prompt}"
            </div>
          </div>

          {/* Visibility Control */}
          <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-4 shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {userPublic.isPublic ? (
                <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <EyeOff className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-amber-200 truncate">
                  Discovery Visibility: {userPublic.isPublic ? 'Visible' : 'Hidden'}
                </h4>
                <p className="text-[10px] text-amber-100/60 line-clamp-2">
                  {userPublic.isPublic
                    ? 'Your profile appears to students on the Discover tab.'
                    : 'Your profile is hidden from new profile discovery.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleVisibility}
              className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                userPublic.isPublic
                  ? 'bg-rose-950 border border-rose-500/40 text-rose-300'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {userPublic.isPublic ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Blocked Users Section */}
          {userPrivate?.blockedUids && userPrivate.blockedUids.length > 0 && (
            <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-4 shadow-xl">
              <h4 className="text-xs font-bold text-amber-200 flex items-center gap-1.5 mb-2">
                <Ban className="w-4 h-4 text-rose-400" />
                <span>Blocked Accounts ({userPrivate.blockedUids.length})</span>
              </h4>
              <div className="space-y-2">
                {userPrivate.blockedUids.map((uid) => (
                  <div key={uid} className="flex items-center justify-between p-2 bg-rose-950/60 rounded-xl text-xs">
                    <span className="text-amber-100/70 font-mono text-[10px] truncate max-w-[150px]">{uid}</span>
                    <button
                      onClick={() => handleUnblock(uid)}
                      className="text-[10px] text-amber-300 hover:underline min-h-[32px] flex items-center"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Settings */}
          <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-4 shadow-xl space-y-3">
            <button
              onClick={handlePasswordReset}
              className="w-full py-2.5 px-3 min-h-[44px] rounded-xl bg-rose-950/60 border border-amber-500/20 text-amber-200 font-bold text-xs hover:bg-rose-900 active:scale-98 flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Send Password Reset Email</span>
            </button>

            <button
              onClick={logout}
              className="w-full py-2.5 px-3 min-h-[44px] rounded-xl bg-rose-900/60 border border-rose-500/40 text-rose-200 font-bold text-xs hover:bg-rose-900 active:scale-98 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Log Out</span>
            </button>
          </div>

        </div>
      )}

      {/* SQUARE CROP & PREVIEW MODAL */}
      {showCropModal && rawImageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#2D0510] border border-amber-500/40 rounded-3xl w-full max-w-xs sm:max-w-sm p-4 sm:p-5 shadow-2xl text-center space-y-3 sm:space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <h3 className="font-serif font-bold text-amber-200 text-sm flex items-center gap-2">
                <Crop className="w-4 h-4 text-amber-400" />
                <span>Square Photo Crop Preview</span>
              </h3>
            </div>

            {/* Square Aspect Preview Container */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-2xl overflow-hidden border-2 border-amber-400 shadow-2xl bg-black">
              <img
                src={rawImageSrc}
                alt="Square crop preview"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 border-2 border-dashed border-amber-400/60 rounded-2xl pointer-events-none" />
            </div>

            <p className="text-[11px] text-amber-200/70 italic">
              Preview your square profile picture before saving.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setPhotoFile(null);
                  setRawImageSrc(null);
                }}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl border border-amber-500/30 text-amber-200 text-xs font-bold hover:bg-rose-900/40 active:scale-95"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmCrop}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-lg hover:brightness-110 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirm Photo</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM PHOTO REMOVAL MODAL */}
      {confirmRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#2D0510] border border-amber-500/40 rounded-3xl w-full max-w-xs sm:max-w-sm p-5 sm:p-6 shadow-2xl text-center space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-950 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="font-serif font-bold text-amber-200 text-base">
              Remove Profile Photo?
            </h3>

            <p className="text-xs text-amber-100/80 leading-relaxed">
              Are you sure you want to remove your profile photo? Your profile will display your initials avatar in maroon and gold across Garba Saathi.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveModal(false)}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl border border-amber-500/30 text-amber-200 text-xs font-bold hover:bg-rose-900/40 active:scale-95"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={executeRemovePhoto}
                disabled={deletingPhoto}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-rose-600 text-white font-bold text-xs shadow-lg hover:bg-rose-500 active:scale-95"
              >
                {deletingPhoto ? 'Removing...' : 'Remove Photo'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
