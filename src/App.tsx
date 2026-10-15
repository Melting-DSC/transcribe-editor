/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Mic,
  FileSpreadsheet,
  Users,
  Sparkles,
  Download,
  AlertCircle,
  Volume2,
  CheckCircle2,
  Info,
  Upload,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  FastForward,
} from 'lucide-react';
import { TranscriptSegment } from './types';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AudioInputSection } from './components/AudioInputSection';
import { UtteranceCard } from './components/UtteranceCard';
import { Toolbar } from './components/Toolbar';
import { SpeakerManagerModal } from './components/SpeakerManagerModal';
import { CsvPreviewModal } from './components/CsvPreviewModal';
import { CsvImportModal } from './components/CsvImportModal';
import {
  parseTimestampToSeconds,
  parseRangeToSeconds,
  PLAYBACK_RATES,
  getNextSlowerRate,
  getNextFasterRate,
} from './utils/time';
import { SAMPLE_TRANSCRIPT_1, generateTestAudioBlob } from './utils/sampleData';

const STORAGE_KEY_SEGMENTS = 'transcription_editor_segments';
const STORAGE_KEY_IMPORTED_AUDIO_FILE = 'transcription_editor_imported_audio_file';
const STORAGE_KEY_LAST_SAVED = 'transcription_editor_last_saved';

// Maximum number of undo steps kept in memory
const HISTORY_LIMIT = 200;

// Re-indexes IDs to be strictly sequential integers starting from 1
const normalizeSegments = (list: TranscriptSegment[]): TranscriptSegment[] =>
  list.map((s, idx) => ({ ...s, id: idx + 1 }));

export default function App() {
  // Main transcript state initialized from localStorage if available
  const [segments, setSegments] = useState<TranscriptSegment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SEGMENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load initial segments from localStorage:', e);
    }
    return SAMPLE_TRANSCRIPT_1;
  });

  // Always-current mirror of `segments` for history snapshots and debounced saves
  const segmentsRef = useRef<TranscriptSegment[]>(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Undo / Redo history. Kept in a ref so that reads and writes stay synchronous
  // (avoids stale-closure bugs); a small piece of state mirrors it for rendering.
  const historyRef = useRef<{ entries: TranscriptSegment[][]; index: number }>({
    entries: [segments],
    index: 0,
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Debounce timer for coalescing a burst of text edits into one undo step
  const textHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextEditRef = useRef(false);
  useEffect(() => () => {
    if (textHistoryTimerRef.current) clearTimeout(textHistoryTimerRef.current);
  }, []);

  // Audio player state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // NOTE: an audio file cannot be persisted in localStorage, so we never restore a
  // previous file's label as if it were still loaded. This always reflects the audio
  // currently in memory (the demo tone until the user re-attaches a file).
  const [audioName, setAudioName] = useState<string>('デモ音声 (佐藤・高橋の会話)');
  const [importedAudioFileName, setImportedAudioFileName] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_IMPORTED_AUDIO_FILE);
    } catch (e) {
      return null;
    }
  });
  // Shown on load when a previously imported audio file is no longer attached
  const [isAudioRelinkNoticeVisible, setIsAudioRelinkNoticeVisible] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY_IMPORTED_AUDIO_FILE);
    } catch (e) {
      return false;
    }
  });
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_SAVED);
    } catch (e) {
      return null;
    }
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);

  // Filter / Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeakerFilter, setSelectedSpeakerFilter] = useState('');

  // Modals
  const [isSpeakerModalOpen, setIsSpeakerModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);

  // Processing & Error states
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Shortcut HUD Toast
  const [shortcutHud, setShortcutHud] = useState<{
    text: string;
    icon: React.ReactNode;
  } | null>(null);
  const shortcutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showShortcutHud = useCallback((text: string, icon: React.ReactNode) => {
    if (shortcutTimerRef.current) {
      clearTimeout(shortcutTimerRef.current);
    }
    setShortcutHud({ text, icon });
    shortcutTimerRef.current = setTimeout(() => {
      setShortcutHud(null);
    }, 1200);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Object URL currently loaded into the audio element. Lets us tell "a different
  // audio file was attached" apart from "the effect merely re-ran".
  const loadedAudioUrlRef = useRef<string | null>(null);
  // Hidden picker used by the "re-attach audio" notice banner.
  const relinkAudioInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-save segments to localStorage on any change (text, timestamp, speaker, add, delete, import)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SEGMENTS, JSON.stringify(segments));
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      localStorage.setItem(STORAGE_KEY_LAST_SAVED, timeStr);
      setLastSavedTime(timeStr);
    } catch (e) {
      console.warn('Failed to auto-save segments to localStorage:', e);
    }
  }, [segments]);

  // Persist importedAudioFileName (used for the CSV export filename default)
  useEffect(() => {
    try {
      if (importedAudioFileName) {
        localStorage.setItem(STORAGE_KEY_IMPORTED_AUDIO_FILE, importedAudioFileName);
      } else {
        localStorage.removeItem(STORAGE_KEY_IMPORTED_AUDIO_FILE);
      }
    } catch (e) {}
  }, [importedAudioFileName]);

  // Synchronous auto-save on beforeunload to prevent any data loss on window close / refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(STORAGE_KEY_SEGMENTS, JSON.stringify(segments));
        if (importedAudioFileName) {
          localStorage.setItem(STORAGE_KEY_IMPORTED_AUDIO_FILE, importedAudioFileName);
        }
      } catch (e) {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [segments, importedAudioFileName]);

  // On initial mount, prepare initial synthetic audio for sample demo if no audio attached
  useEffect(() => {
    try {
      if (!audioUrl) {
        const initialAudio = generateTestAudioBlob(65);
        const url = URL.createObjectURL(initialAudio);
        setAudioUrl(url);
      }
    } catch (e) {
      console.warn('Initial audio synthesis skipped', e);
    }
  }, []);

  // Sync HTMLAudioElement with the attached audio source.
  //
  // Whenever a *different* audio file is attached we reload the element and must
  // also reset the transport state explicitly: `HTMLMediaElement.load()` pauses
  // playback without firing a `pause` event, so without this the `isPlaying` flag
  // (and the play/pause button + scrubber) would keep reflecting the previous
  // track, leaving the newly attached audio apparently unplayable.
  useEffect(() => {
    // No audio attached anymore: make sure nothing keeps playing in the background.
    if (!audioUrl) {
      loadedAudioUrlRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setCurrentTime(0);
      setIsPlaying(false);
      setDuration(0);
      return;
    }

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;

      const el = audio;
      el.onloadedmetadata = () => {
        setDuration(el.duration || 0);
      };

      el.ontimeupdate = () => {
        setCurrentTime(el.currentTime);
      };

      el.onended = () => {
        setIsPlaying(false);
      };

      el.onplay = () => setIsPlaying(true);
      el.onpause = () => setIsPlaying(false);
    }

    if (loadedAudioUrlRef.current === audioUrl) return;
    loadedAudioUrlRef.current = audioUrl;

    audio.pause();
    audio.src = audioUrl;
    audio.load();
    // Reset the transport UI for the new track.
    setCurrentTime(0);
    setIsPlaying(false);
    setDuration(0);
  }, [audioUrl]);

  // Derived list of distinct speakers
  const speakerList = useMemo(() => {
    const speakers = new Set<string>();
    segments.forEach((s) => {
      if (s.speaker && s.speaker.trim()) {
        speakers.add(s.speaker.trim());
      }
    });
    return Array.from(speakers);
  }, [segments]);

  // Mirror the history ref into state so the toolbar buttons re-render
  const syncHistoryFlags = useCallback(() => {
    const h = historyRef.current;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.entries.length - 1);
  }, []);

  // Appends a snapshot to the undo stack, truncating any redo branch and
  // capping the stack at HISTORY_LIMIT entries.
  const pushHistory = useCallback((snapshot: TranscriptSegment[]) => {
    const h = historyRef.current;
    const entries = h.entries.slice(0, h.index + 1);
    entries.push(snapshot);
    let index = entries.length - 1;
    if (entries.length > HISTORY_LIMIT) {
      const overflow = entries.length - HISTORY_LIMIT;
      entries.splice(0, overflow);
      index -= overflow;
    }
    historyRef.current = { entries, index };
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  // Commits any pending (debounced) text edit as a single undo step
  const flushPendingHistory = useCallback(() => {
    if (textHistoryTimerRef.current) {
      clearTimeout(textHistoryTimerRef.current);
      textHistoryTimerRef.current = null;
    }
    if (pendingTextEditRef.current) {
      pendingTextEditRef.current = false;
      pushHistory(segmentsRef.current);
    }
  }, [pushHistory]);

  // Coalesces a burst of keystrokes into one undo step
  const scheduleTextHistory = useCallback(() => {
    pendingTextEditRef.current = true;
    if (textHistoryTimerRef.current) {
      clearTimeout(textHistoryTimerRef.current);
    }
    textHistoryTimerRef.current = setTimeout(() => {
      textHistoryTimerRef.current = null;
      if (pendingTextEditRef.current) {
        pendingTextEditRef.current = false;
        pushHistory(segmentsRef.current);
      }
    }, 600);
  }, [pushHistory]);

  // Helper to commit a structural state change with undo history
  const commitSegmentsChange = useCallback((newSegments: TranscriptSegment[]) => {
    // Flush a pending text edit first so it becomes its own undo step
    flushPendingHistory();

    const normalized = normalizeSegments(newSegments);
    segmentsRef.current = normalized;
    setSegments(normalized);
    pushHistory(normalized);
  }, [flushPendingHistory, pushHistory]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    flushPendingHistory();
    const h = historyRef.current;
    if (h.index <= 0) return;
    const index = h.index - 1;
    const target = h.entries[index];
    historyRef.current = { ...h, index };
    segmentsRef.current = target;
    setSegments(target);
    syncHistoryFlags();
  }, [flushPendingHistory, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    flushPendingHistory();
    const h = historyRef.current;
    if (h.index >= h.entries.length - 1) return;
    const index = h.index + 1;
    const target = h.entries[index];
    historyRef.current = { ...h, index };
    segmentsRef.current = target;
    setSegments(target);
    syncHistoryFlags();
  }, [flushPendingHistory, syncHistoryFlags]);

  // Segment operations
  const handleUpdateText = useCallback((id: number, text: string) => {
    const next = segmentsRef.current.map((s) => (s.id === id ? { ...s, text } : s));
    segmentsRef.current = next;
    setSegments(next);
    scheduleTextHistory();
  }, [scheduleTextHistory]);

  const handleUpdateSpeaker = useCallback((id: number, speaker: string) => {
    commitSegmentsChange(
      segments.map((s) => (s.id === id ? { ...s, speaker } : s))
    );
  }, [segments, commitSegmentsChange]);

  const handleUpdateTimestamp = useCallback((id: number, timestamp: string) => {
    commitSegmentsChange(
      segments.map((s) => (s.id === id ? { ...s, timestamp } : s))
    );
  }, [segments, commitSegmentsChange]);

  const handleDeleteSegment = useCallback((id: number) => {
    if (segments.length <= 1) {
      alert('これ以上発言を削除できません。');
      return;
    }
    commitSegmentsChange(segments.filter((s) => s.id !== id));
  }, [segments, commitSegmentsChange]);

  const handleInsertBelow = useCallback((id: number) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const current = segments[idx];
    const newSegment: TranscriptSegment = {
      id: id + 1,
      timestamp: current.timestamp,
      speaker: current.speaker,
      text: '',
    };
    const nextList = [...segments];
    nextList.splice(idx + 1, 0, newSegment);
    commitSegmentsChange(nextList);
  }, [segments, commitSegmentsChange]);

  const handleMergeWithNext = useCallback((id: number) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx === -1 || idx >= segments.length - 1) return;

    const current = segments[idx];
    const next = segments[idx + 1];

    const currentRange = parseRangeToSeconds(current.timestamp);
    const nextRange = parseRangeToSeconds(next.timestamp);
    const mergedTs = `${current.timestamp.split('-')[0].trim()} - ${
      next.timestamp.includes('-')
        ? next.timestamp.split('-')[1].trim()
        : next.timestamp
    }`;

    const mergedSegment: TranscriptSegment = {
      ...current,
      timestamp: mergedTs,
      text: `${current.text} ${next.text}`.trim(),
    };

    const nextList = [...segments];
    nextList.splice(idx, 2, mergedSegment);
    commitSegmentsChange(nextList);
  }, [segments, commitSegmentsChange]);

  const handleSplitSegment = useCallback((id: number, cursorIndex: number) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const current = segments[idx];
    const text1 = current.text.slice(0, cursorIndex).trim();
    const text2 = current.text.slice(cursorIndex).trim();

    const seg1: TranscriptSegment = { ...current, text: text1 };
    const seg2: TranscriptSegment = {
      id: current.id + 1,
      timestamp: current.timestamp,
      speaker: current.speaker,
      text: text2,
    };

    const nextList = [...segments];
    nextList.splice(idx, 1, seg1, seg2);
    commitSegmentsChange(nextList);
  }, [segments, commitSegmentsChange]);

  const handleAddSegmentAtBottom = useCallback(() => {
    const last = segments[segments.length - 1];
    const newSegment: TranscriptSegment = {
      id: segments.length + 1,
      timestamp: last ? last.timestamp : '00:00',
      speaker: last ? last.speaker : '話者1',
      text: '',
    };
    commitSegmentsChange([...segments, newSegment]);
  }, [segments, commitSegmentsChange]);

  // Batch rename speaker
  const handleBatchRenameSpeaker = useCallback((oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const updated = segments.map((s) =>
      s.speaker === oldName ? { ...s, speaker: newName.trim() } : s
    );
    commitSegmentsChange(updated);
    setSuccessMessage(`話者「${oldName}」を「${newName}」に一括変更しました。`);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, [segments, commitSegmentsChange]);

  // Merge two speakers
  const handleMergeSpeakers = useCallback((sourceName: string, targetName: string) => {
    if (!sourceName || !targetName || sourceName === targetName) return;
    const updated = segments.map((s) =>
      s.speaker === sourceName ? { ...s, speaker: targetName } : s
    );
    commitSegmentsChange(updated);
    setSuccessMessage(`話者「${sourceName}」を「${targetName}」に統合しました。`);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, [segments, commitSegmentsChange]);

  // Audio seek & play
  const handlePlayTimestamp = useCallback((ts: string) => {
    const seconds = parseTimestampToSeconds(ts);
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(console.warn);
      setIsPlaying(true);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Derive the action from the element itself (same as the space-bar shortcut)
    // so the button can never end up out of sync with actual playback.
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(console.warn);
      setIsPlaying(true);
    }
  }, []);

  // Determine active utterance for audio sync
  const activeSegmentId = useMemo(() => {
    if (!isPlaying && currentTime === 0) return null;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const range = parseRangeToSeconds(seg.timestamp);
      const nextSeg = segments[i + 1];
      const nextStart = nextSeg ? parseTimestampToSeconds(nextSeg.timestamp) : Infinity;

      const segStart = range.start;
      const segEnd = range.end !== null ? range.end : nextStart;

      if (currentTime >= segStart && currentTime < segEnd) {
        return seg.id;
      }
    }
    return null;
  }, [currentTime, isPlaying, segments]);

  // Auto-scroll to active utterance
  useEffect(() => {
    if (autoScroll && activeSegmentId !== null && isPlaying) {
      const el = document.getElementById(`utterance-${activeSegmentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSegmentId, autoScroll, isPlaying]);

  // Keyboard shortcuts (Space: play/pause, ArrowLeft: -5s, ArrowRight: +5s, <: slower, >: faster)
  // Only active when cursor is NOT inside a textarea, input, select, or editable element
  useEffect(() => {
    const isEditableElement = (el: Element | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'input' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      if (typeof el.closest === 'function' && el.closest('textarea, input, select, [contenteditable="true"]')) {
        return true;
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts if user is typing in a textarea, input, select, or editable element
      if (isEditableElement(e.target as Element) || isEditableElement(document.activeElement)) {
        return;
      }

      // Do not trigger shortcuts if modals are open
      if (isSpeakerModalOpen || isCsvModalOpen || isCsvImportModalOpen) {
        return;
      }

      // 1. Space: 音声の一時停止 / 再開
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (audioRef.current) {
          if (!audioRef.current.paused) {
            audioRef.current.pause();
            setIsPlaying(false);
            showShortcutHud('一時停止', <Pause className="w-4 h-4 fill-current" />);
          } else {
            audioRef.current.play().catch(console.warn);
            setIsPlaying(true);
            showShortcutHud('再生', <Play className="w-4 h-4 fill-current" />);
          }
        }
        return;
      }

      // 2. Arrow Left: 5秒戻る
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (audioRef.current) {
          const cur = audioRef.current.currentTime || 0;
          const newTime = Math.max(0, cur - 5);
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          showShortcutHud('5秒戻る (-5秒)', <RotateCcw className="w-4 h-4" />);
        }
        return;
      }

      // 3. Arrow Right: 5秒進む
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (audioRef.current) {
          const cur = audioRef.current.currentTime || 0;
          const max = audioRef.current.duration || duration || Infinity;
          const newTime = Math.min(max, cur + 5);
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          showShortcutHud('5秒進む (+5秒)', <RotateCw className="w-4 h-4" />);
        }
        return;
      }

      // 4. <: 速度を1段階低速にする
      const isLessKey =
        e.key === '<' ||
        (e.shiftKey && (e.key === ',' || e.code === 'Comma')) ||
        (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === ',' || e.code === 'Comma'));

      if (isLessKey) {
        e.preventDefault();
        setPlaybackRate((prevRate) => {
          const slowerRate = getNextSlowerRate(prevRate);
          if (audioRef.current) {
            audioRef.current.playbackRate = slowerRate;
          }
          showShortcutHud(`速度: ${slowerRate}x`, <FastForward className="w-4 h-4" />);
          return slowerRate;
        });
        return;
      }

      // 5. >: 速度を1段階高速にする
      const isGreaterKey =
        e.key === '>' ||
        (e.shiftKey && (e.key === '.' || e.code === 'Period')) ||
        (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === '.' || e.code === 'Period'));

      if (isGreaterKey) {
        e.preventDefault();
        setPlaybackRate((prevRate) => {
          const fasterRate = getNextFasterRate(prevRate);
          if (audioRef.current) {
            audioRef.current.playbackRate = fasterRate;
          }
          showShortcutHud(`速度: ${fasterRate}x`, <FastForward className="w-4 h-4" />);
          return fasterRate;
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    duration,
    isSpeakerModalOpen,
    isCsvModalOpen,
    isCsvImportModalOpen,
    showShortcutHud,
  ]);

  // Audio file selected handler (when user selects or drops an audio file)
  const handleAudioFileSelected = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name);
    setImportedAudioFileName(file.name);
    setIsAudioRelinkNoticeVisible(false);
  }, []);

  // Standalone audio import: attach or replace the player's audio file on its own,
  // without touching the transcript and without starting a transcription.
  const handleImportAudioOnly = useCallback(
    (file: File) => {
      handleAudioFileSelected(file);
      setSuccessMessage(`音声ファイル「${file.name}」を読み込みました。プレーヤーから再生できます。`);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    [handleAudioFileSelected]
  );

  // Transcribe API Call
  const handleTranscribe = async (
    audioBase64: string,
    mimeType: string,
    contextHint: string,
    fileName: string,
    audioFileUrl?: string
  ) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType,
          contextHint,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '文字起こしに失敗しました。');
      }

      if (data.segments && Array.isArray(data.segments) && data.segments.length > 0) {
        commitSegmentsChange(data.segments);
        setAudioName(fileName);
        setImportedAudioFileName(fileName);
        if (audioFileUrl) {
          setAudioUrl(audioFileUrl);
        }
        if (data.fallbackNotice) {
          setSuccessMessage(data.fallbackNotice);
          setTimeout(() => setSuccessMessage(null), 7000);
        } else {
          setSuccessMessage(
            data.usedNativeDiarization
              ? 'Gemini 3.5 Transcribe 標準音響話者分析（Diarization）により文字起こしと話者分離が完了しました！'
              : 'Gemini 3.5 Transcribe による文字起こしと話者分析が完了しました！'
          );
          setTimeout(() => setSuccessMessage(null), 4000);
        }
      } else {
        throw new Error('文字起こし結果が取得できませんでした。');
      }
    } catch (err: any) {
      console.error('Transcribe error:', err);
      setErrorMessage(err.message || 'エラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // Sample load handler
  const handleLoadSample = (sampleSegments: TranscriptSegment[], name: string, audioBlob?: Blob) => {
    commitSegmentsChange(sampleSegments);
    setAudioName(name);
    setImportedAudioFileName(null);
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    }
    setSuccessMessage(`「${name}」を読み込みました。`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Reset to initial demo sample
  const handleResetToSample = useCallback(() => {
    if (window.confirm('編集内容をリセットして初期デモデータに戻しますか？（現在の編集内容は破棄されます）')) {
      commitSegmentsChange(SAMPLE_TRANSCRIPT_1);
      setAudioName('デモ音声 (佐藤・高橋の会話)');
      setImportedAudioFileName(null);
      setIsAudioRelinkNoticeVisible(false);
      try {
        localStorage.removeItem(STORAGE_KEY_SEGMENTS);
        localStorage.removeItem(STORAGE_KEY_IMPORTED_AUDIO_FILE);
        localStorage.removeItem(STORAGE_KEY_LAST_SAVED);
      } catch (e) {}
      setSuccessMessage('初期デモデータにリセットしました。');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  }, [commitSegmentsChange]);

  // CSV Import handler
  const handleImportCsv = useCallback(
    (
      importedSegments: TranscriptSegment[],
      mode: 'replace' | 'append' = 'replace',
      audioFile?: File
    ) => {
      let nextSegments: TranscriptSegment[];
      if (mode === 'append') {
        const lastId = segments.length;
        const appended = importedSegments.map((s, idx) => ({
          ...s,
          id: lastId + idx + 1,
        }));
        nextSegments = [...segments, ...appended];
      } else {
        nextSegments = importedSegments;
      }

      commitSegmentsChange(nextSegments);

      if (audioFile) {
        const url = URL.createObjectURL(audioFile);
        setAudioUrl(url);
        setAudioName(audioFile.name);
        setImportedAudioFileName(audioFile.name);
        setIsAudioRelinkNoticeVisible(false);
      } else if (mode === 'replace') {
        setAudioUrl(null);
        setAudioName('');
        setImportedAudioFileName(null);
      }

      setSuccessMessage(
        `CSVから ${importedSegments.length} 件の発言を${mode === 'append' ? '末尾に追加' : 'インポート'}しました。エディタで編集できます。`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    [segments, commitSegmentsChange]
  );

  // Filtered segments
  const filteredSegments = useMemo(() => {
    return segments.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.speaker.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpeaker =
        !selectedSpeakerFilter || s.speaker === selectedSpeakerFilter;
      return matchesSearch && matchesSpeaker;
    });
  }, [segments, searchQuery, selectedSpeakerFilter]);

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Gemini Transcribe
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                  3.5 Transcribe
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                話者分析・推測付き音声文字起こし & CSV出力エディタ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCsvImportModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 transition"
              title="文字起こしCSVデータをインポートして編集"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSVインポート</span>
            </button>
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV出力</span>
            </button>
            <button
              onClick={() => setIsSpeakerModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">話者一括管理</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full pb-28">
        {/* Alerts */}
        {errorMessage && (
          <div className="mb-4 p-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="font-bold underline ml-2"
            >
              閉じる
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {isAudioRelinkNoticeVisible && importedAudioFileName && (
          <div className="mb-4 p-3 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                前回使用した音声「{importedAudioFileName}」はブラウザの制約により再読み込みされていません（CSVのファイル名には引き続き使用されます）。再生するには音声ファイルを選択し直してください。
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <input
                ref={relinkAudioInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (file) {
                    handleImportAudioOnly(file);
                  }
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => relinkAudioInputRef.current?.click()}
                className="font-bold underline"
              >
                音声ファイルを選択
              </button>
              <button
                onClick={() => setIsAudioRelinkNoticeVisible(false)}
                className="text-amber-700 dark:text-amber-300 hover:underline"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* Audio Input Section */}
        <AudioInputSection
          onTranscribe={handleTranscribe}
          onLoadSample={handleLoadSample}
          onOpenCsvImport={() => setIsCsvImportModalOpen(true)}
          onAudioFileSelected={handleImportAudioOnly}
          isProcessing={isProcessing}
          apiKeyConfigured={true}
        />

        {/* Toolbar */}
        <Toolbar
          segments={segments}
          speakerList={speakerList}
          searchQuery={searchQuery}
          selectedSpeakerFilter={selectedSpeakerFilter}
          canUndo={canUndo}
          canRedo={canRedo}
          audioFileName={importedAudioFileName}
          lastSavedTime={lastSavedTime}
          onSearchChange={setSearchQuery}
          onSpeakerFilterChange={setSelectedSpeakerFilter}
          onOpenSpeakerManager={() => setIsSpeakerModalOpen(true)}
          onOpenCsvPreview={() => setIsCsvModalOpen(true)}
          onOpenCsvImport={() => setIsCsvImportModalOpen(true)}
          onAudioFileSelected={handleImportAudioOnly}
          onAddSegment={handleAddSegmentAtBottom}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onResetToSample={handleResetToSample}
        />

        {/* Utterance List Editor */}
        <div className="space-y-3">
          {filteredSegments.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center text-gray-500">
              <Info className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-semibold">表示する発言がありません</p>
              <p className="text-xs text-gray-400 mt-1">
                検索条件を変更するか、新しい発言を追加してください
              </p>
            </div>
          ) : (
            filteredSegments.map((segment, index) => (
              <UtteranceCard
                key={segment.id}
                segment={segment}
                index={index}
                isActive={activeSegmentId === segment.id}
                speakerList={speakerList}
                searchQuery={searchQuery}
                onUpdateText={handleUpdateText}
                onUpdateSpeaker={handleUpdateSpeaker}
                onUpdateTimestamp={handleUpdateTimestamp}
                onDeleteSegment={handleDeleteSegment}
                onInsertBelow={handleInsertBelow}
                onMergeWithNext={handleMergeWithNext}
                onSplitSegment={handleSplitSegment}
                onPlayTimestamp={handlePlayTimestamp}
              />
            ))
          )}
        </div>
      </main>

      {/* Floating Audio Player Bar */}
      <AudioPlayerBar
        audioUrl={audioUrl}
        audioName={audioName}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        autoScroll={autoScroll}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onPlaybackRateChange={(rate) => {
          setPlaybackRate(rate);
          if (audioRef.current) {
            audioRef.current.playbackRate = rate;
          }
        }}
        onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
        onAudioFileSelected={handleImportAudioOnly}
        audioRef={audioRef}
      />

      {/* Shortcut HUD Toast Notification */}
      {shortcutHud && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95">
          <div className="bg-gray-900/95 dark:bg-gray-800/95 text-white px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2.5 border border-white/10 text-xs font-semibold">
            {shortcutHud.icon}
            <span>{shortcutHud.text}</span>
          </div>
        </div>
      )}

      {/* Speaker Manager Modal */}
      <SpeakerManagerModal
        isOpen={isSpeakerModalOpen}
        onClose={() => setIsSpeakerModalOpen(false)}
        segments={segments}
        onBatchRenameSpeaker={handleBatchRenameSpeaker}
        onMergeSpeakers={handleMergeSpeakers}
        speakerList={speakerList}
      />

      {/* CSV Preview Modal */}
      <CsvPreviewModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        segments={segments}
        audioFileName={importedAudioFileName}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvImportModalOpen}
        onClose={() => setIsCsvImportModalOpen(false)}
        onImport={handleImportCsv}
        currentSegmentCount={segments.length}
      />
    </div>
  );
}
