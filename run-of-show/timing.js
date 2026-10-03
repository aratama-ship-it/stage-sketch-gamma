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
  function normalizeStart(value){const seconds=startSeconds(value);return seconds===null?"":formatClock(seconds);}
  const dayLabel=days=>days===1?"翌日":`${days}日後`;
  const ticks=value=>Math.round(value*10);
  const secondLabel=t=>pad(Math.floor(t/10))+(t%10?`.${t%10}`:"");
  function formatDuration(seconds){
    if(seconds===null)return "未定";
    const t=ticks(seconds);return pad(Math.floor(t/600))+":"+secondLabel(t%600);
  }
  function formatClock(seconds){
    if(seconds===null)return "未定";
    const t=ticks(seconds),days=Math.floor(t/864000),time=[pad(Math.floor(t/36000)%24),pad(Math.floor(t/600)%60),secondLabel(t%600)].join(":");
    return (days?dayLabel(days)+" ":"")+time;
  }
  function timeline(items,startTime){
    let next=startSeconds(startTime);
    return items.map((item,index)=>{
      const start=next,after=start===null||item.hold===null?null:start+item.hold;
      next=after===null||item.transition===null?null:Math.round((after+item.transition)*10)/10;
      return {item,index,start,after,end:next};
    });
  }
  function dateTime(seconds,date){
    const relative=formatClock(seconds);if(seconds===null||!date)return relative;
    seconds=ticks(seconds)/10;
    const days=Math.floor(seconds/86400),stamp=Date.parse(date+"T00:00:00Z")+days*86400000;
    if(!Number.isFinite(stamp)||Math.abs(stamp)>8640000000000000)return relative+"（日付範囲外）";
    const civil=new Date(stamp).toISOString().slice(0,10);
    if(!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(civil))return relative+"（日付範囲外）";
    return civil+" "+formatClock(seconds%86400)+(days?`（${dayLabel(days)}）`:"");
  }
  const api={startSeconds,normalizeStart,formatDuration,formatClock,timeline,dateTime};
  root.ROSTiming=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
