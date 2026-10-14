export type DanceVibe =
  | 'Beginner'
  | 'Full Energy'
  | 'Traditional'
  | 'Bollywood Garba'
  | 'Just Here for Photos';

export type LookingFor =
  | 'Dandiya Partner'
  | 'Garba Group'
  | 'Teach Me Steps';

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface UserPublic {
  uid: string;
  fullName: string;
  branch: string;
  year: string;
  outfitColor: string;
  photoUrl: string;
  prompt: string;
  danceVibe: DanceVibe;
  lookingFor: LookingFor;
  isVerified: boolean;
  isPublic: boolean;
  isSuspended: boolean;
  isPriority?: boolean;
  priorityRank?: number;
  priorityUpdatedAt?: string;
  priorityUpdatedBy?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPrivate {
  email: string;
  whatsapp: string;
  instagram: string;
  shareWhatsapp: boolean;
  shareInstagram: boolean;
  blockedUids: string[];
  skippedUids: string[];
}

export interface PartnerRequest {
  id: string;
  senderUid: string;
  recipientUid: string;
  status: RequestStatus;
  senderShareContacts: boolean;
  recipientShareContacts: boolean;
  createdAt: string;
  respondedAt?: string;
  // Hydrated details for UI
  senderProfile?: UserPublic;
  recipientProfile?: UserPublic;
  senderPrivateContact?: {
    whatsapp?: string;
    instagram?: string;
  };
  recipientPrivateContact?: {
    whatsapp?: string;
    instagram?: string;
  };
}

export interface SharedContact {
  ownerUid?: string;
  senderUid?: string;
  recipientUid?: string;
  whatsapp?: string;
  senderWhatsapp?: string;
  recipientWhatsapp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'request_received' | 'request_accepted' | 'request_rejected' | 'system';
  read: boolean;
  createdAt: string;
}

export const BRANCHES = [
  'Computer Science (CSE)',
  'Information Technology (IT)',
  'Electronics & Comm (ECE)',
  'AI & Data Science (AI/DS)',
  'Mechanical Eng (ME)',
  'Civil Eng (CE)',
  'MCA',
  'MBA',
  'Other',
];

export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export const DANCE_VIBES: DanceVibe[] = [
  'Beginner',
  'Full Energy',
  'Traditional',
  'Bollywood Garba',
  'Just Here for Photos',
];

export const LOOKING_FOR_OPTIONS: LookingFor[] = [
  'Dandiya Partner',
  'Garba Group',
  'Teach Me Steps',
];

export const OUTFIT_COLORS = [
  { name: 'Royal Blue', bg: 'bg-blue-600', text: 'text-white' },
  { name: 'Deep Red', bg: 'bg-red-700', text: 'text-white' },
  { name: 'Golden Yellow', bg: 'bg-amber-500', text: 'text-black' },
  { name: 'Emerald Green', bg: 'bg-emerald-600', text: 'text-white' },
  { name: 'Vibrant Pink', bg: 'bg-pink-600', text: 'text-white' },
  { name: 'Purple Magic', bg: 'bg-purple-600', text: 'text-white' },
  { name: 'Cream & Gold', bg: 'bg-amber-100', text: 'text-amber-900' },
  { name: 'Jet Black', bg: 'bg-zinc-800', text: 'text-gold-300' },
  { name: 'Multicolor Festive', bg: 'bg-gradient-to-r from-pink-500 via-amber-500 to-purple-500', text: 'text-white' },
];

export const DANDIYA_PROMPT_SUGGESTIONS = [
  'My favorite Garba song to spin on is...',
  'If you can match my 2-step Dandiya speed, then...',
  'Looking for someone who will help me get the best photos in my outfit!',
  'I may not know all 64 steps, but I bring 100% enthusiasm!',
  'Best snack break buddy for jalebi and fafda during Garba!',
];

export const DEFAULT_AVATARS: string[] = [];
