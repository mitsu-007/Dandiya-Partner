import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Send, 
  Inbox, 
  Sparkles, 
  GraduationCap, 
  Flame, 
  HeartHandshake, 
  Phone,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc, 
  writeBatch,
  addDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { StudentAvatar } from '../components/StudentAvatar';
import { PartnerRequest, UserPublic } from '../types';

interface RequestsViewProps {
  onNavigateToConnections: () => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({ onNavigateToConnections }) => {
  const { currentUser, userPublic, userPrivate } = useAuth();
  const [modalWhatsapp, setModalWhatsapp] = useState('');

  useEffect(() => {
    if (userPrivate) {
      const p = userPrivate as any;
      const num = p.whatsapp || p.whatsappNumber || p.phoneNumber || '';
      if (num) setModalWhatsapp(num);
    }
  }, [userPrivate]);
  
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [receivedRequests, setReceivedRequests] = useState<PartnerRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<PartnerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Consent modal state for accepting a request
  const [acceptingReq, setAcceptingReq] = useState<PartnerRequest | null>(null);

  const [queryError, setQueryError] = useState<string | null>(null);

  // Real-time Firestore subscriptions for requests
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setQueryError(null);

    // Keep exactly two request listeners as required by security rules
    const recvQ = query(collection(db, 'requests'), where('recipientUid', '==', currentUser.uid));
    const sentQ = query(collection(db, 'requests'), where('senderUid', '==', currentUser.uid));

    let recvMap = new Map<string, PartnerRequest>();
    let sentMap = new Map<string, PartnerRequest>();

    const processReceived = async () => {
      try {
        const hydratedRecv: PartnerRequest[] = [];
        for (const reqData of recvMap.values()) {
          const sId = reqData.senderUid || (reqData as any).senderId;
          const rId = reqData.recipientUid || (reqData as any).receiverId;

          // Self-heal legacy field names if authenticated participant reads doc
          if (sId && rId && (!reqData.senderUid || !reqData.recipientUid)) {
            try {
              await updateDoc(doc(db, 'requests', reqData.id), {
                senderUid: sId,
                senderId: sId,
                recipientUid: rId,
                receiverId: rId,
              });
            } catch (healErr) {
              console.warn(`[Self-heal] Could not update request ${reqData.id}:`, healErr);
            }
          }

          if (!sId) continue;
          const senderSnap = await getDoc(doc(db, 'users', sId));
          if (senderSnap.exists()) {
            reqData.senderProfile = senderSnap.data() as UserPublic;
            hydratedRecv.push(reqData);
          }
        }
        // Pending first, then newest first
        hydratedRecv.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setReceivedRequests(hydratedRecv);
      } catch (err) {
        console.error('Error hydrating received requests:', err);
      } finally {
        setLoading(false);
      }
    };

    const processSent = async () => {
      try {
        const hydratedSent: PartnerRequest[] = [];
        for (const reqData of sentMap.values()) {
          const sId = reqData.senderUid || (reqData as any).senderId;
          const rId = reqData.recipientUid || (reqData as any).receiverId;

          // Self-heal legacy field names
          if (sId && rId && (!reqData.senderUid || !reqData.recipientUid)) {
            try {
              await updateDoc(doc(db, 'requests', reqData.id), {
                senderUid: sId,
                senderId: sId,
                recipientUid: rId,
                receiverId: rId,
              });
            } catch (healErr) {
              console.warn(`[Self-heal] Could not update request ${reqData.id}:`, healErr);
            }
          }

          if (!rId) continue;
          const recipientSnap = await getDoc(doc(db, 'users', rId));
          if (recipientSnap.exists()) {
            reqData.recipientProfile = recipientSnap.data() as UserPublic;
            hydratedSent.push(reqData);
          }
        }
        hydratedSent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setSentRequests(hydratedSent);
      } catch (err) {
        console.error('Error hydrating sent requests:', err);
      } finally {
        setLoading(false);
      }
    };

    const unsubRecv = onSnapshot(recvQ, (snap) => {
      snap.docs.forEach((d) => recvMap.set(d.id, { id: d.id, ...d.data() } as PartnerRequest));
      processReceived();
    }, (err) => {
      const info = handleFirestoreError(err, OperationType.GET, 'requests');
      setQueryError(`Query Error: ${info.error}`);
      setLoading(false);
    });

    const unsubSent = onSnapshot(sentQ, (snap) => {
      snap.docs.forEach((d) => sentMap.set(d.id, { id: d.id, ...d.data() } as PartnerRequest));
      processSent();
    }, (err) => {
      const info = handleFirestoreError(err, OperationType.GET, 'requests');
      setQueryError(`Query Error: ${info.error}`);
      setLoading(false);
    });

    return () => {
      unsubRecv();
      unsubSent();
    };
  }, [currentUser]);

  // Confirm and Execute Accept
  const confirmAccept = async (inputWhatsapp?: string) => {
    if (!acceptingReq || !currentUser || !userPublic) return;
    const req = acceptingReq;
    setProcessingId(req.id);
    setAcceptError(null);

    try {
      // 1. Validate accepting student's ownership
      const recipientId = req.recipientUid || (req as any).receiverId;
      if (recipientId && recipientId !== currentUser.uid) {
        throw new Error("Unauthorized: Only the request recipient can accept this partner invitation.");
      }

      // 2. Validate WhatsApp number
      const numToUse = (inputWhatsapp || modalWhatsapp || '').trim();
      const cleanDigits = numToUse.replace(/\D/g, '');

      if (!cleanDigits || cleanDigits.length < 10) {
        throw new Error("Please enter a valid 10-digit WhatsApp number before accepting.");
      }

      const now = new Date().toISOString();
      const batch = writeBatch(db);
      const reqRef = doc(db, 'requests', req.id);
      const sharedContactRef = doc(db, 'sharedContacts', req.id);
      const privateContactRef = doc(db, 'usersPrivate', currentUser.uid);

      // 1. Update Request to accepted
      batch.update(reqRef, {
        status: 'accepted',
        recipientShareContacts: true,
        respondedAt: now,
        updatedAt: now,
      });

      // 2. Create/update Shared Contact record in sharedContacts/{req.id}
      batch.set(
        sharedContactRef,
        {
          ownerUid: currentUser.uid,
          recipientUid: currentUser.uid,
          whatsapp: cleanDigits,
          recipientWhatsapp: cleanDigits,
          updatedAt: now,
        },
        { merge: true }
      );

      // 3. Update Private Contact in usersPrivate/{currentUser.uid}
      batch.set(
        privateContactRef,
        {
          whatsapp: cleanDigits,
          whatsappNumber: cleanDigits,
          phoneNumber: cleanDigits,
          shareWhatsapp: true,
          email: currentUser.email || '',
        },
        { merge: true }
      );

      // Commit the atomic writeBatch!
      await batch.commit();

      // Celebratory Confetti
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#10B981', '#E11D48'],
      });

      setAcceptingReq(null);

      // 5. Auto-navigate to Connections view
      setTimeout(() => {
        onNavigateToConnections();
      }, 800);

    } catch (error: any) {
      console.error('Error accepting request:', error);
      setAcceptError(error.message || 'Failed to accept partner request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Partner Request
  const handleReject = async (req: PartnerRequest) => {
    if (!currentUser) return;
    setProcessingId(req.id);

    try {
      const now = new Date().toISOString();

      await updateDoc(doc(db, 'requests', req.id), {
        status: 'rejected',
        respondedAt: now,
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Cancel Sent Request
  const handleCancelSent = async (requestId: string) => {
    if (!currentUser) return;
    setProcessingId(requestId);

    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'cancelled',
      });
    } catch (error) {
      console.error('Error cancelling request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingReceivedCount = receivedRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-28 sm:pb-24 text-amber-100 relative">
      
      {/* Title */}
      <div className="mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-serif font-bold text-amber-200 flex items-center gap-2">
          <span>Partner Requests</span>
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        </h2>
        <p className="text-[11px] sm:text-xs text-amber-100/60">Manage invitations to dance together</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-rose-950/60 p-1 rounded-2xl border border-amber-500/20 mb-5">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 py-2 min-h-[40px] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98 ${
            activeTab === 'received'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
              : 'text-amber-200/60 hover:text-amber-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Received</span>
          {pendingReceivedCount > 0 && (
            <span className="bg-rose-600 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full">
              {pendingReceivedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 py-2 min-h-[40px] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98 ${
            activeTab === 'sent'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
              : 'text-amber-200/60 hover:text-amber-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Sent</span>
        </button>
      </div>

      {/* Requests Content */}
      {loading ? (
        <div className="text-center py-12 text-amber-200/60 text-xs">Loading requests...</div>
      ) : activeTab === 'received' ? (
        /* RECEIVED TAB */
        <div className="space-y-3.5 sm:space-y-4">
          {receivedRequests.length === 0 ? (
            <div className="text-center py-12 bg-[#2D0510]/80 border border-amber-500/20 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <Inbox className="w-10 h-10 text-amber-400/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-amber-200">No Received Requests Yet</p>
              <p className="text-xs text-amber-100/60 mt-1 leading-relaxed max-w-xs mx-auto">
                When other GLBITM students swipe right on your profile, their requests will appear here automatically!
              </p>
            </div>
          ) : (
            receivedRequests.map((req) => {
              const sender = req.senderProfile;
              if (!sender) return null;

              return (
                <div
                  key={req.id}
                  className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-3.5 sm:p-4 shadow-xl flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <StudentAvatar
                      name={sender.fullName}
                      photoUrl={sender.photoUrl}
                      className="w-12 h-12 sm:w-14 sm:h-14 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-serif font-bold text-amber-200 text-sm sm:text-base truncate">
                          {sender.fullName}
                        </h3>
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                            req.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : req.status === 'accepted'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-950 text-rose-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-amber-100/80 mt-0.5">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">{sender.branch} • {sender.year}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-amber-300 mt-1">
                        <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Vibe: {sender.danceVibe}</span>
                      </div>
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="bg-rose-950/60 border border-amber-500/20 p-2.5 rounded-xl text-xs italic text-amber-100/90 line-clamp-2">
                    "{sender.prompt}"
                  </div>

                  {/* Action Buttons */}
                  {req.status === 'pending' ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleReject(req)}
                        disabled={processingId === req.id}
                        className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-rose-950 border border-rose-500/40 text-rose-300 font-bold text-xs hover:bg-rose-900 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        <span>Decline</span>
                      </button>

                      <button
                        onClick={() => setAcceptingReq(req)}
                        disabled={processingId === req.id}
                        className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-md shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Accept & Pair</span>
                      </button>
                    </div>
                  ) : req.status === 'accepted' ? (
                    <div className="p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-center text-xs text-emerald-200 font-bold flex items-center justify-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Request Accepted! Visible in Connections tab.</span>
                    </div>
                  ) : (
                    <div className="p-2 bg-rose-950/40 rounded-xl text-center text-xs text-amber-200/50">
                      Request Declined
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* SENT TAB */
        <div className="space-y-3.5 sm:space-y-4">
          {sentRequests.length === 0 ? (
            <div className="text-center py-12 bg-[#2D0510]/80 border border-amber-500/20 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <Send className="w-10 h-10 text-amber-400/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-amber-200">No Sent Requests</p>
              <p className="text-xs text-amber-100/60 mt-1 leading-relaxed max-w-xs mx-auto">
                Start discovering student profiles and swipe right to send requests!
              </p>
            </div>
          ) : (
            sentRequests.map((req) => {
              const recipient = req.recipientProfile;
              if (!recipient) return null;

              return (
                <div
                  key={req.id}
                  className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-3.5 sm:p-4 shadow-xl flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar
                      name={recipient.fullName}
                      photoUrl={recipient.photoUrl}
                      className="w-11 h-11 sm:w-12 sm:h-12 shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="font-serif font-bold text-amber-200 text-xs sm:text-sm truncate">
                        {recipient.fullName}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-amber-100/70 truncate">
                        {recipient.branch} • {recipient.year}
                      </p>
                      <span className="text-[10px] text-amber-300/80 block mt-0.5">
                        Sent {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full mb-1 ${
                        req.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : req.status === 'accepted'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-950 text-rose-300'
                      }`}
                    >
                      {req.status}
                    </span>

                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleCancelSent(req.id)}
                        disabled={processingId === req.id}
                        className="block text-[10px] sm:text-[11px] text-rose-400 hover:underline mt-1 ml-auto min-h-[28px]"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ACCEPTANCE CONFIRMATION & CONTACT SHARING CONSENT MODAL */}
      {acceptingReq && acceptingReq.senderProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#2D0510] border border-amber-500/40 rounded-3xl w-full max-w-xs sm:max-w-sm p-5 sm:p-6 shadow-2xl text-center space-y-3 sm:space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Phone className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <h3 className="font-serif font-bold text-amber-200 text-base sm:text-lg">
              Accept Dandiya Partner Request?
            </h3>

            <p className="text-xs text-amber-100/80 leading-relaxed">
              Accepting will connect you with <strong className="text-amber-200">{acceptingReq.senderProfile.fullName}</strong> and share your registered WhatsApp contact for Dandiya Night coordination.
            </p>

            {/* Input WhatsApp if empty */}
            <div className="text-left space-y-1">
              <label className="block text-[11px] font-bold text-amber-300">
                Your WhatsApp Number:
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={modalWhatsapp}
                onChange={(e) => setModalWhatsapp(e.target.value)}
                placeholder="10-digit mobile e.g. 9876543210"
                className="w-full p-2.5 min-h-[44px] bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Error Banner if acceptance failed */}
            {acceptError && (
              <div className="p-2.5 rounded-xl bg-rose-900/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{acceptError}</span>
              </div>
            )}

            <div className="p-2.5 sm:p-3 bg-rose-950/60 border border-amber-500/20 rounded-2xl text-left text-[10px] sm:text-[11px] text-amber-200/70 space-y-1">
              <div className="flex items-center gap-1 font-bold text-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Contact Sharing Notice:</span>
              </div>
              <p>Your WhatsApp number is kept strictly private except for confirmed connections.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptingReq(null)}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl border border-amber-500/30 text-amber-200 text-xs font-bold hover:bg-rose-900/40 active:scale-95"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => confirmAccept(modalWhatsapp)}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 flex items-center justify-center gap-1"
              >
                <span>Accept & Share</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
