import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  X, 
  Sparkles, 
  RefreshCw, 
  Music, 
  Search, 
  Shirt, 
  GraduationCap, 
  Flame, 
  Smile,
  ShieldCheck,
  CheckCircle2,
  Star
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  addDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { StudentAvatar, getInitials } from '../components/StudentAvatar';
import { UserPublic, UserPrivate, PartnerRequest, OUTFIT_COLORS } from '../types';

interface DiscoverViewProps {
  onNavigateToRequests: () => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onNavigateToRequests }) => {
  const { currentUser, userPublic, userPrivate, refreshProfile } = useAuth();
  
  const [candidates, setCandidates] = useState<UserPublic[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<'liked' | 'skipped' | null>(null);

  // Motion swipe values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  const likeOpacity = useTransform(x, [10, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, -10], [1, 0]);

  // Load eligible profiles
  const loadEligibleProfiles = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      // 1. Fetch user's existing sent and received requests
      const sentRequestsQ = query(
        collection(db, 'requests'),
        where('senderUid', '==', currentUser.uid)
      );
      const sentSnap = await getDocs(sentRequestsQ);
      const excludeUids = new Set<string>([currentUser.uid]); // exclude self

      sentSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const rUid = data.recipientUid || data.receiverId;
        if (rUid) excludeUids.add(rUid);
      });

      const recvRequestsQ = query(
        collection(db, 'requests'),
        where('recipientUid', '==', currentUser.uid)
      );
      const recvSnap = await getDocs(recvRequestsQ);
      recvSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const sUid = data.senderUid || data.senderId;
        if (sUid) excludeUids.add(sUid);
      });

      // Also check legacy fields for exclusion to avoid duplicate cards
      try {
        const legacySentQ = query(
          collection(db, 'requests'),
          where('senderId', '==', currentUser.uid)
        );
        const legacySentSnap = await getDocs(legacySentQ);
        legacySentSnap.forEach((d) => {
          const rUid = d.data().recipientUid || d.data().receiverId;
          if (rUid) excludeUids.add(rUid);
        });

        const legacyRecvQ = query(
          collection(db, 'requests'),
          where('receiverId', '==', currentUser.uid)
        );
        const legacyRecvSnap = await getDocs(legacyRecvQ);
        legacyRecvSnap.forEach((d) => {
          const sUid = d.data().senderUid || d.data().senderId;
          if (sUid) excludeUids.add(sUid);
        });
      } catch (legacyErr) {
        // Safe fallback if rules limit legacy field queries
      }

      // 2. Add user's blocked and skipped uids to exclusions
      if (userPrivate?.blockedUids) {
        userPrivate.blockedUids.forEach((uid) => excludeUids.add(uid));
      }
      if (userPrivate?.skippedUids) {
        userPrivate.skippedUids.forEach((uid) => excludeUids.add(uid));
      }

      // 3. Query public profiles from Firestore users collection
      const usersSnap = await getDocs(collection(db, 'users'));

      const priorityGroup: UserPublic[] = [];
      const normalGroup: UserPublic[] = [];

      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const profile = { uid: docSnap.id, ...data } as UserPublic;
        
        // Exclude self, existing partner requests/connections, blocked, skipped, and suspended users
        if (!excludeUids.has(profile.uid) && !profile.isSuspended && profile.isPublic !== false) {
          if (profile.isPriority) {
            priorityGroup.push(profile);
          } else {
            normalGroup.push(profile);
          }
        }
      });

      // Fisher-Yates shuffle for priority group
      for (let i = priorityGroup.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [priorityGroup[i], priorityGroup[j]] = [priorityGroup[j], priorityGroup[i]];
      }

      // If explicit rank is set, sort priority group by rank asc
      priorityGroup.sort((a, b) => {
        if (a.priorityRank !== undefined && b.priorityRank !== undefined) {
          return a.priorityRank - b.priorityRank;
        }
        return 0;
      });

      // Fisher-Yates shuffle for normal group
      for (let i = normalGroup.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [normalGroup[i], normalGroup[j]] = [normalGroup[j], normalGroup[i]];
      }

      // Priority students MUST appear FIRST in the candidate stack!
      const orderedCandidates = [...priorityGroup, ...normalGroup];

      setCandidates(orderedCandidates);
      setCurrentIndex(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEligibleProfiles();
  }, [currentUser]);

  const currentProfile = candidates[currentIndex];
  const [sendingRequest, setSendingRequest] = useState(false);
  const [senderWhatsappModal, setSenderWhatsappModal] = useState(false);
  const [senderWhatsappInput, setSenderWhatsappInput] = useState('');

  useEffect(() => {
    if (userPrivate) {
      const p = userPrivate as any;
      const num = p.whatsapp || p.whatsappNumber || p.phoneNumber || '';
      if (num) setSenderWhatsappInput(num);
    }
  }, [userPrivate]);

  // Execute request sending logic after WhatsApp number and consent are confirmed
  const executeSendRequest = async (whatsappNumber: string) => {
    if (!currentProfile || !currentUser || sendingRequest) return;

    const cleanDigits = whatsappNumber.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
      alert("Please provide a valid 10-digit WhatsApp number to send partner requests.");
      return;
    }

    setSendingRequest(true);
    const requestId = `${currentUser.uid}_${currentProfile.uid}`;
    const reverseRequestId = `${currentProfile.uid}_${currentUser.uid}`;
    const now = new Date().toISOString();

    // 1. Save / sync sender's WhatsApp contact in usersPrivate
    try {
      if (process.env.NODE_ENV === 'development' || true) {
        console.log('[SendRequest] Operation 1: Syncing userPrivate contact details');
      }
      await setDoc(
        doc(db, 'usersPrivate', currentUser.uid),
        {
          whatsapp: cleanDigits,
          whatsappNumber: cleanDigits,
          phoneNumber: cleanDigits,
          shareWhatsapp: true,
          email: currentUser.email || '',
        },
        { merge: true }
      );
      await refreshProfile();
    } catch (privateErr) {
      console.warn('[SendRequest] Notice syncing userPrivate contact:', privateErr);
    }

    // 2. Verify selected recipient profile exists in users collection
    try {
      if (process.env.NODE_ENV === 'development' || true) {
        console.log('[SendRequest] Operation 2: Validating recipient user profile exists');
      }
      const recipientSnap = await getDoc(doc(db, 'users', currentProfile.uid));
      if (!recipientSnap.exists()) {
        alert("Selected student profile is no longer available.");
        setSendingRequest(false);
        setSenderWhatsappModal(false);
        return;
      }
    } catch (recipientErr) {
      console.warn('[SendRequest] Notice checking recipient profile:', recipientErr);
    }

    // 3. Check for duplicate active requests
    try {
      if (process.env.NODE_ENV === 'development' || true) {
        console.log('[SendRequest] Operation 3: Checking duplicate active request status');
      }
      const existingReq = await getDoc(doc(db, 'requests', requestId));
      if (existingReq.exists()) {
        const data = existingReq.data();
        if (data?.status === 'pending' || data?.status === 'accepted') {
          alert("An active partner request already exists for this student.");
          setCurrentIndex((prev) => prev + 1);
          setSendingRequest(false);
          setSenderWhatsappModal(false);
          return;
        }
      }

      const existingReverseReq = await getDoc(doc(db, 'requests', reverseRequestId));
      if (existingReverseReq.exists()) {
        const data = existingReverseReq.data();
        if (data?.status === 'pending' || data?.status === 'accepted') {
          alert("This student has already sent you a partner request! Check your Received Requests tab.");
          setCurrentIndex((prev) => prev + 1);
          setSendingRequest(false);
          setSenderWhatsappModal(false);
          return;
        }
      }
    } catch (dupErr) {
      console.warn("[SendRequest] Notice checking duplicate request doc:", dupErr);
    }

    // 4. Primary Operation: Create persistent partner request document in requests/{requestId}
    let requestCreated = false;
    try {
      if (process.env.NODE_ENV === 'development' || true) {
        console.log(`[SendRequest] Operation 4: Primary request creation in requests/${requestId}`);
      }
      await setDoc(doc(db, 'requests', requestId), {
        requestId,
        senderUid: currentUser.uid,
        recipientUid: currentProfile.uid,
        status: 'pending',
        senderShareContacts: true,
        recipientShareContacts: false,
        createdAt: now,
        updatedAt: now,
      });
      requestCreated = true;
    } catch (primaryErr: any) {
      console.error('[SendRequest] Primary request creation failed:', primaryErr);
      handleFirestoreError(primaryErr, OperationType.CREATE, `requests/${requestId}`);
      alert(`Could not send request: ${primaryErr.message || primaryErr}`);
      setActionFeedback(null);
      setSendingRequest(false);
      setSenderWhatsappModal(false);
      return;
    }

    // 5. Secondary Operation: Store contact exchange in sharedContacts/{requestId}/members/{currentUser.uid} & optional notification
    if (requestCreated) {
      try {
        if (process.env.NODE_ENV === 'development' || true) {
          console.log(`[SendRequest] Operation 5: Secondary sharedContacts update in sharedContacts/${requestId}/members/${currentUser.uid}`);
        }

        // Store sender's contact in member subcollection with explicit ownerUid
        await setDoc(
          doc(db, 'sharedContacts', requestId, 'members', currentUser.uid),
          {
            ownerUid: currentUser.uid,
            requestId: requestId,
            whatsapp: cleanDigits,
            shareConsent: true,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        // Top-level document update for legacy compatibility
        await setDoc(
          doc(db, 'sharedContacts', requestId),
          {
            senderUid: currentUser.uid,
            recipientUid: currentProfile.uid,
            senderWhatsapp: cleanDigits,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (secondaryErr) {
        console.warn('[SendRequest] Secondary sharedContacts write notice:', secondaryErr);
      }

      try {
        if (process.env.NODE_ENV === 'development' || true) {
          console.log('[SendRequest] Operation 6: Creating recipient notification');
        }
        await addDoc(collection(db, 'notifications'), {
          userId: currentProfile.uid,
          senderUid: currentUser.uid,
          type: 'request_received',
          title: 'New Dandiya Partner Request! 💃',
          message: `${userPublic?.fullName || 'A GLBITM student'} sent you a Dandiya partner invitation!`,
          read: false,
          createdAt: now,
        });
      } catch (notifErr) {
        console.warn('[SendRequest] Secondary notification creation notice:', notifErr);
      }

      // Show celebratory feedback and confetti ONLY after successful primary request creation
      setActionFeedback('liked');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#D4AF37', '#E11D48', '#9333EA', '#FAF0E6'],
      });

      setSenderWhatsappModal(false);

      setTimeout(() => {
        setActionFeedback(null);
        x.set(0);
        setCurrentIndex((prev) => prev + 1);
        setSendingRequest(false);
      }, 300);
    }
  };

  // Handle Swipe Right / Like Button
  const handleLike = async () => {
    if (!currentProfile || !currentUser || sendingRequest) return;

    if (!currentUser.uid || !currentProfile.uid) {
      alert("Invalid request parameters: missing sender or recipient UID.");
      return;
    }

    if (currentUser.uid === currentProfile.uid) {
      alert("You cannot send a partner request to yourself.");
      return;
    }

    const existingNum = (userPrivate as any)?.whatsapp || (userPrivate as any)?.whatsappNumber || senderWhatsappInput || '';
    const cleanDigits = existingNum.replace(/\D/g, '');

    if (!cleanDigits || cleanDigits.length < 10) {
      // Prompt user to enter WhatsApp number and give explicit consent
      setSenderWhatsappModal(true);
      return;
    }

    // Direct send with registered number and explicit consent
    await executeSendRequest(cleanDigits);
  };

  // Handle Swipe Left / Skip Button
  const handleSkip = async () => {
    if (!currentProfile || !currentUser) return;

    setActionFeedback('skipped');

    try {
      // Save to skipped list in userPrivate to avoid showing again in current session
      await updateDoc(doc(db, 'usersPrivate', currentUser.uid), {
        skippedUids: arrayUnion(currentProfile.uid),
      });
      await refreshProfile();
    } catch (error) {
      console.error('Error recording skip:', error);
    }

    setTimeout(() => {
      setActionFeedback(null);
      x.set(0);
      setCurrentIndex((prev) => prev + 1);
    }, 250);
  };

  // Reset skipped profiles
  const handleResetSkipped = async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'usersPrivate', currentUser.uid), {
        skippedUids: [],
      });
      await refreshProfile();
      await loadEligibleProfiles();
    } catch (error) {
      console.error('Error resetting skipped profiles:', error);
    }
  };

  // Helper for outfit badge styling
  const getOutfitStyle = (colorName: string) => {
    const found = OUTFIT_COLORS.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
    return found ? `${found.bg} ${found.text}` : 'bg-amber-500/20 text-amber-200 border border-amber-500/30';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-amber-200/80 px-4 text-center">
        <Sparkles className="w-10 h-10 animate-spin text-amber-400 mb-3" />
        <p className="text-sm font-medium">Finding GLBITM Garba partners...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-28 sm:pb-24 flex flex-col items-center min-h-[calc(100vh-80px)]">
      
      {/* Header Banner */}
      <div className="w-full flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-amber-200 flex items-center gap-1.5">
            <span>Discover Partner</span>
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          </h2>
          <p className="text-[11px] sm:text-xs text-amber-100/60">Swipe right to request a Dandiya pair</p>
        </div>
        
        <button
          onClick={loadEligibleProfiles}
          className="p-2.5 rounded-xl bg-rose-950/70 border border-amber-500/20 text-amber-300 hover:text-amber-100 transition-colors active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
          title="Refresh Profiles"
          aria-label="Refresh Profiles"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Profile Card Container */}
      {!currentProfile ? (
        /* Empty State */
        <div className="w-full bg-[#2D0510]/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md my-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-amber-200 font-serif">
            No More Profiles Available
          </h3>
          <p className="text-xs text-amber-100/70 mt-2 leading-relaxed max-w-xs mx-auto">
            You've reviewed all active GLBITM student profiles matching your current criteria!
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleResetSkipped}
              className="w-full py-3 min-h-[44px] rounded-2xl bg-amber-500 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:bg-amber-400 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Skipped Profiles</span>
            </button>

            <button
              onClick={onNavigateToRequests}
              className="w-full py-3 min-h-[44px] rounded-2xl bg-rose-950 border border-amber-500/30 text-amber-300 font-bold text-xs hover:bg-rose-900/60 active:scale-98 transition-all"
            >
              Check Sent / Received Requests
            </button>
          </div>
        </div>
      ) : (
        /* Swipeable Card */
        <div className="w-full relative h-[470px] xs:h-[500px] sm:h-[530px] max-h-[66vh] min-h-[430px] flex items-center justify-center my-auto">
          
          <AnimatePresence>
            <motion.div
              style={{ x, rotate, opacity }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 90) {
                  handleLike();
                } else if (info.offset.x < -90) {
                  handleSkip();
                }
              }}
              className="absolute inset-0 w-full h-full bg-[#2D0510] border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col cursor-grab active:cursor-grabbing select-none"
            >
              
              {/* Swipe Indicators overlay */}
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute top-5 left-5 z-30 px-3.5 py-1.5 bg-emerald-500 text-black font-black text-base sm:text-lg rounded-2xl border-2 border-emerald-300 shadow-xl uppercase tracking-wider rotate-[-12deg] pointer-events-none"
              >
                REQUEST ❤️
              </motion.div>

              <motion.div
                style={{ opacity: skipOpacity }}
                className="absolute top-5 right-5 z-30 px-3.5 py-1.5 bg-rose-600 text-white font-black text-base sm:text-lg rounded-2xl border-2 border-rose-300 shadow-xl uppercase tracking-wider rotate-[12deg] pointer-events-none"
              >
                SKIP ✕
              </motion.div>

              {/* Card Photo Banner */}
              <div className="relative h-56 xs:h-64 sm:h-72 w-full bg-[#1A020A] overflow-hidden flex items-center justify-center shrink-0">
                {currentProfile.photoUrl ? (
                  <img
                    src={currentProfile.photoUrl}
                    alt={currentProfile.fullName}
                    className="w-full h-full object-cover object-center select-none"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-rose-950/60 text-amber-300 font-serif font-bold text-4xl sm:text-5xl">
                    <span>{getInitials(currentProfile.fullName)}</span>
                  </div>
                )}
                
                {/* Gradient overlay on image */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2D0510] via-transparent to-black/30 pointer-events-none" />

                {/* Verification Badge */}
                {currentProfile.isVerified && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-amber-500/80 backdrop-blur-md text-black font-bold text-[10px] rounded-full flex items-center gap-1 shadow-md">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified GLBITM</span>
                  </div>
                )}

                {/* Name & Branch on Image */}
                <div className="absolute bottom-2.5 left-3.5 right-3.5 text-amber-100">
                  <h3 className="text-lg sm:text-xl font-serif font-bold text-amber-200 truncate">
                    {currentProfile.fullName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-amber-100/80 mt-0.5">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{currentProfile.branch} • {currentProfile.year}</span>
                  </div>
                </div>
              </div>

              {/* Card Details Body */}
              <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between space-y-2 sm:space-y-3 bg-[#2D0510] overflow-y-auto">
                
                {/* Outfit & Dance Vibe Tags */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <div className={`px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-sm ${getOutfitStyle(currentProfile.outfitColor)}`}>
                    <Shirt className="w-3.5 h-3.5 shrink-0" />
                    <span>{currentProfile.outfitColor}</span>
                  </div>

                  <div className="px-2.5 py-0.5 sm:py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold rounded-full flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{currentProfile.danceVibe}</span>
                  </div>

                  <div className="px-2.5 py-0.5 sm:py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 text-[11px] sm:text-xs font-bold rounded-full flex items-center gap-1">
                    <Smile className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                    <span>For: {currentProfile.lookingFor}</span>
                  </div>
                </div>

                {/* Dandiya Prompt Box */}
                <div className="p-2.5 sm:p-3 bg-rose-950/60 border border-amber-500/20 rounded-2xl">
                  <div className="flex items-center gap-1 text-amber-400 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold mb-0.5">
                    <Music className="w-3 h-3 shrink-0" />
                    <span>My Dandiya Prompt</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-amber-100 italic leading-snug line-clamp-3">
                    "{currentProfile.prompt}"
                  </p>
                </div>

                {/* Privacy Guarantee Note */}
                <p className="text-[9px] sm:text-[10px] text-amber-200/40 text-center italic">
                  🔒 Contacts private until request accepted.
                </p>
              </div>

            </motion.div>
          </AnimatePresence>

        </div>
      )}

      {/* Action Buttons (Skip & Like) */}
      {currentProfile && (
        <div className="w-full flex items-center justify-center gap-6 mt-3 sm:mt-5 shrink-0">
          <button
            onClick={handleSkip}
            disabled={sendingRequest}
            className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-rose-950 border-2 border-rose-500/40 text-rose-400 flex items-center justify-center shadow-lg hover:scale-105 active:scale-90 transition-all disabled:opacity-50"
            title="Skip Profile"
            aria-label="Skip Profile"
          >
            <X className="w-7 h-7 stroke-[2.5]" />
          </button>

          <button
            onClick={handleLike}
            disabled={sendingRequest}
            className="w-16 h-16 min-w-[64px] min-h-[64px] rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-black flex items-center justify-center shadow-xl shadow-amber-500/30 hover:scale-105 active:scale-90 transition-all disabled:opacity-50"
            title="Send Partner Request"
            aria-label="Send Partner Request"
          >
            {sendingRequest ? (
              <RefreshCw className="w-7 h-7 animate-spin text-black" />
            ) : (
              <Heart className="w-8 h-8 fill-black stroke-black" />
            )}
          </button>
        </div>
      )}

      {/* SENDER WHATSAPP & CONTACT SHARING CONSENT MODAL */}
      {senderWhatsappModal && currentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#2D0510] border border-amber-500/40 rounded-3xl w-full max-w-xs sm:max-w-sm p-5 sm:p-6 shadow-2xl text-center space-y-3 sm:space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Heart className="w-6 h-6 sm:w-7 sm:h-7 fill-amber-400" />
            </div>

            <h3 className="font-serif font-bold text-amber-200 text-base sm:text-lg">
              Send Dandiya Partner Request
            </h3>

            <p className="text-xs text-amber-100/80 leading-relaxed">
              Sending a request to <strong className="text-amber-200">{currentProfile.fullName}</strong> will share your registered WhatsApp contact if they accept your invitation.
            </p>

            <div className="text-left space-y-1">
              <label className="block text-[11px] font-bold text-amber-300">
                Your WhatsApp Number:
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={senderWhatsappInput}
                onChange={(e) => setSenderWhatsappInput(e.target.value)}
                placeholder="10-digit mobile e.g. 9876543210"
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="p-2.5 sm:p-3 bg-rose-950/60 border border-amber-500/20 rounded-2xl text-left text-[10px] sm:text-[11px] text-amber-200/70 space-y-1">
              <div className="flex items-center gap-1 font-bold text-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Contact Privacy Guarantee:</span>
              </div>
              <p>Your WhatsApp number will only be shared with this student if they accept your request.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSenderWhatsappModal(false)}
                disabled={sendingRequest}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl border border-amber-500/30 text-amber-200 text-xs font-bold hover:bg-rose-900/40 active:scale-95"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => executeSendRequest(senderWhatsappInput)}
                disabled={sendingRequest}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 flex items-center justify-center gap-1"
              >
                {sendingRequest ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <span>Consent & Send</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
