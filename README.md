# Autorotation Calculator

依存ライブラリ・ビルド不要の静的Webアプリです。index.html をブラウザーで開いて使用できます。

機体・搭乗員・燃料・その他の重量、気圧高度、外気温を入力し、総重量、密度高度、基準RPM、±5 RPM、参考境界判定を表示します。入力の確定・キャンセル・リセットと保存に対応しています。

## 公開ファイル

チャート画像・表示・描画コード・表示専用設定は削除しました。RPM計算に必要な数値データと校正処理は維持しています。

- index.html / style.css：入力・結果画面
- app.js / input-model.js：入力操作・保存・結果更新
- calculator.js：重量・密度高度・RPM範囲の計算
- rpm-calibration.js：RPM補間用の座標変換と校正値（画像URL・描画処理なし）
- rpm-image-data.js：RPM計算・境界判定用の数値データ
- chart-data.js：数値補間・参考境界判定

数値データはチャート画像からの暫定デジタイズ値・原典確認前です。既存の注意表示を維持しています。

## 動作確認

Windowsでは `powershell -NoProfile -ExecutionPolicy Bypass -File tests/browser-check.ps1` でEdgeを非表示起動し、計算回帰、入力操作、保存復元、画面幅を確認できます。

Node.jsがある場合は `node tests/chart-data.test.js`、`node tests/input-model.test.js`、`node tests/input-storage.test.js` でも確認できます。

## GitHub Pages

Settings → Pages で公開ブランチと `/ (root)` を選択します。相対パスのみを使用し、サーバー処理・APIキー・npmインストールは不要です。