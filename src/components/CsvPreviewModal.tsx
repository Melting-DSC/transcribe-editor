import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, FileSpreadsheet } from 'lucide-react';
import { TranscriptSegment } from '../types';
import { generateCsvString, downloadCsv, getCsvFileName } from '../utils/csv';

interface CsvPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: TranscriptSegment[];
  audioFileName?: string | null;
}

export const CsvPreviewModal: React.FC<CsvPreviewModalProps> = ({
  isOpen,
  onClose,
  segments,
  audioFileName,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'raw'>('table');
  const [fileName, setFileName] = useState(() => getCsvFileName(audioFileName));

  useEffect(() => {
    if (isOpen) {
      setFileName(getCsvFileName(audioFileName));
    }
  }, [isOpen, audioFileName]);

  if (!isOpen) return null;

  const csvString = generateCsvString(segments);

  const handleCopy = () => {
    navigator.clipboard.writeText(csvString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadCsv(segments, fileName.trim() || getCsvFileName(audioFileName));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">CSVプレビュー & 出力</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                列構成: id, timestamp, speaker, text (UTF-8 BOM対応 / Excel文字化け防止)
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

        {/* Tab switch */}
        <div className="px-6 pt-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('table')}
              className={`text-xs px-3 py-1.5 font-semibold rounded-t-lg border-b-2 transition ${
                activeTab === 'table'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              テーブル表示
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`text-xs px-3 py-1.5 font-semibold rounded-t-lg border-b-2 transition ${
                activeTab === 'raw'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              CSV生テキスト
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2">
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">ファイル名:</span>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="transcription.csv"
                className="bg-transparent text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none w-36 sm:w-48 font-semibold"
              />
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition flex items-center gap-1 font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'コピー完了' : 'CSVをコピー'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 font-bold shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSVダウンロード</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
          {activeTab === 'table' ? (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2.5 px-3 w-16">id</th>
                    <th className="py-2.5 px-3 w-36">timestamp</th>
                    <th className="py-2.5 px-3 w-36">speaker</th>
                    <th className="py-2.5 px-3">text</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {segments.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-3 text-gray-500">{s.id}</td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">{s.timestamp}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-gray-200">{s.speaker}</td>
                      <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 font-sans">{s.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <textarea
              readOnly
              value={csvString}
              rows={16}
              className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl font-mono text-xs text-gray-800 dark:text-gray-200 focus:outline-none"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
          <span className="text-xs text-gray-400">合計: {segments.length} レコード</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-lg transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
