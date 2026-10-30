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
    "Consultation (trial): text you enter and the recent conversation (up to six exchanges) are sent to an external AI (Anthropic's API) only to produce a reply. Anthropic does not train models on it and normally deletes it within 30 days (up to 2 years if a policy violation is suspected). Stage Sketch does not save or record it.",
    "Consultation is a trial feature for thinking through ideas. It may open and point to places in the app, but it never changes your show or saves files on its own; operations it proposes (a new alternative, a lighting preview or draft) enter your show only when you review them and press the button. It may change or end without notice and has usage limits. Replies are not guaranteed to be accurate, complete or appropriate; check them yourself. Do not type other people’s personal or confidential information. Pressing “Check this scene”, “Draft in an alternative” or “Draft lighting” sends registered performer names, which may be real names; rename performers to role names or labels first if you do not want to send them.",
    "When you press “Check this scene” in Consultation, the types, names (including performer names) and positions of pieces in this scene and its adjacent scenes are sent to the Anthropic API, along with your text, solely to generate a reply. Stage Sketch does not store this information.",
    "When you click “Draft in an alternative”, your text, the current scene’s piece types, names (including performer names) and positions, and registered performer/set names and types are sent to the Anthropic API only to generate the response. AI proposals create a new alternative only after you review and click. Stage Sketch does not store the conversation or proposed operations. An alternative you create is saved as part of the show.",
    "When you press “Draft lighting”, the current scene’s fixture names, types, positions, current brightness and colours, and performer names and positions are sent with your text to the Anthropic API solely to generate a reply. AI proposals become a preview or unapplied draft in Lighting Design; they enter your show only when you press Apply."
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
  "assist.trialNotice": "This is a trial feature and may end without notice.",
  "assist.notice": "Your text is sent to external AI (Anthropic) only to produce a reply and is not saved by Stage Sketch. Do not enter personal or confidential information. Replies may be inaccurate.",
  "assist.thinking": "Thinking: {n}s",
  "assist.daily": "Today’s allowance is used up. Please come back tomorrow.",
  "assist.monthly": "This month’s consultation allowance is full.",
  "assist.ended": "The consultation trial has ended. Thank you for your feedback.",
  "assist.busy": "The service is busy. Please reopen it later.",
  "assist.unavailable": "Consultation is unavailable. Please reopen it later.",
  "assist.auth": "Please check your sign-in and subscription, then reopen."
});

// K1 consultation reference labels.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.guide": "Guide from consultation",
  "assist.back": "Back to the previous view",
  "assist.opening": "Opening the location",
  "assist.opened": "Opened the {name} tab",
  "assist.located": "Showing {name}",
  "assist.needsFixture": "Select a compatible lighting fixture in the list to see {name} in Fixture details.",
  "assist.field.level": "Level",
  "assist.field.colour": "Light colour",
  "assist.field.aim": "Target surface",
  "assist.field.beam": "Beam spread",
  "assist.field.gobo": "Pattern (gobo)",
  "assist.field.shutter": "Shutter",
  "assist.refs": "References",
  "assist.refWork": "Work: {label} ({source})",
  "assist.refShosai": "Study: {label}"
});

// K4: scene data is sent only by the explicit check action.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.check": "Check this scene",
  "assist.checkPrompt": "Check this scene",
  "assist.checkNotice": "Sends piece types, names (including performer names) and positions from this scene and its adjacent scenes.",
  "assist.refScene": "Checked scene: {label}",
  "assist.sceneUnavailable": "Could not read the scene. Open a scene and try again."
});

// K5: reviewed alternative drafts.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.lightCommon": "Simple lighting needs the common rig. Request detail lighting, or make a common-rig copy yourself first.",
  "assist.lightTheatre": "Simple lighting is unavailable in this theatre. Specify detail fixtures instead.",
  "assist.lightStale": "The source changed after your request. Check the current scene and ask again.",
  "assist.lightReadOnly": "Lighting drafts are unavailable in read-only mode.",
  "assist.lightPlaying": "Stop playback and fades before requesting lighting.",
  "assist.lightRehearsal": "Lighting drafts are unavailable during rehearsal.",
  "assist.lightField": "Lighting drafts are unavailable in field mode.",
  "assist.lighting": "Draft lighting",
  "assist.lightInput": "Describe lighting in up to 400 characters. Sends fixture and performer names (which may be real names) and positions.",
  "assist.lightShared": "Lighting drafts are unavailable while sharing.",
  "assist.lightLite": "Lighting drafts require Studio or Company.",
  "assist.lightUnapplied": "Unapplied edits exist. Apply or cancel them first.",
  "assist.lightBlocked": "Check lighting readiness, editing and playback; stop before retrying.",
  "assist.lightFailed": "Could not prepare the lighting draft.",
  "assist.lightReview": "Review the list and preview or draft, then press Apply if it looks right.",
  "assist.lightChanges": "Proposed changes (unapplied)",
  "assist.lightPresetChange": "{name} · {targets} · {color} · {level}% · size {size}m · {fade}s",
  "assist.lightWhole": "whole stage",
  "assist.lightLevel": "Level {from}%→{to}%",
  "assist.lightColor": "Colour {from}→{to}",
  "assist.lightAim": "Aim at {name}",
  "assist.lightFixedWarning": "{name}: fixed-fixture colour, surface and aim edits propagate to all scenes and alternatives.",
  "assist.lightSizeWarning": "Fixture angle limits may change the spot size. Check in detail view.",
  "assist.lightPlace.left": "audience left",
  "assist.lightPlace.center": "centre",
  "assist.lightPlace.right": "audience right",
  "assist.lightPlace.back": "upstage",
  "assist.lightPlace.front": "downstage",
  "assist.draft": "Draft in an alternative",
  "assist.draftInput": "Describe your draft in up to 400 characters. Sends this scene’s pieces and registered names (including performer names).",
  "assist.draftShared": "Alternative drafts are unavailable while sharing.",
  "assist.draftLite": "Alternative drafts require Studio or Company.",
  "assist.draftStorage": "Resolve the storage problem and try again.",
  "assist.draftBlocked": "Use the normal editor after editing and playback have stopped.",
  "assist.confirmDraft": "This will be done",
  "assist.applyDraft": "Create alternative",
  "assist.cancelDraft": "Cancel",
  "assist.draftRejected": "Omitted {n} unsupported operations.",
  "assist.draftLabel": "Consultation draft",
  "assist.draftCreated": "Created the “{label}” alternative. Compare it and adopt it if you like.",
  "assist.draftSavedDisplayFailed": "The alternative was saved. Reopen the scene to view it.",
  "assist.draftFailed": "Could not create the alternative.",
  "assist.draftReady": "Review the proposed operations.",
  "assist.opRemove": "Take {name} backstage",
  "assist.opFace": "Turn {name} to face {dir} ({n}°)",
  "assist.faceHouse": "the house",
  "assist.faceBack": "upstage",
  "assist.opPlace": "Place {name} at {where}",
  "assist.opMove": "Move {name} to {where}",
  "assist.stageRight": "stage right",
  "assist.stageLeft": "stage left",
  "assist.center": "centre",
  "assist.backStage": "back",
  "assist.frontStage": "front",
  "assist.middleStage": "middle",
  "assist.position": "{side}, {depth} ({x}% across, {y}% from back)",
  "assist.editFailureStale": "The scene, alternative or editing state changed. Ask again.",
  "assist.editFailureSave": "Saving failed. The original alternative is unchanged.",
  "assist.editFailureLocked": "Locked pieces cannot be changed.",
  "assist.editFailureRelationship": "This operation cannot handle the attached or supported pieces.",
  "assist.editFailureUnsupported": "This operation, including lights and routes, is not enabled yet.",
  "assist.editFailureCapacity": "The piece or alternative limit has been reached.",
  "assist.editFailureInvalid": "Check the names, positions and facing in the proposal."
});
