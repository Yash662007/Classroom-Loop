/**
 * Acceptance journey (20 steps) against the production build on a fresh seed.
 * Zero dependencies — plain Node (fetch + node:assert). Run: node data/acceptance-journey.mjs
 */
const BASE = "http://localhost:3000";
let passed = 0;
function step(label) { passed++; console.log("PASS ", label); }
function fail(label, extra) {
  console.error("FAIL ", label, extra ?? "");
  process.exit(1);
}
const ok = (cond, label, extra) => { if (!cond) fail(label, extra); };

async function loginCookie(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  ok(res.status === 200, `${email} login`, res.status);
  const raw = res.headers.get("set-cookie") ?? "";
  const m = raw.match(/cl_session=([^;]+)/);
  ok(Boolean(m), "session cookie issued", raw);
  return `cl_session=${m[1]}`;
}

const get = async (cookie, path) => {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  if (res.status !== 200) fail(`GET ${path}`, res.status);
  return res.json();
};
const post = async (cookie, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status !== 200 && res.status !== 201) fail(`POST ${path}`, res.status);
  return res.json();
};

/* ---- Teacher B journey ---- */

const tb = await loginCookie("teacher.b@classroomloop.demo", "demo1234");
step("S1  teacher login 200 + session cookie");

const me = await get(tb, "/api/auth/me");
ok(me.user?.role === "teacher", "S2 /auth/me role", me);
step("S2  /auth/me resolves role=teacher (cookie token verified)");

const comps = await get(tb, "/api/teacher/competencies");
ok(comps.competencies?.length >= 1, "S3 competencies non-empty", comps);
ok(comps.competencies[0].trainingComplete === true, "S3 training complete", comps.competencies[0]);
ok(comps.competencies[0].check?.status === "passed", "S3 seeded check visible", comps.competencies[0]);
step("S3  training complete + seeded check visible (pre-recheck state)");

const cid = comps.competencies[0].id;
const labels = comps.competencies[0].criteria.map((c) => c.label);
const emerging = await post(tb, "/api/competencies/check", {
  competency_id: cid,
  answers: Object.fromEntries(labels.map((l) => [l, 1])),
});
ok(emerging.status === "needs_review" && emerging.score === 5 && emerging.total === 10,
  "S4 all-emerging self-rating correctly needs review (5/10 < 80%)", emerging);
const confident = await post(tb, "/api/competencies/check", {
  competency_id: cid,
  answers: Object.fromEntries(labels.map((l) => [l, 2])),
});
ok(confident.status === "passed" && confident.score === 10, "S4 confident self-rating passes (10/10)", confident);
const after = await get(tb, "/api/teacher/competencies");
ok(after.competencies[0].check?.status === "passed" && after.competencies[0].check?.score === 10,
  "S4 latest check wins", after.competencies[0].check);
step("S4  competency check threshold (needs_review at 50%, passed at 100%, latest wins)");

const ctx = await get(tb, "/api/teacher/context");
ok(ctx.context?.class_size === 58 && ctx.context?.multigrade === false, "S5 context round-trip", ctx.context);
step("S5  teaching context round-trips (seeded)");

const gen = await post(tb, "/api/implementation/generate", { competency_id: cid, force_new: true });
ok(gen.reusedExisting === false && gen.aiSource === "local_engine", "S6 generate new + local engine", gen);
ok(gen.task?.attempt_number === 2, "S6 attempt 2", gen.task);
const taskId = gen.task.id;
step("S6  AI-personalized retry task generated (attempt 2, local_engine)");

const choices = JSON.parse(gen.task.scenario_choices);
ok(Array.isArray(choices) && choices.length === 4, "S7 four scenario choices", choices);
step("S7  practice scenario present with 4 choices");

const practice = await post(tb, "/api/practice/sessions", {
  task_id: taskId,
  chosen_option: gen.task.recommended_choice,
  reflection: "Pair-share first, then take answers from mixed pairs.",
});
ok(practice.wasCorrect === true, "S8 practice correct", practice);
step("S8  practice session recorded (recommended choice correct)");

const reflection =
  "Second attempt for acceptance. I asked why the river water was muddy and gave real wait time, counting three seconds in silence before taking answers. " +
  "We used pair-share so everyone discussed in pairs first, and I called on different pairs from the back. When one student answered, I probed with a " +
  "follow-up and asked her to explain how she worked that out.";
const ev = await post(tb, "/api/evidence", { task_id: taskId, reflection, checklist: {} });
ok(ev.duplicate === false && ev.analysis?.observed?.length > 0, "S9 evidence + auto analysis", ev);
const evidenceId = ev.evidenceId;
step("S9  evidence submitted -> AI analysis auto-ran");

ok(ev.analysis.interpretation?.length > 0, "S10 interpretation empty", ev.analysis);
ok(ev.analysis.recommendation?.length > 0, "S10 recommendation empty", ev.analysis);
ok(ev.analysis.criterionHits?.every((c) => c.hit), "S10 all criteria evidenced", ev.analysis.criterionHits);
step("S10 Observed/Interpreted/Recommended all present; all 5 criteria evidenced");

/* ---- Mentor half ---- */

const tm = await loginCookie("mentor@classroomloop.demo", "demo1234");
const queue = await get(tm, "/api/mentor/queue");
ok(queue.queue?.some((q) => q.evidenceId === evidenceId), "S11 queue contains new attempt", queue.queue?.map((q) => q.evidenceId));
step("S11 mentor queue contains the new B attempt");

const view = await get(tm, `/api/mentor/evidence/${evidenceId}`);
ok(view.analysis && view.teacher?.name && view.adoption, "S12 review view payload", Object.keys(view));
step("S12 mentor review view loads (evidence+analysis+teacher+adoption)");

const draft = await post(tm, "/api/mentor/feedback/draft", { evidence_id: evidenceId });
ok(draft.created === true && draft.draft?.includes("### What appears to have worked"), "S13 AI draft", draft);
step("S13 AI feedback draft created (human-in-the-loop artifact)");

const mentorMsg =
  "Strong retry: wait time and pair-share are now consistent habits. Next: keep asking how students worked it out, and try it in your noisiest class.";
const sent = await post(tm, "/api/mentor/feedback", {
  evidence_id: evidenceId,
  message: mentorMsg,
  action: "approve_send",
  edited_by_mentor: true,
});
ok(sent.feedbackId && sent.teacherName, "S14 approve&send", sent);
step("S14 mentor edited + approved & sent (mentor's words, not AI's)");

/* ---- Teacher sees feedback, retries, adoption advances ---- */

const evv = await get(tb, `/api/teacher/evidence/${evidenceId}`);
ok(evv.feedback?.status === "sent" && evv.feedback?.message === mentorMsg && evv.feedback.editedByMentor === true,
  "S15 teacher sees mentor words", evv.feedback);
step("S15 teacher sees the mentor's edited words (editedByMentor=true)");

const retry = await post(tb, "/api/implementation/retry", { competency_id: cid, note: "Will try in the noisiest class." });
ok(retry.task?.attempt_number === 3 && retry.task.reasoning?.includes("Retry note"), "S16 retry attempt 3", retry);
step("S16 retry started (attempt 3, teacher note recorded)");

/* ---- Media evidence on attempt 3: voice note + photo + idempotency + limits ---- */

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const mediaRes = await fetch(`${BASE}/api/evidence`, {
  method: "POST",
  headers: { cookie: tb, "x-idempotency-key": "acc-media-token-1" },
  body: (() => {
    const f = new FormData();
    f.set("task_id", retry.task.id);
    f.set("reflection", "After the lesson I spoke this reflection aloud: I tried the pair-share round in the noisiest class, I gave the class three seconds of wait time, I asked two students to explain how they worked that out, and I photographed the group answer board.");
    f.set("voice_note", "Dictated: the pair-share round worked even in the noisiest class.");
    f.set("checklist", JSON.stringify({}));
    f.append("photo", new Blob([PNG_1PX], { type: "image/png" }), "answer-board.png");
    return f;
  })(),
});
ok(mediaRes.status === 201, "S16b media evidence accepted (voice+photo)", mediaRes.status);
const media = await mediaRes.json();
ok(media.analysis && media.analysis.observed.length > 0, "S16b media evidence analyzed with observable quotes", media.analysis);
ok((media.analysis.criterionHits ?? []).filter((c) => c.hit).length >= 3, "S16b media evidence hits rubric criteria", media.analysis.criterionHits);
step("S16b media evidence: voice note + photo accepted and analyzed");

const replayRes = await fetch(`${BASE}/api/evidence`, {
  method: "POST",
  headers: { cookie: tb, "x-idempotency-key": "acc-media-token-1" },
  body: (() => {
    const f = new FormData();
    f.set("task_id", retry.task.id);
    f.set("reflection", "replay");
    f.set("checklist", JSON.stringify({}));
    return f;
  })(),
});
const replayMedia = await replayRes.json();
ok(replayRes.status === 200 && replayMedia.duplicate === true && replayMedia.evidenceId === media.evidenceId,
  "S16c media replay is idempotent", { status: replayRes.status, id: replayMedia.evidenceId });
step("S16c media evidence replay returns the original (idempotent)");

const badType = await fetch(`${BASE}/api/evidence`, {
  method: "POST",
  headers: { cookie: tb },
  body: (() => {
    const f = new FormData();
    f.set("task_id", retry.task.id);
    f.set("reflection", "bad type probe");
    f.set("checklist", JSON.stringify({}));
    f.append("photo", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "x.txt");
    return f;
  })(),
});
ok(badType.status === 415, "S16d non-image photo rejected with 415", badType.status);

const tooBig = await fetch(`${BASE}/api/evidence`, {
  method: "POST",
  headers: { cookie: tb },
  body: (() => {
    const f = new FormData();
    f.set("task_id", retry.task.id);
    f.set("reflection", "too big probe");
    f.set("checklist", JSON.stringify({}));
    f.append("photo", new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "image/png" }), "big.png");
    return f;
  })(),
});
ok(tooBig.status === 413, "S16d oversized photo rejected with 413", tooBig.status);
step("S16d upload validation: 415 on non-image, 413 over 5 MB");

const dash = await get(tb, "/api/teacher/dashboard");
ok(dash.adoption?.stage === "retried", "S17 adoption stage", dash.adoption);
ok(dash.counts?.attempts === 3, "S17 attempts count", dash.counts);
step("S17 adoption ladder advanced to retried; 3 attempts visible");

const hist = await get(tb, "/api/teacher/history");
ok(hist.history?.[0]?.attempts?.length === 3, "S18 history attempts", hist.history?.[0]?.attempts?.length);
step("S18 implementation history shows 3 attempts with evidence");

/* ---- Admin analytics ---- */

const ta = await loginCookie("admin@classroomloop.demo", "demo1234");
const funnel = await get(ta, "/api/analytics/funnel");
const retried = funnel.funnel?.find((s) => s.stage === "retried")?.count ?? 0;
ok(retried >= 2, "S19 funnel retried count", funnel.funnel);
const metrics = await get(ta, "/api/analytics/implementation");
ok(metrics.aiAnalyses >= 5 && metrics.feedbackSent >= 4, "S19 implementation metrics", metrics);
const adoption = await get(ta, "/api/analytics/adoption");
ok((adoption.byStage?.find((s) => s.stage === "retried")?.teachers ?? 0) >= 1, "S19 adoption distribution", adoption.byStage);
step("S19 admin funnel/analytics/adoption reflect the journey");

const support = await get(ta, "/api/analytics/support");
ok(Array.isArray(support.teachers), "S20 support list", support);
step("S20 admin support/intervention list renders (aggregate-only)");

console.log(`\nALL 20 STEPS PASSED (${passed} assertion groups)`);
