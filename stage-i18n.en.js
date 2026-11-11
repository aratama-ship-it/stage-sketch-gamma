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
    "Consultation (trial): text you enter and the recent conversation (up to six exchanges) are sent to an external AI (Anthropic's API) only to produce a reply. Anthropic does not train models on it and normally deletes it within 30 days (up to 2 years if a policy violation is suspected). Storage by Stage Sketch is governed by the answer reuse and device history clauses below.",
    "Consultation is a trial feature for thinking through ideas. It may open and point to places in the app, but it never changes your show or saves files on its own; AI-proposed operations (new alternatives, adding, moving, swapping, taking backstage or changing the facing of pieces in the current scene, group placement, and lighting previews or drafts) enter the show only when you review them and press the relevant button. It may change or end without notice and has usage limits. Replies are not guaranteed to be accurate, complete or appropriate; check them yourself. Do not type other people’s personal or confidential information. Pressing “Check this scene”, “Draft in an alternative” or “Draft lighting” sends registered performer names, which may be real names; rename performers to role names or labels first if you do not want to send them.",
    "Pressing AI check analyses the selected scene or whole show on your device. Findings are grouped by scene and type, and their scene numbers, types, counts, representative measurements or appearance timings, and up to two example performer, object or cue names per group are sent to Anthropic. The complete show, script, piece list, photos and audio are not sent. When nothing requires review, no AI request is made and no allowance is used. A whole-show check uses one request and one consultation allowance. Stage Sketch does not save these results or explanations. A follow-up sent through Ask AI uses a separate allowance. Findings are candidates for review, not certification of physical safety or transition feasibility, and do not change your show automatically.",
    "Pressing Draft this part in Document drafts sends the scene and part shown on screen to Anthropic to produce a reply. Run-note organisation sends the selected run’s saved notes and addenda, run name and source scene title. Performer briefings send the registered performer’s name, presence in the current and adjacent scenes, position words and held-prop names. Technical handovers send the selected scene’s LX cue names, notes, order, configured timing and light values, and the displayed part of the show’s shared equipment registration. Translation sends the selected cue names and notes, scene notes or excerpts of the latest draft for that scene. Exclude personal or confidential information. The whole show, recorded drawings, images and audio are not sent. Drafts are not saved to your show, and your show, run notes and performer-link notes are not changed. If consultation history is turned on, the request and draft are kept in this device’s consultation history, following your history settings. You may retain a copy using Copy or Export. Check all wording and translations before use.",
    "When you press “Check this scene” in Consultation, the types, names (including performer names) and positions of pieces in this scene and its adjacent scenes are sent to the Anthropic API, along with your text, solely to generate a reply. Stage Sketch does not store this information.",
    "When you click “Draft in an alternative”, your text, the current scene’s piece types, names (including performer names) and positions, and registered performer/set names and types are sent to the Anthropic API only to generate the response. AI proposals create a new alternative only after you review and click. Stage Sketch does not store the conversation or proposed operations. An alternative you create is saved as part of the show.",
    "When you press “Draft lighting”, the current scene’s fixture names, types, positions, current brightness and colours, and performer names and positions are sent with your text to the Anthropic API solely to generate a reply. AI proposals become a preview or unapplied draft in Lighting Design; they enter your show only when you press Apply.",
    "When you request lighting adjustments, we send summaries of the current scene’s fixtures, performers and lighting layers, and the lighting cues within the scope you select, including names, positions, colours, brightness and timing. Anything created from a review card is an unapplied draft; it enters your show only when you press “Apply”. Device history of questions and replies follows your Consultation history settings.",
    "Pressing Review transition sends the scene titles and piece types, names and rounded plan positions for the current scene and the selected adjacent scene to Anthropic. Pressing Plan from script sends the current scene title and up to 400 characters of the current scene’s dialogue/directions and speaker names; scene notes are used if no script exists, or the input text if neither exists. Stage Sketch uses this material only to produce a reply and does not store it. Suggestions and Copy do not change your show.",
    "When you press “Operate this scene”, your text and recent conversation, together with the current scene’s piece types, registered names (including performer names), positions and facing, the names and types of registered performers, apparatus and props, and the stage width and depth are sent to the external AI. Stage Sketch does not save conversations or operation proposals; the results of operations you execute are saved in your show.",
    "Duplicating, adding and reordering formations or scenes likewise calculates the changes and their effects on your device, shows them for confirmation, and applies them to your show only when you press Run. Other scenes’ content and the effect list are not sent to the external AI for this calculation.",
    "Text needed to produce consultation replies is sent to Anthropic's API. When answer reuse is enabled, for a predefined general question containing no show data or conversation context, Stage Sketch may reuse an answer. Only answer text is cached in the Cloudflare Cache API for up to 24 hours, without linking it to the questioner, account, IP address or conversation history. The question text itself is not stored in this cache. A reused answer still counts as one consultation request.",
    "History is off by default. After you enable Keep history on this device, only successful questions and replies started afterwards may be kept in this browser's local storage: up to 20 exchanges, 7 days and 64 KiB. Expired entries are removed on the next read. History is not saved as server conversation history or in show files, and is not automatically sent with new questions. Turning history off stops new records; existing records can be removed with Delete all history. Clearing browser data also removes the history. Statements in these terms that conversations or input text are not stored exclude device history that you choose to keep."
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
  "assist.editFailureInvalid": "Check the names, positions and facing in the proposal.",
  "assist.ops": "Operate this scene",
  "assist.opsInput": "Sends this scene’s pieces, registered names, positions and stage dimensions to AI to prepare a confirmation card.",
  "assist.opsShared": "Operation assistance is unavailable during sharing, including for hosts.",
  "assist.opsBlocked": "Operation assistance is unavailable in the current editing state.",
  "assist.opsDirectionCount": "Affected performers: {n} · Scenes: {m}",
  "assist.opsRoute": "Exit route",
  "assist.opsBackstageSpot": "Backstage position",
  "assist.opsTransition": "Transition into this scene",
  "assist.opsLanding": "Keep landing at this scene’s position",
  "assist.opsRoutePoint": "{x}% from stage right · {y}% from upstage",
  "assist.opsBend": "Bend",
  "assist.opsStraight": "Straight",
  "assist.opsDirectionQuestion": "Whose exit or entrance, and which wing? Please check the performer, adjacent scenes, earlier exit source and theatre wings (upstage for thrust, stage left/right otherwise). The conditions are unclear; nothing has changed.",
  "assist.opsDirectionNoChange": "The requested exit or entrance direction is unchanged. Nothing has changed.",
  "assist.opsDirectionProceed": "This change also affects {names}’s exits, entrances and earlier or later scenes as listed below. Proceed?",
  "assist.opsDirectionProceedLocal": "Change {names}’s exit or entrance as listed below. Proceed?",
  "assist.opsDirectionAutomatic": "A performer with a specified exit leaves the automatic backstage queue, so other performers’ waiting positions and entrances or exits also change.",
  "assist.opsDirectionDetails": "Details (coordinates, curves and all changes)",
  "assist.opsPlaceUpstage": "upstage",
  "assist.opsPlaceRightWing": "stage-right wing",
  "assist.opsPlaceLeftWing": "stage-left wing",
  "assist.opsPlaceOnstage": "onstage ({side})",
  "assist.opsPlaceRight": "stage-right area",
  "assist.opsPlaceLeft": "stage-left area",
  "assist.opsPlaceCenter": "centre",
  "assist.opsSummaryExit": "exit",
  "assist.opsSummaryEntrance": "entrance start",
  "assist.opsSummaryPreviousExit": "exit destination from previous scene",
  "assist.opsSummaryCurve": "movement curve changes (landing stays {place})",
  "assist.opsSummaryWithin": "{kind}: position or path changes within {to}",
  "assist.opsSummaryChange": "{kind}: {from} → {to}",
  "assist.opsSummaryRow": "{number} {title}: {name} — {changes}",
  "assist.opsSummarySeparator": " / ",
  "assist.opsDirectionConfirm": "Review exit and entrance changes",
  "assist.opsNoRoute": "Automatic / unspecified",
  "assist.opsDirectionSide": "This theatre has no wing in that direction. Use upstage for thrust, or stage left/right otherwise. Which side? Nothing has changed.",
  "assist.opsDirectionAdjacent": "There is no previous or next scene. Which scene’s entrance or exit should change? Nothing has changed.",
  "assist.opsDirectionSource": "No earlier exit route can change this entrance start. Which earlier scene should supply the exit? Nothing has changed.",
  "assist.opsDirectionPerformer": "Please give the exact registered name of one performer on stage in this scene. Whose entrance or exit should change? Nothing has changed.",
  "assist.opsDirectionRelationship": "A lock, held item or support prevents this route change. Please check those relationships. Whose entrance or exit should change? Nothing has changed.",
  "assist.opsConfirm": "Changes in this scene",
  "assist.opsExecute": "Execute",
  "assist.opsCount": "{n} pieces changed · total {before} → {after}",
  "assist.opsPosition": "{x}% from stage right · {y}% from back · facing {n}°",
  "assist.opsBackstage": "backstage",
  "assist.opsDone": "Applied to this scene. Undo once to restore it.",
  "assist.opsCommitted": "Saved, but the display could not be updated. Reopen the scene to check; do not execute again.",
  "assist.opsFailed": "Could not execute. Check the scene, locks, attachments and saving state, then ask again."
});

// AB read-only consultation starters; no terms or storage changes.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {"assist.quick.title":"Frequent questions","assist.quick.terms":"Look up terms","assist.quick.help":"Troubleshooting","assist.quick.cue":"Draft cue wording","assist.quick.names":"Suggest names","assist.quick.transition":"Review transition","assist.quick.script":"Plan from script","assist.quick.direction":"Compare transition","assist.quick.next":"Now → next","assist.quick.prev":"Previous → now","assist.quick.notice":"Each press uses one request. Transitions send pieces from the selected two scenes; script planning sends up to 400 characters of current-scene dialogue/directions (or notes/input) to Anthropic. Suggestions only; your show stays as it is.","assist.quick.voice":"Voice input: You can use your device’s dictation, such as Mac Dictation.","assist.quick.copy":"Copy","assist.quick.copied":"Copied","assist.quick.copyFailed":"Could not copy. Select and copy the reply text.","assist.quick.noScript":"No script or notes in this scene. Paste dialogue or directions in the input (up to 400 characters).","assist.quick.noAdjacent":"Cannot read the adjacent scene. Check the scene selection.","assist.quick.excerpt":"Script sent: {title} ({n} characters)","assist.quick.excerptShort":"Script sent: {title} (first {n} of {total} characters; the rest was not read)","assist.quick.prompt.terms":"Explain stage left, cyclorama and gobo","assist.quick.prompt.help":"What should I do if I cannot save?","assist.quick.prompt.cue":"Suggest short wording for a lighting cue memo","assist.quick.prompt.names":"Suggest scene, cue or alternative names","assist.quick.prompt.transition":"Explain moving people and objects, entrances, exits and ordering for the selected transition","assist.quick.prompt.script":"Suggest entrances, exits and transition order from this scene’s dialogue and directions"});

// INFRA local archive controls; policy text remains a publication approval item.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {"assist.history.settings": "Consultation settings", "assist.history.enabled": "Keep history on this device", "assist.history.notice": "Off by default. Only questions and replies started after enabling are kept here: up to 20 exchanges, 7 days and 64 KiB. They are not saved in shows or on the server, or automatically sent with new questions. Turning this off keeps existing entries readable until deleted.", "assist.history.archive": "Saved history ({n} exchanges)", "assist.history.clear": "Delete all history", "assist.history.confirmClear": "Delete (cannot be undone)", "assist.history.cancel": "Cancel", "assist.history.cleared": "History on this device was deleted.", "assist.history.storageFailed": "History could not be saved or read. Your show and this reply are unchanged. Delete history to reset this setting.", "assist.history.notSaved": "This exchange was not saved to history.", "assist.history.policy": "Your input is sent to Anthropic to produce replies. You can choose to keep later questions and replies on this device. Conversation history is not stored on the server."});
// CHECK: local batch results and explicit finding-only transmission.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.batch.title": "AI check",
  "assist.batch.scope": "Check scope",
  "assist.batch.scene": "This scene",
  "assist.batch.show": "Whole show",
  "assist.batch.notice": "Only findings (scene numbers/titles, subject names, counts and timing) go to Anthropic. One request uses one allowance. With no findings, no AI call or charge. Results are not saved.",
  "assist.batch.prompt": "Explain the code-calculated findings briefly by category and suggest remedies.",
  "assist.batch.result": "Check results: {scenes} scenes · {n} review items ({places} occurrences)",
  "assist.batch.safety": "Safety / placement",
  "assist.batch.transition": "Transitions",
  "assist.batch.appearance": "Appearances",
  "assist.batch.lighting": "Lighting",
  "assist.batch.advice": "AI suggestions",
  "assist.batch.ask": "Ask AI",
  "assist.batch.askPrompt": "Suggest ways to address this finding: {item}",
  "assist.batch.thinking": "Reviewing the list…",
  "assist.batch.empty": "No review items found. No AI call or allowance used. Also check the unassessed areas. This does not guarantee physical safety.",
  "assist.batch.done": "Checked. Placement, appearances and light coverage are candidates; verify heights, routes, attachments and costumes in rehearsal.",
  "assist.batch.failed": "Could not complete the check or AI explanation. Any displayed list was calculated locally.",
  "assist.batch.tooLarge": "The list exceeds the sending limit. No AI call or allowance used. Check one scene to continue.",
  "assist.batch.stale": "The show has changed. Run the check again.",
  "assist.batch.sceneMissing": "The scene in this result could not be found. Run the check again.",
  "assist.batch.routeFailed": "Could not open that location. Open it by scene number.",
  "assist.batch.opened": "Opened the matching scene and workspace.",
  "assist.batch.count": "{n} performer pieces (placement count)",
  "assist.batch.balance": "Onstage positions lean strongly toward {side} (mean horizontal position {mean}). Check whether this is intentional.",
  "assist.batch.overlap": "{n} overlapping pairs. Subjects: {names}",
  "assist.batch.overhead": "{n} overhead candidates; height and support unknown: {names}",
  "assist.batch.outside": "{n} offstage pieces: {names}",
  "assist.batch.hidden": "{n} potentially hidden performers (fixed venue obstacles, plan blind spots): {names}",
  "assist.batch.positionsUnknown": "Some positions cannot be read; position and overlap checks are incomplete.",
  "assist.batch.sightUnknown": "Audience blind spots unassessed; audience and fixed-obstacle venue data are needed.",
  "assist.batch.speed": "{names}: {m}m / {seconds}s, required {speed}m/s vs guideline {limit}m/s. Consider fewer simultaneous movers, a different order or more time.",
  "assist.batch.route": "{names}: offstage route, distance or timing needs review ({seconds}s). Feasibility is unconfirmed.",
  "assist.batch.changes": "Endpoints: moved {a} people/{b} objects, appeared {c}/{d}, disappeared {e}/{f}, crossed in {g}/{h}, crossed out {i}/{j} (people/objects). Overlapping categories must not be added.",
  "assist.batch.transitionUnknown": "Transition comparison unavailable.",
  "assist.batch.consecutive": "{names}: scenes {a}–{b}, {c} consecutive scenes. Whole-show presence runs: {d}; runs ending before show end: {e}. Review breaks and changes.",
  "assist.batch.return": "{names}: after scene {a}, returns in {b} with one intervening scene; {c}s including transitions. Quick-change/travel candidate. Whole-show presence runs: {d}; runs ending before show end: {e}.",
  "assist.batch.identityUnknown": "Some performers lack cast or shared identifiers; cross-scene appearances are incomplete.",
  "assist.batch.unlit": "{n} potentially outside light: {names}. Cue-start chest sample and static outer cones only.",
  "assist.batch.noFade": "Cue with no fade (check whether an intentional cut): {names}",
  "assist.batch.duplicate": "Cues with identical lights/groups: {names}. Names and timing excluded.",
  "assist.batch.lightUnknown": "Lighting data unavailable; unset does not mean no issues.",
  "assist.batch.movingLight": "Moving beams, gobos, cutters or other effects unassessed: {names}. Verify during playback."
});

Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {"assist.batch.summaryNotice": "AI receives counts, representative metrics and up to two example names grouped by scene and finding type. Individual results stay on this device."});

// CHECK fix 3: priority, grouped findings and unassessed areas.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.batch.more": "{n} more items",
  "assist.batch.otherPlaces": "{n} other occurrences",
  "assist.batch.otherNames": "{n} other people/subjects",
  "assist.batch.group": "{item}: {n} occurrences ({scenes} scenes)",
  "assist.batch.severity.high": "High priority",
  "assist.batch.severity.medium": "Medium priority",
  "assist.batch.severity.low": "Low priority",
  "assist.batch.kind.balance": "Strong side imbalance",
  "assist.batch.kind.overlap": "Overlap",
  "assist.batch.kind.overhead": "Under overhead equipment",
  "assist.batch.kind.hidden": "Hidden from the audience",
  "assist.batch.kind.speed": "Transition speed",
  "assist.batch.kind.return": "Quick return",
  "assist.batch.kind.unlit": "Outside the light",
  "assist.batch.kind.noFade": "No fade",
  "assist.batch.kind.duplicate": "Identical cue content",
  "assist.batch.coverage": "Unassessed areas ({n} types)",
  "assist.batch.coverageNotice": "These areas are unassessed, separately from detected issues. They are excluded from review counts and AI requests; they have not passed the check.",
  "assist.batch.coverageItem": "{item}: {scenes} scenes",
  "assist.batch.coverage.positionsUnknown": "Unreadable positions and overlaps",
  "assist.batch.coverage.sightUnknown": "Audience blind spots (seating and fixed obstacle data needed)",
  "assist.batch.coverage.route": "Offstage routes, distances and transition timing",
  "assist.batch.coverage.transitionUnknown": "Transitions that could not be compared",
  "assist.batch.coverage.identityUnknown": "Appearances without performer identity",
  "assist.batch.coverage.lightUnknown": "Lighting data that could not be assessed",
  "assist.batch.coverage.movingLight": "Moving beams, gobos, cutters and other effects"
});

// DOCS: read-only document drafts.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.docs.original": "Original (unchanged)",
  "assist.docs.title": "Document drafts",
  "assist.docs.kind": "Document",
  "assist.docs.runNotes": "Organize run notes",
  "assist.docs.performer": "Performer briefing",
  "assist.docs.technician": "Technical handover",
  "assist.docs.translate": "Translated copy",
  "assist.docs.run": "Run",
  "assist.docs.scene": "Scene",
  "assist.docs.cast": "Performer",
  "assist.docs.source": "Translation source",
  "assist.docs.cues": "Cue names and notes",
  "assist.docs.notes": "Scene notes",
  "assist.docs.draft": "Latest draft for this scene",
  "assist.docs.language": "Target language",
  "assist.docs.ja": "Japanese",
  "assist.docs.en": "English",
  "assist.docs.ko": "Korean",
  "assist.docs.zh-Hans": "Chinese (Simplified)",
  "assist.docs.zh-Hant": "Chinese (Traditional)",
  "assist.docs.notice": "Only the scene and part shown below are sent to Anthropic. Exclude personal or confidential information. Your show stays unchanged. Each generation uses one consultation.",
  "assist.docs.scope": "Scope: {title}, part {page}/{pages} ({total} items overall). Other parts and scenes are not read. Long labels end in … .",
  "assist.docs.page": "Part {page}/{pages}",
  "assist.docs.previous": "Previous part",
  "assist.docs.next": "Next part",
  "assist.docs.generate": "Draft this part",
  "assist.docs.loading": "Checking the source…",
  "assist.docs.unavailable": "No material is available for this part, or one item exceeds the sending limit. Reselect the run, performer, scene or source.",
  "assist.docs.changed": "The source changed. Review the updated scope below and press again.",
  "assist.docs.copy": "Copy",
  "assist.docs.export": "Export",
  "assist.docs.copied": "Copied",
  "assist.docs.copyFailed": "Copy failed. Select the reply and copy it.",
  "assist.docs.exported": "Export started",
  "assist.docs.exportFailed": "Export failed. Try Copy.",
  "assist.docs.result": "Unreviewed draft: {title}, part {page}/{pages} (other parts unread)",
  "assist.docs.true": "Yes",
  "assist.docs.false": "No",
  "assist.docs.prompt.runNotes": "Organize these run notes into correction lists by department.",
  "assist.docs.prompt.performer": "Draft a movement briefing for this performer.",
  "assist.docs.prompt.technician": "Draft a technical handover from this equipment and LX cue data.",
  "assist.docs.prompt.translate": "Pair each original excerpt with a translation in the selected language. Keep original names.",
  "assist.docs.field.source": "Source",
  "assist.docs.field.text": "Original",
  "assist.docs.field.segment": "Text segment",
  "assist.docs.field.segments": "Text segments overall",
  "assist.docs.field.label": "Label",
  "assist.docs.field.presence": "Scene presence",
  "assist.docs.field.fromPrev": "Presence from previous scene",
  "assist.docs.field.toNext": "Presence into next scene",
  "assist.docs.field.side": "Stage side",
  "assist.docs.field.depth": "Stage depth",
  "assist.docs.field.props": "Held props",
  "assist.docs.field.number": "Registered fixture number",
  "assist.docs.field.position": "Registered position",
  "assist.docs.field.kind": "Fixture type",
  "assist.docs.field.mount": "Mount (source value)",
  "assist.docs.field.u": "Plan horizontal (0–1)",
  "assist.docs.field.v": "Plan depth (0–1)",
  "assist.docs.field.height": "Registered height (m)",
  "assist.docs.field.name": "Name",
  "assist.docs.field.memo": "Note",
  "assist.docs.field.trigger": "Trigger",
  "assist.docs.field.offset": "Scene offset (seconds)",
  "assist.docs.field.placed": "Placed on timeline",
  "assist.docs.field.enabled": "Enabled",
  "assist.docs.field.fadeIn": "Fade in (seconds)",
  "assist.docs.field.fadeOut": "Fade out (seconds)",
  "assist.docs.field.delayIn": "In delay (seconds)",
  "assist.docs.field.delayOut": "Out delay (seconds)",
  "assist.docs.field.cue": "Cue",
  "assist.docs.field.fixture": "Fixture",
  "assist.docs.field.intensity": "Intensity (source value)",
  "assist.docs.field.on": "Light on (source value)",
  "assist.docs.value.unknown": "Unknown",
  "assist.docs.value.absent": "Not placed",
  "assist.docs.value.onstage": "On stage",
  "assist.docs.value.outside": "Outside stage bounds",
  "assist.docs.value.appeared": "Placement appears (route unknown)",
  "assist.docs.value.disappeared": "Placement disappears (route unknown)",
  "assist.docs.value.continued": "Same presence at endpoints",
  "assist.docs.value.stage-right": "Stage right",
  "assist.docs.value.stage-left": "Stage left",
  "assist.docs.value.center": "Centre",
  "assist.docs.value.upstage": "Upstage",
  "assist.docs.value.downstage": "Downstage",
  "assist.docs.value.run-note": "Run note",
  "assist.docs.value.addendum": "Addendum"
});

Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "assist.ops2Confirm": "Review formation / scene operation",
  "assist.ops2FormationCount": "{shape}: {n} pieces change",
  "assist.ops2SceneCount": "{n} scenes added or renumbered",
  "assist.ops2Number": "{from} → {to}: {title}",
  "assist.ops2Outside": "{name}: outside the stage. Review the position.",
  "assist.ops2Overlap": "{name} / {other}: plan centres {distance}m apart; possible overlap with a piece or apparatus. Size, height and physical safety are unverified.",
  "assist.ops2Neighbours": "{number} {title}: adjacent scenes, entrances, exits and paths change.",
  "assist.ops2Ros": "Run-of-show scene rows follow IDs and update order/numbering. Free items and notes stay.",
  "assist.ops2SceneCue": "Cue {name}: keeps its scene ID. Review its new order and time.",
  "assist.ops2FixedCue": "Cue {name}: section timing and scene-following rules stay. Review its time and resulting scene below.",
  "assist.ops2Media": "Audio placement {name}: keeps its start-scene ID and file range. Review playback time.",
  "assist.ops2Audio": "Scene audio-track references stay. Section starts and playback order may change.",
  "assist.ops2CopyLinks": "The copy gets fresh scene, piece and cue IDs. Scene cues, lighting and audio placements are copied; section-time cues are not duplicated. The new run-of-show row does not copy owners or annotations.",
  "assist.ops2SectionCopy": "The copy uses its destination section’s costume and timing.",
  "assist.ops2Time": "{number}: start from show head {from}s → {to}s",
  "assist.ops2Proceed": "Have you reviewed these changes and effects? Press Execute to apply. One Undo restores the whole operation.",
  "assist.ops2OutsideBlocked": "Outside the editable area; cannot execute. Ask again with a different centre or spacing.",
  "assist.ops2Capacity": "Scene/section capacity reached. Make room before adding. Nothing has changed.",
  "assist.ops2Section": "Use leaf scenes within the same section for this operation. Nothing has changed.",
  "assist.ops2LinkedTiming": "Fixed timing, audio or formation links cannot be kept. Review the timeline first. Nothing has changed.",
  "assist.ops2Alternative": "Display the adopted alternative in the source scene before copying. Nothing has changed.",
  "assist.ops2SceneRef": "Scene number not found. Check the numbers and before/after. Nothing has changed.",
  "assist.ops2Relationships": "This arrangement cannot move locked, routed, held or supported pieces. Review the targets. Nothing has changed.",
  "assist.ops2Question": "Specify targets, shape, centre, spacing and facing, or scene numbers and before/after. Nothing has changed.",
  "assist.ops2Shape_line": "Line",
  "assist.ops2Shape_column": "Column",
  "assist.ops2Shape_diagonal": "Diagonal line",
  "assist.ops2Shape_v": "V",
  "assist.ops2Shape_inverted-v": "Inverted V",
  "assist.ops2Shape_circle": "Circle",
  "assist.ops2Shape_two-rows": "Two horizontal rows",
  "assist.ops2Shape_staggered": "Staggered",
  "assist.ops2CueTime": "Cue {name}: time {from} → {to}, resulting scene {scene}.",
  "assist.ops2CopyTitle": "Copy of {title}",
  "assist.ops2Effects": "Effects ({n}, all details)"
});

// 3-C: English supplemental pack mirrors the main dictionary.

Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "4倍以上は音が出ません。": "Audio is muted at 4× and above.",
  "この環境では、音ありは1倍、音なしは4倍・8倍で再生できます。": "In this environment, audio plays at 1×; silent playback supports 4× and 8×.",
  "再生速度": "Playback speed",
  "再生速度（音程を保つ）": "Playback speed (preserve pitch)",
  "この環境では通常速度のみ再生できます。": "Only normal speed is available in this environment.",
  "LXレーンに置く": "Drop on the LX lane",
  "音源を再生できないため、一部または全部を音なしで再生しています。停止して再生し直すと音源を再試行します。": "Audio could not start, so some or all of the show is playing without sound. Stop and play again to retry the audio.",
  "CSVを書き出す": "Export CSV"
});

// W1-A: detail figure view controls (device preferences only).
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "図を全体表示": "Fit the whole figure",
  "図を全体表示（空き場所のダブルクリックでも戻ります）": "Fit the whole figure (or double-click empty space)",
  "ホイールで拡縮、拡大中はスペース＋ドラッグまたは中ボタンで移動": "Wheel to zoom; while enlarged, Space + drag or middle-button drag to pan",
  "平面図と正面図の高さ配分": "Plan and front figure height split"
});

// N4: lighting panel layout, device preferences only.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "パネルを2列に": "2 columns",
  "パネルを1列に": "1 column",
  "照明の初期配置に戻す": "Reset lighting layout",
  "パネルの高さ（px・0は自動）": "Panel height (px; 0 = auto)",
  "パネルを上へ": "Move panel up",
  "パネルを下へ": "Move panel down"
});
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {"assist.light2.button": "Adjust lighting", "assist.light2.notice": "Sends current-scene layer and fixture names and values, plus cues in the selected scope. Review, create a draft, then press Apply.", "assist.light2.review": "Proposed changes (no draft yet)", "assist.light2.stage": "Create draft", "assist.light2.cueChange": "Q{no}: name {from} → {to} / fade in {fromFadeIn}→{fadeIn}s · out {fromFadeOut}→{fadeOut}s", "assist.light2.function.spot": "Spot", "assist.light2.function.wash": "Light the floor", "assist.light2.function.background": "Background", "assist.light2.function.rim": "Rim / fill", "assist.light2.function.custom": "Adjusted in detail", "assist.light2.detailOnly": "Check detailed layers and groups in the detail screen. This proposal has not replaced their setup.", "assist.light2.fixedColor": "This fixed fixture colour affects all scenes. Change it in the detail screen.", "assist.light2.audienceRequired": "This venue has no audience area, so the searchlight form “Wander on stage and audience” cannot be used.", "assist.light2.warning": "Check the beam coverage and backdrop in the detail screen.", "assist.light2.scope": "Cues to send", "assist.light2.scopeScene": "Current scene", "assist.light2.scopeShow": "All show cues"});

/* J3 shared panel controls. */
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {"パネルの並びを変更しました。": "Panel order changed.", "{name}の高さ": "Height of {name}"});
// J5: standard rig and additional simple-lighting types.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "標準セット": "Standard set",
  "かんたん照明は標準セットだけで使えます。": "Simple lighting is available only with the standard set.",
  "かんたん照明は標準セットだけで使えます。保存済みの照明は詳細で編集できます。": "Simple lighting requires the standard set. Saved lighting can be edited in Detail.",
  "フォロー": "Follow spot",
  "ストロボ": "Strobe",
  "UV": "UV (blacklight)",
  "レーザーの広がり（度）": "Laser spread (degrees)",
  "動きの1往復（秒）": "Movement round trip (seconds)",
  "発光回数（毎秒）": "Flashes per second",
  "レーザー 1": "Laser 1",
  "レーザー 2": "Laser 2",
  "ムービング 1": "Moving light 1",
  "ムービング 2": "Moving light 2",
  "フォロー 1": "Follow spot 1",
  "フォロー 2": "Follow spot 2",
  "ストロボ 1": "Strobe 1",
  "ストロボ 2": "Strobe 2",
  "UV 1": "UV (blacklight) 1",
  "UV 2": "UV (blacklight) 2",
  "UV 3": "UV (blacklight) 3",
  "UV 4": "UV (blacklight) 4",
  "転がし 手前 1": "Floor downstage 1",
  "転がし 手前 2": "Floor downstage 2",
  "転がし 手前 3": "Floor downstage 3",
  "転がし 手前 4": "Floor downstage 4",
  "転がし 奥 1": "Floor upstage 1",
  "転がし 奥 2": "Floor upstage 2",
  "転がし 奥 3": "Floor upstage 3",
  "転がし 奥 4": "Floor upstage 4"
});

Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {"ドラッグでパネルを並べ替え": "Drag to reorder panels", "ドラッグで高さを変更。上下キーで調整、Enterまたはダブルクリックで自動高。": "Drag to resize height. Use Up/Down to adjust; Enter or double-click for automatic height.", "パネルの設定を保存できませんでした。": "Panel settings could not be saved."});

// L1: shared lighting toolbar.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "LX キューを保存": "Save LX cues",
  "照明の再生": "Play lighting",
  "照明の停止": "Stop lighting",
  "LX キューを保存しました": "LX cues saved",
  "LX キューを保存しました（試作なので画面は残ります）": "LX cues saved (the prototype stays open)",
  "LXキューの設定を保存します。ショー全体へ適用するには「LX キューを保存」を押してください。": "This saves the LX cue settings. To update the show, press “Save LX cues”."
});

// L1: existing backup and position-manager guidance follows the save label.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "自動で作られた控えは残っていません。照明を「LX キューを保存」で確定するか、使わないショーを減らすと空きます。": "No automatic backups remain. Save lighting with “Save LX cues” or remove unused shows to free space.",
  "変更は編集中の照明デザインへ反映。ショーへの保存は照明デザインタブの「LX キューを保存」から行います。": "Changes update the lighting design being edited. Use “Save LX cues” in the Lighting tab to save them to the show."
});

// T1F: actual wash count in the shared lamp selector.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {"{count}灯": "{count} lights"});

// LA: floor area, direction and the shared fixture-power controls.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "床を照らす": "Light the floor",
  "右半分（上手）": "Right half (stage left)",
  "左半分（下手）": "Left half (stage right)",
  "前半分": "Downstage half",
  "後ろ半分": "Upstage half",
  "左前（下手）": "Downstage left (stage right)",
  "右前（上手）": "Downstage right (stage left)",
  "左奥（下手）": "Upstage left (stage right)",
  "右奥（上手）": "Upstage right (stage left)",
  "平行": "Parallel",
  "クロス": "Cross",
  "灯体": "Fixtures",
  "範囲の外": "Outside the area",
  "灯数・左右の選択対象外": "Excluded by fixture count or side",
  "固定灯の向きではこの範囲を作れません": "The fixed fixture aim cannot create this area",
  "最後の1台は消せません。レイヤーをOFFにしてください": "Keep one fixture on; use the layer power to switch all off",
  "転がし手前": "Downstage floor units",
  "転がし奥": "Upstage floor units",
  "灯体ごとに違う": "Different fixture settings",
  "転がしの設定が灯体ごとに違います。詳細で調整してください": "Floor units have different settings. Adjust them in Detail",
  "左右で違う設定です。詳細で調整してください": "The sides have different settings. Adjust them in Detail",
  "この位置では範囲を選べません": "Area selection is unavailable at this position",
  "この位置では向きを選べません": "Direction selection is unavailable at this position",
  "灯体の選択を確認してください": "Check the fixture selection",
  "点灯する灯体がありません": "No fixtures would light"
});

// V049: standard rig upgrade and separate floor spots.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "転がしスポット手前": "Downstage floor spots",
  "転がしスポット奥": "Upstage floor spots",
  "吊りの16°スポットで型を描きます。新しい標準セットは8灯で、選んだ位置の灯体を動かします。": "Draw a form with overhead 16° spots. The new standard set has eight; lights at the selected position move.",
  "スポットとウォッシュを短く繰り返し点滅させます。毎秒の発光回数を変えられます。": "Flash spots and washes repeatedly. Adjust the number of flashes per second.",
  "標準セットを更新できなかったため、元の版を維持しています。": "The standard set could not be updated. The original version is unchanged.",
  "標準セットの更新前の版を保持": "Preserve version before standard set update",
  "標準セットを新しい版へ更新しました。元の版は控えとして残っています。UVと旧転がしの下手・上手は消灯し、ストロボはスポットの点滅へ、前明かりはムービングへ変わりました。ストロボと同じ位置のスポットを使用中だったキューはスポットを優先しました。変更したレイヤーは詳細で確認してください。": "Updated the standard set in a new version. The original version is retained as a backup. UV and the old left/right floor units are off. Strobes now use flashing spots, and front lights are moving washes. Cues already using a spot at the strobe position keep that spot instead. Check changed layers in Detail."
});

Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "手前のスポット 3": "Downstage spot 3",
  "手前のスポット 4": "Downstage spot 4",
  "奥のスポット 3": "Upstage spot 3",
  "奥のスポット 4": "Upstage spot 4",
  "転がしスポット 手前 1": "Downstage floor spot 1",
  "転がしスポット 手前 2": "Downstage floor spot 2",
  "転がしスポット 奥 1": "Upstage floor spot 1",
  "転がしスポット 奥 2": "Upstage floor spot 2"
});

// V049: separate fixed high-side washes. Japanese uses the source labels.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "斜め上 下手": "High side, stage right",
  "斜め上 下手 1": "High side, stage right 1",
  "斜め上 下手 2": "High side, stage right 2",
  "斜め上 上手": "High side, stage left",
  "斜め上 上手 1": "High side, stage left 1",
  "斜め上 上手 2": "High side, stage left 2"
});

// V0412: theatre-type rigs and the wing-reference safety stop.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "この劇場の種類は、まだかんたん照明に対応していません（三方・全周の客席は別に準備中）": "This theatre type does not yet support Simple Lighting (three-sided and surrounding seating are being prepared separately).",
  "舞台袖が無い劇場では使えません": "Not available in theatres without stage wings.",
  "袖の灯体を使う明かりがあるため、劇場の変更を止めました。元の劇場とQを保持しています。": "The theatre change was stopped because lighting uses wing fixtures. The original theatre and cues are preserved.",
  "舞台袖と寸法に合わせて照明を組み直します。番号は変えません。明かりは変更後に確認してください。": "Lighting will be rebuilt for the stage wings and dimensions. Numbers stay unchanged. Check the lighting afterwards.",
  "舞台袖と寸法に合わせて配置します。番号は変えません。": "Placed to fit the stage wings and dimensions, keeping fixture numbers."
});

// ALT-PRESENT S1: local presentation, never meeting transport.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "発表用の表示": "Presentation view",
  "Zoom・Meetなどの画面共有でお使いください。γから映像・音声・ポインタは送信されません。": "Use screen sharing in Zoom, Meet or a similar tool. Gamma does not transmit video, audio or pointer positions.",
  "案内を閉じる": "Close guide"
});
// ALT_GRID_S2: local plan-view display only.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "呼び名の格子": "Call grid",
  "舞台を6×6に区切ります。下手からA〜F、手前から奥へ1〜6。この端末の画面だけに表示します。": "Divide the stage into 6×6 cells: A–F from audience left to right, 1–6 from downstage to upstage. Shown only on this device's screen.",
  "呼び名の格子を表示しました。": "Call grid shown.",
  "呼び名の格子を隠しました。": "Call grid hidden."
});
// ALT_QLINK_S3: explicit publication and manual viewing only.
Object.assign(window.SHOSAI_I18N_PACKS["en"].text, {
  "閲覧リンクを公開": "Publish a viewing link",
  "Qシートの閲覧": "View Q sheet",
  "公開する部署": "Department to publish",
  "公開": "Publish",
  "公開し直す": "Publish again",
  "リンクを失効": "Revoke link",
  "リンクを写す": "Copy link",
  "閲覧リンク": "Viewing link",
  "読み直す": "Reload",
  "公開日時": "Published at",
  "最後に読み込んだ日時": "Last loaded at",
  "公開された写しです。更新は「読み直す」を押したときだけ取り込みます。": "This is a published copy. Updates are loaded only when you press Reload.",
  "選んだ部署の写しを公開します。リンクを知る人が閲覧できます。自分のメール・LINEでリンクを渡してください。相手への通知や自動の読み直しはありません。": "Publish a copy for the selected department. Anyone with the link can read it. Pass the link using your own email or LINE. There are no notifications or automatic reloads.",
  "閲覧リンクが見つからないか、失効しています。": "The viewing link was not found or has been revoked.",
  "この閲覧リンクは期限切れです。": "This viewing link has expired.",
  "読み込めませんでした。「読み直す」で再試行してください。": "Could not load the sheet. Press Reload to try again.",
  "閲覧リンクの公開は編集できる主催者だけが行えます。": "Only an organiser with editing access can publish a viewing link.",
  "ショーが切り替わりました。欄を開き直してください。": "The show has changed. Reopen this panel.",
  "Qシートの項目か容量が上限を超えています。公開内容を確認してください。": "The Q sheet has invalid fields or exceeds a limit. Check the content before publishing.",
  "閲覧リンクの保管上限に達しました。": "The viewing-link storage limit has been reached.",
  "閲覧リンクの公開はγ専用ホストで使えます。": "Viewing links can be published on Gamma's dedicated host.",
  "発行済みのリンクがあります。欄を開き直してください。": "A link has already been issued. Reopen this panel.",
  "操作できませんでした。接続とログインを確認し、欄を開き直してください。": "The action failed. Check your connection and sign-in, then reopen this panel.",
  "公開しました。変更は自動では公開されません。": "Published. Changes are not published automatically.",
  "閲覧リンクを失効しました。": "The viewing link has been revoked.",
  "リンクを写しました。自分のメール・LINEで渡してください。": "Link copied. Pass it using your own email or LINE."
});
