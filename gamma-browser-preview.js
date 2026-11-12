/* Pages-only, volatile preview. It never reads, migrates or clears stored shows.
 * Derived from account candidate d453ba4e; output controls remain clickable. */
(function(root){
  'use strict';
  const LABEL='体験版（保存なし）';
  const TITLE='保存と書き出しは有料版で使えます';
  const MESSAGE='体験版のままでも、この窓を閉じれば続けて試せます。ブラウザを閉じると、いまの作品は消えます。';
  const NOTICE='{date} から、ブラウザの体験版では保存できなくなります。いま保存している作品は、それまでに『書き出し』で控えを残してください。';
  const PRICING='https://stagesketch.app/#start';
  function applies({enabled,hostname,pathname,native=false,study=false}={}) {
    return enabled===true&&!native&&!study&&hostname==='aratama-ship-it.github.io'
      && /^\/stage-sketch-gamma\/(?:stage|run|company)\.html$/.test(pathname||'');
  }
  function memoryStorage() {
    const values=new Map();
    const api={getItem:key=>values.get(String(key))??null,setItem:(key,value)=>{values.set(String(key),String(value));},
      removeItem:key=>{values.delete(String(key));},clear:()=>values.clear(),key:index=>[...values.keys()][index]??null};
    Object.defineProperty(api,'length',{configurable:true,get:()=>values.size});
    return new Proxy(api,{
      ownKeys:()=>[...values.keys()],getOwnPropertyDescriptor:(_o,key)=>values.has(key)?{configurable:true,enumerable:true,value:values.get(key),writable:true}:Reflect.getOwnPropertyDescriptor(api,key),
      get:(o,key)=>key in o?Reflect.get(o,key):typeof key==='string'?values.get(key):undefined,
      set:(_o,key,value)=>{values.set(String(key),String(value));return true;},
      deleteProperty:(_o,key)=>{values.delete(String(key));return true;},
    });
  }
  const tx=(win,s)=>win.SHOSAI_STAGE_I18N_MODEL?.text(win.document.documentElement.lang||'ja',s)||s;
  function ready(win,fn){if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
  function element(doc,tag,attrs={},text=''){
    const el=doc.createElement(tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);el.textContent=text;return el;
  }
  // Explicit output intent plus a fallback for dynamically created controls.
  // Local editing commits (cue/audio details, presets) remain usable in memory.
  function outputControl(el){
    if(!el)return false;
    if(el.closest?.('[data-preview-ui]'))return false;
    if(el.closest?.('#stage-drive-backup,#stage-work-folder,#stage-file-autosave'))return true;
    const id=el.id||'';
    if(id==='stage-storage-band-backup'||id==='study-replies-open'||id==='study-reply-open')return true;
    if(id==='tc-save')return false; // Commit a timecode edit in the current in-memory show.
    if(/(?:close|cancel|backdrop|tab|scope|view|include|name|detail-save|rig-save|recovery)/.test(id))return false;
    return /(?:^|-)(?:save|export|print|pdf|download)(?:-|$)/.test(id)
      || /(?:^|\s)(?:export|print|download)(?:-|\s|$)/.test(el.getAttribute?.('data-action')||'');
  }
  function createSession({pricingUrl=PRICING}={}){
    const storage=memoryStorage(),sessionStorage=memoryStorage(),installed=new WeakSet(),cleanups=new Set();
    let dirty=false,interacted=false,owner=null,ui=null,returnFocus=null,closed=false;
    function closeGuide(){if(!ui)return;ui.modal.close();ui.modal.hidden=true;ui.backdrop.hidden=true;owner.GAMMA_UI?.layers.sync();returnFocus?.focus?.();}
    function render(){
      if(!owner)return;
      const doc=owner.document,label=doc.getElementById('gamma-browser-preview-label');
      if(label)label.textContent=tx(owner,LABEL);
      if(!ui)return;
      ui.title.textContent=tx(owner,TITLE);ui.body.textContent=tx(owner,MESSAGE);
      ui.pricing.textContent=tx(owner,'料金を見る');ui.resume.textContent=tx(owner,'体験を続ける');
    }
    function showGuide(){
      if(closed||!owner?.document.body)return false;
      const doc=owner.document;
      if(!ui){
        // The common layer manager treats .stage-modal-backdrop as a sibling
        // of a div dialog; this backdrop belongs inside the native dialog.
        const backdrop=element(doc,'div',{id:'gamma-preview-backdrop',class:'gamma-preview-backdrop','data-preview-ui':''});
        const modal=element(doc,'dialog',{id:'gamma-preview-guide',role:'dialog','aria-modal':'true','aria-labelledby':'gamma-preview-title','aria-describedby':'gamma-preview-body','data-no-i18n':'','data-preview-ui':''});
        const panel=element(doc,'section',{class:'gamma-preview-panel gamma-preview-guide'});
        const head=element(doc,'header',{class:'stage-modal-head'}),title=element(doc,'h2',{id:'gamma-preview-title'});
        const bodyWrap=element(doc,'div',{class:'stage-modal-body'}),body=element(doc,'p',{id:'gamma-preview-body'}),actions=element(doc,'div',{class:'gamma-preview-actions'});
        const pricing=element(doc,'a',{href:pricingUrl,target:'_blank',rel:'noopener',class:'btn-quiet'});
        const resume=element(doc,'button',{type:'button',class:'btn-quiet',id:'gamma-preview-continue'});
        head.append(title);actions.append(pricing,resume);bodyWrap.append(body,actions);panel.append(head,bodyWrap);modal.append(backdrop,panel);doc.body.append(modal);
        ui={backdrop,modal,title,body,pricing,resume};
        resume.addEventListener('click',closeGuide);backdrop.addEventListener('click',closeGuide);
        modal.addEventListener('cancel',event=>{event.preventDefault();closeGuide();});
        doc.addEventListener('keydown',event=>{
          if(modal.hidden)return;
          if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeGuide();}
          if(event.key==='Tab'){
            if(event.shiftKey&&doc.activeElement===pricing){event.preventDefault();resume.focus();}
            else if(!event.shiftKey&&doc.activeElement===resume){event.preventDefault();pricing.focus();}
          }
        },true);
      }
      if(!ui.modal.hidden&&ui.modal.dataset.previewOpened==='true')return false;
      returnFocus=doc.activeElement;render();ui.modal.hidden=false;ui.backdrop.hidden=false;ui.modal.showModal();ui.modal.dataset.previewOpened='true';owner.GAMMA_UI?.layers.sync();ui.resume.focus();return true;
    }
    const session={active:true,ready:true,storage,sessionStorage,message:LABEL,label:LABEL,
      markChanged:()=>{if(interacted&&!closed)dirty=true;},dirty:()=>dirty,showGuide,closeGuide,
      onDispose:fn=>cleanups.add(fn),
      decision:(feature='edit')=>({allowed:['edit','view'].includes(feature),reason:'preview-no-save'}),
      install(win){
        if(installed.has(win))return session;
        for(const name of ['localStorage','sessionStorage','indexedDB','showSaveFilePicker','showDirectoryPicker','print']){
          const d=Object.getOwnPropertyDescriptor(win,name);if(d&&d.configurable===false)throw Error('preview-isolation-unavailable');
        }
        Object.defineProperties(win,{
          localStorage:{configurable:true,value:storage},sessionStorage:{configurable:true,value:sessionStorage},
          indexedDB:{configurable:true,value:undefined},showSaveFilePicker:{configurable:true,value:undefined},
          showDirectoryPicker:{configurable:true,value:undefined},print:{configurable:true,value:()=>{showGuide();return false;}},
        });
        installed.add(win);win.GAMMA_BROWSER_PREVIEW=session;
        // Browser-menu printing does not invoke window.print or a keyboard
        // listener. Keep show content out of its print rendering too.
        win.document.documentElement.setAttribute('data-gamma-browser-preview','true');
        const printStyle=element(win.document,'style',{id:'gamma-preview-print-guard'},
          '@media print { html[data-gamma-browser-preview="true"] body { display:none !important; } }');
        win.document.head.append(printStyle);
        const recovery=url=>/(?:^|\/)storage-recovery\.html(?:[?#]|$)/.test(String(url||''));
        const blocked=link=>link?.hasAttribute?.('download')||/^(?:blob:|data:)/.test(link?.href||'')||recovery(link?.href);
        const anchor=win.HTMLAnchorElement?.prototype;
        if(anchor){const click=anchor.click;anchor.click=function(){if(blocked(this)){showGuide();return;}return click.call(this);};}
        const stop=event=>{event.preventDefault();event.stopImmediatePropagation();showGuide();};
        win.document.addEventListener('click',event=>{
          if(blocked(event.target?.closest?.('a'))||outputControl(event.target?.closest?.('button,input,a,summary')))stop(event);
        },true);
        win.document.addEventListener('submit',event=>{if(outputControl(event.target))stop(event);},true);
        win.document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['s','p'].includes(event.key?.toLowerCase()))stop(event);},true);
        if(typeof win.open==='function'){
          const open=win.open;
          win.open=function(url,...args){
            // Ordinary documentation links remain available. Empty/Blob/data
            // print windows and generated output never reach the native API.
            if(recovery(url)||!/^(?:https?:\/\/|(?:\.\/)?manual(?:-gamma)?\/)/i.test(String(url||''))){showGuide();return null;}
            return open.call(win,url,...args);
          };
        }
        for(const type of ['input','change','pointerdown','keydown'])win.document.addEventListener(type,()=>{interacted=true;},true);
        if(win.top===win){
          owner=win;
          win.addEventListener?.('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
          win.addEventListener?.('pagehide',()=>{closed=true;dirty=false;storage.clear();sessionStorage.clear();for(const fn of cleanups)fn();});
          win.addEventListener?.('pageshow',event=>{if(event.persisted)win.location.reload();});
          ready(win,()=>{
            const parent=win.document.body;
            if(parent&&!win.document.getElementById('gamma-browser-preview-label'))parent.append(element(win.document,'span',{id:'gamma-browser-preview-label',class:'gamma-preview-label','data-no-i18n':''},tx(win,LABEL)));
            if(win.MutationObserver)new win.MutationObserver(render).observe(win.document.documentElement,{attributes:true,attributeFilter:['lang']});
          });
        }
        return session;
      },
    };
    return Object.freeze(session);
  }
  function mountNotice(win,date){
    if(!date||win.GAMMA_BROWSER_PREVIEW?.active)return;
    const key='gamma:preview-notice-dismissed:'+date;
    try{if(win.localStorage.getItem(key)==='1')return;}catch(_){}
    ready(win,()=>{
      const doc=win.document;if(doc.getElementById('gamma-preview-notice'))return;
      const notice=element(doc,'div',{id:'gamma-preview-notice',class:'gamma-preview-notice','data-no-i18n':''}),message=element(doc,'span'),close=element(doc,'button',{type:'button',class:'btn-quiet'});
      const render=()=>{message.textContent=tx(win,NOTICE).replace('{date}',date);close.textContent=tx(win,'この知らせを閉じる');};
      render();notice.append(message,close);doc.body.prepend(notice);
      close.addEventListener('click',()=>{notice.hidden=true;try{win.localStorage.setItem(key,'1');}catch(_){}});
      if(win.MutationObserver)new win.MutationObserver(render).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
    });
  }
  function initialize(win){
    if(!win.document)return;
    const config=win.GAMMA_EDITIONS;
    const target={enabled:true,hostname:win.location?.hostname,pathname:win.location?.pathname,
      native:Boolean(win.STAGE_RUNTIME?.isMac?.()||win.webkit?.messageHandlers?.gammaProject||win.stageSketchBridge||win.stageSketchNative),
      study:win.document.documentElement?.hasAttribute?.('data-study-renderer')===true};
    // Recovery is another entry into the same Pages storage. Isolate it before
    // the language loader or recovery UI can read any persistent store.
    const recovery=target.pathname==='/stage-sketch-gamma/storage-recovery.html';
    if(recovery)target.pathname='/stage-sketch-gamma/stage.html';
    if(!applies(target))return;
    if(config?.RELEASE_FEATURES.browserPreview===true){
      if(!win.GAMMA_BROWSER_PREVIEW?.active)createSession({pricingUrl:config.PREVIEW_PRICING_URL||PRICING}).install(win);
    }else if(!recovery)mountNotice(win,config?.PREVIEW_NOTICE_FROM);
  }
  const api=Object.freeze({LABEL,TITLE,MESSAGE,NOTICE,applies,memoryStorage,createSession,initialize,outputControl});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.GAMMA_BROWSER_PREVIEW_MODEL=api;
})(globalThis);
