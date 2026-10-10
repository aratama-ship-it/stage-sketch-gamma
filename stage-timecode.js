/* The timeline owns its transport; this component edits the optional show data. */
(function (root) {
  'use strict';
  const D = root.STAGE_TIME_DOMAIN;
  const wording = {
  "未設定のあいだは、最初のシーンの頭を 00:00:00.0 として表示します（保存はされません）。": ["Until this is set, the start of the first scene is shown as 00:00:00.0 (not saved).", "未设置时，以第一个场景的开头为 00:00:00.0 显示（不会保存）。", "未設定時，以第一個場景的開頭為 00:00:00.0 顯示（不會儲存）。", "설정하기 전에는 첫 씬의 시작을 00:00:00.0으로 표시합니다(저장되지 않음)."],
  "現在のタイムコード（入力して Enter で頭出し）": ["Current timecode (type and press Enter to jump)", "当前时间码（输入后按 Enter 定位）", "目前時間碼（輸入後按 Enter 定位）", "현재 타임코드 (입력 후 Enter로 이동)"],

  "タイムコード": [
    "Timecode",
    "时间码",
    "時間碼",
    "타임코드"
  ],
  "タイムコード設定": [
    "Timecode settings",
    "时间码设置",
    "時間碼設定",
    "타임코드 설정"
  ],
  "本編開始": [
    "Show start",
    "正片开始",
    "正片開始",
    "본편 시작"
  ],
  "本編開始のシーン": [
    "Show start scene",
    "正片开始场景",
    "正片開始場景",
    "본편 시작 씬"
  ],
  "開始タイムコード": [
    "Start timecode",
    "起始时间码",
    "起始時間碼",
    "시작 타임코드"
  ],
  "本編から": [
    "From show start",
    "相对正片开始",
    "相對正片開始",
    "본편 시작 기준"
  ],
  "セクション内": [
    "Within section",
    "分段内",
    "分段內",
    "섹션 내"
  ],
  "このセクションの時間表示": [
    "Time display for this section",
    "此分段的时间显示",
    "此分段的時間顯示",
    "이 섹션의 시간 표시"
  ],
  "本編開始を基準に、前後のシーンと音源を組みます。ショーに保存されます。": [
    "Arrange scenes and audio around the show start. These settings are saved in the show.",
    "以正片开始为基准安排前后的场景和音源。设置保存在演出中。",
    "以正片開始為基準安排前後的場景和音源。設定儲存在演出中。",
    "본편 시작을 기준으로 앞뒤 씬과 음원을 배치합니다. 공연에 저장됩니다."
  ],
  "時:分:秒.小数1桁（フレームではありません）": [
    "Hours:minutes:seconds.tenths (not frames)",
    "时:分:秒.一位小数（不是帧）",
    "時:分:秒.一位小數（不是影格）",
    "시:분:초.소수 1자리 (프레임 아님)"
  ],
  "音源の開始位置": [
    "Audio placements",
    "音源开始位置",
    "音源開始位置",
    "음원 시작 위치"
  ],
  "配置したセクションでは、この一覧で音源を再生します。配置がないセクションは従来の音源を使います。": [
    "Sections with placements use this list for playback. Other sections use their existing audio.",
    "已配置的分段按此列表播放音源。其他分段使用原有音源。",
    "已配置的分段依此清單播放音源。其他分段使用原有音源。",
    "배치가 있는 섹션은 이 목록으로 재생합니다. 다른 섹션은 기존 음원을 사용합니다."
  ],
  "鳴らし始めるシーン": [
    "Start audio at scene",
    "开始播放的场景",
    "開始播放的場景",
    "음원을 시작할 씬"
  ],
  "ファイル開始（秒）": [
    "File in (seconds)",
    "文件起点（秒）",
    "檔案起點（秒）",
    "파일 시작 (초)"
  ],
  "ファイル終了（秒）": [
    "File out (seconds)",
    "文件终点（秒）",
    "檔案終點（秒）",
    "파일 끝 (초)"
  ],
  "音源の最後": [
    "End of audio",
    "音源末尾",
    "音源結尾",
    "음원 끝"
  ],
  "配置を追加": [
    "Add placement",
    "添加配置",
    "新增配置",
    "배치 추가"
  ],
  "外す": [
    "Remove",
    "移除",
    "移除",
    "제거"
  ],
  "最後": [
    "End",
    "末尾",
    "結尾",
    "끝"
  ],
  "シーン不明": [
    "Missing scene",
    "场景缺失",
    "場景遺失",
    "씬 없음"
  ],
  "音源不明": [
    "Missing audio",
    "音源缺失",
    "音源遺失",
    "음원 없음"
  ],
  "無音で確認": [
    "Preview silently",
    "静音预览",
    "靜音預覽",
    "무음 미리보기"
  ],
  "無音で確認中": [
    "Silent preview",
    "正在静音预览",
    "正在靜音預覽",
    "무음 미리보기 중"
  ],
  "再生範囲": [
    "Playback range",
    "播放范围",
    "播放範圍",
    "재생 범위"
  ],
  "表示時刻で頭出し（Enter）": [
    "Seek to displayed time (Enter)",
    "按显示时间定位（Enter）",
    "依顯示時間定位（Enter）",
    "표시 시각으로 이동 (Enter)"
  ],
  "このシーンの先頭を本編開始にする": [
    "Set this scene as the show start",
    "将此场景起点设为正片开始",
    "將此場景起點設為正片開始",
    "이 씬의 처음을 본편 시작으로 설정"
  ],
  "キューのタイムコード": [
    "Cue timecode",
    "提示时间码",
    "提示時間碼",
    "큐 타임코드"
  ],
  "フォーメーションと秒数の対応": [
    "Formation timing",
    "队形与时间的对应",
    "隊形與時間的對應",
    "대형과 시간 대응"
  ],
  "保存時にフォーメーションの秒数をシーンへ反映する": [
    "Apply formation timing to scenes when saving",
    "保存时将队形时间应用到场景",
    "儲存時將隊形時間套用到場景",
    "저장할 때 대형 시간을 씬에 반영"
  ],
  "本編開始のシーンを選び直してください。": [
    "Choose the show start scene again.",
    "请重新选择正片开始场景。",
    "請重新選擇正片開始場景。",
    "본편 시작 씬을 다시 선택하세요."
  ],
  "開始シーンと音源を選んでください。": [
    "Select a start scene and audio track.",
    "请选择开始场景和音源。",
    "請選擇開始場景和音源。",
    "시작 씬과 음원을 선택하세요."
  ],
  "設定が更新されています。開き直して確認してください。": [
    "Settings changed while this window was open. Reopen it to review.",
    "设置已更新，请重新打开确认。",
    "設定已更新，請重新開啟確認。",
    "설정이 변경되었습니다. 다시 열어 확인하세요."
  ],
  "時:分:秒.小数1桁で、0時以上24時未満を入力してください。": [
    "Enter hours:minutes:seconds.tenths between 00:00:00.0 and 23:59:59.9.",
    "请输入时:分:秒.一位小数，范围为0时至24时之前。",
    "請輸入時:分:秒.一位小數，範圍為0時至24時之前。",
    "시:분:초.소수 1자리로 0시 이상 24시 미만을 입력하세요."
  ],
  "ショーの範囲にある時刻を入力してください。": [
    "Enter a time within the show.",
    "请输入演出范围内的时间。",
    "請輸入演出範圍內的時間。",
    "공연 범위 내의 시각을 입력하세요."
  ],
  "音源が未接続です。音源の帯から再接続するか「無音で確認」を選んでください。": [
    "Audio is missing. Reconnect it from the audio lane or choose Preview silently.",
    "音源未连接。请从音源条重新连接，或选择静音预览。",
    "音源未連接。請從音源條重新連接，或選擇靜音預覽。",
    "음원이 연결되지 않았습니다. 음원 막대에서 다시 연결하거나 무음 미리보기를 선택하세요."
  ],
  "このセクション内の時刻を入力してください。固定キューは動かせません。": [
    "Enter a time within this section. Locked cues cannot move.",
    "请输入此分段内的时间。固定提示不能移动。",
    "請輸入此分段內的時間。固定提示不能移動。",
    "이 섹션 내의 시각을 입력하세요. 고정된 큐는 이동할 수 없습니다."
  ]
};
  Object.assign(wording, {
    'このタイムコード設定の版は未対応です。': ['This timecode settings version is not supported.', '不支持此时间码设置版本。', '不支援此時間碼設定版本。', '이 타임코드 설정 버전은 지원되지 않습니다.'],
    '本編開始はシーンの先頭を指定してください。': ['Set the show origin at the start of a scene.', '请将正片起点设在场景开头。', '請將正片起點設在場景開頭。', '본편 시작은 장면의 시작으로 지정하세요.'],
    '開始タイムコードは0時以上、24時未満で指定してください。': ['Set the starting timecode from 00:00:00.0 to before 24:00:00.0.', '开始时间码须为0时以上、24时之前。', '開始時間碼須為0時以上、24時之前。', '시작 타임코드는 0시 이상, 24시 미만으로 지정하세요.'],
    'ショーが0時より前、または24時以降になります。開始タイムコードを変更してください。': ['The show extends before 0h or to 24h. Change its starting timecode.', '演出超出0时至24时的范围。请调整开始时间码。', '演出超出0時至24時的範圍。請調整開始時間碼。', '쇼가 0시 이전 또는 24시 이후로 넘어갑니다. 시작 타임코드를 변경하세요.'],
    '複数曲のキューに対象曲が指定されていません。': ['Select the target song for cues in this multi-song section.', '此多曲目分段的提示尚未指定曲目。', '此多曲目分段的提示尚未指定曲目。', '여러 곡이 있는 섹션의 큐에 대상 곡이 지정되지 않았습니다.'],
    'フォーメーションとシーンの対応を確認してください。': ['Check the links between formation segments and scenes.', '请确认队形与场景的对应关系。', '請確認隊形與場景的對應關係。', '포메이션과 장면의 연결을 확인하세요.'],
    'フォーメーションとシーンの秒数が異なります。': ['Formation and scene timings differ.', '队形与场景的时间不一致。', '隊形與場景的時間不一致。', '포메이션과 장면의 시간이 다릅니다.'],
    'この音源配置の版は未対応です。': ['This audio placement version is not supported.', '不支持此音源配置版本。', '不支援此音源配置版本。', '이 음원 배치 버전은 지원되지 않습니다.'],
    '音源の配置を読み取れません。設定を確認してください。': ['Audio placements could not be read. Check their settings.', '无法读取音源配置。请检查设置。', '無法讀取音源配置。請檢查設定。', '음원 배치를 읽을 수 없습니다. 설정을 확인하세요.'],
    '音源の開始シーン・ファイル範囲を確認してください。': ['Check the audio start scene and file range.', '请检查音源开始场景及文件范围。', '請檢查音源開始場景及檔案範圍。', '음원의 시작 장면과 파일 범위를 확인하세요.'],
    'フォーメーションの音源配置は、対象曲とファイル開始秒をカウントの同期位置に合わせてください。': ['For formation audio, match the song and file start time to the count synchronization.', '队形音源的曲目和文件开始秒数须与计数同步位置一致。', '隊形音源的曲目和檔案開始秒數須與計數同步位置一致。', '포메이션 음원의 곡과 파일 시작 시간을 카운트 동기화 위치에 맞추세요.'],
    '音源の配置が重なっています。終了位置か開始シーンを調整してください。': ['Audio placements overlap. Adjust an end point or start scene.', '音源配置重叠。请调整结束位置或开始场景。', '音源配置重疊。請調整結束位置或開始場景。', '음원 배치가 겹칩니다. 종료 위치나 시작 장면을 조정하세요.'],
    'フォーメーションに対応するシーンがありません。': ['No scene is linked to this formation segment.', '没有与此队形对应的场景。', '沒有與此隊形對應的場景。', '포메이션에 연결된 장면이 없습니다.'],
    'フォーメーションの区間を確認してください。': ['Check the formation intervals.', '请检查队形区间。', '請檢查隊形區間。', '포메이션 구간을 확인하세요.'],
    '固定点があるため、時間を反映できません。': ['Locked points prevent applying these timings.', '由于存在固定点，无法应用时间。', '由於存在固定點，無法套用時間。', '고정된 지점이 있어 시간을 반영할 수 없습니다.'],
    '複数の曲が同じシーンを参照しています。': ['Multiple songs refer to the same scene.', '多首曲目引用同一场景。', '多首曲目引用同一場景。', '여러 곡이 같은 장면을 참조합니다.'],
    '未対応の設定版は、この画面から上書きできません。': ['Unsupported settings versions cannot be overwritten here.', '无法在此覆盖不支持的设置版本。', '無法在此覆寫不支援的設定版本。', '지원되지 않는 설정 버전은 여기서 덮어쓸 수 없습니다.'],
  });
  for (const [index, language] of ['en', 'zh-Hans', 'zh-Hant', 'ko'].entries()) {
    const pack = root.SHOSAI_I18N_PACKS?.[language];
    if (pack?.text) for (const [key, values] of Object.entries(wording)) pack.text[key] = values[index];
  }

  function create({ bridge, tx, context, seek, scope, changed, refreshPosition }) {
    const node = document.createElement('dialog');
    node.id = 'stage-timecode-dialog'; node.className = 'stage-timecode-dialog';
    node.setAttribute('aria-labelledby', 'stage-timecode-title');
    node.innerHTML = `<form method="dialog" id="stage-timecode-form">
      <header><h2 id="stage-timecode-title">タイムコード</h2><button value="cancel" aria-label="閉じる">×</button></header>
      <p class="tc-help">本編開始を基準に、前後のシーンと音源を組みます。ショーに保存されます。</p>
      <label>本編開始のシーン<select id="tc-origin-scene" required></select></label>
      <label>開始タイムコード<input id="tc-origin-clock" type="text" value="01:00:00.0" placeholder="01:00:00.0" autocomplete="off" required></label>
      <p class="tc-help">時:分:秒.小数1桁（フレームではありません）</p>
      <p class="tc-help">未設定のあいだは、最初のシーンの頭を 00:00:00.0 として表示します（保存はされません）。</p>
      <details id="tc-media-details"><summary>音源の開始位置</summary>
        <p class="tc-help">配置したセクションでは、この一覧で音源を再生します。配置がないセクションは従来の音源を使います。</p>
        <div id="tc-media-list"></div>
        <label>鳴らし始めるシーン<select id="tc-media-scene"></select></label>
        <label>音源<select id="tc-media-track"></select></label>
        <div class="tc-pair"><label>ファイル開始（秒）<input id="tc-media-in" type="number" min="0" step="0.1" value="0"></label><label>ファイル終了（秒）<input id="tc-media-out" type="number" min="0" step="0.1" placeholder="音源の最後"></label></div>
        <button type="button" id="tc-media-add">配置を追加</button>
      </details>
      <details id="tc-formation" hidden><summary>フォーメーションと秒数の対応</summary><div id="tc-formation-changes"></div><label class="tc-check"><input type="checkbox" id="tc-adopt-formation">保存時にフォーメーションの秒数をシーンへ反映する</label></details>
      <p id="tc-error" role="status"></p>
      <footer><button value="cancel">キャンセル</button><button type="button" id="tc-save">保存</button></footer>
    </form>`;
    document.body.append(node);
    const q = id => node.querySelector('#' + id);
    let draft = [], original = null, returnFocus = null;
    const option = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; };
    function fill() {
      const { project, sectionId } = context(); original = project;
      const rows = project.scenes.filter(s => s.kind === 'scene');
      for (const id of ['tc-origin-scene', 'tc-media-scene']) q(id).replaceChildren(...rows.map(s => option(s.id, s.title)));
      q('tc-origin-scene').value = project.timecode?.originSceneId || project.activeSceneId;
      if (!q('tc-origin-scene').value) { q('tc-origin-scene').prepend(option('', tx('本編開始のシーンを選び直してください。'))); q('tc-origin-scene').value = ''; }
      q('tc-origin-clock').value = D.clock(project.timecode?.originSeconds ?? 3600);
      q('tc-media-scene').value = project.activeSceneId;
      q('tc-media-track').replaceChildren(...(project.audioTracks || []).map(t => option(t.id, t.title)));
      const active = rows.find(s => s.id === project.activeSceneId);
      if (active?.audioTrackId) q('tc-media-track').value = active.audioTrackId;
      const formation = D.formationTimingProposal(project);
      q('tc-formation').hidden = !formation.changes.length && !formation.errors.length;
      q('tc-adopt-formation').checked = false; q('tc-adopt-formation').disabled = !!formation.errors.length;
      q('tc-formation-changes').textContent = formation.errors.map(e => D.errorText(e, tx)).concat(formation.changes.map(c => `${c.title}：${c.before}s → ${c.hold + c.travel}s`)).join(' / ');
      draft = structuredClone(Array.isArray(project.timelineMedia?.placements) ? project.timelineMedia.placements.filter(p => p && typeof p === 'object') : []); renderDraft(); q('tc-error').textContent = '';
    }
    function renderDraft() {
      const list = q('tc-media-list'); list.replaceChildren();
      draft.forEach((p, index) => {
        const row = document.createElement('div'); row.className = 'tc-media-row';
        const label = document.createElement('span');
        label.textContent = `${original.scenes.find(s => s.id === p.start?.sceneId)?.title || tx('シーン不明')} → ${(original.audioTracks || []).find(t => t.id === p.trackId)?.title || tx('音源不明')}（${p.mediaInSeconds}–${p.mediaOutSeconds ?? tx('最後')}）`;
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = tx('外す'); remove.setAttribute('aria-label', label.textContent + ' ' + tx('外す'));
        remove.onclick = () => { draft.splice(index, 1); renderDraft(); }; row.append(label, remove); list.append(row);
      });
    }
    function open(sceneId) { returnFocus = document.activeElement; fill(); root.GAMMA_UI?.translateDOM(node, { language: document.documentElement.lang, lookup: key => tx(key) }); if (sceneId) q('tc-origin-scene').value = sceneId; node.showModal(); q('tc-origin-scene').focus(); }
    q('tc-media-add').onclick = () => {
      const d = D.resolve(original), scene = d.byId.get(q('tc-media-scene').value);
      const mediaIn = q('tc-media-in').value === '' ? NaN : Number(q('tc-media-in').value);
      const mediaOut = q('tc-media-out').value === '' ? null : Number(q('tc-media-out').value);
      if (!scene?.sectionId || !q('tc-media-track').value) { q('tc-error').textContent = tx('開始シーンと音源を選んでください。'); return; }
      const placement = { id: `media-${crypto.randomUUID()}`, sectionId: scene.sectionId, timelineId: 'fallback', trackId: q('tc-media-track').value, start: { sceneId: scene.id, offsetSeconds: 0 }, mediaInSeconds: mediaIn, mediaOutSeconds: mediaOut };
      const songs = D.formationTimelines(original, d.sections.get(scene.sectionId).row);
      const song = songs.find(s => s.segments.some(segment => segment.sceneId === scene.id));
      if (song) placement.timelineId = song.songId;
      const probe = { ...original, timelineMedia: { version: 1, placements: [...draft, placement] } };
      const issues = D.resolveMedia(D.resolve(probe)).errors;
      q('tc-error').textContent = issues.map(e => D.errorText(e, tx)).join(' ');
      if (!issues.length) { draft.push(placement); renderDraft(); }
    };
    q('tc-save').onclick = () => {
      const { project, sectionId } = context();
      if (project.timecode && (project.timecode.version !== 1 || project.timecode.mode !== 'continuous')
          || project.timelineMedia && project.timelineMedia.version !== 1) {
        q('tc-error').textContent = tx('未対応の設定版は、この画面から上書きできません。'); return;
      }
      // Do not replace edits received while this dialog was open.
      if (JSON.stringify(project.timecode) !== JSON.stringify(original.timecode) || JSON.stringify(project.timelineMedia) !== JSON.stringify(original.timelineMedia)) { q('tc-error').textContent = tx('設定が更新されています。開き直して確認してください。'); return; }
      const seconds = D.parseClock(q('tc-origin-clock').value);
      if (seconds === null) { q('tc-error').textContent = tx('時:分:秒.小数1桁で、0時以上24時未満を入力してください。'); return; }
      const result = bridge.setShowTimecode({
        timecode: { ...project.timecode, version: 1, mode: 'continuous', originSceneId: q('tc-origin-scene').value, originOffsetSeconds: 0, originSeconds: seconds, precision: 'tenths' },
        timelineMedia: draft.length || project.timelineMedia ? { ...project.timelineMedia, version: 1, placements: draft } : undefined,
        sectionId, adoptFormation: q('tc-adopt-formation').checked,
      });
      if (!result.ok) { q('tc-error').textContent = result.errors.map(e => D.errorText(e, tx)).join(' '); return; }
      node.close(); changed();
    };
    node.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
    node.addEventListener('click', event => { if (event.target === node) { const r=node.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) node.close(); } });
    document.getElementById('stage-timecode-settings').onclick = () => open();
    document.getElementById('stage-scene-timecode-origin').hidden = false;
    window.addEventListener('stage-timecode-origin-edit', event => open(event.detail?.sceneId));
    const seekInput = document.getElementById('stage-timecode-seek');
    seekInput.addEventListener('keydown', e => { if(e.key==='Escape') { e.preventDefault(); seekInput.setCustomValidity(''); seekInput.blur(); refreshPosition?.(); } if(e.key==='Enter') { e.preventDefault(); const ok=seek(seekInput.value); seekInput.setCustomValidity(ok ? '' : tx('ショーの範囲にある時刻を入力してください。')); seekInput.reportValidity(); } });
    seekInput.addEventListener('input', () => seekInput.setCustomValidity(''));
    seekInput.addEventListener('blur', () => refreshPosition?.());
    document.getElementById('stage-timecode-scope').onchange = e => scope(e.target.value);
    return { open, seekInput };
  }
  root.STAGE_TIMECODE_UI = { create };
})(window);
