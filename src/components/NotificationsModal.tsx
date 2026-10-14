import React, { useEffect, useState } from 'react';
import { X, Bell, Check, Sparkles, HeartHandshake } from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../types';

interface NotificationsModalProps {
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const fetchNotifications = async () => {
      try {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const list: AppNotification[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
        });
        // Sort in memory by createdAt desc
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(list);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [currentUser]);

  const markAllAsRead = async () => {
    if (!currentUser || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.read) {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        }
      });
      await batch.commit();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error('Error marking notifications read:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#2D0510] border border-amber-500/30 rounded-2xl w-full max-w-md p-5 text-cream shadow-2xl relative max-h-[80vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-300 font-serif text-lg font-bold">
            <Bell className="w-5 h-5 text-amber-400" />
            <span>Notifications</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="text-xs text-amber-300/80 hover:text-amber-200 underline"
            >
              Mark read
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-rose-900/50 text-amber-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto my-3 space-y-2.5 pr-1">
          {loading ? (
            <div className="text-center py-8 text-amber-200/60 text-sm">Loading alerts...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10 text-amber-200/60 text-sm">
              <Sparkles className="w-8 h-8 text-amber-400/40 mx-auto mb-2" />
              <p>No notifications yet!</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-xl border transition-all ${
                  !n.read
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-100 font-medium'
                    : 'bg-rose-950/40 border-amber-500/10 text-amber-200/70'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 text-amber-400">
                    {n.type === 'request_accepted' ? (
                      <HeartHandshake className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-amber-200">{n.title}</h4>
                    <p className="text-xs mt-0.5 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-amber-200/40 block mt-1">
                      {new Date(n.createdAt).toLocaleDateString()} at{' '}
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm shadow-lg hover:bg-amber-400 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
