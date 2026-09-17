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
  /* T-02（2026-09-18 本人要望）: 入口は「選んだもの」パネルの最下部だけにする。
   * 以前は図のバー（平面図＝#stage-arrange-menu の後／正面図＝#stage-front-note の後）に
   * 2つ置いていたが、本人決定で廃止。見た目はパネル内のボタンの作法（.stage-minor-action）に
   * そろえる（近くの「選んだ灯に型を適用…」と同じ性質のボタンなので）。 */
  const host2 = document.getElementById('stage-formation-entry');
  if (host2) {
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'gamma-formation-open'; button.hidden = true;
    button.className = 'stage-minor-action gamma-formation-trigger';
    button.textContent = 'フォーメーション';
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => open(button));
    host2.append(button); buttons.push(button);
  }
  function refresh() {
    const status = host.availability();
    /* T-05（2026-09-18 本人要望）: 物が混ざった選択でも演者だけを対象にするので、
     * 「何人で組むのか」がボタンから読めるようにする（本人決定 (b)＝title 頼みにしない）。 */
    const label = status.enabled && status.count ? `フォーメーション（${status.count}人）` : 'フォーメーション';
    for (const button of buttons) { button.hidden = !status.visible;button.disabled = !status.enabled;button.textContent = label;button.title = status.reason || '選んだ人物のフォーメーション'; }
  }
  window.GAMMA_FORMATION_UI = Object.freeze({ refresh, close });
  refresh();
})();
