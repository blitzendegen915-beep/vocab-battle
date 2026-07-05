---
name: video-production
description: ffmpegベースの動画制作ワークフロー(写真スライドショー・ビート同期MV・タイトルモーション・思い出ムービー)。素材収集→選定→前処理→クリップ生成→結合→音声→納品まで全工程をカバー。ユーザーが「動画作って」「ムービー」「スライドショー」「MV風に」「曲に合わせて」「思い出動画」と言ったら必ずこのスキルを読む。クラウド環境(AviUtl等のGUI不可)前提。
---

# 動画制作スキル (ffmpeg スライドショー / ビート同期MV)

クラウド環境での動画制作の確立済みワークフロー。全工程 ffmpeg + Python。

**パイプライン**: 環境セットアップ → 素材収集 → 選定・重複除去 → 前処理 → クリップ生成 → タイトル/カード → 結合 → 音声 → 納品

## 先に読む: よくある失敗と対処

| 症状 | 原因 | 対処 |
|---|---|---|
| 写真が横倒し・逆さま | ffmpegはEXIF回転を無視する | §3 `exif_transpose` 必須 |
| concat/xfadeで `Input link parameters do not match` | zoompan産クリップのSARが `20481:20480` 等にずれる | 結合filter_complexで全入力に `setsar=1` |
| zoompanが激遅 | 元画像が4000px級 | 前処理で2600pxに縮小(§3) |
| 長時間レンダが途中で死ぬ | `nohup &` はハーネスに殺される | Bashの `run_in_background: true` で実行 |
| 納品ファイルのダウンロード失敗 | 100MB超(161MBで失敗実績) | 720p軽量版を必ず作る(§8) |
| Driveへ動画を返そうとして失敗 | base64が数千万文字でツール入力上限超え | 納品はSendUserFile一択(§1) |

## 0. 環境セットアップ(毎セッション必要・コンテナは揮発)

```bash
apt-get update >/dev/null 2>&1; apt-get install -y ffmpeg fonts-noto-cjk >/dev/null 2>&1
pip install pillow imagehash --quiet   # 写真選定に必要
pip install librosa --quiet            # BPM解析するときだけ(重い)
```

- 日本語フォント: `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc` (`FONT_B`) / `-Regular.ttc`
- 作業は必ずスクラッチパッドで。リポジトリを汚さない。

## 1. 素材収集 (Google Drive)

- `mcp__Google_Drive__search_files` で `parentId = '<folderId>' and mimeType contains 'image/'`、pageSize=100でページング。
- `mcp__Google_Drive__download_file_content` の結果は大きすぎて **tool-resultsディレクトリにJSONファイルとして保存される**(コンテキストは消費しない)。恐れず全部ダウンロードしてよい。
- 一括デコード: tool-results内の `mcp-Google_Drive-download_file_content-*.txt` をJSONとして読み、`title`をファイル名に、`content`をbase64デコードして保存。
- **逆方向(Driveへの動画アップロード)は不可**: base64が数千万文字になりツール入力上限を超える。納品はSendUserFile一択。

## 2. 写真の選定・重複除去

1. **知覚ハッシュで重複検出**: `imagehash.phash(img, hash_size=8)`、ハミング距離 `<=10` を同一グループ化。バーストショット・別アルバム再収録を自動検出できる。各グループから最高解像度の1枚を採用。
2. **コンタクトシートで目視選定**: PILで6列×220pxサムネイル、24枚/シートに分割し、Readで自分の目で見る(1枚≈1.5k tokens)。**インデックス番号を焼き込むこと**。
3. ユーザーのNG指定(特定の写真を除外等)はインデックスで管理。

## 3. 写真の前処理 【最重要の落とし穴】

**ffmpegはJPEGのEXIF回転を無視する。** スマホ写真はそのままだと横倒し・逆さまになる。必ず:

```python
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
im.thumbnail((2600, 2600))  # zoompanが4000px級だと激遅になるので縮小
im.save(out, quality=92)
```

## 4. クリップ生成 (Ken Burns効果)

1枚≈18秒かかる(4コア)。**必ず `run_in_background: true` のBashで実行**(`nohup &`はハーネスに殺されるので禁止)。

```bash
# DUR秒のクリップ → FRAMES = DUR*30。i%2で交互にズームイン/アウト。
# 増分INCが実際の到達ズームを決める: 到達値 ≈ 1 + INC*FRAMES(min/maxの上限1.16は保険)。
# 例: 3秒(90f)でINC=0.0009 → 約1.08到達(実績値・自然な動き)。もっと寄せたいならINCを上げる。
Z_IN="zoompan=z='min(zoom+0.0009,1.16)':d=90:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30"
Z_OUT="zoompan=z='if(lte(zoom,1.0),1.16,max(zoom-0.0009,1.0))':d=90:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30"
ffmpeg -y -loop 1 -i "$f" -t 3 -vf "scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,$Z,format=yuv420p" -r 30 -an out.mp4
```

- 事前2倍スケール(3840x2160)にしてからzoompanするとジッターが出ない。
- 全クリップ同一解像度・fps・pix_fmt(yuv420p)必須(xfade/concatの前提)。
- **SARの罠**: zoompan産クリップはSARが`20481:20480`等の微妙な値になり、concat/xfadeで「Input link parameters do not match」で失敗する。結合filter_complexでは全入力に `setsar=1` を挟むこと。

## 5. タイトル・モーショングラフィック

- **オープニング**: 黒背景 + カラーバー3本が時間差スライドイン(colorソースをoverlayのx式 `min(-W+t*2200, X_FINAL)` で動かす) + drawtextのy式/alpha式でタイトルがスライドアップ+フェードイン。
- **チャプターカード**: 単色ポップ背景(`color=c=0xFF5D8F`) + 大きい半透明ナンバー + タイトルがx式でスライドイン + 白ライン。2.8秒、fade in/out。
- **drawtextアニメの定石**: `alpha='min(max(t-START,0)/DUR,1)'`(フェードイン)、`x='min(-900+t*3400,160)'`(スライドイン)。
- 日本語テキストはNoto Sans CJK Bold。テキスト内のシングルクォート・コロンはエスケープ注意。

## 6. 結合

### A. クロスフェード版 (エモ・ポップ用)

xfadeチェーン。offsetは累積時間から算出。**手書き禁止、必ずPythonで生成**:

```python
XF = 0.5                      # クロスフェード秒
offsets, cum = [], durs[0]
for d in durs[1:]:
    offsets.append(cum - XF)  # offset_i = これまでの合計時間 - XF
    cum += d - XF
```

- トランジション使い分け: 写真間=`fade`、チャプターカードへ=`slideleft`、カードから=`slideright`。
- 67入力で205秒→実速0.75x(約4.5分)。**必ずbackground実行**。

### B. ビート同期版 (MV用) ★高クオリティ

任意の楽曲(ユーザー提供のmp3/wav等)に写真・映像のカットを同期させる汎用手順。

1. BPM・ビート格子の解析:
```python
import librosa, numpy as np
y, sr = librosa.load(mp3, sr=22050)   # ★durationを絞らず全曲解析(途中で足りなくなる事故防止)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
# 注意1: 速い曲は半分のBPMで検出されがち(172→86)。倍にして公称BPMと照合。
# 注意2: beat配列は「検出粒度」であり実ビートの1/2の場合がある。間隔(60/tempo)で判断。
```
2. イントロ尺の決定: ユーザー指定があればそれを採用し、写真開始は**その時刻に最も近いビート**にスナップ(`beats[argmin(|beats-t|)]`)。指定がなければ `librosa.onset` の最初の強いオンセットやサビ頭を目安に提案する。
3. 写真1枚のカット長 = ビート×4〜8(2小節が目安)。テンポが速い曲ほどビート数を増やす(1.5秒未満のカットは見づらい)。
4. `cuts[i] = beats[i0 + k*i]`、各クリップを `trim=end_frame=round(dur*fps)` で正確に切り、concatフィルタで**ハードカット**結合(ビート同期はxfadeより映える)。
5. フレーム丸めの累積ドリフトは、カットごとに実ビート時刻から `round(dur*fps)` し直せば±1/2フレームに収まる。
6. イントロ部分は黒背景+メッセージ等のプレースホルダーで尺を正確に確保(ユーザーが別ツールで差し替える場合も同様)。
7. 曲の残りは動画終端で `afade=t=out` して締める。サビ位置に見せ場写真を置けるとベスト(`librosa` のRMSエネルギーでサビ推定可)。

## 7. 音声

- **著作権**: 市販楽曲は使えない旨を先に伝える。私的利用のユーザー提供音源はmux可。
- **BGM自作**(著作権フリーが必要な場合): `aevalsrc` でコード構成音のsin波を重ね、`tremolo+aecho+lowpass` で加工。エンディングは別トラックを `adelay=MS|MS` + `afade` + `amix` でクロスフェード。
- **ユーザー提供楽曲**: そのままmux。`-shortest` で動画長に合わせ、終端 `afade=t=out`。
- mux: `ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -b:a 160k -shortest out.mp4`

## 8. 納品

1. 完成フレームを2-3枚抽出して**自分で目視確認**してから送る(`ffmpeg -ss T -i out.mp4 -frames:v 1 f.png`)。
2. **軽量版を必ず作る**: 161MBはダウンロード失敗した実績あり。`-vf scale=1280:720 -crf 26` で20-30MBに。
3. SendUserFileで軽量版を送付。フルHD版は保管しておき「必要なら」と伝える。

## 9. 進行管理・トークン節約

- ユーザー確認(AskUserQuestion)は最初に一括: 素材の受け渡し方法 / 雰囲気 / 画面比率 / テンポ / イントロ尺。
- 長時間レンダは background Bash + タスク通知待ち。ポーリングするなら `ls clips/*.mp4 | wc -l` 一発で。
- ffmpegログは `| tail -1` に絞る。プレビュー確認は本当に必要な箇所だけ。

## 実績構成テンプレ

```
OP(モーショングラフィック4s) → Ch.01カード(2.8s) → 写真×N →
Ch.02カード → 写真×N → Ch.03カード → 写真×N →
メッセージカード(5s) → クロージングカード(5s)
写真: エモ系3.5s / ポップ3.0s / ビート同期は2小節
```

## メンテナンス

新しい落とし穴を踏んだら、その場でこのSKILL.mdの「よくある失敗と対処」表と該当セクションに追記してコミットすること。実測値(レンダ速度・ファイルサイズ・パラメータ)は実績ベースで更新する。
