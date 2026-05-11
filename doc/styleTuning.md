# styleTuning.md

## 使い方
- 調整対象は `style.css` の `:root` 変数。
- まずは `推奨範囲` 内で変更し、ブラウザをリロードして確認。
- 1回の変更は1〜2項目に絞ると差分が分かりやすいです。

## Material Tuning Pack

| 変数名 | 用途 | 基準値 | 推奨範囲 | 危険域 |
|---|---|---:|---:|---:|
| `--tune-felt-grain` | フェルト粒子の濃さ | `0.04` | `0.02`〜`0.08` | `0.12`超で黒つぶれしやすい |
| `--tune-felt-vignette` | フェルト外周の暗さ | `0.42` | `0.28`〜`0.55` | `0.65`超で中央以外が沈む |
| `--tune-panel-specular` | パネルの上面反射 | `0.18` | `0.10`〜`0.30` | `0.38`超でテカり過多 |
| `--tune-wood-stripe` | 木目ストライプ強度 | `0.03` | `0.015`〜`0.06` | `0.08`超でノイズ化 |

## Image Match Pack

| 変数名 | 用途 | 基準値 | 推奨範囲 | 備考 |
|---|---|---:|---:|---|
| `--m-title-metal-light` | タイトル金属ハイライト色 | `#f1d39e` | 明るめ金系 | 明るくしすぎると輪郭が飛ぶ |
| `--m-title-metal-mid` | タイトル中間金属色 | `#b88a52` | 金〜銅系 | ロゴ全体の主色 |
| `--m-title-metal-dark` | タイトル影側金属色 | `#6d4a28` | 濃い銅〜茶 | 深くするとエンボス強化 |
| `--m-marble-light` | 左パネル大理石の明るい粒 | `rgba(246,226,190,0.11)` | `0.06`〜`0.16` | |
| `--m-marble-mid` | 左パネル中間模様 | `rgba(180,140,93,0.16)` | `0.10`〜`0.22` | |
| `--m-marble-dark` | 左パネル陰影 | `rgba(65,35,20,0.5)` | `0.30`〜`0.65` | 高すぎると潰れる |
| `--m-bg-outside-a` | 画面外背景の主色A | `#2d0f06` | 暗い赤茶系 | |
| `--m-bg-outside-b` | 画面外背景の主色B | `#120503` | さらに暗い茶黒系 | |
| `--m-card-paper` | カード紙質の中間色 | `#f2ecde` | 黄味のある生成り | 白すぎると安っぽい |
| `--m-card-shadow` | カード落ち影色 | `rgba(16,8,5,0.55)` | `0.35`〜`0.65` | 濃すぎると浮きすぎ |
| `--m-glass` | 右上ガラスパネル透過色 | `rgba(158,191,205,0.1)` | `0.06`〜`0.16` | 高すぎると白濁 |

## まず試すおすすめプリセット
- 重厚寄り
  - `--tune-felt-grain: 0.055;`
  - `--tune-felt-vignette: 0.50;`
  - `--tune-panel-specular: 0.24;`
  - `--tune-wood-stripe: 0.045;`

- 明るめ寄り
  - `--tune-felt-grain: 0.035;`
  - `--tune-felt-vignette: 0.34;`
  - `--tune-panel-specular: 0.28;`
  - `--tune-wood-stripe: 0.025;`

## 直接触る主要セレクタ
- タイトル金属: `#titleBar h1`
- 左パネル質感: `#payoutPanel`
- 外側背景: `body`
- フェルト質感: `#fieldZone`
- カード表面: `.card`
- カード裏面: `.card-back`, `.card-back::after`
- BET数字UI: `#betMeter`, `#betValue`, `#betMax`
- 右上ガラスパネル: `#trackerRight .statBox`, `#trackerRight .statBox::before`
