import React, { useState, useRef } from 'react';
import {
  Search,
  Users,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  Upload,
  Plus,
  Undo2,
  Redo2,
  ChevronDown,
  Copy,
  Check,
  Eye,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { downloadCsv, downloadJson, downloadTxt, generateCsvString, parseCsv, getCsvFileName } from '../utils/csv';

interface ToolbarProps {
  segments: TranscriptSegment[];
  speakerList: string[];
  searchQuery: string;
  selectedSpeakerFilter: string;
  canUndo: boolean;
  canRedo: boolean;
  audioFileName?: string | null;
  lastSavedTime?: string | null;
  onSearchChange: (q: string) => void;
  onSpeakerFilterChange: (spk: string) => void;
  onOpenSpeakerManager: () => void;
  onOpenCsvPreview: () => void;
  onOpenCsvImport: () => void;
  onAddSegment: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetToSample?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  segments,
  speakerList,
  searchQuery,
  selectedSpeakerFilter,
  canUndo,
  canRedo,
  audioFileName,
  lastSavedTime,
  onSearchChange,
  onSpeakerFilterChange,
  onOpenSpeakerManager,
  onOpenCsvPreview,
  onOpenCsvImport,
  onAddSegment,
  onUndo,
  onRedo,
  onResetToSample,
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const csvFileName = getCsvFileName(audioFileName);

  const handleDownloadCsv = () => {
    downloadCsv(segments, csvFileName);
    setIsExportMenuOpen(false);
  };

  const handleDownloadJson = () => {
    downloadJson(segments, csvFileName.replace(/\.csv$/, '.json'));
    setIsExportMenuOpen(false);
  };

  const handleDownloadTxt = () => {
    downloadTxt(segments, csvFileName.replace(/\.csv$/, '.txt'));
    setIsExportMenuOpen(false);
  };

  const handleCopyCsv = () => {
    const csv = generateCsvString(segments);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setIsExportMenuOpen(false);
    }, 1500);
  };

  const totalChars = segments.reduce((acc, s) => acc + (s.text?.length || 0), 0);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-4 mb-5">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search & Filter tools */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search box */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="発言内容を検索..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Speaker Filter */}
          <div className="relative">
            <select
              value={selectedSpeakerFilter}
              onChange={(e) => onSpeakerFilterChange(e.target.value)}
              className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">すべての話者 ({speakerList.length}名)</option>
              {speakerList.map((spk) => (
                <option key={spk} value={spk}>
                  {spk} ({segments.filter((s) => s.speaker === spk).length}件)
                </option>
              ))}
            </select>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-800 pl-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition"
              title="元に戻す (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition"
              title="やり直し (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Speaker Batch Rename Button */}
          <button
            onClick={onOpenSpeakerManager}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl transition font-semibold"
            title="話者名の一括置換や統合を行います"
          >
            <Users className="w-4 h-4" />
            <span>話者を一括編集</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-purple-200 dark:bg-purple-800 rounded-full font-bold">
              {speakerList.length}
            </span>
          </button>

          {/* Add Segment */}
          <button
            onClick={onAddSegment}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition font-medium"
            title="最後尾に新しい発言を追加"
          >
            <Plus className="w-4 h-4" />
            <span>発言追加</span>
          </button>

          {/* CSV Preview */}
          <button
            onClick={onOpenCsvPreview}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition font-medium"
            title="CSV形式のデータを確認"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">CSVプレビュー</span>
          </button>

          {/* CSV Import Button */}
          <button
            onClick={onOpenCsvImport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl transition font-semibold"
            title="文字起こしCSVデータをインポートしてエディタで編集"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSVインポート</span>
          </button>

          {/* Main CSV Download Button */}
          <div className="relative">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition"
              title="CSV形式（id, timestamp, speaker, text）でローカルに保存"
            >
              <Download className="w-4 h-4" />
              <span>CSVダウンロード</span>
            </button>
          </div>

          {/* Other Exports Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 transition"
              title="その他の形式で保存"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-40 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <button
                  onClick={handleCopyCsv}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'コピーしました' : 'CSVをクリップボードにコピー'}</span>
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium"
                >
                  <FileCode className="w-4 h-4 text-blue-500" />
                  <span>JSON形式で保存</span>
                </button>
                <button
                  onClick={handleDownloadTxt}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium"
                >
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>台本テキスト (.txt) で保存</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary stats pill & auto-save status */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
        <div className="flex flex-wrap items-center gap-2.5">
          <span>発言数: {segments.length} 件</span>
          <span>•</span>
          <span>総文字数: {totalChars.toLocaleString()} 文字</span>
          <span>•</span>
          <span>話者: {speakerList.join(', ')}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-saved indicator */}
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold" title="編集内容はブラウザのlocalStorageに常時自動保存されています">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>自動保存済み{lastSavedTime ? ` (${lastSavedTime})` : ''}</span>
          </div>

          {onResetToSample && (
            <button
              onClick={onResetToSample}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              title="編集内容をリセットして初期デモデータに戻します"
            >
              <RotateCcw className="w-3 h-3" />
              <span>初期データに戻す</span>
            </button>
          )}

          <div className="text-gray-400 hidden md:block">
            CSV列定義: id, timestamp, speaker, text
          </div>
        </div>
      </div>
    </div>
  );
};
