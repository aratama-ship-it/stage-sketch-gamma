(function () {
  'use strict';
  const host = window.GAMMA_FORMATION_HOST;
  if (!host) return;
  let dialog = null, returnFocus = null;
  const buttons = [];
  function close() { if (dialog?.open) dialog.close(); }
  function open(button) {
    const availability = host.availability();
    if (!availability.enabled) return;
    if (!dialog) {
      dialog = document.createElement('dialog');dialog.id = 'gamma-formation-dialog';dialog.setAttribute('aria-label', 'フォーメーション');
      const head = document.createElement('div');head.className = 'gamma-formation-head';
      const title = document.createElement('span');title.textContent = 'フォーメーション';
      const cancel = document.createElement('button');cancel.type = 'button';cancel.className = 'gamma-formation-close';cancel.textContent = '閉じる';cancel.addEventListener('click', close);
      head.append(title, cancel);dialog.append(head);document.body.append(dialog);
      dialog.addEventListener('keydown', event => event.stopPropagation());
      dialog.addEventListener('close', () => { dialog.querySelector('iframe')?.remove();returnFocus?.focus(); });
    }
    if (dialog.open) return;
    returnFocus = button;
    const frame = document.createElement('iframe');frame.title = 'フォーメーションの選択と人物の入れ替え';frame.src = 'formation/presets/editor.html?v=formation1';
    dialog.append(frame);dialog.showModal();
  }
  for (const [anchorId, id] of [['stage-arrange-menu','gamma-formation-plan'],['stage-front-note','gamma-formation-front']]) {
    const anchor = document.getElementById(anchorId);if (!anchor) continue;
    const button = document.createElement('button');button.type = 'button';button.id = id;button.hidden = true;button.className = 'stage-canvas-tool gamma-formation-trigger';button.textContent = 'フォーメーション';button.setAttribute('aria-haspopup', 'dialog');button.addEventListener('click', () => open(button));anchor.after(button);buttons.push(button);
  }
  function refresh() {
    const status = host.availability();
    for (const button of buttons) { button.hidden = !status.visible;button.disabled = !status.enabled;button.title = status.reason || '選択した人物のフォーメーション'; }
  }
  window.GAMMA_FORMATION_UI = Object.freeze({ refresh, close });
  refresh();
})();
