import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, getAuth, handleRoute, parseJsonBody, requireAuth, requireRole } from "@/lib/api";
import {
  competencyCheckSchema,
  contextSchema,
  evidenceSchema,
  feedbackSchema,
  generateTaskSchema,
  loginSchema,
  practiceSessionSchema,
  retrySchema,
} from "@/lib/validation";
import { createSessionToken } from "@/lib/jwt";
import type { SessionUser } from "@/lib/jwt";

/* ---------------- Zod request schemas ---------------- */

describe("zod request schemas", () => {
  it("loginSchema trims + lowercases the email and requires a password", () => {
    expect(loginSchema.parse({ email: "  Teacher@ClassroomLoop.DEMO \n", password: "demo1234" })).toEqual({
      email: "teacher@classroomloop.demo",
      password: "demo1234",
    });
    expect(() => loginSchema.parse({ email: "not-an-email", password: "x" })).toThrowError(z.ZodError);
    expect(() => loginSchema.parse({ email: "a@b.c", password: "" })).toThrowError(z.ZodError);
  });

  it("contextSchema bounds experience, grades, class size and confidence", () => {
    const valid = {
      experience_years: 6, grades_taught: [1, 7], subjects: ["Math"], class_size: 48,
      multigrade: true, school_context: "rural", challenges: ["time"], confidence: 3,
    };
    expect(contextSchema.parse(valid)).toEqual(valid);
    expect(() => contextSchema.parse({ ...valid, experience_years: -1 })).toThrowError(z.ZodError);
    expect(() => contextSchema.parse({ ...valid, grades_taught: [13] })).toThrowError(z.ZodError);
    expect(() => contextSchema.parse({ ...valid, class_size: 0 })).toThrowError(z.ZodError);
    expect(() => contextSchema.parse({ ...valid, confidence: 6 })).toThrowError(z.ZodError);
    expect(() => contextSchema.parse({ ...valid, class_size: 48.5 })).toThrowError(z.ZodError);
  });

  it("competencyCheckSchema requires competency_id and 0..2 integer answers", () => {
    expect(competencyCheckSchema.parse({ competency_id: "comp-questioning", answers: { "q": 2 } })).toBeTruthy();
    expect(() => competencyCheckSchema.parse({ competency_id: "", answers: {} })).toThrowError(z.ZodError);
    expect(() => competencyCheckSchema.parse({ competency_id: "c", answers: { q: 3 } })).toThrowError(z.ZodError);
    expect(() => competencyCheckSchema.parse({ competency_id: "c", answers: { q: 1.5 } })).toThrowError(z.ZodError);
  });

  it("generateTaskSchema and retrySchema accept optional fields only as specified", () => {
    expect(generateTaskSchema.parse({ competency_id: "c", force_new: true })).toBeTruthy();
    expect(() => generateTaskSchema.parse({ competency_id: "c", force_new: "yes" })).toThrowError(z.ZodError);
    expect(retrySchema.parse({ competency_id: "c", note: "after feedback" })).toBeTruthy();
    expect(() => retrySchema.parse({ competency_id: "c", note: "x".repeat(501) })).toThrowError(z.ZodError);
  });

  it("practiceSessionSchema bounds the chosen option", () => {
    expect(practiceSessionSchema.parse({ task_id: "t", chosen_option: 2 })).toBeTruthy();
    expect(() => practiceSessionSchema.parse({ task_id: "t", chosen_option: -1 })).toThrowError(z.ZodError);
    expect(() => practiceSessionSchema.parse({ task_id: "t", chosen_option: 10 })).toThrowError(z.ZodError);
  });

  it("evidenceSchema requires a reflection, boolean checklist and allows offline fields", () => {
    const valid = { task_id: "t", reflection: "I asked why-questions", checklist: { a: true } };
    expect(evidenceSchema.parse(valid)).toBeTruthy();
    expect(() => evidenceSchema.parse({ ...valid, reflection: "   " })).toThrowError(z.ZodError);
    expect(() => evidenceSchema.parse({ ...valid, checklist: { a: "yes" } })).toThrowError(z.ZodError);
    expect(evidenceSchema.parse({ ...valid, voice_note: null, photo_path: null })).toBeTruthy();
  });

  it("feedbackSchema accepts exactly the two human-in-the-loop actions", () => {
    expect(feedbackSchema.parse({ evidence_id: "e", message: "Good attempt", action: "save_draft" })).toBeTruthy();
    expect(feedbackSchema.parse({ evidence_id: "e", message: "Good attempt", action: "approve_send", edited_by_mentor: true })).toBeTruthy();
    expect(() => feedbackSchema.parse({ evidence_id: "e", message: "m", action: "auto_send" })).toThrowError(z.ZodError);
    expect(() => feedbackSchema.parse({ evidence_id: "e", message: "", action: "save_draft" })).toThrowError(z.ZodError);
  });
});

/* ---------------- parseJsonBody ---------------- */

describe("parseJsonBody", () => {
  it("passes valid JSON through", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST", body: '{"a":1}', headers: { "content-type": "application/json" } });
    await expect(parseJsonBody(req)).resolves.toEqual({ a: 1 });
  });

  it("maps a malformed body to ApiError 400 bad_json", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST", body: "{not json" });
    const err = await parseJsonBody(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).code).toBe("bad_json");
  });
});

/* ---------------- handleRoute error mapping ---------------- */

describe("handleRoute", () => {
  it("passes successful responses through untouched", async () => {
    const res = await handleRoute(async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("maps ApiError to its status and machine-readable code", async () => {
    const res = await handleRoute(async () => {
      throw new ApiError(404, "Task not found", "not_found");
    });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Task not found", code: "not_found" });
  });

  it("maps ZodError to 400 validation_error with a field-level message", async () => {
    const res = await handleRoute(async () => {
      loginSchema.parse({ email: "nope", password: "" });
      return NextResponse.json({});
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("validation_error");
    expect(body.error).toContain("email");
  });

  it("never leaks unknown errors — logs internally, returns a stable retry message", async () => {
    const logged: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
    try {
      const res = await handleRoute(async () => {
        throw new Error("secret db connection string");
      });
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Something went wrong on our side. Please retry.",
        code: "internal",
      });
      expect(logged).toHaveLength(1); // the real cause stays in the server log only
      expect(String(logged[0])).toContain("secret db connection string");
    } finally {
      spy.mockRestore();
    }
  });
});

/* ---------------- Session auth guards ---------------- */

const TEACHER: SessionUser = { id: "u-1", email: "teacher@classroomloop.demo", name: "Teacher One", role: "teacher" };
const MENTOR: SessionUser = { id: "u-2", email: "mentor@classroomloop.demo", name: "Mentor One", role: "mentor" };

async function requestWithCookie(user: SessionUser | null): Promise<Request> {
  if (!user) return new Request("http://localhost/api/x");
  const token = await createSessionToken(user);
  return new Request("http://localhost/api/x", {
    headers: { cookie: `cl_session=${encodeURIComponent(token)}` },
  });
}

describe("session auth guards", () => {
  it("getAuth resolves a valid session cookie and rejects a tampered one", async () => {
    const auth = await getAuth(await requestWithCookie(TEACHER));
    expect(auth).toMatchObject({ id: "u-1", role: "teacher" });

    const tampered = new Request("http://localhost/api/x", {
      headers: { cookie: "cl_session=not.a.jwt" },
    });
    await expect(getAuth(tampered)).resolves.toBeNull();
    await expect(getAuth(new Request("http://localhost/api/x"))).resolves.toBeNull();
  });

  it("requireAuth throws 401 unauthorized without a session", async () => {
    const err = await requireAuth(await requestWithCookie(null)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).code).toBe("unauthorized");
  });

  it("requireRole allows a listed role and throws 403 forbidden otherwise", async () => {
    const mentorReq = await requestWithCookie(MENTOR);
    await expect(requireRole(mentorReq, "mentor", "admin")).resolves.toMatchObject({ id: "u-2" });

    const teacherReq = await requestWithCookie(TEACHER);
    const err = await requireRole(teacherReq, "mentor", "admin").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).code).toBe("forbidden");
  });

  it("requireRole also demands authentication first (no cookie → 401, not 403)", async () => {
    const err = await requireRole(await requestWithCookie(null), "admin").catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(401);
  });

  it("a rejected route surfaces its guard error through handleRoute untouched", async () => {
    const res = await handleRoute(async () => requireRole(await requestWithCookie(TEACHER), "admin").then(() => NextResponse.json({ ok: true })));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Not allowed for your role", code: "forbidden" });
  });
});
