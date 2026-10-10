"use strict";
/* 文書の予定時計。舞台再生や機器の実行時計へは接続しない。 */
(function(root){
  const pad=x=>String(x).padStart(2,"0");
  function startSeconds(value){
    if(value==="")return null;
    const match=typeof value==="string"&&/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
    if(!match)throw new Error("開始時刻は24時間のHH:MM:SS、または未定の空欄にしてください。");
    return Number(match[1])*3600+Number(match[2])*60+Number(match[3]||0);
  }
  // Stored startTime stays HH:MM:SS; changing the display must not rewrite it.
  function normalizeStart(value){const seconds=startSeconds(value);return seconds===null?"":formatStoredStart(seconds);}
  const formatStoredStart=seconds=>[pad(Math.floor(seconds/3600)),pad(Math.floor(seconds/60)%60),pad(seconds%60)].join(":");
  // 2026-10-07 G1 #1: optional paper language ("en" → English; ja and bilingual keep the Japanese wording).
  const dayLabel=(days,lang)=>lang==="en"?(days===1?"+1 day":`+${days} days`):days===1?"翌日":`${days}日後`;
  const undecided=lang=>lang==="en"?"TBD":"未定";
  const ticks=value=>Math.round(value*10);
  const secondLabel=t=>pad(Math.floor(t/10))+(t%10?`.${t%10}`:"");
  function formatDuration(seconds,lang){
    if(seconds===null)return undecided(lang);
    const t=ticks(seconds);return String(Math.floor(t/600))+":"+secondLabel(t%600);
  }
  function formatClock(seconds,lang){
    if(seconds===null)return undecided(lang);
    const t=ticks(seconds),days=Math.floor(t/864000),time=[String(Math.floor(t/36000)%24),pad(Math.floor(t/600)%60),pad(Math.floor(t/10)%60)].join(":")+"."+t%10;
    return (days?dayLabel(days,lang)+" ":"")+time;
  }
  // Both the paper and timeline overview include the final transition and unknown free-item times.
  function total(items){return items.some(x=>x.hold===null||x.transition===null)?null:items.reduce((sum,x)=>sum+x.hold+x.transition,0);}
  function timeline(items,startTime){
    let next=startSeconds(startTime);
    return items.map((item,index)=>{
      const start=next,after=start===null||item.hold===null?null:start+item.hold;
      next=after===null||item.transition===null?null:Math.round((after+item.transition)*10)/10;
      return {item,index,start,after,end:next};
    });
  }
  function dateText(value, lang = "ja", {time = false, seconds = false} = {}) {
    if (value === null || value === undefined || value === "") return "—";
    const civil = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const at = new Date(civil ? value + "T00:00:00Z" : value);
    if (!Number.isFinite(at.getTime()) || (civil && at.toISOString().slice(0, 10) !== value)) return "—";
    const y = civil ? at.getUTCFullYear() : at.getFullYear(), m = civil ? at.getUTCMonth() : at.getMonth(), d = civil ? at.getUTCDate() : at.getDate();
    const p = n => String(n).padStart(2, "0");
    const result = lang === "en" ? d + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m] + " " + y : String(y).padStart(4, "0") + "/" + p(m + 1) + "/" + p(d);
    return result + (time && !civil ? " " + p(at.getHours()) + ":" + p(at.getMinutes()) + (seconds ? ":" + p(at.getSeconds()) : "") : "");
  }
  function dateTime(seconds,date,lang){
    const relative=formatClock(seconds,lang),outOfRange=lang==="en"?" (date out of range)":"（日付範囲外）";if(seconds===null||!date)return relative;
    seconds=ticks(seconds)/10;
    const days=Math.floor(seconds/86400),stamp=Date.parse(date+"T00:00:00Z")+days*86400000;
    if(!Number.isFinite(stamp)||Math.abs(stamp)>8640000000000000)return relative+outOfRange;
    const civil=new Date(stamp).toISOString().slice(0,10);
    if(!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(civil))return relative+outOfRange;
    return dateText(civil,lang)+" "+formatClock(seconds%86400,lang)+(days?(lang==="en"?` (${dayLabel(days,lang)})`:`（${dayLabel(days,lang)}）`):"");
  }
  const api={total,startSeconds,normalizeStart,formatDuration,formatClock,timeline,dateTime,dateText};
  root.ROSTiming=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
