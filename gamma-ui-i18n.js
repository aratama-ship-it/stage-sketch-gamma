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
  "前一文字幕の有無": ["Front border curtain", "有无前檐幕", "有無前檐幕"],
  "この劇場には前一文字幕がありません": ["This theatre has no front border curtain.", "此剧场没有前檐幕。", "此劇場沒有前檐幕。"],
  "前一文字幕ありにしました。": ["The front border curtain is present.", "已设置前檐幕。", "已設置前檐幕。"],
  "前一文字幕なしにしました。正面図・3D・プレビューに描きません。": ["The front border curtain is absent. It is hidden in the front view, 3D and preview.", "已取消前檐幕。正面图、3D和预览均不显示。", "已取消前檐幕。正面圖、3D和預覽均不顯示。"],
  "壁は幅・奥行とも0.05m以上で、会場の外枠の内側に描いてください。": ["Draw the wall inside the venue outline with width and depth of at least 0.05 m.", "墙的宽度和深度至少为0.05m，请画在场地轮廓内。", "牆的寬度和深度至少為0.05m，請畫在場地輪廓內。"],
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
    "舞台左侧",
    "舞台左側"
  ],
  "下手側": [
    "Stage right",
    "舞台右侧",
    "舞台右側"
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
  "まだ LXキュー がありません。「＋ 新規 LXキュー」でいまの明かりを1本目にして、そこから作り込めます。": [
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
  "ショーの照明を表示中。編集後は「LXキューを適用」でショーへ適用します。": [
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
  "。「照明デザイン」の「LXキューを適用」でショーへ適用します。": [
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
  /* 修正バッチ 2026-10-07 の追い（v0.3.24）: 照明デザインの上部の帯・シーン送り・LXキューの札で日本語のまま出ていた文 */
  phrases["照明の操作"]=["Controls","灯光操作","燈光操作"];
  phrases["かんたん"]=["Simple","简单","簡易"];
  phrases["詳細画面の表示"]=["Show","详细画面显示","詳細畫面顯示"];
  phrases["＋ 新規"]=["＋ New","＋ 新建","＋ 新增"];
  phrases["カット"]=["Cut","硬切","硬切"];
  phrases["Qシート"]=["Q sheet","Q表","Q表"];
  phrases["きっかけ"]=["Trigger","触发","觸發"];
  phrases["名前（任意）"]=["Name (optional)","名称（可选）","名稱（選填）"];
  phrases["例: 「さよなら」の台詞で"]=["e.g. on the line “Goodbye”","例：在台词「再见」时","例：在台詞「再見」時"];
  phrases["次はGO待ち"]=["Next waits for GO","下一个等待 GO","下一個等待 GO"];
  phrases["次をGOから"]=["Next, after GO","下一个在 GO 后","下一個在 GO 後"];
  phrases["次を終わって"]=["Next, after this ends","下一个在结束后","下一個在結束後"];
  phrases["秒後"]=["s later","秒后","秒後"];
  phrases["秒後に出す"]=["Start after (s)","几秒后开始","幾秒後開始"];
  phrases["この LXキュー を編集しています（変えたところはそのまま入ります）"]=["Editing this LX cue (changes go straight into it)","正在编辑此 LX 提示（更改会直接写入）","正在編輯此 LX 提示（變更會直接寫入）"];
  phrases["この LXキュー を編集しています。変えたところはそのまま入ります"]=["Editing this LX cue. Changes go straight into it","正在编辑此 LX 提示。更改会直接写入","正在編輯此 LX 提示。變更會直接寫入"];
  phrases["この間にはもう番号が入りません"]=["No more numbers fit between these","这两者之间已无法再插入编号","這兩者之間已無法再插入編號"];
  phrases["再生中の照明を見る"]=["View the lights during playback","查看播放中的灯光","檢視播放中的燈光"];
  phrases["プリセットの機材配置でのみ利用可能です"]=["Available only with a preset rig layout","仅在预设的设备布置中可用","僅在預設的設備配置中可用"];
  phrases["灯体の印（吊り・SS・転がしなどの記号）を図に出す"]=["Show fixture symbols (hung, side, floor…) on the views","在图上显示灯具符号（吊挂・侧光・地排等）","在圖上顯示燈具符號（吊掛・側光・地排等）"];
  phrases["1000mmごとの目盛りを図に出す"]=["Show a 1000 mm grid on the views","在图上显示每 1000mm 的刻度","在圖上顯示每 1000mm 的刻度"];
  phrases["舞台スケッチ側で置いてある演者を下敷きに出す"]=["Show the performers placed on the stage as an underlay","将舞台上放置的演员作为底图显示","將舞台上放置的演員作為底圖顯示"];
  phrases["舞台スケッチ側で置いてある大道具・小道具を下敷きに出す"]=["Show the set pieces and props placed on the stage as an underlay","将舞台上放置的布景与道具作为底图显示","將舞台上放置的布景與道具作為底圖顯示"];
  phrases["演者・セットの名前を図に出す（影絵は残す）"]=["Show performer and set names on the views (silhouettes stay)","在图上显示演员与布景的名称（保留剪影）","在圖上顯示演員與布景的名稱（保留剪影）"];
  phrases["バトンの手前に吊って灯体を客席から隠す短い幕。出すと、客席から灯体が見えていないかを確かめられます"]=["A short border hung in front of the battens to hide fixtures from the audience. Show it to check whether fixtures can be seen from the house","吊在吊杆前方、从观众席遮住灯具的短幕。显示后可检查观众席是否看得到灯具","吊在吊桿前方、從觀眾席遮住燈具的短幕。顯示後可檢查觀眾席是否看得到燈具"];
  phrases["舞台の左右に吊って袖（そで）を客席から隠す幕。切ると、袖の奥まで見えるようになります"]=["Legs hung at both sides of the stage to mask the wings. Turn them off to see into the wings","吊在舞台两侧、从观众席遮住侧台的侧幕。关闭后可看到侧台深处","吊在舞台兩側、從觀眾席遮住側台的側幕。關閉後可看到側台深處"];
  phrases["光の見せ方"]=["How light is shown","光的显示方式","光的顯示方式"];
  phrases["光が当たっていないところを暗くする（G）"]=["Darken areas the light doesn't reach (G)","让未被照亮的地方变暗（G）","讓未被照亮的地方變暗（G）"];
  phrases["作業灯をどれだけ消すか"]=["How much to dim the work light","工作灯调暗的程度","工作燈調暗的程度"];
  phrases["作業灯をどれだけ消すか（％）"]=["How much to dim the work light (%)","工作灯调暗的程度（%）","工作燈調暗的程度（%）"];
  phrases["前の LXキュー はありません"]=["No previous LX cue","没有上一个 LX 提示","沒有上一個 LX 提示"];
  phrases["次の LXキュー はありません"]=["No next LX cue","没有下一个 LX 提示","沒有下一個 LX 提示"];
  phrases["前のLXキューへ"]=["Previous LX cue","上一个 LX 提示","上一個 LX 提示"];
  phrases["次のLXキューへ"]=["Next LX cue","下一个 LX 提示","下一個 LX 提示"];
  phrases["前のシーンはありません"]=["No previous scene","没有上一个场景","沒有上一個場景"];
  phrases["次のシーンはありません"]=["No next scene","没有下一个场景","沒有下一個場景"];
  phrases["照明デザインの操作"]=["Light design controls","灯光设计操作","燈光設計操作"];
  phrases["このブラウザでの直近の4図描画時間です。CPU・メモリの使用量そのものではありません。"]=["Recent time to draw the four views in this browser. This is not CPU or memory usage itself.","此浏览器中最近绘制 4 张图所用的时间，并非 CPU・内存的使用量本身。","此瀏覽器中最近繪製 4 張圖所用的時間，並非 CPU・記憶體的使用量本身。"];
  phrases["動きを再生する（Space）"]=["Play the motion (Space)","播放动作（Space）","播放動作（Space）"];
  phrases["動きを止める（Space）"]=["Stop the motion (Space)","停止动作（Space）","停止動作（Space）"];
  phrases["選択中の明かりの正面図"]=["Front view of the selected look","所选灯光的正面图","所選燈光的正面圖"];
  phrases["前のプリセット"]=["Previous preset","上一个预设","上一個預設"];
  phrases["次のプリセット"]=["Next preset","下一个预设","下一個預設"];
  phrases["この明かりをシーンへ保存します。保存すると詳細表示へ移り、細かく編集できます"]=["Save this look to the scene. After saving, the detail view opens so you can fine-tune it","将此灯光保存到场景。保存后切换到详细显示，可细致编辑","將此燈光儲存到場景。儲存後切換到詳細顯示，可細緻編輯"];
  phrases["いま編集しているシーンのLXキューを出しています。押すと、いま見ているシーンに固定します"]=["Showing the LX cues of the scene being edited. Press to pin the scene you are viewing","正在显示编辑中场景的 LX 提示。按下后固定为当前查看的场景","正在顯示編輯中場景的 LX 提示。按下後固定為目前檢視的場景"];
  phrases["見るシーンを固定しています。押すと、いま編集しているシーンに合わせて切り替わります"]=["The viewed scene is pinned. Press to follow the scene being edited","已固定查看的场景。按下后跟随编辑中的场景切换","已固定檢視的場景。按下後跟隨編輯中的場景切換"];
  phrases["全シーンのLXキューを、Q番号・きっかけ・略語・秒数の表で見る（CSVをコピーできます）"]=["See every scene's LX cues as a table of Q number, trigger, notation and times (CSV can be copied)","以 Q 编号・触发・略语・秒数的表格查看所有场景的 LX 提示（可复制 CSV）","以 Q 編號・觸發・略語・秒數的表格檢視所有場景的 LX 提示（可複製 CSV）"];
  phrases["セクション番号"]=["Section number","段落编号","段落編號"];
  phrases["シーン番号"]=["Scene number","场景编号","場景編號"];
  phrases["つまんで上下に動かすと順番を変えられます"]=["Drag up or down to change the order","上下拖动可改变顺序","上下拖曳可改變順序"];
  phrases["未適用の変更はありません"]=["No unapplied changes","没有未应用的更改","沒有未套用的變更"];
  phrases["どの LXキュー にも入っていません。LXキュー パネルの「＋ 新規 LXキュー」で1本にできます"]=["Not in any LX cue. Use 「＋ New」 in the LX cue panel to make it one","不属于任何 LX 提示。可用 LX 提示面板的「＋ 新建」做成一个","不屬於任何 LX 提示。可用 LX 提示面板的「＋ 新增」做成一個"];
  phrases["計測中"]=["measuring","测量中","測量中"];
  phrases["再生中"]=["playing","播放中","播放中"];
  phrases["停止"]=["Stop","停止","停止"];
  const LIGHT_WORDS = {"前":["Previous","上一个","上一個"],"次":["Next","下一个","下一個"],"GOから":["after GO","GO 后","GO 後"],"終わって":["after it ends","结束后","結束後"]};
  const LIGHT_TEMPLATES = [
    [/^(.+?) へ GO（画面の明かりをこの中身に入れ替えます）$/, ["GO to {1} (the lights on screen become this cue)","GO 到 {1}（画面上的灯光换成此提示的内容）","GO 到 {1}（畫面上的燈光換成此提示的內容）"]],
    [/^(Q\S*|\d+(?:\.\d+)+) を消す$/, ["Delete {1}","删除 {1}","刪除 {1}"]],
    [/^(Q\S*|\d+(?:\.\d+)+) の名前$/, ["Name of {1}","{1} 的名称","{1} 的名稱"]],
    [/^(Q\S*|\d+(?:\.\d+)+) の次へ$/, ["After {1}","{1} 之后","{1} 之後"]],
    [/^(.+)。このキューへ移るときの時間（フェード・遅れ・カーブ）を決める$/, ["{T1}. Set the time for moving into this cue (fade, delay, curve)","{T1}。设置进入此提示的时间（淡变・延迟・曲线）","{T1}。設定進入此提示的時間（淡變・延遲・曲線）"]],
    [/^いま出ている明かりを次の番号 (\S+) の LXキュー にして、そのまま編集を続けます$/, ["Make the lights on screen the next LX cue {1} and keep editing","将画面上的灯光作为下一个编号 {1} 的 LX 提示，并继续编辑","將畫面上的燈光作為下一個編號 {1} 的 LX 提示，並繼續編輯"]],
    [/^セクション(\d+)・シーン(\d+)／(.+)$/, ["Section {1} · scene {2} / {T3}","段落 {1}・场景 {2}／{T3}","段落 {1}・場景 {2}／{T3}"]],
    [/^(\S+) と同じ中身です（編集中ではありません）。LXキュー パネルで (\S+) を選ぶと、変えたところがそのキューへ入ります$/, ["Same as {1} (not being edited). Choose {2} in the LX cue panel and your changes go into that cue","与 {1} 内容相同（未在编辑）。在 LX 提示面板选择 {2} 后，更改会写入该提示","與 {1} 內容相同（未在編輯）。在 LX 提示面板選擇 {2} 後，變更會寫入該提示"]],
    [/^このシーンには (.+) がありますが、いまの明かりはどれとも違います。LXキュー パネルで選ぶか、「＋ 新規 LXキュー」で1本にできます$/, ["This scene has {1}, but the current lights match none of them. Choose one in the LX cue panel, or use 「＋ New」 to make one","此场景有 {1}，但当前灯光与之都不同。可在 LX 提示面板选择，或用「＋ 新建」做成一个","此場景有 {1}，但目前燈光與之皆不同。可在 LX 提示面板選擇，或用「＋ 新增」做成一個"]],
    [/^描画 (\S+)／回 ・ (再生中|停止)$/, ["Render {T1} each · {T2}","绘制 {T1}／次・{T2}","繪製 {T1}／次・{T2}"]],
    [/^(前|次)のシーン (\S+)「(.*)」へ（(.)）$/, ["{T1} scene {2} “{3}” ({4})","{T1}场景 {2}「{3}」（{4}）","{T1}場景 {2}「{3}」（{4}）"]],
    [/^(前|次)の (\S+)(「.*」)? へ GO$/, ["{T1}: {2}{3} — GO","{T1}：{2}{3} GO","{T1}：{2}{3} GO"]],
    [/^シーン (\S+)「(.*)」／押すとシーンの一覧（↑↓でシーンを送る）$/, ["Scene {1} “{2}” / press for the scene list (↑↓ steps scenes)","场景 {1}「{2}」／按下打开场景列表（↑↓ 切换场景）","場景 {1}「{2}」／按下開啟場景列表（↑↓ 切換場景）"]],
    [/^＋ 後ろに (\S+)$/, ["＋ After: {1}","＋ 在后面插入 {1}","＋ 在後面插入 {1}"]],
    [/^この後ろに (\S+) を入れる（いまの明かりから）$/, ["Insert {1} after this (from the current lights)","在此之后插入 {1}（使用当前灯光）","在此之後插入 {1}（使用目前燈光）"]],
    [/^→ 次へ (GOから|終わって)(\S+)秒後$/, ["→ next: {T1} + {2}s","→ 下一个：{T1} {2} 秒后","→ 下一個：{T1} {2} 秒後"]],
    [/^フェード (\S+)$/, ["Fade {1}","淡变 {1}","淡變 {1}"]],
    [/^上げ (\S+)／下げ (\S+)$/, ["Up {1} / down {2}","渐亮 {1}／渐暗 {2}","漸亮 {1}／漸暗 {2}"]],
    [/^遅れ (\S+)$/, ["Delay {1}","延迟 {1}","延遲 {1}"]],
    [/^位置 (\S+)$/, ["Position {1}","位置 {1}","位置 {1}"]],
    [/^色 (\S+)$/, ["Colour {1}","颜色 {1}","顏色 {1}"]],
  ];
  // ★見る先（2026-10-07）: 劇場設定の見る位置
  phrases["見る先（ドラッグまたは矢印キーで移動）"]=["Look target (drag or use the arrow keys)","观看目标（拖动或用方向键移动）","觀看目標（拖曳或用方向鍵移動）"];
  phrases["この点を見ています。「見る先を真ん中に戻す」で戻せます。"]=["Looking at this point. Use “Look at the stage centre” to reset.","正在看这个点。可用“视线回到舞台中央”还原。","正在看這個點。可用「視線回到舞台中央」還原。"];
  phrases["舞台の真ん中を見ています。"]=["Looking at the stage centre.","正在看舞台中央。","正在看舞台中央。"];
  phrases["見る先を真ん中に戻す"]=["Look at the stage centre","视线回到舞台中央","視線回到舞台中央"];
  phrases["見る位置：点をドラッグして移動、点の上でスクロールして高さを変更できます。線の先の◎をドラッグすると見る先（向き）を変えられます。"]=["Viewpoints: drag a point to move it, or scroll on it to change the eye height. Drag the ◎ at the end of the line to change where it looks.","观看位置：拖动点可移动，在点上滚动可改变视线高度。拖动线端的◎可改变观看方向。","觀看位置：拖曳點可移動，在點上捲動可改變視線高度。拖曳線端的◎可改變觀看方向。"];
  phrases["平面図の好きな場所を押して、見る位置を置いてください。Escで取り消し。"]=["Click anywhere on the plan to place a viewpoint. Press Esc to cancel.","在平面图上任意位置点击以放置观看位置。按 Esc 取消。","在平面圖上任意位置點擊以放置觀看位置。按 Esc 取消。"];
  phrases["見る先を変えました。「一つ戻す」で取り消せます。"]=["Changed where this viewpoint looks. Use Undo to revert.","已更改观看方向。可用“撤销”还原。","已更改觀看方向。可用「復原」還原。"];
  phrases["見る先を舞台の真ん中に戻しました。「一つ戻す」で取り消せます。"]=["This viewpoint looks at the stage centre again. Use Undo to revert.","观看方向已回到舞台中央。可用“撤销”还原。","觀看方向已回到舞台中央。可用「復原」還原。"];
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
    const suffix='。「照明デザイン」の「LXキューを適用」でショーへ適用します。';
    if(key.startsWith('未適用 · ') && key.endsWith(suffix)) return text('未適用',language)+' · '+text(key.slice(6,-suffix.length),language)+text(suffix,language);
    const cleanup=' 編集控えの整理は次回行います。';
    if(key.endsWith(cleanup)) return text(key.slice(0,-cleanup.length),language)+' '+text(cleanup.trim(),language);
    if(key.startsWith('適用できませんでした: ')) return ['Could not apply: ','无法应用：','無法套用：'][index]+key.slice('適用できませんでした: '.length).split(' · ').map(part=>text(part,language)).join(' · ');
    const cue = key.match(/^＋ 新規 (.*)$/); if(cue) return ['＋ New ','＋ 新建 ','＋ 新增 '][index]+cue[1];
    /* 照明デザインの数字・番号入りの文（v0.3.24）。{n} は番号などそのまま、{Tn} は訳してから入れる。区切り「・」の並びは1つずつ訳す */
    for (const [pattern, forms] of LIGHT_TEMPLATES) {
      const m = key.match(pattern); if (!m) continue;
      const tr = (part) => (LIGHT_WORDS[part] ? LIGHT_WORDS[part][index] : text(part, language));
      return forms[index].replace(/\{(T?)(\d)\}/g, (_, t, n) => (m[+n] === undefined ? '' : t ? tr(m[+n]) : m[+n]));
    }
    if (key.includes('・') && /^(カット|フェード|上げ|遅れ|位置|色|MIB)/.test(key)) return key.split('・').map((part) => text(part, language)).join(' · ');
    return key;
  };
  window.GAMMA_UI_TEXT = text;
  // Main app keeps its existing language packs and rendering path.
  window.GAMMA_UI_I18N_MERGE = () => {
    for (const code of codes) {
      const pack=window.SHOSAI_I18N_PACKS?.[code] || (code==='en' ? window.SHOSAI_I18N : null);
      if(pack?.text) for(const [key,values] of Object.entries(phrases)) pack.text[key]=values[codes.indexOf(code)];
    }
  };
  window.GAMMA_UI_I18N_MERGE();
})();
