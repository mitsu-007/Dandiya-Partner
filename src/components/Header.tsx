import React, { useState } from 'react';
import { Sparkles, Bell, Shield, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationsModal } from './NotificationsModal';
import { StudentAvatar } from './StudentAvatar';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, userPublic, isAdmin, unreadNotificationsCount, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#2D0510]/90 backdrop-blur-md border-b border-amber-500/20 px-3 sm:px-4 py-2.5 sm:py-3 text-[#FAF0E6] transition-all">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          
          {/* Logo & Title */}
          <div 
            onClick={() => setActiveTab(isAdmin ? 'admin' : 'discover')}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-600 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              <div className="w-full h-full bg-[#3B0918] rounded-full flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <h1 className="font-serif font-bold text-base sm:text-lg md:text-xl text-amber-200 tracking-wide truncate">
                  Garba Saathi
                </h1>
                <span className="text-[9px] sm:text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  GLBITM
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-amber-200/70 font-sans -mt-0.5 hidden xs:block">
                Simple Dandiya Partner Finder
              </p>
            </div>
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Admin Badge */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all active:scale-95 ${
                  activeTab === 'admin'
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30 font-bold'
                    : 'bg-rose-900/40 text-amber-300 border border-amber-500/30 hover:bg-rose-900/60'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}

            {/* Notification Bell */}
            {userPublic && (
              <button
                onClick={() => setShowNotifications(true)}
                className="relative p-2 rounded-full bg-rose-950/70 border border-amber-500/20 hover:border-amber-400 text-amber-200 hover:text-amber-300 transition-colors active:scale-95 min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-rose-600 text-white font-bold text-[9px] sm:text-[10px] rounded-full flex items-center justify-center animate-bounce shadow-md">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Profile Avatar / User Sign In button */}
            {userPublic ? (
              <div 
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-1.5 cursor-pointer p-1 rounded-full hover:bg-amber-500/10 transition-colors active:scale-95"
              >
                <StudentAvatar
                  name={userPublic.fullName}
                  photoUrl={userPublic.photoUrl}
                  className="w-7 h-7 sm:w-8 sm:h-8"
                  textSize="text-[10px] sm:text-xs"
                />
                <span className="text-xs font-medium text-amber-100 hidden md:inline max-w-[90px] truncate">
                  {userPublic.fullName.split(' ')[0]}
                </span>
              </div>
            ) : currentUser ? (
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-rose-900/40 border border-amber-500/30 text-amber-200 text-[11px] sm:text-xs font-semibold hover:bg-rose-900/80 transition-colors active:scale-95"
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="max-w-[80px] sm:max-w-[100px] truncate">{currentUser.email?.split('@')[0] || 'Account'}</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold text-xs shadow-md shadow-amber-500/20 hover:brightness-110 active:scale-95"
              >
                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Sign In</span>
              </button>
            )}

            {/* Logout Button */}
            {currentUser && (
              <button
                onClick={logout}
                className="p-2 rounded-full bg-rose-950/70 border border-rose-500/30 text-rose-300 hover:text-rose-100 hover:bg-rose-900/60 transition-colors active:scale-95 min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notifications Drawer */}
      {showNotifications && (
        <NotificationsModal onClose={() => setShowNotifications(false)} />
      )}
    </>
  );
};
