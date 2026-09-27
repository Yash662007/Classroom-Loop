/**
 * Classroom Loop — demo data seeder.
 *
 * Every record created here is SIMULATED. Persons are explicitly labeled:
 *   "Teacher A (Sample Data — Multi-grade)", etc.
 *
 * Run: npm run db:seed
 */
import { randomUUID } from "node:crypto";
import { getDb } from "./instance";
import { hashPassword } from "../lib/password";
import {
  localAnalyzeEvidence,
  localDraftFeedback,
  localPersonalize,
  localPracticeScenario,
} from "../lib/ai/local-engine";
import type { TeacherContextData } from "../lib/ai/types";

export const DEMO_PASSWORD = "demo1234";

const daysAgo = (n: number, hourOffset = 0) =>
  new Date(Date.now() - n * 86_400_000 + hourOffset * 3_600_000).toISOString();

/** Idempotent: wipes content tables, then inserts the full demo scenario. */
export async function seedDemoData(): Promise<{ users: number; tasks: number; evidence: number }> {
  const db = getDb();
  const counts = { users: 0, tasks: 0, evidence: 0 };

  db.transaction(() => {
    db.exec(`
      DELETE FROM sync_log;
      DELETE FROM adoption_events;
      DELETE FROM mentor_feedback;
      DELETE FROM ai_analyses;
      DELETE FROM evidence_submissions;
      DELETE FROM practice_sessions;
      DELETE FROM implementation_tasks;
      DELETE FROM competency_results;
      DELETE FROM module_completions;
      DELETE FROM training_modules;
      DELETE FROM competency_criteria;
      DELETE FROM competencies;
      DELETE FROM teacher_contexts;
      DELETE FROM users;
    `);
  })();

  const insertUser = db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash, mentor_id, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const insertContext = db.prepare(
    `INSERT INTO teacher_contexts
       (user_id, experience_years, grades_taught, subjects, class_size, multigrade, school_context, challenges, confidence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertCompetency = db.prepare(
    `INSERT INTO competencies (id, title, description, created_at) VALUES (?, ?, ?, ?)`
  );
  const insertCriterion = db.prepare(
    `INSERT INTO competency_criteria (id, competency_id, label, keywords, display_order) VALUES (?, ?, ?, ?, ?)`
  );
  const insertModule = db.prepare(
    `INSERT INTO training_modules (id, competency_id, title, description, display_order) VALUES (?, ?, ?, ?, ?)`
  );
  const insertCompletion = db.prepare(
    `INSERT INTO module_completions (user_id, module_id, completed_at) VALUES (?, ?, ?)`
  );
  const insertResult = db.prepare(
    `INSERT INTO competency_results (id, user_id, competency_id, status, score, answers, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTask = db.prepare(
    `INSERT INTO implementation_tasks
       (id, user_id, competency_id, attempt_number, status, title, activity, practice_scenario, scenario_choices, recommended_choice, difficulty, micro_learning, support, reasoning, generated_by, personalization_snapshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPractice = db.prepare(
    `INSERT INTO practice_sessions (id, task_id, user_id, chosen_option, was_correct, reflection, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEvidence = db.prepare(
    `INSERT INTO evidence_submissions (id, user_id, task_id, attempt_number, reflection, voice_note, checklist, photo_path, status, client_token, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAnalysis = db.prepare(
    `INSERT INTO ai_analyses (id, evidence_id, observed, interpretation, recommendation, criterion_hits, support_flags, support_recommended, generated_by, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertFeedback = db.prepare(
    `INSERT INTO mentor_feedback (id, evidence_id, mentor_id, draft, sent_message, status, drafted_by, edited_by_mentor, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEvent = db.prepare(
    `INSERT INTO adoption_events (id, user_id, competency_id, stage, attempt_number, detail, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const pw = await hashPassword(DEMO_PASSWORD);

  db.transaction(() => {

    // ---------- People (all simulated) ----------
    const adminId = randomUUID();
    const mentorId = randomUUID();
    const teacherA = randomUUID();
    const teacherB = randomUUID();
    const teacherC = randomUUID();
    insertUser.run(adminId, "admin@classroomloop.demo", "District Admin (Demo)", "admin", pw, null, daysAgo(60));
    insertUser.run(mentorId, "mentor@classroomloop.demo", "CRC Mentor Meena (Demo)", "mentor", pw, null, daysAgo(60));
    insertUser.run(teacherA, "teacher.a@classroomloop.demo", "Teacher A — Sample Data (Multi-grade)", "teacher", pw, mentorId, daysAgo(55));
    insertUser.run(teacherB, "teacher.b@classroomloop.demo", "Teacher B — Sample Data (Early-career)", "teacher", pw, mentorId, daysAgo(55));
    insertUser.run(teacherC, "teacher.c@classroomloop.demo", "Teacher C — Sample Data (Experienced)", "teacher", pw, mentorId, daysAgo(55));
    counts.users = 5;

    // Teacher contexts: personalization uses multiple dimensions (spec §7).
    const ctxA: TeacherContextData = {
      experience_years: 12, grades_taught: [1, 2, 3, 4, 5], subjects: ["All subjects"], class_size: 40,
      multigrade: true, school_context: "Rural single-teacher school; classes often combined", challenges: ["managing multiple grades at once"], confidence: 2,
    };
    const ctxB: TeacherContextData = {
      experience_years: 2, grades_taught: [6, 7], subjects: ["Maths", "Science"], class_size: 58,
      multigrade: false, school_context: "Urban government upper-primary; large classes", challenges: ["large class management"], confidence: 3,
    };
    const ctxC: TeacherContextData = {
      experience_years: 18, grades_taught: [9], subjects: ["Social Science"], class_size: 45,
      multigrade: false, school_context: "Town high school; exam-focused culture", challenges: ["low student participation in discussions"], confidence: 4,
    };
    const insertCtx = (uid: string, c: TeacherContextData) =>
      insertContext.run(uid, c.experience_years, JSON.stringify(c.grades_taught), JSON.stringify(c.subjects),
        c.class_size, c.multigrade ? 1 : 0, c.school_context, JSON.stringify(c.challenges), c.confidence, daysAgo(40));
    insertCtx(teacherA, ctxA);
    insertCtx(teacherB, ctxB);
    insertCtx(teacherC, ctxC);

    // ---------- Competency: Effective Questioning ----------
    const qId = "comp-questioning";
    const qCriteria: Array<[string, string[]]> = [
      ["Asks open-ended questions", ["open", "why", "how", "what do you think", "imagine", "debate"]],
      ["Gives learners response time (wait time)", ["wait time", "pause", "counted", "think first", "silence", "no rush", "two minutes", "seconds"]],
      ["Encourages learners to explain reasoning", ["explain", "reason", "how did you", "because", "justify", "show me", "worked that out"]],
      ["Includes multiple learners", ["pairs", "pair-share", "groups", "everyone", "all students", "called on", "different", "back row", "reluctant", "walked around", "back"]],
      ["Follows up on student answers", ["followed up", "probed", "asked again", "built on", "next question", "extended", "follow-up"]],
    ];
    insertCompetency.run(qId, "Effective Questioning",
      "Ask questions that invite thinking from all learners, give wait time, and respond to student reasoning.",
      daysAgo(50));
    qCriteria.forEach(([label], i) => insertCriterion.run(randomUUID(), qId, label, JSON.stringify(qCriteria[i][1]), i));

    const qModules: Array<[string, string]> = [
      ["Why open questions beat yes/no questions", "A short guide with classroom examples of closed vs open questions."],
      ["Wait time: three seconds that change answers", "Technique card: how pausing after a question increases responses."],
      ["Including the quiet learners", "Ways to involve students who rarely answer: pair-share, cold-call with support."],
    ];
    qModules.forEach(([title, description], i) => insertModule.run(randomUUID(), qId, title, description, i));

    // Training completions: all three teachers completed the module set.
    const moduleIds = (db.prepare(`SELECT id FROM training_modules WHERE competency_id = ? ORDER BY display_order`).all(qId) as Array<{ id: string }>).map((m) => m.id);
    for (const uid of [teacherA, teacherB, teacherC]) {
      for (const mid of moduleIds) insertCompletion.run(uid, mid, daysAgo(42));
    }

    // ---------- Competency checks ----------
    const checkRows = db.prepare(`SELECT label FROM competency_criteria WHERE competency_id = ? ORDER BY display_order`).all(qId) as Array<{ label: string }>;
    const mkAnswers = (hits: number[], picks: number) =>
      JSON.stringify({ items: checkRows.map((c, i) => ({ label: c.label, chosen: picks & (1 << i) ? 2 : hits.includes(i) ? 1 : 0 })), total: checkRows.length * 2 });
    insertResult.run(randomUUID(), teacherA, qId, "passed", 9, mkAnswers([0, 1, 2, 3, 4], 0b11111), daysAgo(39));
    // 9/10 = one criterion marked emerging (1) + four confident (2) — consistent
    // with the app's own pass rule (score/total >= 0.8).
    insertResult.run(randomUUID(), teacherB, qId, "passed", 9, mkAnswers([0], 0b11110), daysAgo(39));
    insertResult.run(randomUUID(), teacherC, qId, "passed", 10, mkAnswers([0, 1, 2, 3, 4], 0b11111), daysAgo(39));

    // ---------- Teacher A: full journey (attempt 1 -> feedback -> retry -> attempt 2) ----------
    const pA1 = localPersonalize({
      teacherName: "Teacher A — Sample Data (Multi-grade)",
      competencyId: qId,
      competencyTitle: "Effective Questioning",
      checkScore: 9,
      context: ctxA,
      history: { priorAttempts: 0, priorEvidence: 0, priorFeedback: 0, priorRetries: 0 },
    });
    const scenarioA = localPracticeScenario({ competencyTitle: "Effective Questioning", context: ctxA });
    const taskA1Id = randomUUID();
    insertTask.run(taskA1Id, teacherA, qId, 1, "completed",
      pA1.title, pA1.activity, scenarioA.scenario, JSON.stringify(scenarioA.choices), scenarioA.recommendedChoice,
      pA1.difficulty, JSON.stringify(pA1.microLearning), pA1.support, pA1.reasoning, "local_engine",
      JSON.stringify({ experience: 12, multigrade: true, confidence: 2 }), daysAgo(35));
    insertPractice.run(randomUUID(), taskA1Id, teacherA, 2, 1,
      "I would try pair-share first so the older students can help the younger ones while I question each group.", daysAgo(33));

    // Evidence attempt 1: solid on open questions + wait time; gaps on inclusion/follow-up.
    const reflectionA1 =
      "Today I tried questioning with my combined class. I asked an open question about why the river water was muddy and told students to think first. " +
      "Some students answered, mostly the older ones from grade 4 and 5. I gave wait time and counted silently to three before picking anyone. " +
      "Two younger students also answered after I asked them to discuss in pairs first. I did not follow up much on their reasoning because the period ended, " +
      "and I still called mostly on students sitting in front.";
    const checklistA1: Record<string, boolean> = {
      "Asks open-ended questions": true,
      "Gives learners response time (wait time)": true,
      "Encourages learners to explain reasoning": false,
      "Includes multiple learners": false,
      "Follows up on student answers": false,
    };
    const evA1 = randomUUID();
    insertEvidence.run(evA1, teacherA, taskA1Id, 1, reflectionA1, null, JSON.stringify(checklistA1), null, "analyzed", "seed-a1", daysAgo(31));
    const analysisA1 = localAnalyzeEvidence({
      reflection: reflectionA1, checklist: checklistA1, voiceNote: null,
      criteria: qCriteria.map(([l]) => l), keywordsByCriterion: Object.fromEntries(qCriteria.map(([l, k]) => [l, k])),
      context: ctxA, history: { priorAttempts: 1, priorEvidence: 1, priorFeedback: 0, priorRetries: 0 },
    });
    insertAnalysis.run(randomUUID(), evA1, JSON.stringify(analysisA1.observed), JSON.stringify(analysisA1.interpretation),
      JSON.stringify(analysisA1.recommendation), JSON.stringify(analysisA1.criterionHits),
      JSON.stringify(analysisA1.supportFlags), analysisA1.supportRecommended ? 1 : 0, "local_engine", daysAgo(31, 2));
    const draftA1 = localDraftFeedback({ analysis: analysisA1, teacherName: "Teacher A — Sample Data (Multi-grade)", competencyTitle: "Effective Questioning" });
    insertFeedback.run(randomUUID(), evA1, mentorId, draftA1, draftA1, "sent", "local_engine", 0, daysAgo(30), daysAgo(30, 3));

    insertEvent.run(randomUUID(), teacherA, qId, "practised", 1, "Practice scenario completed", daysAgo(33));
    insertEvent.run(randomUUID(), teacherA, qId, "attempted", 1, "Applied technique in classroom", daysAgo(31, -2));
    insertEvent.run(randomUUID(), teacherA, qId, "evidence_submitted", 1, "Text reflection submitted", daysAgo(31));
    insertEvent.run(randomUUID(), teacherA, qId, "feedback_received", 1, "Mentor feedback sent", daysAgo(30, 3));

    // Attempt 2 (retry) — evidence shows improvement across all criteria.
    const pA2 = localPersonalize({
      teacherName: "Teacher A — Sample Data (Multi-grade)",
      competencyId: qId,
      competencyTitle: "Effective Questioning",
      checkScore: 9,
      context: ctxA,
      history: { priorAttempts: 1, priorEvidence: 1, priorFeedback: 1, priorRetries: 1 },
    });
    const taskA2Id = randomUUID();
    insertTask.run(taskA2Id, teacherA, qId, 2, "attempted",
      pA2.title, pA2.activity, scenarioA.scenario, JSON.stringify(scenarioA.choices), scenarioA.recommendedChoice,
      pA2.difficulty, JSON.stringify(pA2.microLearning), pA2.support, pA2.reasoning, "local_engine",
      JSON.stringify({ experience: 12, multigrade: true, confidence: 2 }), daysAgo(14));

    const reflectionA2 =
      "Second attempt. I planned three open questions in advance and wrote them on the board. This time I used pair-share for every question, " +
      "so even the grade 1 and 2 students answered through their partners. I gave wait time and then asked two students to explain how they got their answer. " +
      "When one grade 3 student said the plant near the window grew taller because it got more sunlight, I followed up asking how we could check that idea, " +
      "and two groups proposed measuring. Students at the back also answered because I walked around while pairs discussed.";
    const checklistA2: Record<string, boolean> = {
      "Asks open-ended questions": true,
      "Gives learners response time (wait time)": true,
      "Encourages learners to explain reasoning": true,
      "Includes multiple learners": true,
      "Follows up on student answers": true,
    };
    const evA2 = randomUUID();
    insertEvidence.run(evA2, teacherA, taskA2Id, 2, reflectionA2, null, JSON.stringify(checklistA2), null, "analyzed", "seed-a2", daysAgo(10));
    const analysisA2 = localAnalyzeEvidence({
      reflection: reflectionA2, checklist: checklistA2, voiceNote: null,
      criteria: qCriteria.map(([l]) => l), keywordsByCriterion: Object.fromEntries(qCriteria.map(([l, k]) => [l, k])),
      context: ctxA, history: { priorAttempts: 2, priorEvidence: 2, priorFeedback: 2, priorRetries: 1 },
    });
    insertAnalysis.run(randomUUID(), evA2, JSON.stringify(analysisA2.observed), JSON.stringify(analysisA2.interpretation),
      JSON.stringify(analysisA2.recommendation), JSON.stringify(analysisA2.criterionHits),
      JSON.stringify(analysisA2.supportFlags), analysisA2.supportRecommended ? 1 : 0, "local_engine", daysAgo(10, 2));
    const draftA2 = localDraftFeedback({ analysis: analysisA2, teacherName: "Teacher A — Sample Data (Multi-grade)", competencyTitle: "Effective Questioning" });
    insertFeedback.run(randomUUID(), evA2, mentorId, draftA2, draftA2, "sent", "local_engine", 0, daysAgo(9), daysAgo(9, 3));

    insertEvent.run(randomUUID(), teacherA, qId, "retried", 2, "Second attempt after mentor feedback", daysAgo(14));
    insertEvent.run(randomUUID(), teacherA, qId, "evidence_submitted", 2, "Text reflection submitted", daysAgo(10));
    insertEvent.run(randomUUID(), teacherA, qId, "feedback_received", 2, "Mentor feedback sent", daysAgo(9, 3));
    insertEvent.run(randomUUID(), teacherA, qId, "repeated", 2, "Two complete implement-reflect-feedback cycles", daysAgo(9, 4));

    counts.tasks += 2;
    counts.evidence += 2;

    // ---------- Teacher B: early-career, one attempt, feedback draft awaiting mentor ----------
    const pB1 = localPersonalize({
      teacherName: "Teacher B — Sample Data (Early-career)",
      competencyId: qId,
      competencyTitle: "Effective Questioning",
      checkScore: 7,
      context: ctxB,
      history: { priorAttempts: 0, priorEvidence: 0, priorFeedback: 0, priorRetries: 0 },
    });
    const scenarioB = localPracticeScenario({ competencyTitle: "Effective Questioning", context: ctxB });
    const taskB1Id = randomUUID();
    insertTask.run(taskB1Id, teacherB, qId, 1, "completed",
      pB1.title, pB1.activity, scenarioB.scenario, JSON.stringify(scenarioB.choices), scenarioB.recommendedChoice,
      pB1.difficulty, JSON.stringify(pB1.microLearning), pB1.support, pB1.reasoning, "local_engine",
      JSON.stringify({ experience: 2, class_size: 58 }), daysAgo(20));
    insertPractice.run(randomUUID(), taskB1Id, teacherB, 0, 0,
      "I picked asking more students directly, but pair-share seems better with 58 students.", daysAgo(18));

    const reflectionB1 =
      "I tried to ask questions during the maths period. Class 7 has 58 students so it was noisy. I asked if everyone understood and most said yes. " +
      "I did not get time to wait for answers because we had to finish the exercise. I think I asked mostly yes or no questions. Next time I want to try " +
      "asking fewer questions but better ones.";
    const checklistB1: Record<string, boolean> = {
      "Asks open-ended questions": false,
      "Gives learners response time (wait time)": false,
      "Encourages learners to explain reasoning": false,
      "Includes multiple learners": false,
      "Follows up on student answers": false,
    };
    const evB1 = randomUUID();
    insertEvidence.run(evB1, teacherB, taskB1Id, 1, reflectionB1, null, JSON.stringify(checklistB1), null, "analyzed", "seed-b1", daysAgo(16));
    const analysisB1 = localAnalyzeEvidence({
      reflection: reflectionB1, checklist: checklistB1, voiceNote: null,
      criteria: qCriteria.map(([l]) => l), keywordsByCriterion: Object.fromEntries(qCriteria.map(([l, k]) => [l, k])),
      context: ctxB, history: { priorAttempts: 1, priorEvidence: 1, priorFeedback: 0, priorRetries: 0 },
    });
    insertAnalysis.run(randomUUID(), evB1, JSON.stringify(analysisB1.observed), JSON.stringify(analysisB1.interpretation),
      JSON.stringify(analysisB1.recommendation), JSON.stringify(analysisB1.criterionHits),
      JSON.stringify(analysisB1.supportFlags), analysisB1.supportRecommended ? 1 : 0, "local_engine", daysAgo(16, 2));
    // Drafted but NOT sent — gives the mentor demo a live review item.
    const draftB1 = localDraftFeedback({ analysis: analysisB1, teacherName: "Teacher B — Sample Data (Early-career)", competencyTitle: "Effective Questioning" });
    insertFeedback.run(randomUUID(), evB1, mentorId, draftB1, null, "drafted", "local_engine", 0, daysAgo(16, 2), null);

    insertEvent.run(randomUUID(), teacherB, qId, "practised", 1, "Practice scenario completed", daysAgo(18));
    insertEvent.run(randomUUID(), teacherB, qId, "attempted", 1, "Applied technique in classroom", daysAgo(16, -1));
    insertEvent.run(randomUUID(), teacherB, qId, "evidence_submitted", 1, "Text reflection submitted", daysAgo(16));
    // No feedback_received event: B's AI draft is deliberately awaiting the mentor's live decision.

    counts.tasks += 1;
    counts.evidence += 1;

    // ---------- Teacher C: experienced, one strong attempt, feedback sent ----------
    const pC1 = localPersonalize({
      teacherName: "Teacher C — Sample Data (Experienced)",
      competencyId: qId,
      competencyTitle: "Effective Questioning",
      checkScore: 10,
      context: ctxC,
      history: { priorAttempts: 0, priorEvidence: 0, priorFeedback: 0, priorRetries: 0 },
    });
    const scenarioC = localPracticeScenario({ competencyTitle: "Effective Questioning", context: ctxC });
    const taskC1Id = randomUUID();
    insertTask.run(taskC1Id, teacherC, qId, 1, "completed",
      pC1.title, pC1.activity, scenarioC.scenario, JSON.stringify(scenarioC.choices), scenarioC.recommendedChoice,
      pC1.difficulty, JSON.stringify(pC1.microLearning), pC1.support, pC1.reasoning, "local_engine",
      JSON.stringify({ experience: 18, confidence: 4 }), daysAgo(26));
    insertPractice.run(randomUUID(), taskC1Id, teacherC, 1, 1,
      "With senior students I would ask for written responses first, then discuss the best ones.", daysAgo(24));

    const reflectionC1 =
      "I began the chapter with a debate-style open question and gave students two minutes to write before answering. I called on students from different rows " +
      "and asked three of them to justify their position. When one student gave a one-line answer I probed with a follow-up and the class added evidence. " +
      "Participation was better than usual; four students who never speak contributed.";
    const checklistC1: Record<string, boolean> = {
      "Asks open-ended questions": true,
      "Gives learners response time (wait time)": true,
      "Encourages learners to explain reasoning": true,
      "Includes multiple learners": true,
      "Follows up on student answers": true,
    };
    const evC1 = randomUUID();
    insertEvidence.run(evC1, teacherC, taskC1Id, 1, reflectionC1, null, JSON.stringify(checklistC1), null, "analyzed", "seed-c1", daysAgo(21));
    const analysisC1 = localAnalyzeEvidence({
      reflection: reflectionC1, checklist: checklistC1, voiceNote: null,
      criteria: qCriteria.map(([l]) => l), keywordsByCriterion: Object.fromEntries(qCriteria.map(([l, k]) => [l, k])),
      context: ctxC, history: { priorAttempts: 1, priorEvidence: 1, priorFeedback: 0, priorRetries: 0 },
    });
    insertAnalysis.run(randomUUID(), evC1, JSON.stringify(analysisC1.observed), JSON.stringify(analysisC1.interpretation),
      JSON.stringify(analysisC1.recommendation), JSON.stringify(analysisC1.criterionHits),
      JSON.stringify(analysisC1.supportFlags), analysisC1.supportRecommended ? 1 : 0, "local_engine", daysAgo(21, 2));
    const draftC1 = localDraftFeedback({ analysis: analysisC1, teacherName: "Teacher C — Sample Data (Experienced)", competencyTitle: "Effective Questioning" });
    insertFeedback.run(randomUUID(), evC1, mentorId, draftC1, draftC1, "sent", "local_engine", 0, daysAgo(20), daysAgo(20, 3));

    insertEvent.run(randomUUID(), teacherC, qId, "practised", 1, "Practice scenario completed", daysAgo(24));
    insertEvent.run(randomUUID(), teacherC, qId, "attempted", 1, "Applied technique in classroom", daysAgo(21, -1));
    insertEvent.run(randomUUID(), teacherC, qId, "evidence_submitted", 1, "Text reflection submitted", daysAgo(21));
    insertEvent.run(randomUUID(), teacherC, qId, "feedback_received", 1, "Mentor feedback sent", daysAgo(20, 3));

    counts.tasks += 1;
    counts.evidence += 1;
  })();

  return counts;
}

// CLI entry: `npm run db:seed`
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("seed.ts")) {
  void seedDemoData().then((counts) =>
    console.log(
      `Seeded demo data (SIMULATED — sample persons, not real people): ` +
        `${counts.users} users, ${counts.tasks} tasks, ${counts.evidence} evidence submissions.`
    )
  );
}
