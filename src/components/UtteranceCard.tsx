import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Trash2,
  Plus,
  GitMerge,
  Scissors,
  Check,
  ChevronDown,
  User,
  Clock,
  Edit2,
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { getSpeakerColorTheme } from '../utils/colors';

interface UtteranceCardProps {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  speakerList: string[];
  searchQuery: string;
  onUpdateText: (id: number, text: string) => void;
  onUpdateSpeaker: (id: number, speaker: string) => void;
  onUpdateTimestamp: (id: number, timestamp: string) => void;
  onDeleteSegment: (id: number) => void;
  onInsertBelow: (id: number) => void;
  onMergeWithNext: (id: number) => void;
  onSplitSegment: (id: number, cursorIndex: number) => void;
  onPlayTimestamp: (timestamp: string) => void;
}

export const UtteranceCard: React.FC<UtteranceCardProps> = ({
  segment,
  index,
  isActive,
  speakerList,
  searchQuery,
  onUpdateText,
  onUpdateSpeaker,
  onUpdateTimestamp,
  onDeleteSegment,
  onInsertBelow,
  onMergeWithNext,
  onSplitSegment,
  onPlayTimestamp,
}) => {
  const [isEditingTimestamp, setIsEditingTimestamp] = useState(false);
  const [tempTimestamp, setTempTimestamp] = useState(segment.timestamp);
  const [isSpeakerMenuOpen, setIsSpeakerMenuOpen] = useState(false);
  const [newSpeakerInput, setNewSpeakerInput] = useState('');
  const [isCustomSpeakerMode, setIsCustomSpeakerMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speakerMenuRef = useRef<HTMLDivElement>(null);

  const colorTheme = getSpeakerColorTheme(segment.speaker, speakerList);

  // Auto-resize textarea to fit text
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [segment.text]);

  // Click outside to close speaker dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speakerMenuRef.current && !speakerMenuRef.current.contains(e.target as Node)) {
        setIsSpeakerMenuOpen(false);
        setIsCustomSpeakerMode(false);
      }
    };
    if (isSpeakerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpeakerMenuOpen]);

  const handleTimestampSave = () => {
    if (tempTimestamp.trim()) {
      onUpdateTimestamp(segment.id, tempTimestamp.trim());
    }
    setIsEditingTimestamp(false);
  };

  const handleSelectSpeaker = (spk: string) => {
    onUpdateSpeaker(segment.id, spk);
    setIsSpeakerMenuOpen(false);
    setIsCustomSpeakerMode(false);
  };

  const handleAddNewSpeaker = () => {
    if (newSpeakerInput.trim()) {
      onUpdateSpeaker(segment.id, newSpeakerInput.trim());
      setNewSpeakerInput('');
      setIsSpeakerMenuOpen(false);
      setIsCustomSpeakerMode(false);
    }
  };

  const handleSplitClick = () => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart || Math.floor(segment.text.length / 2);
    onSplitSegment(segment.id, cursor);
  };

  // Highlight search matches
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return null;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span className="hidden">
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-yellow-900 dark:text-yellow-100">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div
      id={`utterance-${segment.id}`}
      className={`group relative rounded-xl border transition-all duration-200 p-4 ${
        isActive
          ? `ring-2 ring-blue-500 shadow-md ${colorTheme.cardHighlight} border-blue-400 dark:border-blue-600`
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-800/80">
        <div className="flex flex-wrap items-center gap-2">
          {/* Segment ID */}
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold">
            #{segment.id}
          </span>

          {/* Timestamp Badge / Button */}
          {isEditingTimestamp ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tempTimestamp}
                onChange={(e) => setTempTimestamp(e.target.value)}
                onBlur={handleTimestampSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTimestampSave();
                  if (e.key === 'Escape') {
                    setTempTimestamp(segment.timestamp);
                    setIsEditingTimestamp(false);
                  }
                }}
                autoFocus
                className="text-xs font-mono px-2 py-0.5 bg-gray-50 dark:bg-gray-800 border border-blue-500 rounded text-gray-800 dark:text-gray-200 focus:outline-none w-28"
              />
              <button
                onClick={handleTimestampSave}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group/ts">
              <button
                onClick={() => onPlayTimestamp(segment.timestamp)}
                className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-gray-50 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-950/40 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 transition"
                title="このタイムスタンプから音声を再生"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{segment.timestamp}</span>
              </button>
              <button
                onClick={() => {
                  setTempTimestamp(segment.timestamp);
                  setIsEditingTimestamp(true);
                }}
                className="opacity-0 group-hover/ts:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                title="タイムスタンプを編集"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Speaker Switcher Dropdown */}
          <div className="relative" ref={speakerMenuRef}>
            <button
              onClick={() => setIsSpeakerMenuOpen(!isSpeakerMenuOpen)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition ${colorTheme.badgeBg} ${colorTheme.badgeText} ${colorTheme.badgeBorder} hover:opacity-90 active:scale-95`}
              title="クリックして話者を変更"
            >
              <span className={`w-2 h-2 rounded-full ${colorTheme.avatarBg}`} />
              <span>{segment.speaker}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {/* Dropdown Menu for Speaker Change */}
            {isSpeakerMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-40 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 px-2 py-1">
                  話者を変更
                </div>

                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {speakerList.map((spk) => {
                    const theme = getSpeakerColorTheme(spk, speakerList);
                    const isCurrent = spk === segment.speaker;
                    return (
                      <button
                        key={spk}
                        onClick={() => handleSelectSpeaker(spk)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                          isCurrent
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-2 h-2 rounded-full ${theme.avatarBg}`} />
                          <span className="truncate">{spk}</span>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom speaker inline add */}
                <div className="pt-1.5 border-t border-gray-100 dark:border-gray-700">
                  {isCustomSpeakerMode ? (
                    <div className="flex items-center gap-1 p-1">
                      <input
                        type="text"
                        placeholder="新しい話者名..."
                        value={newSpeakerInput}
                        onChange={(e) => setNewSpeakerInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddNewSpeaker();
                        }}
                        autoFocus
                        className="text-xs px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1"
                      />
                      <button
                        onClick={handleAddNewSpeaker}
                        className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        title="追加"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCustomSpeakerMode(true)}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新しい話者名を入力...</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick action tools on top right */}
        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleSplitClick}
            className="p-1.5 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-md transition"
            title="カーソル位置で分割"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMergeWithNext(segment.id)}
            className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition"
            title="下の発言と結合"
          >
            <GitMerge className="w-3.5 h-3.5 rotate-90" />
          </button>
          <button
            onClick={() => onInsertBelow(segment.id)}
            className="p-1.5 text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition"
            title="下に新しい発言を追加"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteSegment(segment.id)}
            className="p-1.5 text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition"
            title="この発言を削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editable Speech Text Area */}
      <div className="mt-2.5">
        <textarea
          ref={textareaRef}
          value={segment.text}
          onChange={(e) => onUpdateText(segment.id, e.target.value)}
          placeholder="発言内容を入力..."
          rows={1}
          className="w-full bg-transparent text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded-md p-1 transition"
        />
      </div>
    </div>
  );
};
