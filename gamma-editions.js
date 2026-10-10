/* Edition scope shared by the builder and browser. */
(function (root) {
  "use strict";
  const ALL_TABS = Object.freeze(["normal","venue-setup","light-placement","light-design","script","3d","cuesheet","run-of-show"]);
  const ALL_ON = Object.freeze({idleAreas:true,arrowTool:true,memoTool:true,penTool:true,lightRender:true,fpv:true,timeline:true,audio:true,cues:true,share:true,cueSheet:true,venueLighting:true,scriptEditor:true,formations:true,sceneAlternatives:true,routeTool:true,machinery:true});
  const common = {tabs:ALL_TABS,dropScripts:[],dropStyles:[],features:ALL_ON,hiddenPanels:[]};
  const edition = (key,file,label,scope={}) => Object.freeze({...common,file,label,title:`舞台スケッチ γ ${label} | Stage Sketch Gamma ${label}`,h1:`舞台スケッチ γ ${label}`,...scope});
  const EDITIONS = Object.freeze({studio:edition("studio","stage.html","Studio"),company:edition("company","company.html","Company"),lite:edition("lite","run.html","Lite",{
    tabs:["normal","venue-setup","run-of-show"],
    dropScripts:["stage-first-person-loader.js", "stage-fixture-body.js", "stage-lighting-plans.js", "stage-lighting-plan-overlay.js", "light-design/rig-engine.js", "light-design/laser-effects.js", "stage-light-eval.js", "stage-light-receiver.js", "stage-light-render.js", "gamma-light-cue-overlay.js", "stage-cue-sheet.js", "stage-vox-panel.js", "stage-script-editor.js", "stage-timeline.js", "stage-session.js", "stage-study-owner.js", "stage-usage.js", "gamma-formation.js", "gamma-formation-model.js", "gamma-formation-presets.js", "stage-scene-alternatives-ui.js"],
    dropStyles:["stage-script-editor.css","stage-vox-panel.css","gamma-formation.css"],
    features:Object.freeze(Object.fromEntries(Object.keys(ALL_ON).map(k=>[k,false]))),hiddenPanels:["music","light","vox","alternatives","machinery","rigs"]})});
  const TAB_BUTTON_IDS = Object.freeze({normal:"stage-workspace-normal","venue-setup":"gamma-venue","light-placement":"gamma-placement","light-design":"gamma-design",script:"gamma-script","3d":"stage-freecam-open",cuesheet:"gamma-cuesheet","run-of-show":"gamma-run-of-show"});
  const api = Object.freeze({EDITIONS,TAB_BUTTON_IDS,ALL_TABS,detect(doc){const key=doc?.querySelector('meta[name="gamma-edition"]')?.content;return EDITIONS[key]?key:"studio";}});
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  root.GAMMA_EDITIONS=api;
  if(root.document){const key=api.detect(root.document);
    if(key === "lite") { try { if(!localStorage.getItem("gamma:shosai-stage-lang")) { const lang=localStorage.getItem("gamma:run:language"); if(["ja","en"].includes(lang)) localStorage.setItem("gamma:shosai-stage-lang",lang); } } catch (_) {} }
    root.GAMMA_EDITION=key;root.GAMMA_EDITION_FEATURES=EDITIONS[key].features;root.document.documentElement.dataset.gammaEdition=key;}
})(typeof globalThis!=="undefined"?globalThis:this);
