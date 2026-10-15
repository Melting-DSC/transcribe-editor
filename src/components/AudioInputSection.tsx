import React, { useState, useRef } from 'react';
import {
  Upload,
  Mic,
  MicOff,
  Sparkles,
  FileAudio,
  Radio,
  HelpCircle,
  PlayCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { SAMPLE_TRANSCRIPT_1, SAMPLE_TRANSCRIPT_2, generateTestAudioBlob } from '../utils/sampleData';
import { TranscriptSegment } from '../types';

interface AudioInputSectionProps {
  onTranscribe: (audioBase64: string, mimeType: string, contextHint: string, audioName: string, audioFileUrl?: string) => Promise<void>;
  onLoadSample: (segments: TranscriptSegment[], name: string, audioBlob?: Blob) => void;
  onOpenCsvImport?: () => void;
  onAudioFileSelected?: (file: File) => void;
  isProcessing: boolean;
  apiKeyConfigured: boolean;
}

export const AudioInputSection: React.FC<AudioInputSectionProps> = ({
  onTranscribe,
  onLoadSample,
  onOpenCsvImport,
  onAudioFileSelected,
  isProcessing,
  apiKeyConfigured,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contextHint, setContextHint] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (
        file.name.endsWith('.csv') ||
        file.name.endsWith('.tsv') ||
        file.type.includes('csv') ||
        file.type.includes('spreadsheet')
      ) {
        if (onOpenCsvImport) {
          onOpenCsvImport();
          return;
        }
      }
      handleFileSelected(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    if (onAudioFileSelected) {
      onAudioFileSelected(file);
    }
  };

  // Microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const recordedBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const recordedFile = new File([recordedBlob], `録音_${new Date().toLocaleTimeString('ja-JP').replace(/:/g, '')}.webm`, {
          type: mimeType,
        });
        setSelectedFile(recordedFile);
        if (onAudioFileSelected) {
          onAudioFileSelected(recordedFile);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      alert('マイクへのアクセスが許可されていないか、利用できません。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    }
  };

  const handleStartTranscribe = async () => {
    if (!selectedFile) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      const audioUrl = URL.createObjectURL(selectedFile);
      await onTranscribe(
        base64Data,
        selectedFile.type || 'audio/mp3',
        contextHint,
        selectedFile.name,
        audioUrl
      );
    };
    reader.readAsDataURL(selectedFile);
  };

  const loadSample1 = () => {
    const audioBlob = generateTestAudioBlob(65);
    onLoadSample(SAMPLE_TRANSCRIPT_1, 'サンプル対話 (佐藤・高橋)', audioBlob);
  };

  const loadSample2 = () => {
    const audioBlob = generateTestAudioBlob(35);
    onLoadSample(SAMPLE_TRANSCRIPT_2, 'サンプル会議 (田中・鈴木・山田)', audioBlob);
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 mb-6">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Gemini 3.5 Transcribe
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>標準話者ダイアライゼーション機能（有効）</span>
            </span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
            音声のアップロード & 標準話者分析文字起こし
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Gemini 3.5 Transcribeの標準話者分析（音響ダイアライゼーション ＆ 単語タイムスタンプ）機能により、話者の発話を正確に分離・推測します
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            ※ 無料枠クォータ上限（25回/日）に達した場合は、自動的に高精度マルチモーダルモデルへ切り替えて文字起こしを継続します。
          </p>
        </div>

        {/* Quick sample loader buttons & CSV Import */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenCsvImport && (
            <button
              onClick={onOpenCsvImport}
              disabled={isProcessing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition font-semibold"
              title="文字起こしCSVデータをインポートしてエディタで編集"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSVをインポート</span>
            </button>
          )}
          <span className="text-xs font-medium text-gray-400">デモデータ:</span>
          <button
            onClick={loadSample1}
            disabled={isProcessing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition font-medium"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>対話サンプル (佐藤・高橋)</span>
          </button>
          <button
            onClick={loadSample2}
            disabled={isProcessing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition font-medium"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>会議サンプル (田中・鈴木・山田)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload / Mic Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isRecording && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px] ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
              : selectedFile
              ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/10'
              : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50/50 dark:bg-gray-800/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full">
                <FileAudio className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate max-w-xs">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • クリックしてファイルを変更
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-full">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  音声ファイルをドラッグ＆ドロップ または 参照
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  MP3, WAV, M4A, WEBM, OGG, AAC などに対応
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Mic record & Context Hint */}
        <div className="flex flex-col justify-between gap-3">
          {/* Microphone recording bar */}
          <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-lg ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {isRecording ? <Radio className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {isRecording ? 'マイク録音中...' : 'マイクから直接録音'}
                </div>
                <div className="text-[11px] font-mono text-gray-500">
                  {isRecording
                    ? `録音時間: ${Math.floor(recordingSeconds / 60)
                        .toString()
                        .padStart(2, '0')}:${(recordingSeconds % 60).toString().padStart(2, '0')}`
                    : 'ブラウザのマイクを使用して録音'}
                </div>
              </div>
            </div>

            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1"
              >
                <MicOff className="w-3.5 h-3.5" />
                <span>録音停止</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-semibold rounded-lg transition shadow-xs flex items-center gap-1"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>録音開始</span>
              </button>
            )}
          </div>

          {/* Context hint for speaker inference */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>登場人物や背景のヒント（任意）</span>
              <span className="text-[10px] text-gray-400 font-normal">話者名の推測精度が向上します</span>
            </label>
            <input
              type="text"
              placeholder="例: 「佐藤と高橋の会話」 「登場人物: 田中、鈴木、山田」"
              value={contextHint}
              onChange={(e) => setContextHint(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit transcribe button */}
          <button
            onClick={handleStartTranscribe}
            disabled={!selectedFile || isProcessing}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gemini 3.5 Transcribeで話者分析中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>話者分析付きで文字起こしを実行</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
