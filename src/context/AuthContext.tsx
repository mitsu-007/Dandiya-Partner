import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, onSnapshot, collection, query, where, arrayUnion } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserPublic, UserPrivate, PartnerRequest, AppNotification } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userPublic: UserPublic | null;
  userPrivate: UserPrivate | null;
  loading: boolean;
  isAdmin: boolean;
  unreadNotificationsCount: number;
  pendingReceivedRequestsCount: number;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userPublic: null,
  userPrivate: null,
  loading: true,
  isAdmin: false,
  unreadNotificationsCount: 0,
  pendingReceivedRequestsCount: 0,
  refreshProfile: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPublic, setUserPublic] = useState<UserPublic | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingReceivedRequestsCount, setPendingReceivedRequestsCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setIsAdmin(false);
      return;
    }

    const checkAdminStatus = async () => {
      const t0 = performance.now();
      try {
        // 1. Quick check for official admin email (0ms network cost)
        if (currentUser.email?.toLowerCase() === 'admin@glbitm.ac.in') {
          setIsAdmin(true);
          try {
            await setDoc(doc(db, 'config', 'admins'), {
              uids: arrayUnion(currentUser.uid),
              adminEmails: arrayUnion('admin@glbitm.ac.in'),
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch (configErr) {
            console.warn('[Admin] Config auto-seed notice:', configErr);
          }
          console.log(`[Perf] checkAdminStatus (admin email): ${(performance.now() - t0).toFixed(1)}ms`);
          return;
        }

        // 2. Check cached ID token claim without forcing network token refresh
        const tokenResult = await currentUser.getIdTokenResult(false);
        if (tokenResult.claims.admin === true) {
          setIsAdmin(true);
          console.log(`[Perf] checkAdminStatus (token claim): ${(performance.now() - t0).toFixed(1)}ms`);
          return;
        }

        // 3. Optional check of /config/admins document
        const adminConfigSnap = await getDoc(doc(db, 'config', 'admins'));
        if (adminConfigSnap.exists()) {
          const uids: string[] = adminConfigSnap.data().uids || [];
          if (uids.includes(currentUser.uid)) {
            setIsAdmin(true);
            console.log(`[Perf] checkAdminStatus (config doc): ${(performance.now() - t0).toFixed(1)}ms`);
            return;
          }
        }

        setIsAdmin(false);
      } catch (err) {
        setIsAdmin(currentUser?.email?.toLowerCase() === 'admin@glbitm.ac.in');
      }
    };

    checkAdminStatus();
  }, [currentUser]);

  const fetchProfile = async (uid: string) => {
    const t0 = performance.now();
    try {
      const fetchDoc = async (collectionName: string) => {
        try {
          // Attempt instant cache lookup first
          return await getDoc(doc(db, collectionName, uid));
        } catch {
          // Fallback to server if cache miss
          return await getDocFromServer(doc(db, collectionName, uid));
        }
      };

      // Concurrent fetch for both public and private documents
      const [publicSnap, privateSnap] = await Promise.all([
        fetchDoc('users'),
        fetchDoc('usersPrivate'),
      ]);

      if (publicSnap.exists()) {
        setUserPublic(publicSnap.data() as UserPublic);
      } else {
        setUserPublic(null);
      }

      if (privateSnap.exists()) {
        setUserPrivate(privateSnap.data() as UserPrivate);
      } else {
        setUserPrivate(null);
      }
      console.log(`[Perf] fetchProfile (concurrent users + usersPrivate): ${(performance.now() - t0).toFixed(1)}ms`);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser.uid);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserPublic(null);
    setUserPrivate(null);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        setUserPublic(null);
        setUserPrivate(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to unread notifications and pending requests for badges
  useEffect(() => {
    if (!currentUser) {
      setUnreadNotificationsCount(0);
      setPendingReceivedRequestsCount(0);
      return;
    }

    // Unread notifications count
    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('read', '==', false)
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snapshot) => {
        setUnreadNotificationsCount(snapshot.size);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'notifications')
    );

    // Pending received requests count
    const requestsQuery = query(
      collection(db, 'requests'),
      where('recipientUid', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const unsubRequests = onSnapshot(
      requestsQuery,
      (snapshot) => {
        setPendingReceivedRequestsCount(snapshot.size);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'requests')
    );

    return () => {
      unsubNotifs();
      unsubRequests();
    };
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userPublic,
        userPrivate,
        loading,
        isAdmin,
        unreadNotificationsCount,
        pendingReceivedRequestsCount,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
