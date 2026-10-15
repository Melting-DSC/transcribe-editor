import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clipboard,
  Layers,
  ArrowRight,
  Music,
  FileAudio,
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { parseCsv, readCsvFileWithEncoding } from '../utils/csv';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (segments: TranscriptSegment[], mode: 'replace' | 'append', audioFile?: File) => void;
  currentSegmentCount: number;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentSegmentCount,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [encoding, setEncoding] = useState<'auto' | 'utf-8' | 'shift-jis'>('auto');

  // File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Attached audio file (optional)
  const [attachedAudio, setAttachedAudio] = useState<File | null>(null);

  // Parsed segments preview
  const [parsedSegments, setParsedSegments] = useState<TranscriptSegment[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setParseError(null);
    }
  }, [isOpen]);

  // Re-parse when file or encoding changes
  useEffect(() => {
    if (activeTab === 'file' && selectedFile) {
      parseSelectedFile(selectedFile, encoding);
    }
  }, [selectedFile, encoding]);

  // Re-parse when pasted text changes
  useEffect(() => {
    if (activeTab === 'paste') {
      if (!pastedText.trim()) {
        setParsedSegments([]);
        setParseError(null);
        return;
      }
      try {
        const result = parseCsv(pastedText);
        if (result.length === 0) {
          setParseError('有効なデータ行が見つかりませんでした。列（id, timestamp, speaker, text）をご確認ください。');
          setParsedSegments([]);
        } else {
          setParsedSegments(result);
          setParseError(null);
        }
      } catch (err: any) {
        setParseError(`解析エラー: ${err.message || 'CSV形式が不正です'}`);
        setParsedSegments([]);
      }
    }
  }, [pastedText, activeTab]);

  const parseSelectedFile = async (file: File, enc: 'auto' | 'utf-8' | 'shift-jis') => {
    setIsParsing(true);
    setParseError(null);
    try {
      const forced = enc === 'auto' ? undefined : enc;
      const text = await readCsvFileWithEncoding(file, forced);
      const result = parseCsv(text);
      if (result.length === 0) {
        setParseError('CSV内に有効な文字起こしデータが検出されませんでした。');
        setParsedSegments([]);
      } else {
        setParsedSegments(result);
        setParseError(null);
      }
    } catch (err: any) {
      setParseError(`ファイル読込エラー: ${err.message || '読み込みに失敗しました'}`);
      setParsedSegments([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedAudio(e.target.files[0]);
    }
  };

  const handlePasteDemoSample = () => {
    const demoCsv = `id,timestamp,speaker,text
1,00:00 - 00:04,佐藤,本日はお時間をいただきありがとうございます。
2,00:05 - 00:09,高橋,こちらこそ、よろしくお願いいたします。
3,00:10 - 00:18,佐藤,それでは前回の議題の進捗状況から確認していきましょう。
4,00:19 - 00:27,高橋,はい。開発チームのタスクはすべて計画通り完了しております。`;
    setPastedText(demoCsv);
    setActiveTab('paste');
  };

  const handleExecuteImport = () => {
    if (parsedSegments.length === 0) return;
    onImport(parsedSegments, importMode, attachedAudio || undefined);
    onClose();
  };

  if (!isOpen) return null;

  // Extract distinct speakers from parsed data
  const detectedSpeakers = Array.from(new Set(parsedSegments.map((s) => s.speaker)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">文字起こしCSVデータのインポート</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                CSVまたはTSVファイルを読み込んでGUIエディタ上で編集を開始できます
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

        {/* Tab switcher */}
        <div className="px-6 pt-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('file')}
              className={`text-xs px-3.5 py-2 font-semibold rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'file'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-900 shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>ファイルから選択</span>
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`text-xs px-3.5 py-2 font-semibold rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-900 shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>テキストを貼り付け</span>
            </button>
          </div>

          <button
            onClick={handlePasteDemoSample}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium mb-1"
          >
            サンプルCSVを入力
          </button>
        </div>

        {/* Content area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Tab 1: File Dropzone */}
          {activeTab === 'file' && (
            <div className="space-y-3">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : 'border-gray-300 dark:border-gray-700 hover:border-emerald-400 bg-gray-50/40 dark:bg-gray-800/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  onChange={handleFileChange}
                />
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full mb-2">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                {selectedFile ? (
                  <div>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-sm">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • クリックしてファイルを変更
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      CSVファイルをドラッグ＆ドロップ または クリックして選択
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      .csv, .tsv, .txt （UTF-8 / Shift-JIS自動判定）に対応
                    </p>
                  </div>
                )}
              </div>

              {/* Encoding selector */}
              <div className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-300 font-medium">文字コード設定:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={encoding}
                    onChange={(e) => setEncoding(e.target.value as any)}
                    className="text-xs px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200"
                  >
                    <option value="auto">自動判定 (推奨)</option>
                    <option value="utf-8">UTF-8</option>
                    <option value="shift-jis">Shift-JIS (Windows Excel)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Textarea Paste */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>CSV / TSV テキストを貼り付け:</span>
                <span className="text-[11px] text-gray-400 font-normal">Excel等の表からそのままコピー＆ペースト可能です</span>
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`id,timestamp,speaker,text\n1,00:00 - 00:05,佐藤,こんにちは\n2,00:06 - 00:10,高橋,よろしくお願いします`}
                rows={6}
                className="w-full text-xs font-mono p-3 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Optional Audio Link */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                <Music className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {attachedAudio ? attachedAudio.name : '対応する音声ファイルを紐付け（任意）'}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {attachedAudio
                    ? `${(attachedAudio.size / (1024 * 1024)).toFixed(1)} MB • 音声プレーヤーに読み込まれます`
                    : 'インポートした発言のタイムスタンプに合わせて音声を再生できます'}
                </div>
              </div>
            </div>

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              onChange={handleAudioChange}
            />
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-200 transition shrink-0"
            >
              {attachedAudio ? '音声を変更' : '音声を選択'}
            </button>
          </div>

          {/* Parse Result / Error Banner */}
          {parseError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedSegments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>解析成功: {parsedSegments.length} 件の発言を検出</span>
                </div>
                <span className="text-[11px] text-gray-500 font-normal">
                  話者: {detectedSpeakers.join(', ')} ({detectedSpeakers.length}名)
                </span>
              </div>

              {/* Preview table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto font-mono text-[11px]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="py-1.5 px-2.5 w-12">id</th>
                      <th className="py-1.5 px-2.5 w-28">timestamp</th>
                      <th className="py-1.5 px-2.5 w-24">speaker</th>
                      <th className="py-1.5 px-2.5">text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
                    {parsedSegments.slice(0, 10).map((seg) => (
                      <tr key={seg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-1.5 px-2.5 text-gray-400 font-mono">{seg.id}</td>
                        <td className="py-1.5 px-2.5 text-blue-600 dark:text-blue-400 font-mono">{seg.timestamp}</td>
                        <td className="py-1.5 px-2.5 font-semibold text-gray-800 dark:text-gray-200">{seg.speaker}</td>
                        <td className="py-1.5 px-2.5 text-gray-600 dark:text-gray-300 truncate max-w-xs">{seg.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedSegments.length > 10 && (
                <p className="text-[11px] text-gray-400 text-right">
                  ...他 {parsedSegments.length - 10} 件の発言（すべてインポートされます）
                </p>
              )}
            </div>
          )}

          {/* Import Mode Selector */}
          {parsedSegments.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-2">
                インポート方法:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                    importMode === 'replace'
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold">上書きインポート（推奨）</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      現在のエディタの発言をすべてクリアし、CSVデータで完全に置き換えます
                    </div>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                    importMode === 'append'
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold">末尾に追記マージ</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      現在の{currentSegmentCount}件の発言の後ろにCSVデータを追加します
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-lg transition"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={parsedSegments.length === 0}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition shadow-md flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{parsedSegments.length} 件の発言をインポートして編集</span>
          </button>
        </div>
      </div>
    </div>
  );
};
