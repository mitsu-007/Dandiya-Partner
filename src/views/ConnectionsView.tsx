import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  MessageCircle, 
  Lock, 
  Sparkles, 
  GraduationCap, 
  Flame, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDoc, 
  setDoc,
  doc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { StudentAvatar } from '../components/StudentAvatar';
import { PartnerRequest, UserPublic, SharedContact } from '../types';
import { openWhatsApp } from '../utils/whatsapp';

export const ConnectionsView: React.FC = () => {
  const { currentUser, userPrivate } = useAuth();
  
  const [connections, setConnections] = useState<
    {
      request: PartnerRequest;
      partnerProfile: UserPublic;
      sharedContact?: SharedContact;
      otherUserId: string;
      isSender: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [whatsappError, setWhatsappError] = useState<{ [reqId: string]: string }>({});

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query for accepted requests where currentUser is sender or recipient
    const qSender = query(
      collection(db, 'requests'),
      where('senderUid', '==', currentUser.uid),
      where('status', '==', 'accepted')
    );

    const qRecipient = query(
      collection(db, 'requests'),
      where('recipientUid', '==', currentUser.uid),
      where('status', '==', 'accepted')
    );

    const requestMap = new Map<string, PartnerRequest>();

    const processConnections = async () => {
      try {
        const list: {
          request: PartnerRequest;
          partnerProfile: UserPublic;
          sharedContact?: SharedContact;
          otherUserId: string;
          isSender: boolean;
        }[] = [];

        const processedOtherUids = new Set<string>();

        for (const reqData of requestMap.values()) {
          const senderId = reqData.senderUid || (reqData as any).senderId;
          const receiverId = reqData.recipientUid || (reqData as any).receiverId;

          if (!senderId || !receiverId) continue;

          const isSender = senderId === currentUser.uid;
          const otherUserId = isSender ? receiverId : senderId;

          if (processedOtherUids.has(otherUserId)) continue;
          processedOtherUids.add(otherUserId);

          // 1. Fetch partner's public profile from users/{otherUserId}
          let partnerProfile: UserPublic;
          try {
            const profileSnap = await getDoc(doc(db, 'users', otherUserId));
            if (profileSnap.exists()) {
              partnerProfile = profileSnap.data() as UserPublic;
            } else {
              partnerProfile = {
                uid: otherUserId,
                fullName: 'GLBITM Dandiya Partner',
                branch: 'Campus Fest',
                year: 'Student',
                outfitColor: 'Festive',
                photoUrl: '',
                prompt: 'Excited for GLBITM Dandiya Night!',
                danceVibe: 'Full Energy',
                lookingFor: 'Dandiya Partner',
                isVerified: true,
                isPublic: true,
                isSuspended: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            }
          } catch (profileErr) {
            partnerProfile = {
              uid: otherUserId,
              fullName: 'Dandiya Partner',
              branch: 'GLBITM Student',
              year: 'Campus Fest',
              outfitColor: 'Festive',
              photoUrl: '',
              prompt: 'Excited for GLBITM Dandiya Night!',
              danceVibe: 'Full Energy',
              lookingFor: 'Dandiya Partner',
              isVerified: true,
              isPublic: true,
              isSuspended: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }

          // 2. Fetch shared contact from sharedContacts/{requestId} for both sender and recipient
          let sharedContact: SharedContact | undefined = undefined;
          try {
            const sharedSnap = await getDoc(doc(db, 'sharedContacts', reqData.id));
            if (sharedSnap.exists()) {
              sharedContact = sharedSnap.data() as SharedContact;
            }
          } catch (sharedErr) {
            console.warn(`[Connections] sharedContacts/${reqData.id} fetch notice:`, sharedErr);
          }

          // 3. Auto-sync current user's registered WhatsApp if missing from sharedContacts
          const myWhatsapp = (userPrivate as any)?.whatsapp || (userPrivate as any)?.whatsappNumber || (userPrivate as any)?.phoneNumber || '';
          const cleanMyNum = myWhatsapp.replace(/\D/g, '');
          if (cleanMyNum && cleanMyNum.length >= 10) {
            if (isSender && !sharedContact?.senderWhatsapp) {
              try {
                await setDoc(doc(db, 'sharedContacts', reqData.id), {
                  senderUid: currentUser.uid,
                  senderWhatsapp: cleanMyNum,
                  updatedAt: new Date().toISOString(),
                }, { merge: true });
                sharedContact = {
                  ...(sharedContact || { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
                  senderWhatsapp: cleanMyNum,
                };
              } catch (syncErr) {
                console.warn('[Auto-sync] Could not sync sender whatsapp:', syncErr);
              }
            } else if (!isSender && (!sharedContact?.recipientWhatsapp && !sharedContact?.whatsapp)) {
              try {
                await setDoc(doc(db, 'sharedContacts', reqData.id), {
                  recipientUid: currentUser.uid,
                  recipientWhatsapp: cleanMyNum,
                  whatsapp: cleanMyNum,
                  updatedAt: new Date().toISOString(),
                }, { merge: true });
                sharedContact = {
                  ...(sharedContact || { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
                  recipientWhatsapp: cleanMyNum,
                  whatsapp: cleanMyNum,
                };
              } catch (syncErr) {
                console.warn('[Auto-sync] Could not sync recipient whatsapp:', syncErr);
              }
            }
          }

          list.push({
            request: reqData,
            partnerProfile,
            sharedContact,
            otherUserId,
            isSender,
          });
        }

        // Sort connections by respondedAt or createdAt desc
        list.sort((a, b) => {
          const tA = new Date(a.request.respondedAt || a.request.createdAt).getTime();
          const tB = new Date(b.request.respondedAt || b.request.createdAt).getTime();
          return tB - tA;
        });

        setConnections(list);
      } catch (err) {
        console.error('[Connections Error] Failed to process connections:', err);
      } finally {
        setLoading(false);
      }
    };

    const handleSnapshotUpdate = (snapshot: any) => {
      snapshot.docs.forEach((docSnap: any) => {
        requestMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PartnerRequest);
      });
      processConnections();
    };

    const unsubSender = onSnapshot(qSender, handleSnapshotUpdate, (e) => {
      handleFirestoreError(e, OperationType.GET, 'requests');
      setLoading(false);
    });

    const unsubRecipient = onSnapshot(qRecipient, handleSnapshotUpdate, (e) => {
      handleFirestoreError(e, OperationType.GET, 'requests');
      setLoading(false);
    });

    return () => {
      unsubSender();
      unsubRecipient();
    };
  }, [currentUser]);

  const handleMessageWhatsAppClick = (reqId: string, whatsappNumber?: string) => {
    setWhatsappError((prev) => ({ ...prev, [reqId]: '' }));
    try {
      if (!whatsappNumber) {
        throw new Error("Partner's WhatsApp contact is private or not authorized.");
      }
      openWhatsApp(whatsappNumber);
    } catch (err: any) {
      setWhatsappError((prev) => ({
        ...prev,
        [reqId]: err.message || "Failed to launch WhatsApp.",
      }));
    }
  };

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-28 sm:pb-24 text-amber-100">
      
      {/* Header */}
      <div className="mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-serif font-bold text-amber-200 flex items-center gap-2">
          <span>Connections</span>
          <HeartHandshake className="w-5 h-5 text-amber-400 shrink-0" />
        </h2>
        <p className="text-[11px] sm:text-xs text-amber-100/60">Your confirmed Dandiya & Garba partners</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-amber-200/60 text-xs">
          <Sparkles className="w-8 h-8 text-amber-400/60 animate-pulse mx-auto mb-2" />
          <span>Syncing real-time connections...</span>
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 bg-[#2D0510]/80 border border-amber-500/20 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
          <HeartHandshake className="w-12 h-12 text-amber-400/40 mx-auto mb-3" />
          <p className="text-sm sm:text-base font-bold font-serif text-amber-200">
            No connections yet! 💛 Start exploring and find your Garba Saathi.
          </p>
          <p className="text-xs text-amber-100/60 mt-2 leading-relaxed max-w-xs mx-auto">
            When you accept a request or when someone accepts your request, your matched connection and WhatsApp contact button will appear here automatically!
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 sm:space-y-4">
          {connections.map(({ request, partnerProfile, sharedContact, isSender }) => {
            const partnerWhatsapp = isSender
              ? (sharedContact?.recipientWhatsapp || sharedContact?.whatsapp)
              : (sharedContact?.senderWhatsapp || sharedContact?.whatsapp);
            const err = whatsappError[request.id];

            return (
              <div
                key={request.id}
                className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 sm:space-y-4 relative overflow-hidden"
              >
                {/* Gold Glow Accent */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/10 blur-2xl rounded-full pointer-events-none" />

                {/* Partner Header */}
                <div className="flex items-center gap-3">
                  <StudentAvatar
                    name={partnerProfile.fullName}
                    photoUrl={partnerProfile.photoUrl}
                    className="w-14 h-14 sm:w-16 sm:h-16 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-serif font-bold text-amber-200 text-base sm:text-lg truncate">
                        {partnerProfile.fullName}
                      </h3>
                      {/* Green Connected Status Badge */}
                      <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-2 py-0.5 rounded-full uppercase shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Connected</span>
                      </span>
                    </div>

                    <p className="text-xs text-amber-100/80 mt-0.5 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{partnerProfile.branch} • {partnerProfile.year}</span>
                    </p>

                    <p className="text-xs text-amber-300 mt-0.5 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Vibe: {partnerProfile.danceVibe}</span>
                    </p>
                  </div>
                </div>

                {/* Dandiya Prompt */}
                <div className="p-2.5 sm:p-3 bg-rose-950/60 border border-amber-500/20 rounded-xl text-xs italic text-amber-100/90 line-clamp-2">
                  "{partnerProfile.prompt}"
                </div>

                {/* Error Banner */}
                {err && (
                  <div className="p-2.5 rounded-xl bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{err}</span>
                  </div>
                )}

                {/* Primary Action: Message on WhatsApp OR WhatsApp Contact Private */}
                <div className="pt-2 border-t border-amber-500/20">
                  {partnerWhatsapp ? (
                    <button
                      onClick={() => handleMessageWhatsAppClick(request.id, partnerWhatsapp)}
                      className="w-full py-3 min-h-[48px] px-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 flex items-center justify-center gap-2 transition-all active:scale-98"
                    >
                      <MessageCircle className="w-5 h-5 fill-white shrink-0" />
                      <span>Message on WhatsApp</span>
                    </button>
                  ) : (
                    <div className="py-2.5 px-3 min-h-[44px] rounded-2xl bg-rose-950/60 border border-amber-500/20 text-amber-200/60 text-xs font-medium flex items-center justify-center gap-1.5 cursor-not-allowed">
                      <Lock className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                      <span>WhatsApp Contact Private</span>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
