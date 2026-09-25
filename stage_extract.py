#!/usr/bin/env python3
"""独立した舞台スケッチ正本 stage.html から共有断片を取り出す。"""

import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "stage.html"

# 過去の結合版が混ざったときに書斎側のスクリプトを除外する安全網。
SKIP_JS = {
    "db.js", "data.js", "book-seeds.js", "shelf-classification.js",
    "stage-apparatus-data.js", "desk-media.js", "app.js", "roster.js",
    "roster-crew.js", "roster-key.local.js", "roster-key.example.js",
}

html = SRC.read_text(encoding="utf-8")

_view_start = html.index('<main id="view-stage"')
_view_end = html.index("</main>", _view_start) + len("</main>")
view = html[_view_start:_view_end]
view = view.replace(
    '<main id="view-stage" class="view" hidden>',
    '<main id="view-stage" class="view">',
    1,
)

_tour_start = html.index('<div class="stage-tour" id="stage-tour"')
_tour_end = html.index('<div class="stage-modal-backdrop"', _tour_start)
tour = html[_tour_start:_tour_end].rstrip()

_tail = html[_view_end:]
_modals = re.findall(
    r'<div class="stage-modal-backdrop"[\s\S]*?</div>\s*|<div class="stage-modal[\s\S]*?\n</div>\s*',
    _tail,
)
modal_html = "".join(_modals).rstrip()

_present = re.search(r'<div class="stage-present-overlay"[\s\S]*?\n</div>', _tail)
present_html = _present.group(0).rstrip() if _present else ""


def ver(name: str) -> str:
    """stage.html が参照する ``?v=`` 付きのファイル名を返す。"""
    match = re.search(r'(?:src|href)="' + re.escape(name) + r'(\?v=[^"]+)?', html)
    return name + (match.group(1) or "") if match else name


script_srcs = []
for _src in re.findall(r'<script src="([^"]+)"', html):
    _bare = re.sub(r'\?v=[^"\s]+', "", _src)
    if _bare not in SKIP_JS:
        script_srcs.append(_src)


def modal_count() -> int:
    """生成後の診断表示に使うモーダル断片数。"""
    return len(_modals)
