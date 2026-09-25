#!/usr/bin/env python3
"""Generate the isolated renderer from canonical stage.html. Never edit study-frame.html."""
from pathlib import Path
import sys
import re
from stage_extract import view, modal_html, present_html, tour, ver

ROOT = Path(__file__).resolve().parent
scripts = ['stage-venues.js', 'stage-venue-lines.js', 'stage-i18n.js', 'stage-set-model.js',
           'stage-machinery.js', 'gamma-ui.js', 'gamma-ui-i18n.js', 'stage-sketch.js']
tags = '\n'.join(f'<script src="/study-assets/{ver(name)}"></script>' for name in scripts)
legacy = re.sub(r'\s+(?:src|href|action|poster|srcset)="[^"]*"', "", view + tour + modal_html + present_html)
page = f'''<!doctype html>
<!-- Generated from stage.html by build_study.py. -->
<html lang="ja" data-study-renderer>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<title>Stage Sketch — read-only drawings</title>
<link rel="stylesheet" href="/study-assets/{ver('style.css')}"><link rel="stylesheet" href="/stage-study.css?v=25"><link rel="stylesheet" href="/stage-study-navigation.css?v=1">
<script src="/stage-study-sticky.js?v=5"></script><script src="/stage-study-pen.js?v=4"></script><script src="/stage-study-navigation.js?v=1"></script><script src="/stage-study-frame.js?v=6"></script></head>
<body class="study-frame" data-view="both">
<div class="study-drawings"><div class="study-drawing study-front"></div><div class="study-drawing study-plan"></div></div>
<div id="study-legacy" hidden inert aria-hidden="true">{legacy}</div>
{tags}
</body></html>
'''
out = ROOT / 'study-frame.html'
if '--check' in sys.argv:
    if not out.exists() or out.read_text() != page:
        raise SystemExit('study-frame.html is stale. Run python3 build_study.py')
    print('study-frame.html matches stage.html')
else:
    out.write_text(page)
    print('Generated study-frame.html from stage.html')
