import React, { useState } from 'react';
import {
  X,
  Users,
  Check,
  ArrowRight,
  GitMerge,
  Sparkles,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { getSpeakerColorTheme } from '../utils/colors';

interface SpeakerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: TranscriptSegment[];
  onBatchRenameSpeaker: (oldName: string, newName: string) => void;
  onMergeSpeakers: (sourceName: string, targetName: string) => void;
  speakerList: string[];
}

export const SpeakerManagerModal: React.FC<SpeakerManagerModalProps> = ({
  isOpen,
  onClose,
  segments,
  onBatchRenameSpeaker,
  onMergeSpeakers,
  speakerList,
}) => {
  // Temporary rename inputs per speaker
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});
  const [mergeSource, setMergeSource] = useState<string>('');
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [newSpeakerName, setNewSpeakerName] = useState<string>('');

  if (!isOpen) return null;

  // Calculate speaker statistics
  const speakerStats = speakerList.map((speaker) => {
    const speakerSegments = segments.filter((s) => s.speaker === speaker);
    const count = speakerSegments.length;
    const charCount = speakerSegments.reduce((sum, s) => sum + (s.text?.length || 0), 0);
    return {
      speaker,
      count,
      charCount,
      percentage: segments.length > 0 ? Math.round((count / segments.length) * 100) : 0,
    };
  });

  const handleApplyRename = (oldName: string) => {
    const newName = (renameMap[oldName] || '').trim();
    if (!newName || newName === oldName) return;
    onBatchRenameSpeaker(oldName, newName);
    setRenameMap((prev) => {
      const next = { ...prev };
      delete next[oldName];
      return next;
    });
  };

  const handleApplyAllRenames = () => {
    Object.entries(renameMap).forEach(([oldName, newName]) => {
      if (newName.trim() && newName.trim() !== oldName) {
        onBatchRenameSpeaker(oldName, newName.trim());
      }
    });
    setRenameMap({});
  };

  const handleExecuteMerge = () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    onMergeSpeakers(mergeSource, mergeTarget);
    setMergeSource('');
    setMergeTarget('');
  };

  const QUICK_PRESETS = ['話者A', '話者B', '話者C', '話者D', '田中', '佐藤', '鈴木', '高橋', '山田', '渡辺', '伊藤', '中村'];

  const hasPendingRenames = Object.values(renameMap).some((val) => val.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">話者名の一括編集・管理</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AIが分析・推測した話者名を一括置換または統合できます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick preset suggestions */}
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>よく使われる話者名プリセット:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    // Set to first speaker or currently edited
                    if (speakerList.length > 0) {
                      setRenameMap((prev) => ({
                        ...prev,
                        [speakerList[0]]: preset,
                      }));
                    }
                  }}
                  className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-700 transition"
                  title="クリックして候補に入力"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Speakers List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>検出された話者一覧 ({speakerStats.length}名)</span>
              {hasPendingRenames && (
                <button
                  onClick={handleApplyAllRenames}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  すべての変更を一括適用
                </button>
              )}
            </div>

            {speakerStats.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                文字起こしデータに話者が存在しません
              </div>
            ) : (
              <div className="space-y-2.5">
                {speakerStats.map(({ speaker, count, charCount, percentage }) => {
                  const colorTheme = getSpeakerColorTheme(speaker, speakerList);
                  const newName = renameMap[speaker] !== undefined ? renameMap[speaker] : '';

                  return (
                    <div
                      key={speaker}
                      className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:bg-white dark:hover:bg-gray-800 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      {/* Speaker Badge and Stats */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-full ${colorTheme.avatarBg} ${colorTheme.avatarText} font-bold text-sm flex items-center justify-center shrink-0 shadow-xs`}
                        >
                          {speaker.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                            <span>{speaker}</span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full border ${colorTheme.badgeBg} ${colorTheme.badgeText} ${colorTheme.badgeBorder}`}
                            >
                              {percentage}%
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {count} 件の発言 ({charCount.toLocaleString()} 文字)
                          </div>
                        </div>
                      </div>

                      {/* Rename input */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-48">
                          <input
                            type="text"
                            placeholder="新しい名前を入力"
                            value={newName}
                            onChange={(e) =>
                              setRenameMap((prev) => ({
                                ...prev,
                                [speaker]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleApplyRename(speaker);
                            }}
                            className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          onClick={() => handleApplyRename(speaker)}
                          disabled={!newName.trim() || newName.trim() === speaker}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition flex items-center gap-1 shadow-xs shrink-0"
                          title="この話者のすべての発言を置換"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>一括置換</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Merge Speakers Section */}
          {speakerList.length >= 2 && (
            <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <GitMerge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>話者の統合（名寄せ・マージ）</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                同じ人物が別々の名前（例:「話者1」と「田中」）として検出された場合、一つに統合できます。
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <select
                  value={mergeSource}
                  onChange={(e) => setMergeSource(e.target.value)}
                  className="w-full sm:flex-1 text-xs px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">統合元の話者を選択...</option>
                  {speakerList.map((s) => (
                    <option key={s} value={s}>
                      {s} ({segments.filter((seg) => seg.speaker === s).length}件)
                    </option>
                  ))}
                </select>

                <ArrowRight className="w-4 h-4 text-gray-400 shrink-0 hidden sm:block" />

                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="w-full sm:flex-1 text-xs px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">統合先の話者を選択...</option>
                  {speakerList
                    .filter((s) => s !== mergeSource)
                    .map((s) => (
                      <option key={s} value={s}>
                        {s} ({segments.filter((seg) => seg.speaker === s).length}件)
                      </option>
                    ))}
                </select>

                <button
                  onClick={handleExecuteMerge}
                  disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
                  className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition shrink-0 shadow-xs"
                >
                  統合を実行
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-lg transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
