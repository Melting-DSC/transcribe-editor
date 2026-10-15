import { TranscriptSegment } from '../types';

/**
 * Escapes a field for CSV format according to RFC 4180.
 * If value contains commas, quotes, or newlines, wraps in quotes and doubles inner quotes.
 */
export function escapeCsvField(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates CSV string with exact columns: id, timestamp, speaker, text
 */
export function generateCsvString(segments: TranscriptSegment[]): string {
  const header = ['id', 'timestamp', 'speaker', 'text'].join(',');
  const rows = segments.map((seg) => {
    return [
      escapeCsvField(seg.id),
      escapeCsvField(seg.timestamp),
      escapeCsvField(seg.speaker),
      escapeCsvField(seg.text),
    ].join(',');
  });

  return [header, ...rows].join('\r\n');
}

/**
 * Resolves CSV export filename based on the imported audio file name.
 * If audio file exists (e.g. "meeting.mp3"), returns "meeting.csv".
 * If no audio file exists, falls back to "transcription.csv".
 */
export function getCsvFileName(audioFileName?: string | null): string {
  if (!audioFileName || !audioFileName.trim()) {
    return 'transcription.csv';
  }
  const trimmed = audioFileName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot > 0) {
    const base = trimmed.substring(0, lastDot);
    return `${base}.csv`;
  }
  return `${trimmed}.csv`;
}

/**
 * Triggers browser download of the CSV file.
 * Adds UTF-8 BOM (\uFEFF) to guarantee correct character encoding in Excel.
 */
export function downloadCsv(segments: TranscriptSegment[], filename = 'transcription.csv'): void {
  const csvContent = generateCsvString(segments);
  // \uFEFF is UTF-8 Byte Order Mark (BOM)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads as JSON
 */
export function downloadJson(segments: TranscriptSegment[], filename = 'transcription.json'): void {
  const jsonContent = JSON.stringify(segments, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads as formatted text / script
 */
export function downloadTxt(segments: TranscriptSegment[], filename = 'transcription.txt'): void {
  const txtContent = segments
    .map((s) => `[${s.timestamp}] ${s.speaker}:\n${s.text}\n`)
    .join('\n');
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.txt') ? filename : `${filename}.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads a File as text, auto-detecting UTF-8 vs Shift-JIS (for Windows Excel CSVs).
 */
export async function readCsvFileWithEncoding(file: File, forcedEncoding?: 'utf-8' | 'shift-jis'): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check UTF-8 BOM
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  }

  if (forcedEncoding) {
    const decoder = new TextDecoder(forcedEncoding);
    return decoder.decode(bytes);
  }

  // Try UTF-8 first with fatal=true to detect Shift-JIS invalid UTF-8 sequences
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(bytes);
  } catch {
    // If UTF-8 decode failed, decode as Shift-JIS
    try {
      const sjisDecoder = new TextDecoder('shift-jis');
      return sjisDecoder.decode(bytes);
    } catch {
      // Fallback
      const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
      return fallbackDecoder.decode(bytes);
    }
  }
}

/**
 * Parses a CSV/TSV string back into TranscriptSegment array.
 * Robust against multi-line quotes, TSV (tabs), Japanese headers, and headerless files.
 */
export function parseCsv(csvText: string): TranscriptSegment[] {
  if (!csvText || !csvText.trim()) return [];

  // Strip BOM if present
  let cleanText = csvText.replace(/^\uFEFF/, '').trim();

  // Detect delimiter: check first line for tabs vs commas
  const firstLine = cleanText.split(/[\r\n]+/)[0] || '';
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';

  // RFC 4180 multi-line quoted CSV parser
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((f) => f.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((f) => f.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  // Analyze header row
  const firstRow = rows[0].map((h) => h.trim().toLowerCase());
  const isIdHeader = (h: string) => /^(id|no|番号|連番|#)$/i.test(h);
  const isTsHeader = (h: string) => /^(timestamp|time|タイムスタンプ|時間|時刻|開始時間|区間)$/i.test(h);
  const isSpkHeader = (h: string) => /^(speaker|話者|話者名|発話者|発言者|名前|氏名)$/i.test(h);
  const isTxtHeader = (h: string) => /^(text|transcript|content|発言|テキスト|内容|発言内容|本文)$/i.test(h);

  let idIdx = firstRow.findIndex(isIdHeader);
  let tsIdx = firstRow.findIndex(isTsHeader);
  let spkIdx = firstRow.findIndex(isSpkHeader);
  let txtIdx = firstRow.findIndex(isTxtHeader);

  const hasHeader = idIdx !== -1 || tsIdx !== -1 || spkIdx !== -1 || txtIdx !== -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  // Fallback index assignment if header was missing or partial
  if (!hasHeader) {
    if (firstRow.length >= 4) {
      idIdx = 0;
      tsIdx = 1;
      spkIdx = 2;
      txtIdx = 3;
    } else if (firstRow.length === 3) {
      // timestamp, speaker, text
      idIdx = -1;
      tsIdx = 0;
      spkIdx = 1;
      txtIdx = 2;
    } else if (firstRow.length === 2) {
      // speaker, text
      idIdx = -1;
      tsIdx = -1;
      spkIdx = 0;
      txtIdx = 1;
    }
  } else {
    // If some headers weren't found, supply smart defaults based on remaining columns
    if (txtIdx === -1) {
      // Choose the longest field or last column
      txtIdx = firstRow.length - 1;
    }
    if (spkIdx === -1 && firstRow.length >= 3) {
      spkIdx = idIdx === 0 && tsIdx === 1 ? 2 : 1;
    }
  }

  const segments: TranscriptSegment[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const rawId = idIdx !== -1 && row[idIdx] ? parseInt(row[idIdx].trim(), 10) : i + 1;
    const timestamp = tsIdx !== -1 && row[tsIdx] ? row[tsIdx].trim() : '00:00';
    const speaker = spkIdx !== -1 && row[spkIdx] ? row[spkIdx].trim() : `話者${String.fromCharCode(65 + (i % 26))}`;
    const text = txtIdx !== -1 && row[txtIdx] ? row[txtIdx].trim() : (row[row.length - 1] || '').trim();

    segments.push({
      id: isNaN(rawId) ? i + 1 : rawId,
      timestamp: timestamp || '00:00',
      speaker: speaker || '話者A',
      text,
    });
  }

  // Renumber IDs sequentially starting from 1
  return segments.map((seg, idx) => ({
    ...seg,
    id: idx + 1,
  }));
}
