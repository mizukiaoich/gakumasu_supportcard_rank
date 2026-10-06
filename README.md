# gakumasu_supportcard_rank
学マスサポートカードランキング作成

## 学園アイドルマスター サポートカード能力ランキング

育成プラン・プロデュース行動回数・Vo / Da / Vi の優先順位を入力すると、条件に合わせてサポートカードの評価値を計算してランキング表示する **非公式** の静的 Web アプリです。固定の Tier 表ではなく、入力条件に応じてランキングが変わります。

- バックエンド・ログイン・外部 API 不要（HTML / CSS / JavaScript / JSON のみ、ビルド不要）
- GitHub Pages で公開可能（プロジェクトサイトのサブパス配下でも動作）
- PC・スマートフォン対応

> **注意：現在登録されているサポートカード（`sample_001`〜`sample_012`）はすべて動作確認用のダミーデータです。** カード名・効果・数値は実際のゲームデータではありません。画面上でも「サンプル」と表示されます。

本サイトは個人が作成した非公式のファンツールであり、ゲームの公式運営とは関係ありません。

## 画面

| URL | 内容 |
| --- | --- |
| `/` | ランディングページ（概要・特徴・ランキングについて・使い方・FAQ・注意事項） |
| `/ranking/` | ランキング計算画面（条件入力・優先パラメータランキング・総合評価ランキング・カード詳細） |

## 計算方法

各カードの初期評価と 6 つの効果スロットについて計算します（初期版は完凸状態のみ）。

```
初期評価（initial_bonus）は行動回数に関係なく value を target のパラメータに固定で加算
actualCount  = MIN(ユーザー入力の行動回数, max_count)
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
│  ├─ support_cards.json      サポートカード（現在はダミーデータのみ）
│  ├─ plans.json              育成プラン
│  └─ action_types.json       行動種類
├─ images/
│  ├─ hero/hero-visual.svg    ファーストビューの装飾（オリジナル・差し替え可）
│  ├─ support_cards/          カード画像（sample_001.svg はダミー画像）
│  └─ favicon.svg
├─ scripts/serve.mjs          ローカル確認用の静的サーバー
├─ tests/unit/                単体テスト（node:test）
├─ tests/e2e/                 ブラウザテスト（node:test + Playwright）
├─ .nojekyll                  GitHub Pages で Jekyll 処理を無効化
└─ package.json
```

ゲームデータは `data/`、計算ロジックは `js/calculator.js` / `js/ranking.js` に分離しています。

## サポートカードデータの追加方法

`data/support_cards.json` の配列にカードを追加します。

```json
{
  "id": "card_0001",
  "name": "カード名",
  "rarity": "SSR",
  "plan": "センス",
  "image": "images/support_cards/card_0001.webp",
  "initial_bonus": [
    { "target": "Vo", "value": 65 }
  ],
  "effects": [
    { "type": "おでかけ", "target": "Vo", "max_count": 3, "value": 10 },
    { "type": "相談", "target": "Da", "max_count": 2, "value": 15 },
    { "type": "削除", "target": "Vo", "max_count": 2, "value": 10 },
    { "type": "削除", "target": "Vi", "max_count": 1, "value": 20 },
    { "type": "SPレッスン", "target": "Vo", "max_count": 4, "value": 8 },
    { "empty": true }
  ]
}
```

| 項目 | 内容 |
| --- | --- |
| `id` | 一意な文字列（重複不可）。同順位時の最終的な並び順にも使用 |
| `name` | カード名 |
| `rarity` | レアリティ（文字列） |
| `plan` | `data/plans.json` の `name` のいずれか |
| `image` | サイトルートからの画像パス。画像がない場合は `""`（プレースホルダー表示） |
| `is_sample` | 任意。`true` の場合は画面に「サンプル」と表示。**実データには付けない** |
| `initial_bonus` | 初期評価（例：Vo +65）。行動回数に関係なく固定で加算。複数指定可、なしの場合は `[]` または省略 |
| `initial_bonus[].target` | `Vo` / `Da` / `Vi` |
| `initial_bonus[].value` | 加算する値（数値） |
| `effects` | **ちょうど 6 件**。完凸状態の効果を記入 |
| `effects[].type` | `data/action_types.json` の `name` のいずれか |
| `effects[].target` | `Vo` / `Da` / `Vi` |
| `effects[].max_count` | 最大発動回数（0 以上の整数） |
| `effects[].value` | 1 回あたりの上昇値（数値） |
| 空スロット | `{ "empty": true }`（計算対象外） |

データに不備がある場合、ランキング画面に「`support_cards.json: [2] (id: xxx).effects[4].target: ...`」のように問題箇所が表示され、計算は行われません。`npm run test:unit` でもデータファイルの検証が行われます。

**実データへの切り替え時**は、ダミーデータ（`is_sample: true` のカード）を削除し、ゲーム内で確認した正確な値を登録してください。全カードから `is_sample` がなくなると、画面上のサンプル表示も消えます。

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
  { "name": "新しいプラン" }
]
```

カードの `plan` には、ここで定義した `name` と同じ文字列を指定してください。

## 行動種類の追加方法

`data/action_types.json` に追加します。行動回数の入力欄が自動で増え、カード効果の `type` として使えるようになります。`default` は入力欄の初期値（0 以上の整数、省略時 0）です。

```json
{ "name": "新しい行動", "default": 0 }
```

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
