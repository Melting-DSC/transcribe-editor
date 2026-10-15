export interface TranscriptSegment {
  id: number;
  timestamp: string;
  speaker: string;
  text: string;
}

export interface SpeakerInfo {
  name: string;
  count: number;
  colorIndex: number;
  characterCount: number;
}

export interface AudioState {
  file: File | null;
  name: string;
  url: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  isRecorded: boolean;
}
