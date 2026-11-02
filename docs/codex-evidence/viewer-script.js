
'use strict';
const evidence=JSON.parse(document.getElementById('evidence-data').textContent);
const put=(id,value)=>{document.getElementById(id).textContent=String(value);};
put('build-code',evidence.recordedBuild.excerpt);
put('call-id',evidence.recordedBuild.callId);
put('call-at',evidence.recordedBuild.at);
put('call-hash',evidence.recordedBuild.recordInputSHA256.slice(0,24)+'…');
put('solver-code',evidence.currentEngine.solver);
put('transition-code',evidence.currentEngine.transition);
put('replay-code',evidence.currentEngine.replayWitness);
put('engine-hash',evidence.currentEngine.sha256);
put('browser-seconds',evidence.executedVerification.browserSeconds);
put('checks-at',evidence.executedVerification.recordedAt);
put('checks-hash',evidence.executedVerification.sourceDigest);
put('main-session',evidence.mainSessionId);
const tabs=Array.from(document.querySelectorAll('[role="tab"]'));
const panels=Array.from(document.querySelectorAll('[role="tabpanel"]'));
function select(index,focus){tabs.forEach((tab,i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;panels[i].hidden=!active;});if(focus)tabs[index].focus();}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(index,false));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();select(next,true);}});});
document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;const index=['1','2','3'].indexOf(event.key);if(index>=0){event.preventDefault();select(index,true);}});
