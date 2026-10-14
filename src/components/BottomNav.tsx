import React from 'react';
import { Compass, Send, Users, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { pendingReceivedRequestsCount } = useAuth();

  const navItems = [
    {
      id: 'discover',
      label: 'Discover',
      icon: Compass,
      badge: 0,
    },
    {
      id: 'requests',
      label: 'Requests',
      icon: Send,
      badge: pendingReceivedRequestsCount,
    },
    {
      id: 'connections',
      label: 'Connections',
      icon: Users,
      badge: 0,
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: User,
      badge: 0,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#21030C]/95 backdrop-blur-lg border-t border-amber-500/20 px-2 sm:px-3 py-1.5 sm:py-2 text-[#FAF0E6] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-1 px-2 sm:px-3 min-w-[56px] min-h-[48px] rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-amber-300 font-bold scale-105'
                  : 'text-amber-200/50 hover:text-amber-200'
              }`}
              aria-label={item.label}
            >
              {/* Glow backdrop for active tab */}
              {isActive && (
                <div className="absolute inset-0 bg-amber-500/15 rounded-2xl blur-sm -z-10" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white font-bold text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center animate-pulse">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] sm:text-[11px] tracking-tight leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
