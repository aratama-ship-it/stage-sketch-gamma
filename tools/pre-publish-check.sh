#!/bin/bash
# 一括publish の直前に「いま push したら何が出るか」を一覧で見るための道具。
# 2026-09-14 本人決定（案C）。PUBLISH_RULES.md の経路B で必ず実行する。
#
#   bash tools/pre-publish-check.sh
#
# 何も変更しない。読むだけ。作業ツリー・インデックス・リモートに一切触らない。
# 終了コード: 0=そのまま進めてよい / 1=止まって確認が要る項目がある

set -u
cd "$(dirname "$0")/.." || exit 1
REPO="$(pwd)"
STOP=0
BUSY_MIN="${BUSY_MIN:-5}"   # 直近この分数に更新されたファイルは「他セッションが書込み中」の疑い

hr(){ printf '\n\033[2m%s\033[0m\n' "────────────────────────────────────────────────────────"; }
ok(){   printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$1"; }
bad(){  printf '  \033[31m✗\033[0m %s\n' "$1"; STOP=1; }

echo "公開前チェック — $REPO"
echo "$(date '+%Y-%m-%d %H:%M:%S')"

# ── 0. git の途中状態 ───────────────────────────────────────
hr; echo "0. git の状態"
G="$(git rev-parse --git-dir 2>/dev/null)" || { echo "gitリポジトリではない"; exit 1; }
if [ -d "$G/rebase-merge" ] || [ -d "$G/rebase-apply" ]; then
  bad "rebase の途中です。公開作業に rebase は使いません（PUBLISH_RULES.md 共通ルール）。"
elif [ -f "$G/MERGE_HEAD" ]; then
  bad "merge の途中です。中断してください。"
else
  ok "rebase / merge の途中ではない"
fi
echo "  現在のブランチ: $(git rev-parse --abbrev-ref HEAD)"

git fetch origin main -q 2>/dev/null \
  && ok "origin/main を取得: $(git log origin/main --format='%h %s' -1 | cut -c1-70)" \
  || warn "origin/main を取得できなかった（オフライン？）"

# ── 1. 出るものの一覧 ──────────────────────────────────────
hr; echo "1. いま push すると出るもの"
# 追跡済みの変更 ＋ 未追跡で .gitignore に載っていないもの
# core.quotePath=false: 日本語ファイル名が "\343\203..." に化けて分類も grep も狂うため
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  git -c core.quotePath=false diff --name-only origin/main -- . > /tmp/_pp_tracked.txt
else
  # First publication of an independent repository: inspect every tracked file.
  git -c core.quotePath=false ls-files > /tmp/_pp_tracked.txt
fi
git -c core.quotePath=false ls-files --others --exclude-standard > /tmp/_pp_untracked.txt
cat /tmp/_pp_tracked.txt /tmp/_pp_untracked.txt | sort -u > /tmp/_pp_all.txt
N=$(wc -l < /tmp/_pp_all.txt | tr -d ' ')
NT=$(wc -l < /tmp/_pp_tracked.txt | tr -d ' ')
NU=$(wc -l < /tmp/_pp_untracked.txt | tr -d ' ')
echo "  合計 ${N} ファイル（origin/main との差分 ${NT} ＋ 新規追加 ${NU}）"
if [ "$N" -eq 0 ]; then ok "出るものがありません。公開の必要はありません。"; fi

echo
echo "  置き場ごとの内訳:"
awk -F/ '{print (NF>1 ? $1"/" : "（ルート直下）")}' /tmp/_pp_all.txt | sort | uniq -c | sort -rn \
  | awk '{printf "    %-22s %s\n", $2, $1}'

# 利用者へ配信される面（tests/tools/docs 以外）は必ず目を通す
grep -vE '^(tests|tools|docs|i18n-prep|design)/' /tmp/_pp_all.txt > /tmp/_pp_ship.txt || :
NS=$(wc -l < /tmp/_pp_ship.txt | tr -d ' ')
echo
if [ "$NS" -gt 0 ]; then
  warn "配信物・製品本体にあたるファイルが ${NS} 件あります。1件ずつ目を通してください:"
  sed 's/^/      /' /tmp/_pp_ship.txt
else
  ok "配信物・製品本体の変更はなし（tests / tools / docs などの開発物のみ）"
fi

# ── 2. 他セッションが書き込み中か ────────────────────────────
hr; echo "2. 他セッションの同時編集"
: > /tmp/_pp_busy.txt
while IFS= read -r f; do
  [ -f "$f" ] || continue
  if [ -n "$(find "$f" -newermt "-${BUSY_MIN} minutes" 2>/dev/null)" ]; then echo "$f" >> /tmp/_pp_busy.txt; fi
done < /tmp/_pp_all.txt
NB=$(wc -l < /tmp/_pp_busy.txt | tr -d ' ')
if [ "$NB" -gt 0 ]; then
  bad "直近${BUSY_MIN}分に更新されたファイルが ${NB} 件あります。書きかけを公開する恐れがあります:"
  head -20 /tmp/_pp_busy.txt | sed 's/^/      /'
  [ "$NB" -gt 20 ] && echo "      …ほか $((NB-20)) 件"
  echo "      → 並行セッションに確認するか、更新が止まるまで待ってください。"
else
  ok "直近${BUSY_MIN}分に更新されたファイルはなし"
fi

# ── 3. 除外されるはずのものが混ざっていないか ──────────────────
hr; echo "3. .gitignore との整合"
: > /tmp/_pp_ign.txt
while IFS= read -r f; do
  git check-ignore -q "$f" 2>/dev/null && echo "$f" >> /tmp/_pp_ign.txt
done < /tmp/_pp_all.txt
NI=$(wc -l < /tmp/_pp_ign.txt | tr -d ' ')
if [ "$NI" -gt 0 ]; then
  bad "本来除外されるファイルが ${NI} 件混ざっています（-f で強制追加された？）:"
  head -10 /tmp/_pp_ign.txt | sed 's/^/      /'
else
  ok "除外対象の混入なし"
fi
NC=$(find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -name "* 2.*" -print 2>/dev/null | wc -l | tr -d ' ')
if [ "$NC" -gt 0 ]; then
  warn "iCloud の同期競合コピーが ${NC} 件あります（.gitignore の \`* 2.*\` で公開はされません）。"
  warn "ただしテストが実ファイルを数える場合は落ちます。片付けは本人の承認を得てから。"
fi

# ── 4. 秘密情報 ─────────────────────────────────────────────
hr; echo "4. 秘密情報の混入"
PAT='sk-[A-Za-z0-9]{20}|ghp_[A-Za-z0-9]{20}|xox[baprs]-[A-Za-z0-9]|BEGIN (RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY|AKIA[0-9A-Z]{16}'
: > /tmp/_pp_sec.txt
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in *.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.zip|*.mp4|*.mp3|*.wav) continue;; esac
  if grep -aEl "$PAT" "$f" >/dev/null 2>&1; then echo "$f" >> /tmp/_pp_sec.txt; fi
done < /tmp/_pp_all.txt
NSEC=$(wc -l < /tmp/_pp_sec.txt | tr -d ' ')
if [ "$NSEC" -gt 0 ]; then
  bad "鍵・トークンらしき文字列を含むファイルが ${NSEC} 件:"
  sed 's/^/      /' /tmp/_pp_sec.txt
else
  ok "鍵・トークンらしき文字列は見つからない"
fi
echo "  ※ このリポジトリは公開（public）です。出したものは誰でも読めます。"

# ── 5. テスト ───────────────────────────────────────────────
hr; echo "5. テスト"
if [ "${SKIP_TESTS:-0}" = "1" ]; then
  warn "SKIP_TESTS=1 のため省略（公開前には必ず一度通してください）"
elif command -v node >/dev/null 2>&1; then
  # Node 22 treats a directory argument as a module path. Match the explicit
  # test files used by the GitHub Actions regression job instead.
  if node --test tests/*.test.mjs tests/regression/*.test.cjs > /tmp/_pp_test.txt 2>&1; then
    ok "$(grep -E '^# (tests|pass)' /tmp/_pp_test.txt | tr '\n' ' ')"
  else
    bad "テストが落ちています: $(grep -E '^# (tests|pass|fail)' /tmp/_pp_test.txt | tr '\n' ' ')"
    grep -B2 "^not ok" /tmp/_pp_test.txt | head -6 | sed 's/^/      /'
    echo "      全文: /tmp/_pp_test.txt"
  fi
else
  warn "node が見つからない（\`source ~/.zshrc\` を試す）"
fi

# ── 判定 ────────────────────────────────────────────────────
hr
if [ "$STOP" -eq 0 ]; then
  echo "判定: 進めてよい。"
  echo "  公開は commit と push だけで行う。rebase は使わない。"
else
  echo "判定: 止まって確認が要る項目があります（上の ✗）。"
fi
echo "  手順の正本: PUBLISH_RULES.md"
exit "$STOP"
