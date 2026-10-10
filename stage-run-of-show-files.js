"use strict";
/* Gamma Run of Show: validation and embedded-image helpers; storage belongs to ProjectStore. */
(function (root) {
  const FORMAT = "stage-sketch-run-of-show";
  const LIMITS = Object.freeze({ imageBytes: 10 * 1024 ** 2, pixels: 40000000, totalBytes: 32 * 1024 ** 2, fileBytes: 145 * 1024 ** 2, items: 1000, assets: 200 });
  const fail = message => { throw new Error(message); };
  const record = x => x && typeof x === "object" && !Array.isArray(x);
  const text = x => typeof x === "string" && x.length <= 100000;
  const id = x => typeof x === "string" && /^[\w:.-]{1,120}$/.test(x);
  const clone = x => JSON.parse(JSON.stringify(x));
  // v1の追加欄。旧文書は読込時だけ見本の初期値を補い、原本を変更しない。
  const INFO_DEFAULTS = Object.freeze({title:"",venue:"",date:"",revision:"DRAFT 01",startTime:""});
  const INFO_LIMITS = Object.freeze({title:200,venue:200,revision:80});
  function validateInfo(info) {
    if (!record(info)) fail("公演情報の形式を確認できません。");
    for (const [key,max] of Object.entries(INFO_LIMITS)) {
      if (typeof info[key] !== "string" || info[key].length > max) fail(`公演情報の${{title:"公演名",venue:"会場",revision:"文書版"}[key]}は${max}文字以内で入力してください。`);
    }
    if (typeof info.date !== "string" || (info.date !== "" && (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(info.date) || !Number.isFinite(Date.parse(info.date+"T00:00:00Z")) || new Date(info.date+"T00:00:00Z").toISOString().slice(0,10) !== info.date))) fail("公演日は実在する日付（YYYY-MM-DD）、または空欄にしてください。");
    if (Object.hasOwn(info,"startTime") && (typeof info.startTime !== "string" || (info.startTime !== "" && !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(info.startTime)))) fail("開始時刻は24時間のHH:MM:SS、または未定の空欄にしてください。");
  }
  function documentInfo(doc) {
    if (Object.hasOwn(doc,"documentInfo")) { validateInfo(doc.documentInfo); return {startTime:INFO_DEFAULTS.startTime,...clone(doc.documentInfo)}; }
    return {...INFO_DEFAULTS};
  }
  const bytesToBase64 = bytes => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  };
  function imageHeader(bytes) {
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > LIMITS.imageBytes) fail("画像は1点10 MiB以内にしてください。");
    const b = bytes, d = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let mime, width, height;
    const ascii = (offset, size) => String.fromCharCode(...b.subarray(offset, offset + size));
    if (b.length >= 24 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v) && ascii(12,4) === "IHDR") {
      mime = "image/png"; width = d.getUint32(16); height = d.getUint32(20);
    } else if (b.length >= 12 && b[0] === 255 && b[1] === 216) {
      mime = "image/jpeg";
      let offset = 2;
      while (offset + 4 < b.length) {
        if (b[offset++] !== 255) break;
        while (b[offset] === 255) offset++;
        const marker = b[offset++];
        if (marker === 218 || marker === 217) break;
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        if (offset + 2 > b.length) break;
        const length = d.getUint16(offset);
        if (length < 2 || offset + length > b.length) break;
        if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 8) {
          height = d.getUint16(offset + 3); width = d.getUint16(offset + 5); break;
        }
        offset += length;
      }
    } else if (b.length >= 30 && ascii(0,4) === "RIFF" && ascii(8,4) === "WEBP") {
      mime = "image/webp";
      const kind = ascii(12,4);
      if (kind === "VP8X") {
        width = 1 + b[24] + b[25] * 256 + b[26] * 65536; height = 1 + b[27] + b[28] * 256 + b[29] * 65536;
      } else if (kind === "VP8L" && b[20] === 47) {
        const bits = d.getUint32(21, true); width = (bits & 16383) + 1; height = ((bits >>> 14) & 16383) + 1;
      } else if (kind === "VP8 " && b[23] === 157 && b[24] === 1 && b[25] === 42) {
        width = d.getUint16(26, true) & 16383; height = d.getUint16(28, true) & 16383;
      }
    }
    if (!mime || !width || !height) fail("PNG・JPEG・WebPの画像を選んでください。画像の内容を確認できませんでした。");
    if (width * height > LIMITS.pixels) fail("画像は4,000万画素以内にしてください。元画像は変更していません。");
    return { mime, width, height };
  }
  async function decodeImage(dataUrl) {
    const img = new Image(); img.src = dataUrl;
    try { await img.decode(); } catch { fail("画像を開けませんでした。破損していないPNG・JPEG・WebPを選び直してください。"); }
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > LIMITS.pixels) fail("画像の寸法を確認できませんでした。");
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  async function createAsset(bytes, name, decode = decodeImage) {
    const info = imageHeader(bytes), dataUrl = `data:${info.mime};base64,${bytesToBase64(bytes)}`;
    const size = await decode(dataUrl);
    const hash = await root.crypto.subtle.digest("SHA-256", bytes);
    return { id: "img-" + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,"0")).join(""), name: String(name).slice(0,255), mime: info.mime, size: bytes.length, width: size.width, height: size.height, dataUrl };
  }
  function referencedIds(items) {
    return new Set(items.flatMap(item => [...(item.detailAssets || []), ...(item.noteAssets || [])].map(ref => ref.assetId)));
  }
  function validateStructure(doc, columnSets) {
    if (!record(doc) || doc.format !== FORMAT || doc.version !== 1) fail("進行表の形式または版に対応していません。保存内容は保持しています。");
    documentInfo(doc);
    if (!Array.isArray(doc.items) || !doc.items.length || doc.items.length > LIMITS.items) fail("進行項目の数を確認してください（1〜1,000件）。");
    const ids = new Set(), scenes = new Set();
    for (const item of doc.items) {
      if (!record(item) || !id(item.id) || ids.has(item.id)) fail("項目IDが欠けているか重複しています。"); ids.add(item.id);
      if (item.sceneId !== null) {
        if (!id(item.sceneId) || scenes.has(item.sceneId)) fail("関連シーンIDを確認できません。"); scenes.add(item.sceneId);
      }
      for (const key of ["title","owner","standby","go","details","notes","transitionDetail","transitionNotes"]) if (!text(item[key])) fail(`項目の${key}を読み込めません。`);
      if(Object.hasOwn(item,"callEdits")&&(!Array.isArray(item.callEdits)||item.callEdits.length>100||item.callEdits.some(entry=>!record(entry)||["standby","go","action","details","notes"].some(key=>Object.hasOwn(entry,key)&&!text(entry[key])))))fail("合図詳記の編集内容を読み込めません。");
      for (const key of ["hold","transition"]) if (item[key] !== null && (!Number.isFinite(item[key]) || item[key] < 0 || item[key] > Number.MAX_SAFE_INTEGER / 4000)) fail("時間は0以上の秒数、または未定で保存してください。");
      for (const key of ["detailImage","noteImage","transitionImage","transitionReview"]) if (typeof item[key] !== "boolean") fail("見本図・転換の設定を確認できません。");
      if (!Array.isArray(item.dept) || item.dept.length > 100 || item.dept.some(d => !Array.isArray(d) || d.length !== 2 || !d.every(text))) fail("各部の指示を確認できません。");
      for (const key of ["detailAssets","noteAssets"]) if (!Array.isArray(item[key]) || item[key].length > LIMITS.assets || item[key].some(r => !record(r) || !id(r.assetId) || !text(r.caption))) fail("画像の関連付けを確認できません。");
    }
    if (!ids.has(doc.selected) || !Number.isSafeInteger(doc.nextId) || doc.nextId < 1) fail("選択項目・採番情報を確認できません。");
    if (!["bilingual","ja","en"].includes(doc.language) || !["free","a4-landscape","a4-portrait"].includes(doc.paperFormat) || !["ros","calls"].includes(doc.view)) fail("表示設定を確認できません。");
    if(doc.paperFontSize!==undefined&&(!Number.isFinite(doc.paperFontSize)||doc.paperFontSize<8||doc.paperFontSize>18))fail("文字サイズは8〜18ptで指定してください。");
    if (!record(doc.layouts)) fail("書式設定がありません。");
    function profile(p, defs, optional=false) {
      if (p===undefined && optional) return;
      const known=defs.filter(c=>c.legacy!==false).map(c=>c.id), all=defs.map(c=>c.id);
      const order=(v,ids)=>Array.isArray(v)&&v.length===ids.length&&new Set(v).size===ids.length&&v.every(x=>ids.includes(x));
      const hidden=(v,ids)=>Array.isArray(v)&&new Set(v).size===v.length&&v.every(x=>ids.includes(x)&&!defs.find(c=>c.id===x).required);
      if (!record(p)||!order(p.order,known)) fail("列の順序を確認できません。");
      if (!hidden(p.hidden,known)) fail("非表示列を確認できません。");
      if (p.extra!==undefined&&(!record(p.extra)||!order(p.extra.order,all)||!hidden(p.extra.hidden,all))) fail("追加列の順序を確認できません。");
      if (p.widths!==undefined&&(!record(p.widths)||Object.entries(p.widths).some(([k,v])=>!all.includes(k)||!Number.isFinite(v)||v<1||v>100))) fail("列幅を確認できません。");
      if (p.stage!==undefined&&!['front','plan','both'].includes(p.stage)) fail("舞台の図の設定を確認できません。");
    }
    for (const paper of ["free","a4-landscape","a4-portrait"]) for (const [kind,defs] of Object.entries(columnSets)) profile(doc.layouts[`${paper}:${kind}`],defs,kind==='cue'||kind.startsWith('row-'));
    if(doc.rowMode!==undefined&&!['scene','scene-transition','cue'].includes(doc.rowMode)) fail("行の単位を確認できません。");
    // 2026-10-07 G1 #4: the stage diagram chosen per row (front/plan). v0.3.21 and older readers do not check this key and keep it.
    if(doc.stageByItem!==undefined&&(!record(doc.stageByItem)||Object.keys(doc.stageByItem).length>LIMITS.items||Object.entries(doc.stageByItem).some(([k,v])=>!id(k)||!['front','plan'].includes(v)))) fail("舞台上の図の行ごとの設定を確認できません。");
    if(doc.cueNotes!==undefined&&(!record(doc.cueNotes)||Object.keys(doc.cueNotes).length>5000||Object.entries(doc.cueNotes).some(([k,v])=>!id(k)||!record(v)||['owner','standby','trigger','notes'].some(f=>v[f]!==undefined&&!text(v[f]))))) fail("キューの記入内容を確認できません。");
    if(doc.cellAlign!==undefined){
      if(!record(doc.cellAlign)) fail("セルの寄せを確認できません。");
      for(const [mode,v] of Object.entries(doc.cellAlign)){
        if(!['scene','scene-transition','cue','calls'].includes(mode)||!record(v)) fail("セルの寄せを確認できません。");
        for(const field of ['columns','cells']) if(v[field]!==undefined){
          if(!record(v[field])||Object.keys(v[field]).length>5000||Object.entries(v[field]).some(([k,a])=>!['left','center','right'].includes(a)||!(field==='cells'?/^[\w:.-]{1,120}\|[a-z]{1,20}$/:/^[a-z]{1,20}$/).test(k))) fail("セルの寄せを確認できません。");
        }
      }
    }
    if (!Array.isArray(doc.assets) || doc.assets.length > LIMITS.assets) fail("画像の一覧を確認できません（最大200点）。");
    const assetIds = new Set(); let bytes = 0;
    for (const asset of doc.assets) {
      if (!record(asset) || !/^img-[a-f0-9]{64}$/.test(asset.id) || assetIds.has(asset.id) || !text(asset.name) || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > LIMITS.imageBytes) fail("画像の情報が不正です。");
      if (typeof asset.dataUrl !== "string" || asset.dataUrl.length > LIMITS.imageBytes * 4 / 3 + 100 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.dataUrl)) fail("画像の埋込みデータを確認できません。外部URLは読み込みません。");
      assetIds.add(asset.id); bytes += asset.size;
    }
    if (bytes > LIMITS.totalBytes) fail("画像の合計は100 MiB以内にしてください。");
    for (const assetId of referencedIds(doc.items)) if (!assetIds.has(assetId)) fail("参照先の画像が欠けています。編集中の内容は変更していません。");
    if(doc.distributions!==undefined){
      const D=root.ROSDistribution||(typeof require==='function'?require('./stage-run-of-show-distribution.js'):null);
      if(!D)fail('配布履歴を検証する機能がありません。保存内容を保持しています。');
      D.validate(doc.distributions,snapshot=>validateStructure(snapshot,columnSets));
    }
    return doc;
  }
  async function validateDocument(input, columnSets, decode = decodeImage) {
    const doc = clone(input); validateStructure(doc, columnSets);
    // 全ての画像を検証し終えてから呼出元が文書全体を差し替える。
    const embedded=new Map([...doc.assets,...(doc.distributions?.releases||[]).flatMap(r=>r.document.assets)].map(a=>[JSON.stringify(a),a]));
    for (const asset of embedded.values()) {
      const binary = atob(asset.dataUrl.split(",")[1]);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const actual = await createAsset(bytes, asset.name, decode);
      if (actual.id !== asset.id || actual.size !== asset.size || actual.mime !== asset.mime || actual.width !== asset.width || actual.height !== asset.height) fail("画像の内容と記録が一致しません。編集中の内容は変更していません。");
    }
    return doc;
  }
  const api = { FORMAT, LIMITS, INFO_DEFAULTS, INFO_LIMITS, documentInfo, clone, imageHeader, createAsset, referencedIds, validateStructure, validateDocument };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ROSFiles = api;
})(globalThis);
