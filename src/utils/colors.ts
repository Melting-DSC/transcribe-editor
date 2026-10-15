export interface SpeakerColorTheme {
  name: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  avatarBg: string;
  avatarText: string;
  activeBorder: string;
  cardHighlight: string;
}

export const SPEAKER_COLORS: SpeakerColorTheme[] = [
  {
    name: 'blue',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    avatarBg: 'bg-blue-600',
    avatarText: 'text-white',
    activeBorder: 'border-blue-500',
    cardHighlight: 'bg-blue-50/30 dark:bg-blue-950/20',
  },
  {
    name: 'emerald',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    avatarBg: 'bg-emerald-600',
    avatarText: 'text-white',
    activeBorder: 'border-emerald-500',
    cardHighlight: 'bg-emerald-50/30 dark:bg-emerald-950/20',
  },
  {
    name: 'purple',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    avatarBg: 'bg-purple-600',
    avatarText: 'text-white',
    activeBorder: 'border-purple-500',
    cardHighlight: 'bg-purple-50/30 dark:bg-purple-950/20',
  },
  {
    name: 'amber',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    avatarBg: 'bg-amber-600',
    avatarText: 'text-white',
    activeBorder: 'border-amber-500',
    cardHighlight: 'bg-amber-50/30 dark:bg-amber-950/20',
  },
  {
    name: 'rose',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800',
    avatarBg: 'bg-rose-600',
    avatarText: 'text-white',
    activeBorder: 'border-rose-500',
    cardHighlight: 'bg-rose-50/30 dark:bg-rose-950/20',
  },
  {
    name: 'cyan',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-200 dark:border-cyan-800',
    avatarBg: 'bg-cyan-600',
    avatarText: 'text-white',
    activeBorder: 'border-cyan-500',
    cardHighlight: 'bg-cyan-50/30 dark:bg-cyan-950/20',
  },
  {
    name: 'indigo',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800',
    avatarBg: 'bg-indigo-600',
    avatarText: 'text-white',
    activeBorder: 'border-indigo-500',
    cardHighlight: 'bg-indigo-50/30 dark:bg-indigo-950/20',
  },
  {
    name: 'teal',
    badgeBg: 'bg-teal-50 dark:bg-teal-950/40',
    badgeText: 'text-teal-700 dark:text-teal-300',
    badgeBorder: 'border-teal-200 dark:border-teal-800',
    avatarBg: 'bg-teal-600',
    avatarText: 'text-white',
    activeBorder: 'border-teal-500',
    cardHighlight: 'bg-teal-50/30 dark:bg-teal-950/20',
  },
];

// Returns consistent color theme for a speaker name
export function getSpeakerColorTheme(speaker: string, speakerList?: string[]): SpeakerColorTheme {
  if (!speaker) return SPEAKER_COLORS[0];
  
  if (speakerList && speakerList.length > 0) {
    const idx = speakerList.indexOf(speaker);
    if (idx !== -1) {
      return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
    }
  }

  // Hash the speaker string to a color index
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = (hash << 5) - hash + speaker.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  return SPEAKER_COLORS[positiveHash % SPEAKER_COLORS.length];
}
