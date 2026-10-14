import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Send, 
  HeartHandshake, 
  Search, 
  CheckCircle, 
  XCircle, 
  Ban, 
  ShieldAlert,
  Sparkles,
  Star,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Clock,
  LogOut,
  UserPlus
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { StudentAvatar } from '../components/StudentAvatar';
import { UserPublic, BRANCHES, YEARS } from '../types';

export const AdminView: React.FC = () => {
  const { isAdmin, currentUser, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'priority'>('dashboard');
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPriority: 0,
    totalPendingRequests: 0,
    totalAcceptedConnections: 0,
  });
  const [loading, setLoading] = useState(true);

  // Search, Filter & Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [prioritySearchTerm, setPrioritySearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<'All' | 'Priority' | 'Normal'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all student profiles from 'users' collection
      const usersSnap = await getDocs(collection(db, 'users'));
      const userList: UserPublic[] = [];
      let priorityCount = 0;

      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const u = { uid: docSnap.id, ...data } as UserPublic;
        userList.push(u);
        if (u.isPriority) priorityCount++;
      });

      // Sort by priority first (true before false), then by createdAt desc
      userList.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      // Update student user list immediately so student roster displays
      setUsers(userList);
      setStats((prev) => ({
        ...prev,
        totalUsers: userList.length,
        totalPriority: priorityCount,
      }));

      // 2. Fetch requests stats in a separate try/catch block
      try {
        const requestsSnap = await getDocs(collection(db, 'requests'));
        let pendingCount = 0;
        let acceptedCount = 0;

        requestsSnap.forEach((docSnap) => {
          const status = docSnap.data()?.status;
          if (status === 'pending') pendingCount++;
          if (status === 'accepted') acceptedCount++;
        });

        setStats({
          totalUsers: userList.length,
          totalPriority: priorityCount,
          totalPendingRequests: pendingCount,
          totalAcceptedConnections: acceptedCount,
        });
      } catch (reqError) {
        console.warn('[AdminView] Requests statistics query note:', reqError);
      }
    } catch (error) {
      console.error('[AdminView] Error loading student users:', error);
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  // Toggle Priority Status for a student
  const handleTogglePriority = async (student: UserPublic) => {
    if (!currentUser) return;
    setUpdatingUid(student.uid);
    const newPriority = !student.isPriority;
    const now = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'users', student.uid), {
        isPriority: newPriority,
        priorityUpdatedAt: now,
        priorityUpdatedBy: currentUser.email || currentUser.uid,
        updatedAt: now,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === student.uid
            ? {
                ...u,
                isPriority: newPriority,
                priorityUpdatedAt: now,
                priorityUpdatedBy: currentUser.email || currentUser.uid,
              }
            : u
        )
      );

      setStats((prev) => ({
        ...prev,
        totalPriority: newPriority ? prev.totalPriority + 1 : prev.totalPriority - 1,
      }));
    } catch (error: any) {
      console.error('Error toggling priority status:', error);
      alert(`Failed to update priority status: ${error.message || error}. Please ensure you are logged in as admin@glbitm.ac.in.`);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Toggle Verification
  const toggleVerification = async (uid: string, currentStatus: boolean) => {
    setUpdatingUid(uid);
    try {
      await updateDoc(doc(db, 'users', uid), {
        isVerified: !currentStatus,
        updatedAt: new Date().toISOString(),
      });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, isVerified: !currentStatus } : u))
      );
    } catch (error) {
      console.error('Error toggling verification:', error);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Toggle Suspension
  const toggleSuspension = async (uid: string, currentSuspended: boolean) => {
    setUpdatingUid(uid);
    try {
      await updateDoc(doc(db, 'users', uid), {
        isSuspended: !currentSuspended,
        updatedAt: new Date().toISOString(),
      });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, isSuspended: !currentSuspended } : u))
      );
    } catch (error) {
      console.error('Error toggling suspension:', error);
    } finally {
      setUpdatingUid(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-amber-200">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-950 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-serif font-bold text-amber-200">Admin Access Restricted</h3>
        <p className="text-xs text-amber-100/60 mt-2 leading-relaxed">
          Only authorized GLBITM Dandiya Night organizers can access this administration portal.
        </p>
      </div>
    );
  }

  // Filtered users for "All Students" table
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.branch.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBranch = selectedBranch === 'All' || u.branch === selectedBranch;
    const matchesYear = selectedYear === 'All' || u.year === selectedYear;

    const matchesPriority =
      selectedPriorityFilter === 'All' ||
      (selectedPriorityFilter === 'Priority' && u.isPriority) ||
      (selectedPriorityFilter === 'Normal' && !u.isPriority);

    return matchesSearch && matchesBranch && matchesYear && matchesPriority;
  });

  // Priority-only list
  const priorityStudents = users.filter((u) => u.isPriority);

  // Pagination for All Students
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 text-amber-100">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-amber-500/20">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-amber-200 tracking-wide">
              Organizers Admin Console
            </h2>
          </div>
          <p className="text-xs text-amber-100/60 mt-0.5">
            GLBITM Dandiya Night 2026 • Real-time Account & Priority Management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="px-3 py-1.5 min-h-[36px] rounded-xl bg-rose-950 border border-amber-500/30 text-amber-300 hover:text-amber-100 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={logout}
            className="px-3 py-1.5 min-h-[36px] rounded-xl bg-rose-900/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900 hover:text-rose-100 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-5 border-b border-amber-500/20 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3.5 py-2 min-h-[38px] rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
            activeTab === 'dashboard'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'bg-rose-950/40 text-amber-300 hover:bg-rose-950/80 border border-amber-500/20'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('students');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-2 min-h-[38px] rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
            activeTab === 'students'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'bg-rose-950/40 text-amber-300 hover:bg-rose-950/80 border border-amber-500/20'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>All Students ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('priority')}
          className={`px-3.5 py-2 min-h-[38px] rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
            activeTab === 'priority'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30'
              : 'bg-rose-950/40 text-amber-300 hover:bg-rose-950/80 border border-amber-500/20'
          }`}
        >
          <Star className="w-4 h-4 fill-amber-400" />
          <span>Priority Accounts ({stats.totalPriority})</span>
        </button>
      </div>

      {/* 1. DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            
            <div className="p-3.5 sm:p-4 bg-[#2D0510] border border-amber-500/30 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-1.5">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-xl sm:text-2xl font-serif font-extrabold text-amber-200">{stats.totalUsers}</span>
              <span className="text-[10px] sm:text-[11px] text-amber-100/60 uppercase font-bold tracking-wider mt-0.5">
                Total Students
              </span>
            </div>

            <div className="p-3.5 sm:p-4 bg-[#2D0510] border border-amber-400/40 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 mb-1.5">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-300" />
              </div>
              <span className="text-xl sm:text-2xl font-serif font-extrabold text-amber-300">{stats.totalPriority}</span>
              <span className="text-[10px] sm:text-[11px] text-amber-300/80 uppercase font-bold tracking-wider mt-0.5">
                Priority Accounts
              </span>
            </div>

            <div className="p-3.5 sm:p-4 bg-[#2D0510] border border-amber-500/30 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-1.5">
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-xl sm:text-2xl font-serif font-extrabold text-amber-200">{stats.totalPendingRequests}</span>
              <span className="text-[10px] sm:text-[11px] text-amber-100/60 uppercase font-bold tracking-wider mt-0.5">
                Pending Requests
              </span>
            </div>

            <div className="p-3.5 sm:p-4 bg-[#2D0510] border border-amber-500/30 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1.5">
                <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-xl sm:text-2xl font-serif font-extrabold text-emerald-300">{stats.totalAcceptedConnections}</span>
              <span className="text-[10px] sm:text-[11px] text-amber-100/60 uppercase font-bold tracking-wider mt-0.5">
                Connections
              </span>
            </div>

          </div>

          {/* Quick Info Box */}
          <div className="p-4 sm:p-5 bg-[#2D0510] border border-amber-500/20 rounded-3xl space-y-2">
            <h3 className="font-serif font-bold text-amber-200 text-sm sm:text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Priority Accounts Overview</span>
            </h3>
            <p className="text-xs text-amber-100/70 leading-relaxed">
              Students added to the <strong>Priority Accounts</strong> feature appear first in candidate discovery for all other users. They receive higher visibility without altering matching rules or automatic messaging.
            </p>
          </div>
        </div>
      )}

      {/* 2. ALL STUDENTS TAB */}
      {activeTab === 'students' && (
        <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
          
          {/* Controls Header */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-serif font-bold text-amber-200 text-base sm:text-lg">
                Registered Student Directory
              </h3>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-amber-400/60" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search student name or branch..."
                  className="pl-9 pr-3 py-2 bg-rose-950/60 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none w-full sm:w-64 min-h-[38px]"
                />
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 pt-2 border-t border-amber-500/10">
              <div>
                <label className="text-[10px] text-amber-200/60 uppercase block mb-1 font-bold">Branch</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-rose-950/80 border border-amber-500/30 rounded-xl px-2 py-1.5 min-h-[36px] text-xs text-amber-200 focus:outline-none"
                >
                  <option value="All">All Branches</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-amber-200/60 uppercase block mb-1 font-bold">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-rose-950/80 border border-amber-500/30 rounded-xl px-2 py-1.5 min-h-[36px] text-xs text-amber-200 focus:outline-none"
                >
                  <option value="All">All Years</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-amber-200/60 uppercase block mb-1 font-bold">Priority Status</label>
                <select
                  value={selectedPriorityFilter}
                  onChange={(e) => {
                    setSelectedPriorityFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-rose-950/80 border border-amber-500/30 rounded-xl px-2 py-1.5 min-h-[36px] text-xs text-amber-200 focus:outline-none"
                >
                  <option value="All">All Priority</option>
                  <option value="Priority">Priority Only ⭐</option>
                  <option value="Normal">Normal Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student List Table */}
          {loading ? (
            <div className="text-center py-12 text-amber-200/60 text-xs">Loading student records...</div>
          ) : paginatedUsers.length === 0 ? (
            <div className="text-center py-12 text-amber-200/60 text-xs">No matching student profiles found.</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left text-xs min-w-[580px]">
                <thead>
                  <tr className="border-b border-amber-500/20 text-amber-300 uppercase tracking-wider text-[10px]">
                    <th className="pb-2">Student</th>
                    <th className="pb-2">Branch / Year</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {paginatedUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-rose-950/30 transition-colors">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar
                            name={u.fullName}
                            photoUrl={u.photoUrl}
                            className="w-9 h-9 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-amber-100 flex items-center gap-1">
                              <span className="truncate">{u.fullName}</span>
                              {u.isPriority && (
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                              )}
                            </span>
                            <span className="text-[10px] text-amber-200/50 block font-mono truncate max-w-[120px]">
                              {u.uid.slice(0, 10)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2 text-amber-200/80">
                        <span className="font-medium">{u.branch}</span> <br />
                        <span className="text-[10px] text-amber-200/50">{u.year}</span>
                      </td>

                      <td className="py-3 px-2">
                        {u.isPriority ? (
                          <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-300 shrink-0" />
                            <span>Priority</span>
                          </span>
                        ) : (
                          <span className="text-amber-200/40 text-[10px]">Normal</span>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        {u.isSuspended ? (
                          <span className="bg-rose-900/60 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Suspended
                          </span>
                        ) : u.isVerified ? (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Verified
                          </span>
                        ) : (
                          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px]">
                            Standard
                          </span>
                        )}
                      </td>

                      <td className="py-3 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          
                          {/* Priority Toggle Button */}
                          <button
                            onClick={() => handleTogglePriority(u)}
                            disabled={updatingUid === u.uid}
                            className={`px-2.5 py-1 min-h-[32px] rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95 ${
                              u.isPriority
                                ? 'bg-rose-950 text-amber-200 border border-amber-500/30 hover:bg-rose-900'
                                : 'bg-amber-500 text-black hover:bg-amber-400'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${u.isPriority ? '' : 'fill-black'}`} />
                            <span>{u.isPriority ? 'Remove Priority' : 'Add Priority'}</span>
                          </button>

                          {/* Verification Toggle */}
                          <button
                            onClick={() => toggleVerification(u.uid, u.isVerified)}
                            disabled={updatingUid === u.uid}
                            className={`px-2 py-1 min-h-[32px] rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                              u.isVerified
                                ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-600/80 text-white hover:bg-emerald-600'
                            }`}
                          >
                            {u.isVerified ? 'Unverify' : 'Verify'}
                          </button>

                          {/* Suspension Toggle */}
                          <button
                            onClick={() => toggleSuspension(u.uid, u.isSuspended)}
                            disabled={updatingUid === u.uid}
                            className={`px-2 py-1 min-h-[32px] rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                              u.isSuspended
                                ? 'bg-amber-500 text-black'
                                : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-amber-500/10 text-xs text-amber-200/70">
              <span>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-rose-950 border border-amber-500/20 disabled:opacity-30 hover:text-amber-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-rose-950 border border-amber-500/20 disabled:opacity-30 hover:text-amber-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 3. PRIORITY ACCOUNTS TAB */}
      {activeTab === 'priority' && (
        <div className="bg-[#2D0510] border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-amber-200 text-base sm:text-lg flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>Priority Account Roster</span>
              </h3>
              <p className="text-xs text-amber-100/60 mt-0.5">
                Students with elevated discovery placement
              </p>
            </div>
            
            <span className="px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full font-bold text-xs self-start sm:self-auto">
              {priorityStudents.length} Active Priority
            </span>
          </div>

          {/* Quick Promote / Add to Priority Tool */}
          <div className="p-3.5 sm:p-4 bg-rose-950/50 border border-amber-500/20 rounded-2xl space-y-2.5">
            <h4 className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Promote Student to Priority</span>
            </h4>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-amber-400/60" />
              <input
                type="text"
                value={prioritySearchTerm}
                onChange={(e) => setPrioritySearchTerm(e.target.value)}
                placeholder="Search non-priority student by name, email or branch to promote..."
                className="pl-9 pr-3 py-2 bg-rose-950/80 border border-amber-500/30 rounded-xl text-amber-100 text-xs focus:outline-none w-full min-h-[38px]"
              />
            </div>

            {prioritySearchTerm.trim() !== '' && (
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                {users
                  .filter(
                    (u) =>
                      !u.isPriority &&
                      (u.fullName.toLowerCase().includes(prioritySearchTerm.toLowerCase()) ||
                        (u.email && u.email.toLowerCase().includes(prioritySearchTerm.toLowerCase())) ||
                        u.branch.toLowerCase().includes(prioritySearchTerm.toLowerCase()))
                  )
                  .slice(0, 5)
                  .map((nonP) => (
                    <div
                      key={nonP.uid}
                      className="p-2.5 bg-[#21030C] border border-amber-500/20 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StudentAvatar
                          name={nonP.fullName}
                          photoUrl={nonP.photoUrl}
                          className="w-8 h-8 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-amber-100 block truncate">{nonP.fullName}</span>
                          <span className="text-[10px] text-amber-200/50 truncate block">{nonP.branch} • {nonP.year}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          handleTogglePriority(nonP);
                          setPrioritySearchTerm('');
                        }}
                        disabled={updatingUid === nonP.uid}
                        className="px-2.5 py-1.5 min-h-[32px] rounded-lg bg-amber-500 text-black font-bold text-[10px] hover:bg-amber-400 transition-colors shrink-0 active:scale-95"
                      >
                        Add to Priority ⭐
                      </button>
                    </div>
                  ))}

                {users.filter(
                  (u) =>
                    !u.isPriority &&
                    (u.fullName.toLowerCase().includes(prioritySearchTerm.toLowerCase()) ||
                      (u.email && u.email.toLowerCase().includes(prioritySearchTerm.toLowerCase())) ||
                      u.branch.toLowerCase().includes(prioritySearchTerm.toLowerCase()))
                ).length === 0 && (
                  <div className="text-[11px] text-amber-200/50 italic py-1">
                    No matching non-priority students found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Priority Students Grid */}
          {priorityStudents.length === 0 ? (
            <div className="text-center py-12 text-amber-200/60 text-xs">
              No priority accounts configured. Search above or use "All Students" tab to promote students.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {priorityStudents.map((u) => (
                <div 
                  key={u.uid}
                  className="p-3.5 sm:p-4 bg-rose-950/40 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar
                      name={u.fullName}
                      photoUrl={u.photoUrl}
                      className="w-10 h-10 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-amber-100 text-xs sm:text-sm flex items-center gap-1">
                        <span className="truncate">{u.fullName}</span>
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                      </h4>
                      <span className="text-[11px] text-amber-200/70 block truncate">
                        {u.branch} • {u.year}
                      </span>
                      {u.priorityUpdatedAt && (
                        <span className="text-[9px] text-amber-200/40 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Updated {new Date(u.priorityUpdatedAt).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleTogglePriority(u)}
                    disabled={updatingUid === u.uid}
                    className="px-3 py-1.5 min-h-[36px] rounded-xl bg-rose-950 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-900 transition-colors shrink-0 active:scale-95"
                  >
                    Remove Priority
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
