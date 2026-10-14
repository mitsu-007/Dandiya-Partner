import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { FestiveDecorations } from './components/FestiveDecorations';
import { AuthFlow } from './components/auth/AuthFlow';
import { DiscoverView } from './views/DiscoverView';
import { RequestsView } from './views/RequestsView';
import { ConnectionsView } from './views/ConnectionsView';
import { ProfileView } from './views/ProfileView';
import { AdminView } from './views/AdminView';
import { Sparkles } from 'lucide-react';

function AppContent() {
  const { currentUser, userPublic, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('discover');

  // Set default tab to admin when logged in as pure admin account
  useEffect(() => {
    if (currentUser && isAdmin && !userPublic) {
      setActiveTab('admin');
    }
  }, [currentUser, isAdmin, userPublic]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2D0510] text-[#FAF0E6] flex flex-col items-center justify-center">
        <Sparkles className="w-10 h-10 text-amber-400 animate-spin mb-3" />
        <p className="text-xs font-serif font-bold text-amber-200 tracking-wider">
          GARBA SAATHI GLBITM
        </p>
      </div>
    );
  }

  // If user is not logged in OR has an incomplete student profile
  if (!currentUser || (!userPublic && !isAdmin)) {
    return (
      <div className="min-h-screen bg-[#2D0510] text-[#FAF0E6] flex flex-col justify-between relative overflow-hidden font-sans">
        <FestiveDecorations />
        
        <header className="p-4 text-center border-b border-amber-500/15 bg-[#21030C]/60 backdrop-blur-sm z-10">
          <h1 className="font-serif font-bold text-lg text-amber-200">
            Garba Saathi <span className="text-xs text-amber-400 font-sans">| GLBITM</span>
          </h1>
        </header>

        <div className="flex-1 flex items-center justify-center">
          <AuthFlow onSuccess={() => setActiveTab(isAdmin ? 'admin' : 'discover')} />
        </div>

        <footer className="py-4 text-center text-[11px] text-amber-200/40 border-t border-amber-500/10 z-10">
          GLBITM Dandiya Night 2026 • Simple Dandiya Partner Finder
        </footer>
      </div>
    );
  }

  // Determine effective tab to show
  const effectiveTab = (isAdmin && !userPublic && (activeTab === 'discover' || activeTab === 'requests' || activeTab === 'connections'))
    ? 'admin'
    : activeTab;

  return (
    <div className="min-h-screen bg-[#2D0510] text-[#FAF0E6] flex flex-col relative overflow-x-hidden font-sans">
      <FestiveDecorations />

      {/* Top Header */}
      <Header activeTab={effectiveTab} setActiveTab={setActiveTab} />

      {/* Main View Container */}
      <main className="flex-1 z-10">
        {effectiveTab === 'admin' && <AdminView />}
        
        {effectiveTab === 'discover' && (
          <DiscoverView onNavigateToRequests={() => setActiveTab('requests')} />
        )}
        
        {effectiveTab === 'requests' && (
          <RequestsView onNavigateToConnections={() => setActiveTab('connections')} />
        )}
        
        {effectiveTab === 'connections' && <ConnectionsView />}
        
        {effectiveTab === 'profile' && <ProfileView />}
      </main>

      {/* Mobile & Desktop Bottom Navigation */}
      <BottomNav activeTab={effectiveTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
