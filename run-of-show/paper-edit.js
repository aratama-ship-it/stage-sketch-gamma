"use strict";
// Edits the visible fragment in place. Canonical data belongs to the native host; editor.js coordinates pagination.
window.ROSPaperEditor={create({frame,read,commit,onDraft,onState,continuous=()=>false}){
  let active=null,pending=null;
  const selector="[data-direct-field],[data-direct-info]";
  const descriptor=node=>({itemId:node.dataset.directItem||null,key:node.dataset.directField||node.dataset.directInfo,info:!!node.dataset.directInfo,type:node.dataset.directType||"text",label:node.getAttribute("aria-label"),start:node.dataset.sourceStart===undefined?null:Number(node.dataset.sourceStart),end:node.dataset.sourceEnd===undefined?null:Number(node.dataset.sourceEnd)});
  const identity=d=>[d.info,d.itemId,d.key].join("|");
  function visibleNodes(){return [...frame.querySelectorAll(selector)].filter(n=>n.getClientRects().length&&!n.closest('[hidden],.page-building'));}
  function locate(d){const nodes=visibleNodes().filter(n=>identity(descriptor(n))===identity(d));return nodes.find(n=>d.start===null||Number(n.dataset.sourceStart||0)===d.start)||nodes[0];}
  function nextField(node,direction,sameColumn=false){
    const seen=new Set(),nodes=visibleNodes().filter(n=>{const key=identity(descriptor(n));if(seen.has(key))return false;seen.add(key);return true;});
    const d=descriptor(node),at=nodes.findIndex(n=>identity(descriptor(n))===identity(d));
    for(let i=at+direction;i>=0&&i<nodes.length;i+=direction){const next=descriptor(nodes[i]);if(!sameColumn||(!next.info&&next.key===d.key))return next;}
    return null;
  }
  function state(text){onState(text,!!active);}
  function finish(cancel=false,next=null){
    if(!active)return true;
    const edit=active;
    if(!cancel&&!edit.input.checkValidity()){edit.input.reportValidity();state("入力を確認してください。Escで取り消せます。");return false;}
    const value=edit.input.value,full=edit.prefix+value+edit.suffix;
    if(!cancel){const error=commit(edit.desc,full,true);if(error){edit.input.setCustomValidity(error);edit.input.reportValidity();state(error);return false;}}
    active=null;edit.node.classList.remove("paper-editing-field");edit.node.replaceChildren(...edit.children);edit.node.setAttribute("role","button");edit.node.tabIndex=0;
    if(cancel||full===edit.original){state(cancel?"この欄の入力を取り消しました。":"紙面の欄をクリックして編集できます。");if(next)begin(locate(next));else edit.node.focus({preventScroll:true});return true;}
    pending={desc:next||edit.desc,edit:!!next};commit(edit.desc,full,false);state("変更を反映し、ページを整えています…");return true;
  }
  function begin(node){
    if(!node||active?.node===node)return;
    const desc=descriptor(node),data=read(desc);if(!data)return;
    if(active){const next=desc;if(!finish(false,next))return;if(pending)return;node=locate(next);if(!node)return;}
    const original=data.value,partial=data.multiline&&desc.start!==null;
    const start=partial?desc.start:0,end=partial?desc.end:original.length;
    const input=document.createElement(data.multiline?"textarea":"input");
    input.className="paper-input";input.setAttribute("aria-label",desc.label);input.autocomplete="off";input.setAttribute("data-lpignore","true");input.setAttribute("data-1p-ignore","");
    if(!data.multiline){input.type=desc.type;if(desc.type==="number"){input.min="0";input.step="0.1";}if(desc.type==="time")input.step="1";if(desc.type==="date"){input.min="0001-01-01";input.max="9999-12-31";}}
    input.maxLength=data.max||100000;input.value=original.slice(start,end);
    active={node,desc,input,original,prefix:original.slice(0,start),suffix:original.slice(end),children:[...node.childNodes]};
    node.replaceChildren(input);node.classList.add("paper-editing-field");node.removeAttribute("role");node.removeAttribute("tabindex");
    input.addEventListener("input",()=>{input.setCustomValidity("");if(data.multiline){input.style.height="auto";input.style.height=Math.max(120,input.scrollHeight)+"px";}onDraft();state("この欄を編集中 · 欄外またはCtrl/⌘+Enterで反映 · Escで取消");});
    input.addEventListener("keydown",event=>{
      if(event.isComposing||event.keyCode===229)return;
      if(event.key==="Escape"){event.preventDefault();finish(true);return;}
      if(event.key==="Enter"&&(!data.multiline||event.ctrlKey||event.metaKey)){event.preventDefault();finish(false,continuous()&&!data.multiline&&!desc.info&&!event.ctrlKey&&!event.metaKey?nextField(node,event.shiftKey?-1:1,true):null);return;}
      if(event.key==="Tab"){
        const next=nextField(node,event.shiftKey?-1:1);
        if(next){event.preventDefault();finish(false,next);}
      }
    });
    input.addEventListener("blur",()=>{if(active?.input===input)finish();});
    state(partial?"続きの文章を編集中 · 表示中の区間だけを変更します。":desc.type==="number"?"秒数を入力 · 空欄は未定 · Enterで反映 · Escで取消":"この欄を編集中 · 欄外またはCtrl/⌘+Enterで反映 · Escで取消");input.focus({preventScroll:true});if(!data.multiline)input.select();
  }
  // Capture the intended next field before a commit replaces the page DOM.
  document.addEventListener("pointerdown",event=>{
    if(!active||active.node.contains(event.target))return;
    const next=frame.contains(event.target)?event.target.closest(selector):null;
    if(!finish(false,next?descriptor(next):null)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  frame.addEventListener("click",event=>{const node=event.target.closest(selector);if(node&&!node.classList.contains("paper-editing-field")){event.preventDefault();begin(node);}});
  frame.addEventListener("keydown",event=>{
    if(event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||!event.target.matches(selector))return;
    if(['Enter',' ','F2'].includes(event.key)){event.preventDefault();begin(event.target);return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
      const next=nextField(event.target,['ArrowUp','ArrowLeft'].includes(event.key)?-1:1,['ArrowUp','ArrowDown'].includes(event.key));
      if(next){event.preventDefault();const node=locate(next);node?.scrollIntoView({block:'nearest',inline:'nearest'});node?.focus({preventScroll:true});}
    }
  });
  return {finish:()=>finish(),cancel:()=>finish(true),focus(desc){const node=locate(desc);if(node)begin(node);else pending={desc,edit:true};},refresh(){
    if(active&&!active.node.isConnected){active=null;state("紙面を更新しました。");}
    if(pending){const next=pending,node=locate(next.desc);if(node){pending=null;node.scrollIntoView({block:"nearest",inline:"nearest"});if(next.edit)begin(node);else node.focus({preventScroll:true});}}
  },get active(){return !!active;},get hasDraft(){return !!active&&active.prefix+active.input.value+active.suffix!==active.original;}};
}};
