import { TranscriptSegment } from '../types';

export const SAMPLE_TRANSCRIPT_1: TranscriptSegment[] = [
  {
    id: 1,
    timestamp: '00:00 - 00:05',
    speaker: '佐藤',
    text: '本日はお忙しい中、弊社の一次面接にお越しいただきありがとうございます。',
  },
  {
    id: 2,
    timestamp: '00:06 - 00:11',
    speaker: '高橋',
    text: 'こちらこそ、貴重なお時間をいただき誠にありがとうございます。高橋と申します。よろしくお願いいたします。',
  },
  {
    id: 3,
    timestamp: '00:12 - 00:20',
    speaker: '佐藤',
    text: 'それではまず、これまでの職務経歴と、特に注力されてきたプロジェクトについて簡単にご説明いただけますか？',
  },
  {
    id: 4,
    timestamp: '00:21 - 00:33',
    speaker: '高橋',
    text: 'はい。前職ではWebアプリケーションのフロントエンドおよびバックエンド開発を担当しておりました。特にTypeScriptとReactを活用した大規模リニューアルを主導いたしました。',
  },
  {
    id: 5,
    timestamp: '00:34 - 00:43',
    speaker: '佐藤',
    text: 'なるほど、素晴らしいですね。チーム内でのコミュニケーションや、課題解決において意識されている点はございますか？',
  },
  {
    id: 6,
    timestamp: '00:44 - 00:56',
    speaker: '高橋',
    text: '常に早めの相談と透明性のある情報共有を心掛けています。仕様の不確実性が高い場合でも、プロトタイプを迅速に作成して合意形成を図るようにしています。',
  },
  {
    id: 7,
    timestamp: '00:57 - 01:03',
    speaker: '佐藤',
    text: 'ありがとうございます。非常によく理解できました。続いて技術的なアプローチについて伺います。',
  },
];

export const SAMPLE_TRANSCRIPT_2: TranscriptSegment[] = [
  {
    id: 1,
    timestamp: '00:00 - 00:06',
    speaker: '田中',
    text: '定刻になりましたので、第3四半期の新プロダクト企画定例会議を開始します。',
  },
  {
    id: 2,
    timestamp: '00:07 - 00:13',
    speaker: '鈴木',
    text: 'UIプロトタイプを作成しましたので共有します。画面右側のダッシュボード導線を簡略化しました。',
  },
  {
    id: 3,
    timestamp: '00:14 - 00:22',
    speaker: '山田',
    text: '確認しました。このレイアウトなら既存のコンポーネントを再利用できるため、開発工数を約30%削減できそうです。',
  },
  {
    id: 4,
    timestamp: '00:23 - 00:31',
    speaker: '田中',
    text: 'それは心強いですね。リリース目標の来月中旬に向けて、この方針で進めていきましょう。',
  },
];

/**
 * Generates a simple multi-frequency synth beep audio WAV blob to allow testing
 * audio player and playback sync even without an external audio file.
 */
export function generateTestAudioBlob(durationSeconds = 65): Blob {
  const sampleRate = 22050;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + numSamples * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 1 * 2)
  view.setUint32(28, sampleRate * 2, true);
  // block align (1 * 2)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, numSamples * 2, true);

  // Generate pleasant gentle speech-like melodic tones for testing
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Periodic gentle chimes corresponding to dialogue changes
    const freq = 220 + ((Math.floor(t / 6) % 4) * 80);
    // Envelope for each beat
    const beat = t % 1.5;
    const env = Math.exp(-beat * 2.5);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.15 * env;
    const intSample = Math.max(-32768, Math.min(32767, sample * 32767));
    view.setInt16(44 + i * 2, intSample, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
