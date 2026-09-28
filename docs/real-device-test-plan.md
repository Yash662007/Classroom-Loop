# Real-device test plan — Android Chrome (Classroom Loop)

Manual test plan for the flows that cannot be verified in a desktop browser:
real camera/mic hardware, real radios, real permission dialogs, real
backgrounding. Every step has an expected result; a failing expectation is a
bug report, not a note.

**Setup (once):** low-end Android 10+ phone, Chrome stable, server reachable
over LAN HTTPS (or an ngrok URL — getUserMedia requires a secure context).
Seed fresh demo data. Sign in as **teacher.b@classroomloop.demo** /
`demo1234`.

| # | Step | Expected result |
|---|------|-----------------|
| **Layout / 390 px** |
| 1 | Open `/teacher` | Bottom nav (Home/Practice/Progress/More) visible; no horizontal scroll; dashboard cards stack in one column. |
| 2 | Rotate to landscape | Layout reflows without overflow; bottom nav stays. |
| 3 | Open the nav drawer (☰) | Drawer covers ≤ 85% width; backdrop tap closes; focus moves into drawer. |
| **Camera / mic hardware** |
| 4 | `/teacher/task` → take a photo (rear camera) | Native camera UI opens; after capture a compressed preview shows; no full-resolution upload happens (check DevTools network size < 1 MB). |
| 5 | Deny camera permission once, retry photo | Permission-denied fallback copy appears; typed reflection still submittable — evidence flow never blocks on one input. |
| 6 | Grant camera, record a 15 s video | Recording stops at 30 s max; preview plays with sound; file size ≤ 5 MB (bitrate-capped); "Remove video" resets. |
| 7 | Record a voice reflection | Timer runs; stop produces a playable recording; retake works. |
| 8 | Submit evidence with photo + voice + video | 201 response; AI insight page renders all three attachments; mentor (desktop) can play voice and video in review. |
| **Offline sync** |
| 9 | Airplane mode ON; write reflection; submit | Amber "Saved on this device" state; IndexedDB outbox gains exactly one queued item with the same blobs attached. |
| 10 | Airplane mode OFF (Wi-Fi back) | Automatic flush within ~60 s or on "Sync now"; item leaves the outbox; submission appears with analysis; no duplicates on the server. |
| 11 | Kill Chrome mid-flush; reopen | Interrupted "flushing" item recovers to queued and syncs once — no duplicate evidence rows. |
| **Data Saver** |
| 12 | Enable Data Saver in `/teacher/settings` | Toggle persists after reload; "held photo" flow shows the amber hold notice with an "Upload now" button. |
| 13 | Capture a photo while offline, submit | Outbox item has **no photo blob** (hold honored); "Upload now" then enqueues it on the next submit. |
| 14 | On a throttled connection (DevTools "Slow 3G"), normal capture | Auto behavior unchanged (hold only when Data Saver on); evidence still submits. |
| **Sessions / notifications** |
| 15 | Background Chrome for 10 min, return | Session still valid (JWT cookie); outbox state intact; connection chip reflects current status. |
| 16 | Mentor (desktop) sends feedback; teacher phone receives it | Insight page shows mentor's edited words after refresh; adoption stage advanced. |
| **Performance floor** |
| 17 | Cold start on 3G throttle (cached SW) | First meaningful paint < 5 s; evidence form interactive < 8 s on a low-end device. |
| 18 | Capture + submit on 10% battery / battery saver | No crash; uploads either complete or queue — never partial. |

**Known limits of this plan:** no iOS/Safari coverage (mp4 path differs), no
multi-device concurrency test, no background-sync-only verification (Chrome
requires an installed PWA for that). Record device model + Android + Chrome
version with results.
