import React from 'react';

export const FestiveDecorations: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Radial Gold Glow Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-amber-500/15 via-rose-500/5 to-transparent blur-3xl rounded-full" />
      <div className="absolute -bottom-32 right-0 w-[500px] h-[500px] bg-amber-600/10 blur-3xl rounded-full" />
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-purple-600/10 blur-3xl rounded-full" />

      {/* Subtle Dandiya Cross Motif in Corners */}
      <div className="absolute top-4 right-4 opacity-15 hover:opacity-30 transition-opacity">
        <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
          <line x1="10" y1="90" x2="90" y2="10" stroke="#D4AF37" strokeWidth="6" strokeLinecap="round" />
          <line x1="10" y1="10" x2="90" y2="90" stroke="#E6C200" strokeWidth="6" strokeLinecap="round" />
          <circle cx="50" cy="50" r="12" fill="#E11D48" />
        </svg>
      </div>

      <div className="absolute top-4 left-4 opacity-15 hover:opacity-30 transition-opacity">
        <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
          <line x1="10" y1="90" x2="90" y2="10" stroke="#D4AF37" strokeWidth="6" strokeLinecap="round" />
          <line x1="10" y1="10" x2="90" y2="90" stroke="#E6C200" strokeWidth="6" strokeLinecap="round" />
          <circle cx="50" cy="50" r="12" fill="#9333EA" />
        </svg>
      </div>
    </div>
  );
};
