import React, { useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  FastForward,
  Compass,
  Keyboard,
} from 'lucide-react';
import { formatSecondsToTimestamp, PLAYBACK_RATES } from '../utils/time';

interface AudioPlayerBarProps {
  audioUrl: string | null;
  audioName: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  autoScroll: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleAutoScroll: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioUrl,
  audioName,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  autoScroll,
  onPlayPause,
  onSeek,
  onPlaybackRateChange,
  onToggleAutoScroll,
  audioRef,
}) => {
  const [volume, setVolume] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioRef]);

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(duration || 0, audioRef.current.currentTime + seconds));
      audioRef.current.currentTime = newTime;
      onSeek(newTime);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    onSeek(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audioUrl) return null;

  return (
    <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-2xl px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        {/* Progress scrub bar */}
        <div className="flex items-center gap-3 text-xs font-mono text-gray-500 dark:text-gray-400">
          <span className="w-12 text-right">{formatSecondsToTimestamp(currentTime)}</span>
          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer relative group overflow-hidden"
          >
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-[width] duration-75 group-hover:bg-blue-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-12">{formatSecondsToTimestamp(duration)}</span>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* File info */}
          <div className="flex items-center gap-2 min-w-0 max-w-xs sm:max-w-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={audioName}>
              {audioName || '音声ファイル'}
            </span>
          </div>

          {/* Main playback buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => handleSkip(-5)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
              title="5秒巻き戻し"
              aria-label="5秒巻き戻し"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onPlayPause}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md hover:shadow-lg transition transform active:scale-95 flex items-center justify-center"
              title={isPlaying ? '一時停止' : '再生'}
              aria-label={isPlaying ? '一時停止' : '再生'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => handleSkip(5)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
              title="5秒早送り"
              aria-label="5秒早送り"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Playback speed selector */}
            <div className="relative flex items-center ml-2 border-l border-gray-200 dark:border-gray-700 pl-2">
              <span className="text-xs text-gray-500 mr-1 hidden sm:inline">速度:</span>
              <select
                value={playbackRate}
                onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
                className="text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-1.5 py-1 text-gray-700 dark:text-gray-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional controls (Volume & Auto-scroll & Shortcut Hint) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Keyboard shortcut hint badge */}
            <div
              className="hidden lg:flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded-lg"
              title="ショートカットキー: Space (再生/一時停止), ←/→ (±5秒), </> (速度変更) ※テキスト入力欄外で動作"
            >
              <Keyboard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="font-mono">Space: 再生/停止</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="font-mono">←/→: ±5秒</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="font-mono">&lt;/&gt;: 速度</span>
            </div>
            {/* Auto scroll toggle */}
            <button
              onClick={onToggleAutoScroll}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition ${
                autoScroll
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-medium'
                  : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="再生中の発言に自動追従してスクロールします"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">自動追従</span>
            </button>

            {/* Volume slider */}
            <div className="hidden md:flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1"
                aria-label="ミュート切替"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
