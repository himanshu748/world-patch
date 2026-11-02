"""Build a credential-free viewer from one explicitly selected main-chat record."""
from pathlib import Path
import sys,json,re,hashlib,html,datetime
out=Path(__file__).resolve().parent
project=Path(sys.argv[1]).resolve()
rollout=Path(sys.argv[2]).resolve()
session='01a1807d-e70b-7572-bc0d-a4f29b37d1b8'
call_id='call_8a269bc0bd72434280f046ddaccba24f'
record=None;completion=None;record_line=None;completion_line=None;actual_session=None
for number,line in enumerate(rollout.open(),1):
 item=json.loads(line);payload=item.get('payload',{})
 if item.get('type')=='session_meta':actual_session=payload.get('id')
 if item.get('type')!='response_item' or payload.get('call_id')!=call_id:continue
 if payload.get('type')=='custom_tool_call':record=item;record_line=number
 if payload.get('type')=='custom_tool_call_output':completion=item;completion_line=number
 if record and completion and actual_session:break
assert actual_session==session and record and completion
raw=record['payload']['input']
assert record['timestamp'].startswith('2026-10-28')
position=raw.index('tools.apply_patch(')+len('tools.apply_patch(')
patch,_=json.JSONDecoder().raw_decode(raw[position:])
parts=re.split(r'^\*\*\* (?:Add|Update) File: ',patch,flags=re.M)
app=next(part for part in parts if part.startswith('outputs/world-patch/src/server/app.ts\n'))
app_source='\n'.join(line[1:] for line in app.split('\n',1)[1].splitlines() if line.startswith('+'))+'\n'
start=app_source.index('  const twitch=createTwitch')
end=app_source.index('  const unsubscribe=',start)
original=app_source[start:end]
assert 'onChat(event)' in original and 'room.ingest' in original and 'onGap(reason)' in original
completion_output=completion['payload']['output']
assert any('Script completed' in part.get('text','') for part in completion_output if isinstance(part,dict))
engine=(project/'src/shared/engine.ts').read_text()
def full_function(name):
 start=engine.index('export function '+name+'(')
 end=engine.index('\n}',start)+2
 return engine[start:end]
transition=full_function('transition')
replay=full_function('replayWitness')
solver_start=engine.index('  while (cursor < nodes.length)')
solver_end=engine.index('      const key = compactKey(state);',solver_start)
solver=engine[solver_start:solver_end]
checks_path=project/'evidence/release-final-checks.json'
unit_path=project/'evidence/release-final-unit.json'
browser_path=project/'evidence/release-final-browser.json'
checks=json.loads(checks_path.read_text());unit=json.loads(unit_path.read_text());browser=json.loads(browser_path.read_text())
assert unit['success'] and unit['numPassedTests']==114 and unit['numFailedTests']==0
assert browser['stats']['expected']==22 and all(browser['stats'][key]==0 for key in ['unexpected','skipped','flaky'])
def sha(data):return hashlib.sha256(data).hexdigest()
def file_sha(path):return sha(path.read_bytes())
steps={step['name']:step for step in checks['steps']}
assert all(steps[name]['exitCode']==0 for name in ['types','lint','unit','build','browser'])
project_files={key:value for key,value in checks['sourceFiles'].items() if not key.startswith('node_modules/')}
source_drift=[key for key,value in project_files.items() if not (project/key).is_file() or file_sha(project/key)!=value]
assert source_drift==[]
source_digest=sha(json.dumps(project_files,sort_keys=True,separators=(',',':')).encode())
recorded_line_start=app_source[:start].count('\n')+1
recorded_line_end=recorded_line_start+original.count('\n')-1
payload={
 'project':'WORLD//PATCH','mainSessionId':session,
 'viewerKind':'Local evidence viewer, not a recording of the native Codex interface',
 'recordedBuild':{'sourceFile':'src/server/app.ts','recordedSourceLines':[recorded_line_start,recorded_line_end],
  'tool':'functions.exec → tools.apply_patch','callId':call_id,'at':record['timestamp'],'recordLine':record_line,
  'recordInputSHA256':sha(raw.encode()),'excerptSHA256':sha(original.encode()),'excerpt':original,
  'completionAt':completion['timestamp'],'completionLine':completion_line,'completionSummary':'Script completed',
  'completionRecordSHA256':sha(json.dumps(completion_output,sort_keys=True,separators=(',',':')).encode()),
  'qualification':'Exact excerpt from the initial recorded source-writing call. Later hardening remains in the current project. This record is not claimed to be the creation of engine.ts.'},
 'currentEngine':{'sourceFile':'src/shared/engine.ts','sha256':file_sha(project/'src/shared/engine.ts'),'engineVersion':'world-patch/1.0.0',
  'transition':transition,'solver':solver,'replayWitness':replay,'qualification':'Current-source excerpts; not presented as historical main-chat edit records. Solver excerpt is partial.'},
 'executedVerification':{'recordedAt':checks['recordedAt'],'unitPassed':114,'unitFailed':0,'browserPassed':22,'browserFailed':0,
  'browserSkipped':0,'browserFlaky':0,'browserSeconds':round(browser['stats']['duration']/1000,2),
  'typecheck':'PASS','lint':'PASS','productionBuild':'PASS','sourceDigest':source_digest,'fingerprintedFiles':len(project_files),'sourceDrift':source_drift,
  'fingerprintMethod':'SHA-256 of sorted compact JSON project-file manifest from release-final-checks.json, excluding node_modules; current files compared with report hashes at viewer refresh.',
  'reports':[{'path':str(path.relative_to(project)),'sha256':file_sha(path)}for path in [checks_path,unit_path,browser_path]],
  'qualification':'Local engine/server/provider-fixture tests and production-browser journeys. Twitch was disabled in this suite; it is not live Twitch, OBS, broadcast or public-delivery proof.'}}
(out/'evidence.json').write_text(json.dumps(payload,indent=2)+'\n')
(out/'recorded-server-bridge.txt').write_text(original)
(out/'current-transition.txt').write_text(transition+'\n')
(out/'current-solver-excerpt.txt').write_text(solver)
(out/'current-replay-witness.txt').write_text(replay+'\n')
serialized=json.dumps(payload,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
template=r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>WORLD//PATCH — Codex development evidence</title>
<style>
:root{color-scheme:dark;--bg:#080d15;--panel:#111a27;--panel-deep:#0a111c;--line:#28374b;--ink:#f0f4f6;--muted:#9daec2;--amber:#ffd078;--cyan:#a5e4df;--green:#b9dca7;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans)}button{font:inherit}button:focus-visible{outline:3px solid var(--cyan);outline-offset:5px}.shell{width:100%;max-width:1920px;min-height:1080px;margin:auto;padding:38px 54px 28px;display:flex;flex-direction:column;gap:25px}.masthead{display:flex;align-items:center;justify-content:space-between;gap:30px;border-bottom:1px solid var(--line);padding-bottom:23px}.brand{font-weight:780;letter-spacing:-1.3px;font-size:29px}.brand span{color:var(--amber);margin:0 3px}.stamp,.eyebrow,.file-label,.proof-label,.footer,.tab-key{font:500 15px var(--mono);letter-spacing:1.4px}.stamp{color:var(--muted)}.stamp i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cyan);margin-right:10px}.heading{display:flex;align-items:flex-end;justify-content:space-between;gap:30px}.eyebrow{color:var(--amber);margin:0 0 10px}h1{font-size:59px;letter-spacing:-2.4px;line-height:1.05;margin:0}h2,h3,p{margin:0}.subhead{font-size:21px;line-height:1.45;color:var(--muted);max-width:580px;padding-bottom:4px}.tabs{display:flex;gap:12px}.tab{position:relative;display:flex;align-items:center;gap:14px;min-height:58px;padding:0 23px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:22px;cursor:pointer;border-radius:5px}.tab[aria-selected="true"]{background:var(--amber);border-color:var(--amber);color:#1b1b1b;font-weight:650}.tab-key{border:1px solid currentColor;border-radius:3px;width:24px;height:24px;display:grid;place-items:center;opacity:.65;font-size:13px}.panels{flex:1;min-height:600px}.panel{display:grid;grid-template-columns:minmax(0,1fr) 500px;gap:22px;min-height:600px}.panel[hidden]{display:none}.card{border:1px solid var(--line);border-radius:7px;background:var(--panel);overflow:hidden}.card-top{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 25px;border-bottom:1px solid var(--line)}.file-label{color:var(--muted);letter-spacing:.3px}.tag{font:500 13px var(--mono);letter-spacing:1px;color:var(--cyan);border:1px solid #34504f;padding:6px 9px;border-radius:3px;white-space:nowrap}.code-wrap{padding:23px 26px}.code{font:400 22px/1.48 var(--mono);color:#cfdee8;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2;margin:0}.record-note{border-top:1px solid var(--line);padding:17px 25px;color:var(--muted);font-size:17px;line-height:1.45}.proof-card{padding:22px 25px;display:flex;flex-direction:column;gap:18px}.proof-label{color:var(--amber);font-size:13px;margin-bottom:9px}.proof-card h2{font-size:25px;line-height:1.12;letter-spacing:-.6px}.proof-card .explain{font-size:16px;line-height:1.4;color:var(--muted)}.proof-item{border-top:1px solid var(--line);padding-top:10px}.proof-item dt{color:var(--muted);font-size:13px;margin-bottom:6px}.proof-item dd{margin:0;font:500 16px/1.35 var(--mono);overflow-wrap:anywhere}.proof-item .short-hash{color:var(--cyan)}.source-hash{font:500 14px/1.5 var(--mono);color:var(--muted);overflow-wrap:anywhere}.session-strip{border:1px solid var(--line);background:var(--panel-deep);padding:14px 21px;display:flex;gap:18px;align-items:center;justify-content:space-between;border-radius:5px}.session-strip span{font:500 14px var(--mono);letter-spacing:1px;color:var(--muted)}.session-strip strong{font:500 23px var(--mono);color:var(--cyan)}.footer{display:flex;justify-content:space-between;gap:20px;color:var(--muted);font-size:12px;letter-spacing:.5px}.rule-stack{display:grid;grid-template-columns:1fr 1fr;gap:18px}.rule-stack .code{font-size:18px;line-height:1.5}.rule-stack .code-wrap{padding:17px 23px}.rule-stack .card-top{padding:14px 23px}.rule-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:20px}.rule-list li{padding-left:17px;border-left:2px solid var(--cyan)}.rule-list strong{display:block;font-size:21px;line-height:1.3;margin-bottom:5px}.rule-list span{color:var(--muted);font-size:17px;line-height:1.4;display:block}.verification-panel{display:block}.check-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}.metric{padding:25px 29px;min-height:227px}.metric .metric-number{font:650 79px/1.1 var(--sans);letter-spacing:-4px;margin:7px 0 10px;color:var(--cyan)}.metric .metric-number span{font-size:31px;color:var(--muted);letter-spacing:-1px}.metric h2{font-size:22px;margin-bottom:9px}.metric p{font-size:17px;line-height:1.45;color:var(--muted)}.metric .passed{color:var(--green);font:600 15px var(--mono);letter-spacing:1px}.gate-list{padding:25px 29px;display:flex;flex-direction:column;gap:16px}.gate{display:flex;justify-content:space-between;gap:12px;font-size:20px;padding-bottom:14px;border-bottom:1px solid var(--line)}.gate:last-child{border:0;padding:0}.gate b{font:600 16px var(--mono);color:var(--green)}.verification-bottom{margin-top:21px;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:20px}.report-card{padding:23px 29px}.report-card h3{font-size:22px;letter-spacing:-.2px;margin-bottom:11px}.report-card p{font-size:18px;line-height:1.5;color:var(--muted)}.report-list{margin:10px 0 13px;padding:0;list-style:none;font:500 16px/1.9 var(--mono);color:var(--cyan)}.qualification{padding:16px 19px;background:#14242a;border-left:2px solid var(--cyan);font-size:17px;line-height:1.5;color:var(--muted);margin-top:15px}.check-date{font:500 15px var(--mono);color:var(--muted);margin-top:18px}dl{margin:0}.gap-note{font:400 13px/1.4 var(--mono);color:var(--muted);margin-top:10px}
@media(max-width:1200px){.shell{padding:25px;min-height:100vh;gap:20px}.heading{align-items:flex-start;flex-direction:column;gap:16px}h1{font-size:48px}.panel{grid-template-columns:minmax(0,1fr) 370px}.code{font-size:17px}.tabs{flex-wrap:wrap}.tab{font-size:18px;padding:0 14px}.proof-card{padding:20px}.rule-stack{display:flex;flex-direction:column}.session-strip{align-items:flex-start;flex-direction:column;gap:8px}.session-strip strong{font-size:19px}.metric .metric-number{font-size:65px}.check-grid{grid-template-columns:1fr 1fr}.gate-list{grid-column:1/-1}.footer{flex-direction:column;gap:6px}}
@media(max-width:760px){.shell{padding:18px;gap:20px}.stamp{display:none}.brand{font-size:23px}h1{font-size:39px}.subhead{font-size:18px}.tab{font-size:16px;min-height:50px}.tab-key{display:none}.panel{display:flex;flex-direction:column}.code{font-size:15px}.check-grid,.verification-bottom{display:flex;flex-direction:column}.metric{min-height:190px}.session-strip strong{font-size:15px;overflow-wrap:anywhere}.proof-item dd{font-size:16px}.rule-stack .code{font-size:15px}.footer{font-size:10px;line-height:1.5}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<div class="shell">
<header class="masthead"><div class="brand">WORLD<span>//</span>PATCH</div><div class="stamp"><i></i>CODEX DEVELOPMENT EVIDENCE</div></header>
<section class="heading"><div><p class="eyebrow">THE BUILD, WITH RECEIPTS</p><h1>Built with Codex.</h1></div><p class="subhead">Recorded main-chat work, current source and executed checks. Each has its own provenance.</p></section>
<nav class="tabs" aria-label="Evidence sections" role="tablist">
<button class="tab" id="tab-build" role="tab" aria-selected="true" aria-controls="panel-build" tabindex="0" data-panel="build"><span class="tab-key" aria-hidden="true">1</span>Codex build</button>
<button class="tab" id="tab-rules" role="tab" aria-selected="false" aria-controls="panel-rules" tabindex="-1" data-panel="rules"><span class="tab-key" aria-hidden="true">2</span>Shared rules</button>
<button class="tab" id="tab-verification" role="tab" aria-selected="false" aria-controls="panel-verification" tabindex="-1" data-panel="verification"><span class="tab-key" aria-hidden="true">3</span>Executed verification</button>
</nav>
<main class="panels">
<section class="panel" id="panel-build" role="tabpanel" aria-labelledby="tab-build" tabindex="0">
<article class="card"><div class="card-top"><span class="file-label">src/server/app.ts · recorded source-writing call</span><span class="tag">28 OCTOBER 2026</span></div><div class="code-wrap"><pre class="code" id="build-code"></pre></div><p class="record-note">Exact excerpt from the initial patch. Later hardening is preserved in the current project. Lines wrap for readability.</p></article>
<aside class="card proof-card"><div><p class="proof-label">ACTUAL MAIN-CHAT RECORD</p><h2>Connecting chat<br>to the trusted room.</h2></div><p class="explain">Codex wrote the server bridge that routes Twitch events into the room and broadcasts authoritative state.</p><dl><div class="proof-item"><dt>Recorded tool call</dt><dd id="call-id"></dd></div><div class="proof-item"><dt>Call timestamp</dt><dd id="call-at"></dd></div><div class="proof-item"><dt>Associated tool result</dt><dd>Script completed</dd></div><div class="proof-item"><dt>Original call input · SHA-256</dt><dd class="short-hash" id="call-hash"></dd></div></dl><p class="source-hash">Selected source and metadata only. Raw session retained separately.</p></aside>
</section>
<section class="panel" id="panel-rules" role="tabpanel" aria-labelledby="tab-rules" tabindex="0" hidden>
<div class="rule-stack"><article class="card"><div class="card-top"><span class="file-label">Current engine · bounded search</span><span class="tag">SAME TRANSITION</span></div><div class="code-wrap"><pre class="code" id="solver-code"></pre><p class="gap-note">Partial solver excerpt. The complete source is retained in the project.</p></div></article><article class="card"><div class="card-top"><span class="file-label">Current engine · player movement and witness replay</span></div><div class="code-wrap"><pre class="code" id="transition-code"></pre><pre class="code" id="replay-code" style="margin-top:15px"></pre></div></article></div>
<aside class="card proof-card"><div><p class="proof-label">CURRENT SOURCE, SEPARATE FROM HISTORY</p><h2>One model.<br>Every escape.</h2></div><ul class="rule-list"><li><strong>Player, solver and replay</strong><span>All call the same deterministic transition. Phaser presents its result.</span></li><li><strong>Limits stay explicit</strong><span>A budget limit returns incomplete. It cannot be presented as an impossible world.</span></li><li><strong>A witness is executable</strong><span>The found route is replayed before a patch may be accepted.</span></li></ul><div class="proof-item"><p class="proof-label">src/shared/engine.ts · SHA-256</p><p class="source-hash" id="engine-hash"></p></div></aside>
</section>
<section class="panel verification-panel" id="panel-verification" role="tabpanel" aria-labelledby="tab-verification" tabindex="0" hidden>
<div class="check-grid"><article class="card metric"><p class="passed">PASS · EXECUTED</p><div class="metric-number">114<span> / 114</span></div><h2>Unit, property and integration checks</h2><p>Engine, room, persistence, HTTP and provider fixtures.</p></article><article class="card metric"><p class="passed">PASS · EXECUTED</p><div class="metric-number">22<span> / 22</span></div><h2>Production-browser journeys</h2><p><span id="browser-seconds"></span> seconds. No failures, skips or flaky tests.</p></article><article class="card gate-list"><div class="gate"><span>TypeScript</span><b>PASS</b></div><div class="gate"><span>ESLint</span><b>PASS</b></div><div class="gate"><span>Production build</span><b>PASS</b></div><div class="gate"><span>Source drift</span><b>ZERO · 45 FILES</b></div></article></div>
<div class="verification-bottom"><article class="card report-card"><h3>Results you can inspect.</h3><ul class="report-list"><li>evidence/release-final-unit.json</li><li>evidence/release-final-browser.json</li><li>evidence/release-final-checks.json</li></ul><p class="check-date">Report recorded <span id="checks-at"></span></p><p class="source-hash" style="margin-top:13px">Tested-source fingerprint <span id="checks-hash"></span></p></article><article class="card report-card"><h3>Keep the evidence boundaries clear.</h3><p>The browser suite runs the built frontend and a real local server with isolated test data.</p><p class="qualification">These checks use provider fixtures and simulation. Actual Twitch delivery, OBS capture and public access require separate evidence.</p></article></div>
</section>
</main>
<div class="session-strip"><span>MAIN CODEX BUILD SESSION</span><strong id="main-session"></strong><span>OCT 28 → NOV 2, 2026</span></div>
<footer class="footer"><span>LOCAL EVIDENCE VIEWER · NOT THE NATIVE CODEX INTERFACE</span><span>NO RUNTIME MODEL · NO SYNTHETIC TOOL OUTPUT</span></footer>
</div>
<script type="application/json" id="evidence-data">__EVIDENCE_JSON__</script>
<script>
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
</script>
</body>
</html>'''
(out/'index.html').write_text(template.replace('__EVIDENCE_JSON__',serialized))
readme='''# Codex development evidence viewer

This self-contained local HTML viewer is an original presentation for a short OBS capture. Open index.html as an OBS Browser Source local file at 1920×1080, or serve this directory on loopback. It uses no external fonts, assets, network requests or runtime model.

Use buttons or keys1/2/3 to switch between Codex build, Shared rules and Executed verification. Arrow keys, Home and End work within the tab list. No fake typing, generated tool output, timed auto-advance or decorative animation is used.

The build panel contains an exact selected source excerpt from the actual main Codex session's source-writing call for src/server/app.ts. Its call ID, recorded timestamp and input hash are retained. The original tool result says Script completed. The current shared-engine panel is explicitly separate: the main log's engine hits were reads/tests, so this viewer does not claim that its displayed main record created engine.ts. The selected historical server excerpt predates later hardening.

The current verification panel reads the executed November2 reports:114 passed unit/property/server/provider-fixture tests,22 passed production-browser journeys, TypeScript/ESLint/build success and zero drift across45 project files from the final report manifest (dependencies excluded). These local results are not live Twitch, OBS, broadcast or hosted-delivery proof.

The raw Codex transcript is not exported. evidence.json contains only the whitelisted source excerpt, metadata, current source snippets and report summaries/hashes. It contains no OAuth/browser/authentication records or personal answers. Source snippets are assigned with textContent; no untrusted text is inserted as HTML.

This is an evidence viewer, not a recording or reconstruction of the native Codex interface. The parent still needs to inspect its actual1920×1080 browser rendering before the final capture. Suggested capture: build panel10s, shared rules12s, executed verification10s. The displayed dates are source-record and verification dates, not simulated live execution.
'''
(out/'README.md').write_text(readme)
files=['build_viewer.py','index.html','evidence.json','recorded-server-bridge.txt','current-transition.txt','current-solver-excerpt.txt','current-replay-witness.txt','README.md']
provenance={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mainSessionId':session,'originalMainRecordLocated':True,
 'originalRecord':{key:payload['recordedBuild'][key]for key in ['callId','at','recordLine','recordInputSHA256','excerptSHA256','completionAt','completionLine','completionRecordSHA256']},
 'sourceLocator':'Exact main-session rollout on the local machine, identified by session metadata; raw transcript and absolute personal path omitted',
 'currentSource':{'path':'src/shared/engine.ts','sha256':payload['currentEngine']['sha256']},
 'reports':payload['executedVerification']['reports'],'qualifications':[payload['viewerKind'],payload['recordedBuild']['qualification'],payload['currentEngine']['qualification'],payload['executedVerification']['qualification']],
 'files':[{'path':name,'sha256':file_sha(out/name),'bytes':(out/name).stat().st_size}for name in files]}
(out/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(json.dumps({'output':str(out),'originalMainRecordLocated':True,'callId':call_id,'recordAt':record['timestamp'],'unitPassed':114,'browserPassed':22,'files':len(files)+1},indent=2))
