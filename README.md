# saifu

スマホで使う、自分専用のお金管理PWA。サーバーもログインもなし。データは端末の中（localStorage）だけに置く。

## できること

- **残金の見える化** … 銀行 / 現金 / PayPay / PASMO などの手段ごとの残高と合計。手段は設定で追加・編集・削除。チャージや引き出しは「移動」として記録
- **支出・収入の記録** … 手入力、または画像（レシート・決済アプリのスクショ）から金額・日付・店名を読み取り。保存前に確認画面。カテゴリは店名から自動で推測し、直した対応は覚える
- **予定支出** … サブスク（毎月◯日）や一回だけの出費をメモ。予定日が来たらホームに出て、ワンタップで支出として記録（または「なし」で飛ばす）
- **貯金目標** … 毎月の貯金額と、月ごとの上書き（ボーナス月など）。達成判定は「その月の収入 − 支出 ≧ 貯金額」。手で達成/未達に直せる。達成した月の分は累計として確保
- **ホームの残高表示** … 「現在の残高」と「使える残高（現在 − 使用予定 − 今月の貯金 − 確保ずみ貯金）」をタップで切替。マイナスなら赤くなる
- **衝動ストップ** … 金額を入れると使った後の残高が見え、タイマー（設定で分数変更）と、登録しておいた「貯めたい理由」が出る。時間がたったら「やめた / やっぱり使う」。やめた分は累計で記録
- **バックアップ** … 設定からJSONで書き出し・読み込み

## 構成

ビルド不要の静的サイト。

```
index.html
manifest.webmanifest   PWA（ホーム画面に追加）
sw.js                  オフライン対応のService Worker
css/app.css
js/
  app.js        タブとFAB
  store.js      データ（localStorage）、バックアップ
  money.js      残高・使える残高・予定・貯金の計算
  editors.js    支出/収入/移動・予定・手段の入力シート、画像読み取りの流れ
  ocr.js        Tesseract.js で端末内OCR、レシート/スクショの解釈
  categorize.js 店名からカテゴリ推測
  stop.js       衝動ストップ
  views/        home / history / plan / savings / settings
icons/
```

OCRは [Tesseract.js](https://github.com/naptha/tesseract.js) をCDN（jsDelivr）から読み込む。無料・鍵不要・端末内処理。初回だけ日本語データ（十数MB）を取得し、以後はService Workerのキャッシュで使う。

## ローカルで動かす

```bash
npx -y http-server . -p 8660 -c-1
```

`http://localhost:8660/` を開く。

## 公開（GitHub Pages、無料）

1. GitHubで公開リポジトリ `saifu` を作る（ブラウザから）
2. このフォルダで

```bash
git init
git add .
git commit -m "saifu v1"
git branch -M main
git remote add origin https://github.com/<ユーザー名>/saifu.git
git push -u origin main
```

3. リポジトリの Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして保存
4. 数分後に `https://<ユーザー名>.github.io/saifu/` で開ける
5. iPhoneのSafariで開き、共有 → 「ホーム画面に追加」

更新するときは commit → `git push` だけ。Service Workerはネットワーク優先なので、次に開いたときに新しい版になる。

## 注意

- データは端末のブラウザ内だけ。機種変更やSafariのデータ削除で消えるので、設定の「書き出す」でときどきバックアップを取る
- 他人がURLを開いても自分のデータは見えない（その人の端末には何もない）
- OCRは撮り方で精度が変わる。明るい場所で、レシートを平らにして真上から撮ると読みやすい。読み取れなかった金額は確認画面で直せる
