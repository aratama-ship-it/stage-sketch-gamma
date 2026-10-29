/* S-4: approved terms display copy. Japanese is authoritative. */
window.SHOSAI_TERMS = window.SHOSAI_TERMS || {};
window.SHOSAI_TERMS["en"] = {
  "title": "Terms, copyright and privacy",
  "paragraphs": [
    "© 2026 PYGMIX. All rights reserved.",
    "Shows in the browser edition are stored only in the browser on your device and may be deleted by browser settings or prolonged inactivity. Export backup copies; the Mac app saves shows as files.",
    "We collect only anonymous counts of tab and feature use, which you can turn off in Settings. We do not collect show content, text you enter, screenshots or personally identifiable information.",
    "You are responsible for decisions about running a performance and its safety."
  ],
  "webParagraphs": [
    "Consultation (trial): text you enter is sent to an external AI (Anthropic's API) only to produce a reply. Anthropic does not train models on it and normally deletes it within 30 days (up to 2 years if a policy violation is suspected). Stage Sketch does not save or record it.",
    "Consultation is a trial feature for thinking through ideas. It does not operate the board or save files, may change or end without notice, and has usage limits. Replies are not guaranteed to be accurate, complete or appropriate; check them yourself. Do not enter personal or confidential information."
  ],
  "priority": "This English text is a summary; the Japanese version takes precedence.",
  "contact": "Contact",
  "japanese": "Japanese version"
};

/* Download gate result; separate from the app interface pack. */
window.SHOSAI_DOWNLOAD_GATE_COPY = window.SHOSAI_DOWNLOAD_GATE_COPY || {};
window.SHOSAI_DOWNLOAD_GATE_COPY["en"] = { unlocked: "Passphrase confirmed. The download is available." };

// B68 A4-13: download-page display copy; gate behaviour is unchanged.
window.SHOSAI_DOWNLOAD = window.SHOSAI_DOWNLOAD || {};
window.SHOSAI_DOWNLOAD["en"] = {
  "title": "Download Stage Sketch γ for Mac",
  "versionFallback": "Check GitHub Releases for the latest version.",
  "version": "Latest Mac version: {version}",
  "heading": "Download or update the Mac app",
  "lead": "Download the new app and replace your current 舞台スケッチγ.app.",
  "gate": "Passphrase",
  "open": "Open",
  "showPassphrase": "Show passphrase",
  "hidePassphrase": "Hide passphrase",
  "required": "Please enter the passphrase.",
  "wrong": "The passphrase is incorrect.",
  "unavailable": "Verification was unavailable in this environment. Please try another browser.",
  "download": "Download (GitHub Releases)",
  "install": "Installation",
  "step1": "Download the latest zip from GitHub Releases.",
  "step2": "Unzip the file.",
  "step3": "Place 舞台スケッチγ.app in Applications or on the desktop. To update, quit the current app before replacing it with the new one.",
  "step4": "Double-click 舞台スケッチγ.app to open it.",
  "storage": "About saved data",
  "storageNote": "Shows are saved in project files (.stageproj), separately from the app. Replacing the app leaves your saved files in place. For shows in the previous WebView storage, open Previous shows and save them as project files to migrate them.",
  "browser": "Open the browser edition",
  "requirements": "Requires a Mac with Apple silicon and macOS 14 or later. Intel-based Macs are not supported.",
  "signed": "This distribution is signed with Developer ID and notarised by Apple. You normally do not need to bypass an “unidentified developer” warning.",
  "warningGuidance": "If you see an unidentified developer warning, check the download source and app version, then contact support."
};

// B70 A5-07: download guidance copy; the passphrase controls display only.
window.SHOSAI_DOWNLOAD_COPY = window.SHOSAI_DOWNLOAD_COPY || {};
window.SHOSAI_DOWNLOAD_COPY["en"] = {
  "scope": "Enter the passphrase to show the download location and installation instructions. This is a simple display gate; it does not restrict access to the distributed files.",
  "remember": "After entry, the same browser keeps the instructions visible for 30 days.",
  "authenticity": "Check the distributor separately from the passphrase. Before downloading, confirm that the link goes to the official PYGMIX GitHub repository (aratama-ship-it/stage-sketch-gamma)."
};

// G-130: expiry copy; ko/zh translations await native-speaker review.
window.SHOSAI_I18N_PACKS = window.SHOSAI_I18N_PACKS || {};
window.SHOSAI_I18N_PACKS["en"] = window.SHOSAI_I18N_PACKS["en"] || { text: {} };
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "リンクの期限": "Link expiry",
  "期限なし": "No expiry",
  "日時を指定": "Specify date and time",
  "現地の日時": "Local date and time",
  "UTC では": "In UTC",
  "期限": "Expires",
  "期限切れ": "Expired",
  "このサーバーは期限付きの発行に未対応です。": "This server does not support links with an expiry.",
  "現在より後の日時を指定してください。": "Choose a date and time in the future.",
  "期限を受け付けられません。指定した日時を確認してください。": "The expiry was not accepted. Check the date and time.",
  "発行した期限を確認できません。リンクは配布せず、保存済みリンクを確認してください。": "The issued expiry could not be verified. Do not distribute the link; check saved links.",
  "期限切れ（閲覧・投稿は停止中。受信済みのメモは残っています）": "Expired (viewing and posting have stopped; received notes are kept).",
  "新しいリンクを発行するには、先にリンクを無効化してください。": "Revoke this link before creating a new one.",
  "期限が切れました。発行者に連絡してください。": "This link has expired. Please contact the issuer.",
  "書きかけのメモ（同期は停止中）": "Your draft note (sync has stopped)"
});

// Consultation trial: separate keys, no conversation storage.
window.SHOSAI_I18N_PACKS = window.SHOSAI_I18N_PACKS || {};
window.SHOSAI_I18N_PACKS["en"] = window.SHOSAI_I18N_PACKS["en"] || {text:{}};
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.title": "Consultation (provisional)",
  "assist.badge": "Trial",
  "assist.name": "Sode",
  "assist.you": "You",
  "assist.input": "Your message",
  "assist.placeholder": "Example: Ideas to fill the transition in act two?",
  "assist.send": "Send",
  "assist.context": "Share the current scene title and head count",
  "assist.remaining": "{n} left today",
  "assist.notice": "This is a trial feature and may end without notice. Your text is sent to external AI (Anthropic) only to produce a reply and is not saved by Stage Sketch. Do not enter personal or confidential information. Replies may be inaccurate.",
  "assist.thinking": "Thinking: {n}s",
  "assist.daily": "Today’s allowance is used up. Please come back tomorrow.",
  "assist.monthly": "This month’s consultation allowance is full.",
  "assist.ended": "The consultation trial has ended. Thank you for your feedback.",
  "assist.busy": "The service is busy. Please reopen it later.",
  "assist.unavailable": "Consultation is unavailable. Please reopen it later.",
  "assist.auth": "Please check your sign-in and subscription, then reopen."
});
