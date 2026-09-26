'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summary,render,validateResult}=require('./report.cjs');
const seed=()=>({kind:'gamma-regression-run',schema:1,runId:'run1',source:{sha256:'abc'},version:'v1',results:[{id:'panel',title:'Panel',status:'pass'}]});
test('failures and blocked execution never yield a passing gate',()=>{assert.equal(summary([{status:'fail'}]).exitCode,1);assert.equal(summary([{status:'blocked'}]).exitCode,2);assert.equal(summary([{status:'pass'},{status:'manual'}]).exitCode,0);assert.throws(()=>summary([{status:'unknown'}]));});
test('duplicate result or missing failure explanation is rejected',()=>{const r=seed();r.results.push({...r.results[0]});assert.throws(()=>validateResult(r));r.results=[{id:'x',title:'X',status:'fail'}];assert.throws(()=>validateResult(r));});
test('report escapes test output and cannot turn it into executable markup',()=>{const r=seed();r.results[0].title='<img src=x onerror=alert(1)>';r.results[0].reason='</pre><script>alert(1)</script>';const html=render(r);assert(!html.includes('<img src=x'));assert(html.includes('&lt;script&gt;'));assert(html.includes('checked disabled'));});
test('human checks are separate from automated results and scoped to each run',()=>{const r=seed();r.results.push({id:'manual',title:'Real device',status:'manual'});const html=render(r);assert(html.includes('data-manual="1"'));assert(html.includes('meta.source'));assert(html.includes('meta.runId'));assert(html.includes('全機能・実機・公開承認の完了を意味しません'));});

test('an empty or wholly unexecuted suite cannot pass',()=>{assert.equal(summary([]).exitCode,2);assert.equal(summary([{status:'na'},{status:'manual'}]).exitCode,2)});
