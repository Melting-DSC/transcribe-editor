# TODO — 文字起こしエディタ 改善タスク

ブラウザ完結の文字起こし編集ツールとしての課題を優先順に整理したもの。
（旧「Gemini Transcribe」のサーバー / API 依存は撤去済み。履歴は git log を参照。）

凡例: **P0** = データ損失/明確なバグ / **P1** = 不具合・不整合 / **P2** = 品質・運用・改善

---

## P0 — 最優先（データ保全）

- [x] **Undo/Redo を一本化する** — `src/App.tsx`
- [x] **リロード後の音声不一致を解消する** — `src/App.tsx`
- [ ] **ダウンロード処理の重複排除** — 済（`csv.ts` の `downloadBlob` に共通化）
- [ ] **純関数の単体テスト追加** — `time.ts` / `csv.ts`（特に `parseCsv`）を対象。テストランナー導入 + CI。

---

## P1 — 明確な不具合・不整合

- [x] **検索ハイライトの死にコード削除** — `UtteranceCard.tsx` の `renderHighlightedText` を削除。
- [x] **既定話者名を統一** — 「発言追加」の既定を `話者A` に。
- [x] **結合処理を `time.ts` ベースに修正** — `parseRangeToSeconds` + `formatSecondsToTimestamp` に統一。
- [x] **未使用 import / 型を削除** — 各コンポーネント / `types.ts`。
- [x] **モーダルのアクセシビリティ** — `ModalShell.tsx` を導入（`role="dialog"` / `aria-modal` / Escape 閉じ / 背景クリック閉じ）。アイコンボタンに `aria-label` 追加。
- [ ] **フォーカストラップ** — `ModalShell` にフォーカス移動 / トラップ / 復帰を追加。
- [ ] **`window.alert` / `window.confirm` を排す** — `App.tsx` の削除確認・リセット確認をスタイル済み UI に統一。

---

## P2 — 品質・運用・UX

### CSV / ユーティリティ
- [x] **区切り文字判定を改善** — 1行目でのカンマ/タブ出現回数比較（引用符内は除外）。
- [ ] **エクスポート形式の拡充** — 例: Markdown / VTT / SRT 出力の追加検討。

### ビルド / 設定
- [x] **Vite のみの構成に整理** — `server.ts` / Express / dotenv / `@google/genai` を撤去。`dev`/`build`/`preview` を Vite に統一。`clean` をクロスプラットフォーム化。
- [ ] **不要依存の最終精査** — 削除済み（`motion` / `autoprefixer` / `esbuild` / `tsx`）。lockfile を再生成する。

### a11y / メタ
- [x] **`html lang` を `ja` に** — `index.html`
- [ ] **キーボード操作の網羅** — Undo/Redo のショートカット（Ctrl+Z / Ctrl+Y）を実際に配線する（Toolbar の title 表示のみで未実装）。

### パフォーマンス
- [ ] **localStorage 保存をデバウンス** — `App.tsx` はキーストロークごとに全文 JSON 書き込み + `lastSavedTime` 更新による再レンダリング。
- [ ] **カードの再描画抑制** — `UtteranceCard` を `React.memo` 化（テキスト1文字入力で全カード再描画）。

### セキュリティ / プライバシー
- [ ] **localStorage の平文保存** — 共有端末での残留対策（注意書き or 任意クリア導線）。

---

## 未着手の確認事項
- [ ] 大規模データ（数千発言）でのスクロール / 編集性能の計測と仮想化の検討。
