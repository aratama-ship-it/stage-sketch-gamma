/* Shared UI wording only. Never translates project names, notes or input values. */
(() => {
  'use strict';
  const phrases = {
  "無料テスト版γ": [
    "Gamma · free test version",
    "γ 免费测试版",
    "γ 免費測試版"
  ],
  "舞台・劇場設定・機材配置・照明デザイン・3D": [
    "Stage / theatre / equipment / lighting / 3D",
    "舞台 / 剧场 / 设备 / 灯光 / 3D",
    "舞台 / 劇場 / 設備 / 燈光 / 3D"
  ],
  "照明を開けませんでした": [
    "Lighting could not be opened",
    "无法打开灯光",
    "無法開啟燈光"
  ],
  "復旧の案内を閉じる": [
    "Hide recovery options",
    "收起恢复选项",
    "收起復原選項"
  ],
  "復旧の案内を開く": [
    "Show recovery options",
    "显示恢复选项",
    "顯示復原選項"
  ],
  "機材一覧": [
    "Equipment",
    "设备列表",
    "設備清單"
  ],
  "機材設置": [
    "Add equipment",
    "安装设备",
    "安裝設備"
  ],
  "灯体一覧": [
    "Lighting fixtures",
    "灯具列表",
    "燈具清單"
  ],
  "灯体情報": [
    "Fixture details",
    "灯具信息",
    "燈具資訊"
  ],
  "選んだ機材": [
    "Selected equipment",
    "所选设备",
    "所選設備"
  ],
  "シーンの一覧": [
    "Scenes",
    "场景列表",
    "場景清單"
  ],
  "シーンと連動": [
    "Follow scene",
    "跟随场景",
    "跟隨場景"
  ],
  "控え・書き出し": [
    "Backup / export",
    "备份 / 导出",
    "備份 / 匯出"
  ],
  "LXキューを適用": [
    "Apply LX cues",
    "应用 LX 提示",
    "套用 LX 提示"
  ],
  "LXキュー": [
    "LX cue",
    "LX 提示",
    "LX 提示"
  ],
  "未登録の下書き": [
    "Unsaved draft",
    "未保存草稿",
    "未儲存草稿"
  ],
  "平面図（真上から）": [
    "Plan (top)",
    "平面图（俯视）",
    "平面圖（俯視）"
  ],
  "正面図": [
    "Front view",
    "正面图",
    "正面圖"
  ],
  "前一文字": [
    "Front border",
    "前沿幕",
    "前沿幕"
  ],
  "袖幕": [
    "Legs",
    "侧幕",
    "側幕"
  ],
  "幕": [
    "Curtains",
    "幕布",
    "幕布"
  ],
  "舞台の幕": [
    "Stage curtains",
    "舞台幕布",
    "舞台幕布"
  ],
  "ホリゾント上　なし": [
    "Upper cyc: none",
    "天幕上方：无",
    "天幕上方：無"
  ],
  "ホリゾント床　あり": [
    "Floor cyc: present",
    "天幕地排：有",
    "天幕地排：有"
  ],
  "機材": [
    "Equipment",
    "设备",
    "設備"
  ],
  "演者": [
    "Performers",
    "表演者",
    "表演者"
  ],
  "一文字幕": [
    "Caption",
    "字幕",
    "字幕"
  ],
  "一文字幕を設置": [
    "Add caption",
    "添加字幕",
    "新增字幕"
  ],
  "グリッド": [
    "Grid",
    "网格",
    "網格"
  ],
  "セット": [
    "Set",
    "布景",
    "佈景"
  ],
  "表示": [
    "Display",
    "显示",
    "顯示"
  ],
  "調整": [
    "Adjust",
    "调整",
    "調整"
  ],
  "前": [
    "Front",
    "前方",
    "前方"
  ],
  "袖": [
    "Wing",
    "侧台",
    "側台"
  ],
  "上手を見る": [
    "Stage left",
    "看上手侧",
    "看上手側"
  ],
  "下手を見る": [
    "Stage right",
    "看下手侧",
    "看下手側"
  ],
  "距離：固定帯": [
    "Distance: fixed range",
    "距离：固定范围",
    "距離：固定範圍"
  ],
  "1000mmでそろえる": [
    "Snap to 1000 mm",
    "对齐到 1000 mm",
    "對齊到 1000 mm"
  ],
  "すべて": [
    "All",
    "全部",
    "全部"
  ],
  "吊り": [
    "Flown",
    "吊挂",
    "吊掛"
  ],
  "転がし": [
    "Floor",
    "地灯",
    "地燈"
  ],
  "前明かり": [
    "Front light",
    "面光",
    "面光"
  ],
  "動き": [
    "Movement",
    "运动",
    "動作"
  ],
  "動く範囲": [
    "Movement range",
    "运动范围",
    "動作範圍"
  ],
  "名前": [
    "Name",
    "名称",
    "名稱"
  ],
  "型": [
    "Type",
    "类型",
    "類型"
  ],
  "番号": [
    "Number",
    "编号",
    "編號"
  ],
  "高さ": [
    "Height",
    "高度",
    "高度"
  ],
  "奥行き": [
    "Depth",
    "深度",
    "深度"
  ],
  "上手側": [
    "Stage left",
    "上手侧",
    "上手側"
  ],
  "下手側": [
    "Stage right",
    "下手侧",
    "下手側"
  ],
  "中央": [
    "Centre",
    "中央",
    "中央"
  ],
  "中ほど": [
    "Middle",
    "中部",
    "中部"
  ],
  "上手寄り": [
    "Towards stage left",
    "靠上手侧",
    "靠上手側"
  ],
  "下手寄り": [
    "Towards stage right",
    "靠下手侧",
    "靠下手側"
  ],
  "上手寄り・奥": [
    "Upstage left",
    "上手侧后方",
    "上手側後方"
  ],
  "下手寄り・奥": [
    "Upstage right",
    "下手侧后方",
    "下手側後方"
  ],
  "中央・奥": [
    "Upstage centre",
    "后方中央",
    "後方中央"
  ],
  "中央・手前": [
    "Downstage centre",
    "前方中央",
    "前方中央"
  ],
  "このバトンに灯体を吊る": [
    "Hang fixtures on this batten",
    "在此吊杆上安装灯具",
    "在此吊桿上安裝燈具"
  ],
  "バトンを渡す": [
    "Add batten",
    "添加吊杆",
    "新增吊桿"
  ],
  "バトンを削除": [
    "Delete batten",
    "删除吊杆",
    "刪除吊桿"
  ],
  "等間隔に並べる": [
    "Space evenly",
    "等距排列",
    "等距排列"
  ],
  "左右対称設置": [
    "Mirror placement",
    "对称放置",
    "對稱放置"
  ],
  "反対側へコピー": [
    "Copy to opposite side",
    "复制到另一侧",
    "複製到另一側"
  ],
  "選んだ灯をグループにする": [
    "Group selected fixtures",
    "将所选灯具分组",
    "將所選燈具分組"
  ],
  "作業灯を消す": [
    "Turn off work lights",
    "关闭工作灯",
    "關閉工作燈"
  ],
  "作業灯を点ける": [
    "Turn on work lights",
    "打开工作灯",
    "開啟工作燈"
  ],
  "ソロ": [
    "Solo",
    "单独显示",
    "單獨顯示"
  ],
  "オン": [
    "On",
    "开",
    "開"
  ],
  "オフ": [
    "Off",
    "关",
    "關"
  ],
  "出す": [
    "Show",
    "显示",
    "顯示"
  ],
  "隠す": [
    "Hide",
    "隐藏",
    "隱藏"
  ],
  "コピー": [
    "Copy",
    "复制",
    "複製"
  ],
  "ペースト": [
    "Paste",
    "粘贴",
    "貼上"
  ],
  "再生": [
    "Play",
    "播放",
    "播放"
  ],
  "停止": [
    "Stop",
    "停止",
    "停止"
  ],
  "リセット": [
    "Reset",
    "重置",
    "重設"
  ],
  "設定": [
    "Settings",
    "设置",
    "設定"
  ],
  "閉じる": [
    "Close",
    "关闭",
    "關閉"
  ],
  "キャンセル": [
    "Cancel",
    "取消",
    "取消"
  ],
  "戻る": [
    "Back",
    "返回",
    "返回"
  ],
  "削除": [
    "Delete",
    "删除",
    "刪除"
  ],
  "保存": [
    "Save",
    "保存",
    "儲存"
  ],
  "読み込む": [
    "Import",
    "导入",
    "匯入"
  ],
  "書き出す": [
    "Export",
    "导出",
    "匯出"
  ],
  "プリセット": [
    "Presets",
    "预设",
    "預設"
  ],
  "選択": [
    "Selection",
    "选择",
    "選取"
  ],
  "平面": [
    "Plan",
    "平面",
    "平面"
  ],
  "シーン": [
    "Scene",
    "场景",
    "場景"
  ],
  "セクション": [
    "Section",
    "章节",
    "章節"
  ],
  "◆ ムービング全部": [
    "◆ All moving heads",
    "◆ 所有摇头灯",
    "◆ 所有搖頭燈"
  ],
  "ここに操作の結果や注意が出ます": [
    "Action results and notices appear here",
    "此处显示操作结果和提示",
    "此處顯示操作結果與提示"
  ],
  "まだ LXキュー がありません。〈＋ 新規 LXキュー〉でいまの明かりを1本目にして、そこから作り込めます。": [
    "No LX cues yet. Add a new LX cue to use the current lighting as your starting point.",
    "尚无 LX 提示。添加新的 LX 提示，以当前灯光为起点。",
    "尚無 LX 提示。新增 LX 提示，以目前燈光為起點。"
  ],
  "シーンごとに変えられません": [
    "cannot change between scenes",
    "不能随场景改变",
    "不能隨場景改變"
  ],
  "が、シーンによって違う向き・色・広がりになっています。固定灯は仕込みで決まるので、実物では": [
    " have different directions, colours or spreads across scenes. A fixed fixture is set during rigging and ",
    "在不同场景中的方向、颜色或光束不同。固定灯的设置在装台时确定，实际设备",
    "在不同場景中的方向、顏色或光束不同。固定燈的設定在裝台時確定，實際設備"
  ],
  "。どれかにそろえてください。": [
    ". Choose one scene to match.",
    "。请选择一个场景统一设置。",
    "。請選擇一個場景統一設定。"
  ],
  "ショーの照明を表示中。編集後は「LXキューを適用」でショーへ反映します。": [
    "Showing the saved lighting. After editing, choose “Apply LX cues” to update the show.",
    "正在显示已保存的灯光。编辑后选择“应用 LX 提示”更新演出。",
    "正在顯示已儲存的燈光。編輯後選擇「套用 LX 提示」更新演出。"
  ],
  "このブラウザに控え保存済み": [
    "Draft backed up in this browser",
    "草稿已备份到此浏览器",
    "草稿已備份到此瀏覽器"
  ],
  "控え保存待ち": [
    "Draft backup pending",
    "等待备份草稿",
    "等待備份草稿"
  ],
  "控えを保存できません。控え・書き出しからファイルへ残してください": [
    "Could not back up the draft. Use Backup / export to save a file.",
    "无法备份草稿。请使用“备份 / 导出”保存文件。",
    "無法備份草稿。請使用「備份 / 匯出」儲存檔案。"
  ],
  "ショーへ適用中…": [
    "Applying to the show…",
    "正在应用到演出…",
    "正在套用到演出…"
  ],
  "未適用": [
    "Not applied",
    "尚未应用",
    "尚未套用"
  ],
  "。「照明デザイン」の「LXキューを適用」でショーへ反映します。": [
    ". Choose “Apply LX cues” in Lighting to update the show.",
    "。在灯光设计中选择“应用 LX 提示”更新演出。",
    "。在燈光設計中選擇「套用 LX 提示」更新演出。"
  ],
  "選択した灯体": [
    "Selected fixtures",
    "所选灯具",
    "所選燈具"
  ],
  "色": [
    "Colour",
    "颜色",
    "顏色"
  ],
  "強さ": [
    "Intensity",
    "强度",
    "強度"
  ],
  "向き": [
    "Direction",
    "方向",
    "方向"
  ],
  "広がり": [
    "Beam spread",
    "光束宽度",
    "光束寬度"
  ],
  "このシーンだけ": [
    "This scene only",
    "仅此场景",
    "僅此場景"
  ],
  "全シーン": [
    "All scenes",
    "所有场景",
    "所有場景"
  ],
  "全てのシーン": [
    "All scenes",
    "所有场景",
    "所有場景"
  ],
  "新しく作る": [
    "Create new",
    "新建",
    "新增"
  ],
  "ファイルへ書き出す": [
    "Export to file",
    "导出文件",
    "匯出檔案"
  ],
  "ファイルから読み込む": [
    "Import from file",
    "从文件导入",
    "從檔案匯入"
  ],
  "デザインの名前": [
    "Design name",
    "设计名称",
    "設計名稱"
  ],
  "控えを保存中…": [
    "Saving draft backup…",
    "正在备份草稿…",
    "正在備份草稿…"
  ],
  "ショーが別のタブで更新されています。照明を控え・書き出しから残し、読み直してください。": [
    "The show changed in another tab. Use Backup / export to keep your lighting, then reload.",
    "演出已在其他标签页中更新。请先备份或导出灯光，再重新加载。",
    "演出已在其他分頁中更新。請先備份或匯出燈光，再重新載入。"
  ],
  "適用済み · 照明をこのブラウザのショーへ保存しました。": [
    "Applied · Lighting saved to the show in this browser.",
    "已应用 · 灯光已保存到此浏览器中的演出。",
    "已套用 · 燈光已儲存到此瀏覽器中的演出。"
  ],
  "適用済み · ショー一覧の控えを更新できません。ショーをファイルへ書き出してください。": [
    "Applied · Could not update the show-list backup. Export the show to a file.",
    "已应用 · 无法更新演出列表备份。请将演出导出为文件。",
    "已套用 · 無法更新演出清單備份。請將演出匯出為檔案。"
  ],
  "編集控えの整理は次回行います。": [
    "Draft backup cleanup will be retried next time.",
    "下次将重试清理草稿备份。",
    "下次將重試清理草稿備份。"
  ]
};
  phrases['番号・名前で探す']=['Search number / name','按编号或名称搜索','依編號或名稱搜尋'];
  const codes = ['en','zh-Hans','zh-Hant'];
  const text = (key, language = document.documentElement.lang) => {
    const index = codes.indexOf(language);
    if (index < 0) return key;
    if (phrases[key]) return phrases[key][index];
    const parentModel = window.parent !== window ? window.parent.SHOSAI_STAGE_I18N_MODEL : window.SHOSAI_STAGE_I18N_MODEL;
    const fallback = parentModel?.text(language,key);
    if (fallback && fallback !== key) return fallback;
    // UI-only templates. Captured project titles are preserved verbatim.
    const match = key.match(/^シーン(\d+)「(.*)」 にそろえる$/);
    if (match) return [ `Match scene ${match[1]} “${match[2]}”`, `与场景 ${match[1]}「${match[2]}」一致`, `與場景 ${match[1]}「${match[2]}」一致` ][index];
    const count = key.match(/^(固定灯)?(\d+)(灯|件)(\sまとめて選ぶ|\s列を選ぶ)?$/);
    if (count) return [ `${count[2]} ${count[1]?'fixed fixtures':count[3]==='灯'?'fixtures':'items'}${count[4]?' · Select group':''}`, `${count[2]}${count[3]==='灯'?'灯':'项'}${count[4]?' · 选择组':''}`, `${count[2]}${count[3]==='灯'?'燈':'項'}${count[4]?' · 選取群組':''}` ][index];
    const suffix='。「照明デザイン」の「LXキューを適用」でショーへ反映します。';
    if(key.startsWith('未適用 · ') && key.endsWith(suffix)) return text('未適用',language)+' · '+text(key.slice(6,-suffix.length),language)+text(suffix,language);
    const cleanup=' 編集控えの整理は次回行います。';
    if(key.endsWith(cleanup)) return text(key.slice(0,-cleanup.length),language)+' '+text(cleanup.trim(),language);
    if(key.startsWith('適用できませんでした: ')) return ['Could not apply: ','无法应用：','無法套用：'][index]+key.slice('適用できませんでした: '.length).split(' · ').map(part=>text(part,language)).join(' · ');
    const cue = key.match(/^＋ 新規 (.*)$/); if(cue) return ['＋ New ','＋ 新建 ','＋ 新增 '][index]+cue[1];
    return key;
  };
  window.GAMMA_UI_TEXT = text;
  // Main app keeps its existing language packs and rendering path.
  for (const code of codes) {
    const pack=window.SHOSAI_I18N_PACKS?.[code] || (code==='en' ? window.SHOSAI_I18N : null);
    if(pack?.text) for(const [key,values] of Object.entries(phrases)) pack.text[key]=values[codes.indexOf(code)];
  }
})();
