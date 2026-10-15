# TODO — Gemini Transcribe 改善タスク

コードベース分析で洗い出した課題を優先順に整理したもの。
行番号は調査時点（`tsc --noEmit` はパス済み）のもの。

凡例: **P0** = データ損失/明確なバグ / **P1** = 不具合・不整合 / **P2** = 品質・運用・改善

---

## P0 — 最優先（データ保全・誤情報）

- [x] **Undo/Redo を一本化する** — `src/App.tsx`
  - 履歴を ref（`historyRef`）に一本化し、`commitSegmentsChange` / テキスト編集 / Undo / Redo の全経路を通した。
  - テキスト編集は 600ms デバウンスで 1 エントリに凝縮（`scheduleTextHistory`）し、構造変更・Undo・Redo の前に `flushPendingHistory` で確実に確定。これでテキスト編集も Undo 可能になり、Undo によるテキスト消失を解消。
  - 履歴上限 `HISTORY_LIMIT = 200` と ID 正規化 `normalizeSegments` を追加。

- [x] **リロード後の音声不一致を解消する** — `src/App.tsx`
  - `audioName` を localStorage から復元するのをやめ、常に「現在メモリ上にある音声」を表すようにした（旧 `STORAGE_KEY_AUDIO_NAME` は廃止）。
  - `importedAudioFileName` は CSV 出力ファイル名の既定値としてのみ復元し、未再接続なら起動時に注意バナーを表示（再選択 or 閉じる）。音声を再接続すると自動で消える。

- [x] **`isQuotaFallback` と `fallbackNotice` を正確にする** — `server.ts`
  - `usedFallback`（フォールバックした）と `isQuotaError`（真に 429/クォータ）を分離。
  - `isQuotaFallback` は両方が真のときのみ true。通知文言もクォータ時と一般障害時で出し分け。

- [x] **`modelUsed` を実際のモデルに合わせる** — `server.ts`
  - 実際に segments を生成したモデルを `modelUsed` に記録（3.5 / 3.1-flash-lite / 3.8-flash）。
  - `MODEL_DISPLAY_NAMES` を追加し、`fallbackNotice` にも実モデル名を反映。

- [ ] **Gemini モデル ID の実在確認** — `server.ts:127, :234, :244, :312, :342`
  - `gemini-3.5-transcribe` / `gemini-3.1-flash-lite` / `gemini-3.8-flash` が現在の API で有効か確認。
  - 無効な場合、全リクエストが失敗し P0-3 の「クォータ」メッセージで覆い隠される。
  - **未実施**: 実 API キーでのライブ確認が必要（オフラインでは検証不可）。AGENTS.md はこれら3モデルをルーティングとして明記しているため、コード上は据え置き。

---

## P1 — 明確な不具合・不整合

- [ ] **検索ハイライトを実装 or 削除する** — `src/components/UtteranceCard.tsx:112-128`
  - `renderHighlightedText` はどこからも呼ばれない死にコード。`new RegExp(query)` をエスケープ無しで使う（呼べば `(` 等で例外）。
  - 対応: 正規表現エスケープの上で実装するか、関数と関連 import を削除。現状の検索は絞り込みのみ。

- [ ] **既定話者名を統一する** — `src/App.tsx:363`
  - 「発言追加」が `話者1`。他はすべて `話者A/B/C`。`話者A` 系に揃える。

- [ ] **結合処理を `time.ts` ベースに直す** — `src/App.tsx:318-324`
  - `timestamp.split('-')` の手書き結合は非標準形式で壊れる。`parseRangeToSeconds` を使う。
  - 併せて未使用変数 `currentRange` / `nextRange` を削除。

- [ ] **再生状態の真実源を一本化する** — `src/App.tsx:408 vs :473`
  - `handlePlayPause` は `isPlaying` を参照、スペースキーは `audioRef.current.paused` を参照。ずれの余地をなくす。

- [ ] **サーバの不要な再文字起こしを止める** — `server.ts:281, :374`
  - ネイティブ分離が無いだけで生テキストは取得済みなのに、Step2 で高コストな2回目の音声送信を実行。
  - 対応: 先に `:374` の文分割フォールバックを試し、それでも空のときだけ Step2 へ。

- [ ] **フォールバック JSON 処理の二重実装を統合する** — `server.ts:326-337, :355-366`
  - lite/flash でほぼ同一のパース・マッピングをコピー。ヘルパー関数に集約。

- [ ] **`/api/health` を UI と連携する** — `src/App.tsx:797`
  - `apiKeyConfigured={true}` をハードコード。起動時に `/api/health` を取得し、キー未設定なら警告バナーを出す。

- [ ] **未使用 import / 型を削除する**
  - `src/App.tsx`: `Sparkles`, `Download`, `Volume2`
  - `src/components/AudioInputSection.tsx`: `HelpCircle`, `AlertCircle`
  - `src/components/Toolbar.tsx`: `parseCsv`
  - `src/components/CsvImportModal.tsx`: `FileText`, `Layers`, `ArrowRight`, `FileAudio`
  - `src/components/SpeakerManagerModal.tsx`: `Plus`
  - `src/types.ts`: `SpeakerInfo`, `AudioState`（未使用の型）

---

## P2 — 品質・運用・UX

### CSV / ユーティリティ
- [ ] **区切り文字判定を改善** — `src/utils/csv.ts:152` — 1行目 bool 判定だと本文に `,` を含む TSV を誤判定。出現回数比較に。
- [ ] **ダウンロード処理の重複排除** — `src/utils/csv.ts:54-103` — `downloadCsv/Json/Txt` の DOM 操作を `downloadBlob` に共通化。
- [ ] **純関数の単体テスト追加** — `time.ts` / `csv.ts`（特に `parseCsv`）を対象。テストランナー導入 + CI。

### ビルド / 設定
- [ ] **`npm start` を本番相当にする** — `package.json:9` — `NODE_ENV=production` を別途付けないと Vite middleware で起動する事故を防ぐ（`cross-env` 等）。
- [ ] **`preview` スクリプトを見直す** — `package.json:10` — `/api` が無く動かない。削除か注記。
- [ ] **`clean` をクロスプラットフォーム化** — `package.json:11` — `rm -rf` は Windows で失敗。
- [ ] **package.json を整備** — `name: "react-example"` / `version: 0.0.0` を実態に。不要依存（`autoprefixer` / `postcss` / `esbuild` の要否）を精査。lockfile の扱いを決定。
- [ ] **本番 SPA fallback が API を飲み込む問題** — `server.ts:458` — 未知の `/api/*` は 404 JSON を返すよう分岐。
- [ ] **`PORT` の入力検証** — `server.ts:13` — NaN 時に既定値へフォールバック。
- [ ] **エラーメッセージの露出を抑える** — `server.ts:440` — 内部 `error.message` をそのまま返さない。

### a11y / メタ
- [ ] **`html lang` を `ja` に** — `index.html:2`
- [ ] **モーダルのアクセシビリティ** — `*Modal.tsx` — `role="dialog"` / `aria-modal` / Escape 閉じ / フォーカストラップ / 背景クリック閉じ。アイコンのみボタンに `aria-label`。
- [ ] **`requestFramePermissions` を見直す** — `metadata.json:4` — マイク録音を使うのに空。

### ドキュメント
- [ ] **README を実態に合わせる** — `.env.local` 案内は誤り（`dotenv.config()` は `.env` のみ読む）。手順と構成を修正。
- [ ] **`.env.example` の `APP_URL`** — コード未使用。削除か用途明記。

### セキュリティ / プライバシー
- [ ] **認証・レート制限** — `POST /api/transcribe` は誰でも叩ける（100MB body）。公開するなら必須。
- [ ] **localStorage の平文保存** — 共有端末での残留対策（注意書き or 任意クリア導線）。

### パフォーマンス
- [ ] **localStorage 保存をデバウンス** — `src/App.tsx:131-141` — キーストロークごとに全文 JSON 書き込み + `lastSavedTime` 更新による再レンダリング。
- [ ] **履歴の上限を設ける** — `src/App.tsx:64, :237-250` — 構造変更ごとに全コピー保持でメモリ増大。
- [ ] **カードの再描画抑制** — `UtteranceCard` を `React.memo` 化（テキスト1文字入力で全カード再描画）。

---

## 未着手の確認事項
- [ ] タイムアウト / リトライ / 中断（abort）を `server.ts` の Gemini 呼び出しに追加。
- [ ] `window.alert` / `window.confirm`（`App.tsx:290, :646`）をスタイル済み UI に統一。
