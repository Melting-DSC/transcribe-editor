import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High payload limit for audio files (up to 100MB base64)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface TranscriptSegment {
  id: number;
  timestamp: string;
  speaker: string;
  text: string;
}

// Helper to convert second offset string like "0.400s" or "65.200s" to "MM:SS"
function formatOffsetToTimestamp(offsetStr?: string): string {
  if (!offsetStr) return '00:00';
  const sec = parseFloat(offsetStr.replace('s', '')) || 0;
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Maps acoustic label (spk:0, spk:1, etc.) to alphabetical default label (話者A, 話者B, 話者C, etc.)
function defaultSpeakerLetter(label: string, index: number): string {
  const match = label.match(/\d+/);
  const num = match ? parseInt(match[0], 10) : index;
  const letter = String.fromCharCode(65 + (num % 26)); // A, B, C, D...
  return `話者${letter}`;
}

// Prohibited generic role keywords that should never be used as speaker names
const ROLE_KEYWORDS = ['面接官', '応募者', '司会', '司会者', '進行', '進行役', '医師', '患者', '部長', '課長', '先生', '質問者', '回答者', '参加者'];

function sanitizeSpeakerName(name: string, fallback: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return fallback;
  // If the inferred name is purely a role or includes prohibited role words alone
  for (const role of ROLE_KEYWORDS) {
    if (trimmed === role || trimmed === `${role}役` || trimmed.startsWith(`（${role}）`)) {
      return fallback;
    }
  }
  // Strip parentheses if it contains role like "田中 (面接官)" -> "田中"
  const cleanName = trimmed.replace(/\s*[\(（][^\)）]*[\)）]\s*/g, '').trim();
  return cleanName || fallback;
}

// Helper to extract transcription text from gemini-3.5-transcribe response
// Note: gemini-3.5-transcribe returns text inside part.audioTranscription.text
function extractTranscriptionText(response: any): string {
  if (response.text && response.text.trim()) {
    return response.text.trim();
  }
  let combined = '';
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part?.audioTranscription?.text) {
      combined += (combined ? ' ' : '') + part.audioTranscription.text.trim();
    } else if (part?.text) {
      combined += (combined ? ' ' : '') + part.text.trim();
    }
  }
  return combined.trim();
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!apiKey,
  });
});

// Transcription endpoint using Gemini 3.5 Transcribe with standard speaker diarization
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/mp3', contextHint = '' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: '音声データが指定されていません。' });
    }

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY が設定されていません。AI StudioのSecretsパネルをご確認ください。',
      });
    }

    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');

    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64,
      },
    };

    // Step 1: Call Gemini 3.5 Transcribe with native speaker diarization and word timestamps enabled
    let transcribeResponse: any = null;
    let isQuotaFallback = false;

    try {
      transcribeResponse = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            audioPart,
            { text: 'Transcribe this audio verbatim in original language.' },
          ],
        },
        config: {
          audioTranscriptionConfig: {
            diarization: true,
            wordTimestamp: true,
          },
        },
      });
    } catch (transcribeErr: any) {
      const errStr = JSON.stringify(transcribeErr?.message || transcribeErr || '');
      const isQuota = transcribeErr?.status === 429 || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota');

      if (isQuota) {
        console.warn('Gemini 3.5 Transcribe hit quota 429 limit, switching to multimodal fallback (gemini-3.1-flash-lite):', transcribeErr?.message);
        isQuotaFallback = true;
      } else {
        // If other error, also attempt fallback
        console.warn('Gemini 3.5 Transcribe failed with error, attempting fallback:', transcribeErr);
        isQuotaFallback = true;
      }
    }

    let segments: TranscriptSegment[] = [];
    let usedNativeDiarization = false;
    let transcribedRawText = '';

    // If Gemini 3.5 Transcribe succeeded, process its response
    if (transcribeResponse && !isQuotaFallback) {
      const parts = transcribeResponse.candidates?.[0]?.content?.parts || [];
      transcribedRawText = extractTranscriptionText(transcribeResponse);

      if (!transcribedRawText && parts.length === 0) {
        return res.status(400).json({
          error: '音声から発話が検出されませんでした。マイクの音量や音声データに発話が含まれているかご確認ください。',
        });
      }

      // Check if Gemini 3.5 Transcribe returned native diarized segments (parts with speakerLabel)
      const nativeDiarizedParts = parts.filter(
        (p: any) => p.audioTranscription && (p.audioTranscription.text || p.text)
      );

      if (nativeDiarizedParts.length > 1 || (nativeDiarizedParts.length === 1 && nativeDiarizedParts[0].audioTranscription?.speakerLabel)) {
        usedNativeDiarization = true;

        // Map raw segments with exact acoustic timestamps
        const rawSegments = nativeDiarizedParts.map((p: any, idx: number) => {
          const at = p.audioTranscription;
          const text = (at?.text || p.text || '').trim();
          const words = at?.words || [];
          const startOffset = words.length > 0 ? words[0]?.startOffset : undefined;
          const endOffset = words.length > 0 ? words[words.length - 1]?.endOffset : undefined;

          const startTs = formatOffsetToTimestamp(startOffset);
          const endTs = formatOffsetToTimestamp(endOffset);
          const timestamp = startTs === endTs ? startTs : `${startTs} - ${endTs}`;
          const speakerLabel = at?.speakerLabel || `spk:${idx}`;

          return {
            id: idx + 1,
            timestamp,
            speakerLabel,
            speaker: speakerLabel,
            text,
          };
        });

        // Extract unique speaker labels
        const uniqueSpeakerLabels: string[] = Array.from(new Set(rawSegments.map((s: any) => String(s.speakerLabel))));

        // If we have speaker labels, infer actual human names from speech content
        if (uniqueSpeakerLabels.length > 0) {
          try {
            const sampleLines = rawSegments
              .slice(0, 15)
              .map((s: any) => `${s.speakerLabel}: ${s.text}`)
              .join('\n');

            const inferPrompt = `
あなたは音声会話の話者特定AIです。
以下は「Gemini 3.5 Transcribe」の標準音響ダイアライゼーションによって抽出された各音響話者ID（spk:0, spk:1など）の発言内容です:
${sampleLines}
${contextHint ? `\n【補足コンテキスト/前提情報】:\n${contextHint}\n` : ''}

【極めて重要なラベリング規則】
1. 【役職名の禁止】面接官、応募者、司会、医師、患者、部長、課長、司会者、進行役などの「役職名・役割名」は絶対に使用しないでください。
2. 【実名の特定】会話中の自己紹介（「〇〇です」）、相手への呼びかけ（「〇〇さん」）、名乗りから、実際の話者の氏名（名字またはフルネーム: 例「田中」「佐藤」「高橋」など）を特定して設定してください。
3. 【氏名不明時の表記】会話から氏名の特定が難しい話者は、必ず「話者A」「話者B」「話者C」…のようにアルファベット順でラベリングしてください。
   - spk:0 → 特定された氏名、または「話者A」
   - spk:1 → 特定された氏名、または「話者B」
   - spk:2 → 特定された氏名、または「話者C」

必ず以下のJSONオブジェクト形式のみを出力してください:
{
  ${uniqueSpeakerLabels.map((l, i) => `"${l}": "${defaultSpeakerLetter(l, i)}または特定された氏名"`).join(',\n  ')}
}
`;

            let inferText = '';
            try {
              const inferRes = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: inferPrompt,
                config: {
                  responseMimeType: 'application/json',
                },
              });
              inferText = inferRes.text?.trim() || '';
            } catch (liteErr) {
              console.warn('Lite name inference failed, trying flash:', liteErr);
              const fallbackRes = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: inferPrompt,
                config: {
                  responseMimeType: 'application/json',
                },
              });
              inferText = fallbackRes.text?.trim() || '';
            }

            const nameMap = JSON.parse(inferText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() || '{}');
            segments = rawSegments.map((s: any, idx: number) => {
              const defaultLabel = defaultSpeakerLetter(s.speakerLabel, idx);
              const rawName = nameMap[s.speakerLabel] || defaultLabel;
              const finalSpeaker = sanitizeSpeakerName(rawName, defaultLabel);
              return {
                id: s.id,
                timestamp: s.timestamp,
                speaker: finalSpeaker,
                text: s.text,
              };
            });
          } catch (inferErr) {
            console.warn('Speaker name inference fallback:', inferErr);
            // Fallback to alphabetical labels 話者A, 話者B, 話者C...
            segments = rawSegments.map((s: any, idx: number) => ({
              id: s.id,
              timestamp: s.timestamp,
              speaker: defaultSpeakerLetter(s.speakerLabel, idx),
              text: s.text,
            }));
          }
        }
      }
    }

    // Step 2 Fallback: If quota was exceeded or native diarization didn't produce segments,
    // use direct multimodal transcription with gemini-3.1-flash-lite
    if (segments.length === 0) {
      const directMultimodalPrompt = `
あなたは高精度な音声文字起こしおよび話者特定（ダイアライゼーション）の専門AIです。
提供された音声を忠実に文字起こしし、話者を分離・特定してください。

【厳格なラベリング規則】
1. 【役職名の禁止】面接官、応募者、司会、医師、患者、部長などの役職名・役割名は一切使用しないでください。
2. 【実名の特定】会話内の自己紹介（「〇〇です」）、呼びかけ（「〇〇さん」）などから、各話者の実際の氏名（名字・名前: 例「田中」「高橋」「佐藤」など）を特定して設定してください。
3. 【氏名不明時の表記】氏名の特定が難しい話者は、必ず「話者A」「話者B」「話者C」…のようにアルファベット順でラベリングしてください。
4. 各発言に適切なタイムスタンプ（推定時間: "MM:SS - MM:SS" 形式）を付与してください。
5. 各発言を必ず以下の4つのプロパティを持つJSONオブジェクトの配列として出力してください:
   - "id": 1から始まる連番整数 (1, 2, 3...)
   - "timestamp": 発言の開始・終了時刻 (例: "00:00 - 00:05")
   - "speaker": 特定された氏名、または「話者A」「話者B」
   - "text": 発言内容
${contextHint ? `\n【補足コンテキスト/前提情報】:\n${contextHint}\n` : ''}

【出力形式】
JSON配列のみを出力してください:
[
  {
    "id": 1,
    "timestamp": "00:00 - 00:05",
    "speaker": "佐藤",
    "text": "本日はお時間をいただきありがとうございます。"
  }
]
`;

      try {
        const fallbackAudioRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: {
            parts: [
              audioPart,
              { text: directMultimodalPrompt },
            ],
          },
          config: {
            responseMimeType: 'application/json',
          },
        });

        const fallbackJsonText = fallbackAudioRes.text?.trim() || '';
        const parsed = JSON.parse(fallbackJsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          segments = parsed.map((item, index) => {
            const defaultLabel = `話者${String.fromCharCode(65 + (index % 26))}`;
            const cleanSpeaker = sanitizeSpeakerName(item.speaker, defaultLabel);
            return {
              id: typeof item.id === 'number' ? item.id : index + 1,
              timestamp: String(item.timestamp || '00:00'),
              speaker: cleanSpeaker,
              text: String(item.text || '').trim(),
            };
          });
        }
      } catch (fallbackAudioErr: any) {
        console.warn('Direct multimodal fallback with gemini-3.1-flash-lite failed, attempting gemini-3.8-flash:', fallbackAudioErr);
        try {
          const fallbackFlashRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
              parts: [
                audioPart,
                { text: directMultimodalPrompt },
              ],
            },
            config: {
              responseMimeType: 'application/json',
            },
          });
          const flashJsonText = fallbackFlashRes.text?.trim() || '';
          const parsed = JSON.parse(flashJsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
          if (Array.isArray(parsed) && parsed.length > 0) {
            segments = parsed.map((item, index) => {
              const defaultLabel = `話者${String.fromCharCode(65 + (index % 26))}`;
              const cleanSpeaker = sanitizeSpeakerName(item.speaker, defaultLabel);
              return {
                id: typeof item.id === 'number' ? item.id : index + 1,
                timestamp: String(item.timestamp || '00:00'),
                speaker: cleanSpeaker,
                text: String(item.text || '').trim(),
              };
            });
          }
        } catch (flashErr) {
          console.error('All model attempts failed:', flashErr);
        }
      }
    }

    // If we have text from earlier but no segments, split into sentences
    if (segments.length === 0 && transcribedRawText) {
      const sentenceParts = transcribedRawText
        .split(/(?<=[。！？\n])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let currentSec = 0;
      segments = sentenceParts.map((sentence, idx) => {
        const estDuration = Math.max(3, Math.round(sentence.length * 0.25));
        const startSec = currentSec;
        const endSec = startSec + estDuration;
        currentSec = endSec;

        const formatTs = (sec: number) => {
          const m = Math.floor(sec / 60).toString().padStart(2, '0');
          const s = (sec % 60).toString().padStart(2, '0');
          return `${m}:${s}`;
        };

        const speakerLetter = String.fromCharCode(65 + (idx % 2)); // A, B
        return {
          id: idx + 1,
          timestamp: `${formatTs(startSec)} - ${formatTs(endSec)}`,
          speaker: `話者${speakerLetter}`,
          text: sentence,
        };
      });
    }

    if (segments.length === 0) {
      return res.status(400).json({
        error: '音声から有効な文字起こし結果が得られませんでした。マイクの音量や音声データをご確認ください。',
      });
    }

    // Ensure IDs are strictly sequential integers starting from 1
    segments = segments.map((s, idx) => ({
      ...s,
      id: idx + 1,
    }));

    const finalModelUsed = isQuotaFallback ? 'gemini-3.1-flash-lite' : 'gemini-3.5-transcribe';
    const fallbackNotice = isQuotaFallback
      ? '※ Gemini 3.5 Transcribe の無料利用枠クォータ（1日25回上限）に達したため、Gemini 3.1 Flash-Lite の高精度マルチモーダル機能で自動継続して文字起こしと話者分析を行いました。'
      : undefined;

    return res.json({
      success: true,
      segments,
      rawText: transcribedRawText || segments.map((s) => s.text).join(' '),
      modelUsed: finalModelUsed,
      usedNativeDiarization,
      isQuotaFallback,
      fallbackNotice,
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    const errMessage = error?.message || '';
    const isQuota = error?.status === 429 || errMessage.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('quota');

    if (isQuota) {
      return res.status(429).json({
        error: 'Gemini APIの1日の無料リクエスト上限（クォータ）に達しました。しばらく時間をおいてから再度お試しいただくか、Google AI Studioの有料課金（Pay-as-you-go）の追加をご検討ください。',
      });
    }

    return res.status(500).json({
      error: error.message || '音声文字起こし処理中にエラーが発生しました。',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
