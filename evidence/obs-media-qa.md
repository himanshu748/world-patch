# OBS media QA — 2 November 2026

The existing Swift inspector now runs successfully with system Apple Swift 6.1.2 and AVFoundation. The earlier missing output is consistent with the interrupted run; no compiler defect was reproduced. No Homebrew library or global installation was changed, and the broken FFmpeg/ffprobe tools were not used. The extended inspector decodes selected exact-time PNG frames, enumerates compressed video samples and can inspect complete retained audio tracks numerically. It also supports a video-only passthrough export.

## Old smoke clip

Input remains private at work/recordings/obs-twitch-witness-smoke.mov. Actual decoded metadata:44.683 seconds,1920×1080, AVC/H.264, nominal60fps and2681 encoded video samples. Source SHA-256 and three full-resolution decoded frame hashes are in obs-smoke-media.json. Nominal/encoded cadence is not a count of unique rendered frames and cannot supersede the reported OBS lag:8.5percent rendering and2percent encoding. This remains a failed quality smoke test, not the final demonstration.

One48kHz stereo AAC track was present. Its complete numeric PCM decode contained4,288,320 nonzero sample values, peak−10.76dBFS and RMS−33.18dBFS; it is not silent. Microphone denial/mute did not establish silence of all retained sources. No audio was listened to, transcribed, separately extracted or copied to an audio artifact. Do not publish the raw smoke clip.

## Silent fallback copy

At the parent's explicit request, AVFoundation AVAssetExportPresetPassthrough created work/recordings/obs-twitch-witness-smoke-silent.mov with video only. The source file was not changed. Full metadata reinspection confirms zero audio tracks. All2681 compressed video samples retain the exact same combined payload SHA-256; their first/last presentation times and all three sampled decoded PNG SHA-256 values match the original. No lossy video encode was performed.

Container duration normalized from44.683000 to44.683333 seconds, a+0.333ms end-time rounding difference below one60fps frame. This difference is recorded explicitly rather than claiming byte-identical container timing. Verification and hashes are in obs-smoke-silent-media.json. Audio removal leaves the original render/encode lag unchanged. This is fallback game footage only and does not constitute a final submission video, continuous live-chat demonstration or Codex capture.

## Visual and proof scope

The inspected middle frame shows the read-only Vector Foundry witness, Twitch-ready indicator, closed wall A and the stored24-move/58-state Twitch receipt. Other extracted frames are available under evidence/screenshots/obs-smoke-*-frame-*.png. Selected frame inspection is not a complete visual/privacy review or a measurement of continuous smoothness. No GUI, OBS setting, external upload, generated narration, private configuration or account data was accessed by this worker.

Apple API references: [AVAssetReaderTrackOutput](https://developer.apple.com/documentation/avfoundation/avassetreadertrackoutput), [image(at:)](https://developer.apple.com/documentation/avfoundation/avassetimagegenerator/image(at:)). Framework behavior was verified by actual execution and artifact comparisons.

## Nov2 failed live-round recording

The private capture was copied only to work/recordings/obs-nov2-failed.mov for inspection. AVFoundation reports 100.900 seconds,1920×1080 AVC/H.264, nominal30fps and3,026 retained encoded video samples. The parent-provided OBS log accounting reports33/3,037 skipped encoding frames (1.1%); rendering lag was not reported for this recording. Container sample counts and OBS accounting totals are different measurements.

One48kHz stereo AAC track is present, but complete numeric PCM decoding found every value exactly zero: DIGITAL_SILENCE, zero peak/RMS amplitude (negative infinity dBFS). No audio was listened to or transcribed. This corrects the assumption that AAC track presence necessarily means audible/private content.

The new clip still fails the intended complete live game journey: the wall proposal was accepted and one ballot recorded, but the merge recheck returned VERIFICATION_INCOMPLETE and no new law merged. The inspected frames show the actual game-plus-chat composition, gravity lockout rejection and unchanged world; no final successful merge/demo is claimed. The main agent subsequently repaired the bounded room budget and passed114 unit checks/22 browser journeys, but a new successful recorded round still needs its own authorization/evidence. Full metadata, audio metrics and extracted frame hashes are in obs-nov2-failed-media.json. The raw clip remains private and is excluded from the staged release.

## Corrected Nov2 game/chat capture

The corrected capture is private at work/recordings/obs-final-live.mov. AVFoundation decoded it as169.266 seconds (2:49.266),1920×1080 AVC/H.264, nominal30fps and5,077 retained encoded samples. One48kHz stereo AAC track is present, but all decoded PCM values are exactly zero. No audio was listened to or transcribed. Selected middle/end frames show the actual chat pane, the closed wall A Twitch receipt with24 moves/58 states, and the ghost reaching24/24 EXIT REACHED.

The matching OBS log block reports5,079 output frames,5,085 drawn frames, and2/5,086 encoding-lag frames:0.0393percent, rounded by OBS to0.0percent. This is not literally zero lost encoding frames. Rendering lag is not separately reported for this recording; no zero-render-lag claim is made. These OBS counters differ from retained container samples and are not equated.

The corrected Twitch replay was independently recomputed with the actual compiled verifier: session d4f06036-ef59-4f11-b9d5-c823783f7155,36 events, one merge and escaped final game. It binds to the stored24-move wall receipt seen in the capture. The recording includes the successful real proposal/vote/merge/player/reveal flow; host pause/resume while preparing drafts is genuine moderation, not fake chat. This new capture supersedes the failed merge attempt as current live-flow evidence while leaving its failure history intact.

The raw169.266-second game/chat footage leaves only10.734 seconds under the180-second video limit. Final editing must trim actual idle/preparation intervals before adding meaningful Codex footage. This analysis is not final editorial/privacy approval, a completed YouTube video, a public Twitch broadcast or a submission. Exact metadata, frame hashes, source hash, retained-audio metrics, OBS counters and replay binding are in obs-final-live-media.json. Raw recordings remain excluded from release source.
