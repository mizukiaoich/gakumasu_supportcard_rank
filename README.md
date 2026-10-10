# gakumasu_supportcard_rank
学マスサポートカードランキング作成

## 学園アイドルマスター サポートカード能力ランキング

育成プラン・プロデュース行動回数・Vo / Da / Vi の優先順位を入力すると、条件に合わせてサポートカードの評価値を計算してランキング表示する **非公式** の静的 Web アプリです。固定の Tier 表ではなく、入力条件に応じてランキングが変わります。

- バックエンド・ログイン・外部 API 不要（HTML / CSS / JavaScript / JSON のみ、ビルド不要）
- GitHub Pages で公開可能（プロジェクトサイトのサブパス配下でも動作）
- PC・スマートフォン対応

> **注意：** `data/support_cards.json` のカードデータは手作業で入力したものです。計算式で表せない効果（パラメータ上昇量の割合アップ、条件付きの効果など）は空スロットとして扱い、計算に含めていません。テスト用のダミーカードは `tests/fixtures/sample_cards.json` にあります。

本サイトは個人が作成した非公式のファンツールであり、ゲームの公式運営とは関係ありません。

## 画面

| URL | 内容 |
| --- | --- |
| `/` | ランディングページ（概要・特徴・ランキングについて・使い方・FAQ・注意事項） |
| `/ranking/` | ランキング計算画面（条件入力・優先パラメータランキング・総合評価ランキング・カード詳細） |

## 計算方法

各カードの 6 つの効果スロット（初期評価を含む）とイベント効果について計算します（初期版は完凸状態のみ）。

```
効果（effects）とイベント効果（event_bonus）は同じ形式・同じ計算方法
固定加算の効果（初期評価）: 行動回数に関係なく value を target のパラメータに1回だけ加算
それ以外の効果: actualCount  = MIN(ユーザー入力の行動回数, max_count)
contribution = actualCount × value
target が Vo / Da / Vi のパラメータに contribution を加算
total = Vo + Da + Vi
```

- 空スロット（`{ "empty": true }`）は計算しません。
- **優先パラメータランキング**：第一優先 → 第二優先 → 総合評価 → カード ID（昇順）の順に比較（重み付き合算はしません）。
- **総合評価ランキング**：総合評価 → カード ID（昇順）の順に比較。

## ローカルでの起動方法

ES Modules と `fetch` で JSON を読み込むため、`index.html` を直接ファイルとして開くのではなく、Web サーバー経由で開いてください。

```bash
# Node.js 18 以上（追加パッケージ不要）
npm start
# → http://localhost:8080/ を開く

# GitHub Pages のプロジェクトサイトと同じサブパスで確認する場合
npm run start:pages
# → http://localhost:8080/gakumasu_supportcard_rank/ を開く
```

Node.js がない場合は `python3 -m http.server 8080` でも動作します。

## テスト

```bash
npm install          # テスト用の Playwright を取得（ブラウザ本体は別途インストール済みである前提）
npx playwright install chromium   # ブラウザが未インストールの場合のみ
npm test             # 単体テスト + ブラウザテスト
npm run test:unit    # 計算・並び替え・データ検証の単体テスト（追加パッケージ不要）
npm run test:e2e     # ブラウザでの画面テスト（サブパス配下で配信して確認）
```

## ファイル構成

```
/
├─ index.html                 ランディングページ
├─ ranking/index.html         ランキング計算画面
├─ css/
│  ├─ common.css              共通（色・ヘッダー・フッター・ボタン）
│  ├─ landing.css             ランディングページ
│  └─ ranking.css             ランキング計算画面
├─ js/
│  ├─ constants.js            評価対象パラメータ（Vo / Da / Vi）と効果スロット数
│  ├─ data-loader.js          JSON 読み込み・パス解決
│  ├─ validator.js            データ・入力値の検証
│  ├─ calculator.js           評価値の計算（純粋関数）
│  ├─ ranking.js              ランキングの並び替え（純粋関数）
│  ├─ card-image.js           カード画像／プレースホルダー表示
│  ├─ app.js                  ランキング計算画面の UI
│  └─ landing.js              ランディングページ（スマホ用メニュー）
├─ data/
│  ├─ support_cards.json      サポートカード（excel/support_cards.xlsx から変換）
│  ├─ plans.json              育成プラン
│  ├─ action_types.json       行動種類（行動回数の入力欄）
│  └─ effect_types.json       効果種類（SP終了時など、別の行動の回数で発動する効果）
├─ images/
│  ├─ hero/hero-visual.svg    ファーストビューの装飾（オリジナル・差し替え可）
│  ├─ support_cards/          カード画像（support_001.png など。未配置の画像は「NO IMAGE」表示。sample_001.svg はテスト用ダミー）
│  └─ favicon.svg
├─ excel/support_cards.xlsx   サポートカード入力用の Excel（npm run cards:export / cards:import）
├─ scripts/serve.mjs          ローカル確認用の静的サーバー
├─ scripts/cards-excel.mjs    Excel ⇔ JSON 変換コマンド（処理本体は cards-excel-lib.mjs）
├─ tests/unit/                単体テスト（node:test）
├─ tests/e2e/                 ブラウザテスト（node:test + Playwright）
├─ .nojekyll                  GitHub Pages で Jekyll 処理を無効化
└─ package.json
```

ゲームデータは `data/`、計算ロジックは `js/calculator.js` / `js/ranking.js` に分離しています。

## サポートカードデータの追加方法

Excel で入力して変換する方法（おすすめ）と、`data/support_cards.json` を直接編集する方法があります。

### Excel で入力する（おすすめ）

```bash
npm install            # 初回のみ（Excel の読み書きに exceljs を使用）
npm run cards:export   # 現在の data/support_cards.json から excel/support_cards.xlsx を作成
# excel/support_cards.xlsx を Excel / Google スプレッドシート等で編集・保存
npm run cards:check    # 検証のみ（JSON は変更しない）
npm run cards:import   # 検証して問題がなければ data/support_cards.json を上書き
```

- 「カード一覧」シートに **1行＝1カード** で入力します。効果1〜6・イベント効果1〜2は横に並んでいます（イベント効果も効果と同じく「種類・対象・最大回数・値」の4列）。
- プラン・対象・効果種類・サンプル列はプルダウンで選べます（選択肢は `data/plans.json`・`data/action_types.json`・`data/effect_types.json` から作成）。
- 使わない効果スロット、今の計算式で表せない効果（パラメータ上昇量%アップ、条件付きの効果など）は、その効果の4列をすべて空欄にします（空スロット）。
- 初期評価は効果スロットの1つとして「種類＝初期評価」で入力します。最大回数は 1 か空欄です（固定加算は常に1回だけ）。
- 問題があると「`カード一覧 5行目 (id: ssr_0001) 効果3 対象: ...`」のように行番号と列名を表示し、JSON は変更しません。
- 別のファイルを使う場合は `node scripts/cards-excel.mjs import path/to/file.xlsx` のように指定できます。Google スプレッドシートは「ファイル → ダウンロード → Microsoft Excel (.xlsx)」で書き出してください。
- 行動種類・効果種類・プランを増やしたときは、`npm run cards:export` で Excel を作り直すとプルダウンにも反映されます（既存の入力内容は JSON から引き継がれるので、先に `cards:import` しておいてください）。

### JSON を直接編集する

`data/support_cards.json` の配列にカードを追加します。

```json
{
  "id": "card_0001",
  "name": "カード名",
  "rarity": "SSR",
  "plan": "センス",
  "image": "images/support_cards/card_0001.webp",
  "event_bonus": [
    { "type": "初期評価", "target": "Da", "max_count": 1, "value": 20 }
  ],
  "effects": [
    { "type": "おでかけ", "target": "Vo", "max_count": 3, "value": 10 },
    { "type": "相談", "target": "Da", "max_count": 2, "value": 15 },
    { "type": "削除", "target": "Vo", "max_count": 2, "value": 10 },
    { "type": "削除", "target": "Vi", "max_count": 1, "value": 20 },
    { "type": "VoSP終了時", "target": "Vo", "max_count": 4, "value": 8 },
    { "type": "初期評価", "target": "Vo", "value": 65 }
  ]
}
```

| 項目 | 内容 |
| --- | --- |
| `id` | 一意な文字列（重複不可）。同順位時の最終的な並び順にも使用 |
| `name` | カード名 |
| `rarity` | レアリティ（文字列） |
| `plan` | `data/plans.json` の `name` のいずれか。`フリー`（`all_plans: true`）のカードはどのプランを選んでもランキングに含まれる |
| `image` | サイトルートからの画像パス。画像がない場合は `""`（プレースホルダー表示） |
| `is_sample` | 任意。`true` の場合は画面に「サンプル」と表示。**実データには付けない** |
| `event_bonus` | イベント効果。`effects` と同じ形式（`type` / `target` / `max_count` / `value`）の配列で、計算方法も同じ。件数の制限なし、空スロットは使わない。なしの場合は `[]` または省略。例：固定で Vo +20 なら `{ "type": "初期評価", "target": "Vo", "max_count": 1, "value": 20 }` |
| `effects` | **ちょうど 6 件**。完凸状態の効果を記入 |
| `effects[].type` | `data/action_types.json` または `data/effect_types.json` の `name` のいずれか |
| `effects[].target` | `Vo` / `Da` / `Vi` |
| `effects[].max_count` | 最大発動回数（0 以上の整数）。初期評価など固定加算の効果では `1` または省略（常に1回だけ加算） |
| `effects[].value` | 1 回あたりの上昇値（数値） |
| 初期評価 | `{ "type": "初期評価", "target": "Vo", "value": 65 }`。効果スロットの1つとして記入し、行動回数に関係なく1回だけ加算 |
| 空スロット | `{ "empty": true }`（計算対象外） |

データに不備がある場合、ランキング画面に「`support_cards.json: [2] (id: xxx).effects[4].target: ...`」のように問題箇所が表示され、計算は行われません。`npm run test:unit` でもデータファイルの検証が行われます。

テスト用のダミーカードは `tests/fixtures/sample_cards.json` にあり、画面テストはこのファイルを使います（`data/support_cards.json` の内容に左右されません）。

## 画像の追加方法

1. 利用条件を確認したうえで、画像ファイルを `images/support_cards/` に置きます（例：`card_0001.webp`）。
2. 該当カードの `image` に `"images/support_cards/card_0001.webp"` を設定します。

画像は縦横比 3:4 の枠に `object-fit: cover` で表示されます。ファイルが存在しない・読み込めない場合は自動的に「NO IMAGE」のプレースホルダーに切り替わります。公式画像を無断で取得・転載しないでください。

ファーストビューの装飾は `images/hero/hero-visual.svg` を同名ファイルで置き換えるか、`index.html` の `.hero-art` の `src` を変更すると差し替えられます。

## 育成プランの追加方法

`data/plans.json` に追加します。画面の選択肢は自動で増えます。

```json
[
  { "name": "センス" },
  { "name": "ロジック" },
  { "name": "アノマリー" },
  { "name": "新しいプラン" },
  { "name": "フリー", "all_plans": true }
]
```

カードの `plan` には、ここで定義した `name` と同じ文字列を指定してください。`"all_plans": true` のプラン（フリー）は選択肢には表示されず、そのカードはどのプランを選んでもランキングの対象になります。

## 行動種類の追加方法

`data/action_types.json` に追加します。行動回数の入力欄が自動で増え、カード効果の `type` として使えるようになります。`default` は入力欄の初期値（0 以上の整数、省略時 0）です。

現在の行動種類は、Voレッスン / Daレッスン / Viレッスン（いずれも SPレッスンを含む）/ 授業・営業終了時 / おでかけ / 相談 / 活動支給・差し入れ選択時 / 強化 / 削除 / 休む / 特別指導開始時 / 試験・オーディション終了時 / 好調・好印象・やる気・集中・元気・強気・温存・全力 の各「効果カード獲得時」です。これらはそのまま効果の種類としても使えます。

`description` を付けると、入力欄の名前の下に補足として表示されます（例：`"description": "SPレッスンを含む"`）。

```json
{ "name": "新しい行動", "default": 0 }
```

## 効果種類の追加方法

行動回数の入力欄は増やさずに、**既存の行動の回数で発動する効果**を追加する場合は `data/effect_types.json` に追加します。`count_from` には、発動回数として参照する `action_types.json` の行動種類を指定します。

```json
[
  { "name": "初期評価", "fixed": true },
  { "name": "VoSP終了時", "count_from": "Voレッスン" },
  { "name": "DaSP終了時", "count_from": "Daレッスン" },
  { "name": "ViSP終了時", "count_from": "Viレッスン" }
]
```

たとえば効果 `{ "type": "VoSP終了時", "max_count": 4, "value": 17 }` は、入力した Voレッスン（SPレッスンを含む）の回数（最大4回）× 17 を加算します。Daレッスン・Viレッスンの回数では発動しません。

`"fixed": true` の効果種類（初期評価）は、行動回数に関係なく `value` を1回だけ加算します。カードの効果の `max_count` は `1` にするか省略します。

`count_from` は次の3通りで書けます。

| 書き方 | 例 | 発動回数 |
| --- | --- | --- |
| 行動名 | `"count_from": "Voレッスン"` | その行動の入力回数 |
| 行動名の配列 | `"count_from": ["好調効果カード獲得時", "好印象効果カード獲得時", …]`（スキル獲得時） | 入力回数の**合計** |
| 対象パラメータ別 | `"count_from": { "Vo": "Voレッスン", "Da": "Daレッスン", "Vi": "Viレッスン" }`（SPレッスン） | 効果の対象に対応する行動の回数（対象 Vo の効果は Voレッスンの回数だけで、Da・Viレッスンは数えない） |

`count_label` を付けると、カード詳細の内訳表に「どの回数を使ったか」の説明として表示されます。


## GitHub Pages の設定手順

ビルドは不要です。`.github/workflows/pages.yml` が `main` へのプッシュ時にリポジトリのファイルをそのまま公開します。

1. 変更を `main` ブランチにマージ（またはプッシュ）します。
2. GitHub のリポジトリ画面で **Settings → Pages** を開きます。
3. **Build and deployment** の **Source** を **GitHub Actions** にします。
4. **Actions** タブで「Deploy to GitHub Pages」が実行されます。設定変更前にマージ済みの場合は、ワークフローを選んで **Run workflow** を押してください。
5. 完了後、`https://<ユーザー名>.github.io/gakumasu_supportcard_rank/` で公開されます。

（Source を **Deploy from a branch**・`main`・`/ (root)` にする方法でも公開できます。）

リンク・データ・画像はすべて相対パス（データと画像は `js/data-loader.js` の位置を基準に解決）なので、プロジェクトサイト（サブパス）でも独自ドメイン（ルート）でも同じファイルのまま動作します。`.nojekyll` により Jekyll の処理は行われません。

## ライセンス

コードは [MIT License](LICENSE) です。ゲームに関する権利は各権利者に帰属します。
