import React, { useState, useEffect } from 'react';
import { getOptimizedCloudinaryUrl } from '../utils/cloudinary';

interface StudentAvatarProps {
  name?: string;
  photoUrl?: string | null;
  className?: string;
  textSize?: string;
  showBorder?: boolean;
}

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'GS';
  const clean = name.trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  name = '',
  photoUrl,
  className = 'w-12 h-12',
  textSize,
  showBorder = true,
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state if photoUrl changes
  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  const initials = getInitials(name);
  const hasValidPhoto = photoUrl && photoUrl.trim() !== '' && !imageError;

  const borderClass = showBorder ? 'border-2 border-amber-400/80 shadow-md' : '';

  if (hasValidPhoto) {
    const optimizedSrc = getOptimizedCloudinaryUrl(photoUrl);
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 bg-[#2D0510] ${className} ${borderClass}`}>
        <img
          src={optimizedSrc}
          alt={name || 'Student Avatar'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full shrink-0 bg-[#2D0510] ${borderClass} ${className} flex items-center justify-center text-amber-300 font-serif font-bold tracking-wider select-none shadow-inner`}
      title={name}
    >
      <span className={textSize || 'text-sm'}>{initials}</span>
    </div>
  );
};
