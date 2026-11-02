from pathlib import Path
import json,hashlib,re,subprocess,datetime
from html.parser import HTMLParser
root=Path(__file__).resolve().parent
text=(root/'index.html').read_text();data=json.loads((root/'evidence.json').read_text());provenance=json.loads((root/'provenance.json').read_text())
class Page(HTMLParser):
 def __init__(self):super().__init__();self.tabs=[];self.panels=[];self.external=[];self.script=False;self.scripts=[];self.buffer=''
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get('role')=='tab':self.tabs.append(a)
  if a.get('role')=='tabpanel':self.panels.append(a)
  if any(name in a for name in ['src','href']):self.external.append((tag,a))
  if tag=='script':self.script=True;self.buffer=''
 def handle_data(self,value):
  if self.script:self.buffer+=value
 def handle_endtag(self,tag):
  if tag=='script' and self.script:self.scripts.append(self.buffer);self.script=False
page=Page();page.feed(text)
assert len(page.tabs)==len(page.panels)==3
assert [t['aria-controls']for t in page.tabs]==[p['id']for p in page.panels]
assert not page.external
assert len(page.scripts)==2 and json.loads(page.scripts[0])==data
assert 'innerHTML' not in page.scripts[1]
assert 'fetch(' not in page.scripts[1] and 'setTimeout' not in page.scripts[1] and 'setInterval' not in page.scripts[1]
assert data['mainSessionId']=='01a1807d-e70b-7572-bc0d-a4f29b37d1b8'
assert data['recordedBuild']['callId']=='call_8a269bc0bd72434280f046ddaccba24f'
assert hashlib.sha256(data['recordedBuild']['excerpt'].encode()).hexdigest()==data['recordedBuild']['excerptSHA256']
assert data['executedVerification']['unitPassed']==114 and data['executedVerification']['browserPassed']==22
for row in provenance['files']:assert hashlib.sha256((root/row['path']).read_bytes()).hexdigest()==row['sha256']
script_path=root/'viewer-script.js';script_path.write_text(page.scripts[1])
result=subprocess.run(['node','--check',str(script_path)],capture_output=True,text=True);assert result.returncode==0,result.stderr
harness=r'''
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
'''
harness_path=root/'verify_viewer.cjs';harness_path.write_text(harness)
node_result=subprocess.run(['node',str(harness_path),str(root/'evidence.json'),str(script_path)],capture_output=True,text=True);assert node_result.returncode==0,node_result.stderr
verification={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS_STATIC_AND_SCRIPT_CHECKS','originalMainRecordLocated':True,'mainSessionId':data['mainSessionId'],'recordedCallId':data['recordedBuild']['callId'],'recordedAt':data['recordedBuild']['at'],'unitPassed':114,'browserPassed':22,'htmlChecks':{'threeSemanticTabsAndPanels':True,'inlineEvidenceMatchesJSON':True,'noExternalReferences':True,'noTimersOrNetworkInScript':True,'noInnerHTML':True,'sourceExcerptHashMatches':True,'artifactHashesMatch':True},'javascriptSyntax':'PASS','scriptBehavior':json.loads(node_result.stdout),'browserRender':'UNVERIFIED by this child; parent owns actual CUA/OBS inspection','claimedNativeCodexUI':False}
(root/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
print(json.dumps(verification,indent=2))
