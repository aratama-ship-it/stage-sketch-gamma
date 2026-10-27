/* Signed monthly local-edit rights. No show data, credentials or private keys. */
(function(root) {
  'use strict';
  const AUDIENCE = 'gamma-local-edit-v1';
  const DEVICE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  function decode(text) {
    if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) throw Error('encoding');
    const bytes=Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)),x=>x.charCodeAt(0));
    if(encode(bytes)!==text)throw Error('encoding');return bytes;
  }
  const utf8 = new TextEncoder(), json = value => encode(utf8.encode(JSON.stringify(value)));
  async function sign(claims, privateJwk, kid) {
    const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const input=json({alg:'ES256',typ:'GAMMA-LICENSE',kid})+'.'+json(claims);
    return input+'.'+encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,utf8.encode(input)));
  }
  async function verify(token, {keys,issuer,device,account,minimumSequence=0,nonce}={}) {
    try {
      if(typeof token!=='string'||token.length>8192)throw Error('token');
      const parts=token.split('.');if(parts.length!==3)throw Error('token');
      const header=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0])));
      if(header.alg!=='ES256'||header.typ!=='GAMMA-LICENSE'||typeof header.kid!=='string'||!Object.hasOwn(keys||{},header.kid))throw Error('key');
      const key=await crypto.subtle.importKey('jwk',keys[header.kid],{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
      if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(parts[2]),utf8.encode(parts[0]+'.'+parts[1])))throw Error('signature');
      const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[1])));
      if(c.v!==1||c.aud!==AUDIENCE||!issuer||c.iss!==issuer||!DEVICE.test(c.device)||c.device!==device||typeof c.sub!=='string'||!c.sub||c.sub!==account
        ||!['lite','studio','company'].includes(c.plan)||![c.iat,c.nextRenewalAt,c.until,c.seq].every(Number.isSafeInteger)
        ||!DEVICE.test(c.nonce||'')||(nonce!==undefined&&c.nonce!==nonce)||c.seq<1||c.seq<minimumSequence||c.iat<0||c.nextRenewalAt<=c.iat||c.until<=c.iat||c.until>c.nextRenewalAt)throw Error('claims');
      return {ok:true,claims:Object.freeze(c)};
    }catch(_){return {ok:false,error:'invalid-license'};}
  }
  function createAccess({storage,config,wallNow=()=>Date.now(),elapsedNow=()=>performance.now(),changed=()=>{}}) {
    const key='gamma:license:v1', deviceKey='gamma:license:device:v1';
    let cache=null,claims=null,state=config.required?'unverified':'legacy',error='',wall=wallNow(),elapsed=elapsedNow(),anchor=0,locked=false;
    let device; try{device=config.device||storage.getItem(deviceKey);if(!DEVICE.test(device||'')){device=crypto.randomUUID();storage.setItem(deviceKey,device);}}
    catch(_){error='storage';state=config.required?'unverified':'legacy';}
    const now=()=>Math.max(wallNow(),anchor+Math.max(0,wallNow()-wall,elapsedNow()-elapsed));
    function persist(){if(!cache)return;cache.observed=Math.max(cache.observed||0,now());cache.wall=Math.max(cache.wall||0,wallNow());storage.setItem(key,JSON.stringify(cache));}
    function read(){
      if(claims&&!locked&&now()>=claims.until){locked=true;state='renewal-required';error='renewal-required';changed();}
      return Object.freeze({state,error,plan:claims?.plan??null,user:claims?.sub??cache?.account??'',until:claims?new Date(claims.until).toISOString():null,nextRenewalAt:claims?.nextRenewalAt??null,device});
    }
    function deny(reason){locked=true;state='renewal-required';error=reason;if(cache){cache.denied=reason;try{persist();}catch(_){/* Retain the last signed grant. */}}changed();return false;}
    async function accept(value,{restoring=false,nonce}={}) {
      if(config.required!==true)return deny('license-unavailable');
      const account=value?.account;
      if(cache&&account===cache.account&&value?.token===cache.token&&claims&&!restoring){read();return !locked;}
      const checked=await verify(value?.token,{...config,device,account,nonce,minimumSequence:cache?.account===account?cache.seq:0});
      if(!checked.ok)return deny('invalid-license');
      const c=checked.claims;
      if(!restoring&&cache?.account===account&&c.seq<=cache.seq)return deny('replay');
      claims=c;anchor=restoring?Math.max(c.iat,Number(value.observed)||c.iat):c.iat;
      wall=wallNow();elapsed=elapsedNow();locked=false;state='licensed';error='';
      cache={account,token:value.token,seq:c.seq,observed:anchor,wall};
      if(restoring){
        if(value.denied)return deny(value.denied);
        if(!Number.isFinite(value.wall)||wall<value.wall)return deny('clock-rollback');
        anchor+=Math.max(0,wall-value.wall);
      }
      try{persist();}catch(_){return deny('storage');}read();changed();return !locked;
    }
    return Object.freeze({read,device,accept,deny,
      async restore(){
        let hadGrant=false;
        try{const raw=storage.getItem(key);hadGrant=Boolean(raw);if(raw){cache=JSON.parse(raw);await accept(cache,{restoring:true});}}
        catch(_){if(config.required||hadGrant||cache)deny('invalid-license');}return read();
      },
      checkpoint(){try{persist();}catch(_){deny('storage');}},
      decision(){return {allowed:read().state==='licensed'||state==='legacy',reason:error||'license-required'};},
      remaining(){read();return claims&&!locked?Math.max(0,claims.until-now()):null;},
      needsCheck(){return !claims||locked||read().state!=='licensed';},
      // A failed online request never replaces a valid monthly grant.
      networkFailure(){if(!claims||read().state!=='licensed')deny('renewal-required');},
    });
  }
  const api=Object.freeze({AUDIENCE,DEVICE,encode,decode,sign,verify,createAccess});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.GAMMA_LICENSE_MODEL=api;
})(typeof globalThis!=='undefined'?globalThis:this);
