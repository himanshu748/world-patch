
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const evidence=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const callbacks={},nodes=new Map();let focused=null;
const node=(id)=>{if(!nodes.has(id))nodes.set(id,{textContent:'',setAttribute(name,value){this[name]=value},focus(){focused=this},events:{},addEventListener(name,fn){this.events[name]=fn}});return nodes.get(id)};
node('evidence-data').textContent=JSON.stringify(evidence);
const tabs=['build','rules','verification'].map((name,i)=>Object.assign(node('tab-'+name),{'aria-selected':String(i===0),tabIndex:i===0?0:-1}));
const panels=['build','rules','verification'].map((name,i)=>Object.assign(node('panel-'+name),{hidden:i!==0}));
const document={getElementById:node,querySelectorAll(selector){return selector==='[role="tab"]'?tabs:panels},addEventListener(name,fn){callbacks[name]=fn}};
vm.runInNewContext(fs.readFileSync(process.argv[3],'utf8'),{document});
assert.equal(node('build-code').textContent,evidence.recordedBuild.excerpt);
assert.equal(node('main-session').textContent,evidence.mainSessionId);
tabs[1].events.click();assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
let prevented=false;tabs[1].events.keydown({key:'ArrowRight',preventDefault(){prevented=true}});assert(prevented);assert.equal(tabs[2]['aria-selected'],'true');assert.equal(focused,tabs[2]);
callbacks.keydown({key:'1',preventDefault(){}});assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);assert.equal(tabs[0].tabIndex,0);
callbacks.keydown({key:'3',ctrlKey:true,preventDefault(){throw new Error('modified shortcut should not run')}});assert.equal(tabs[0]['aria-selected'],'true');
console.log(JSON.stringify({textContentRendering:'PASS',clickTabs:'PASS',arrowKeyboard:'PASS',numberKeyboard:'PASS',modifiedShortcutIgnored:'PASS'}));
