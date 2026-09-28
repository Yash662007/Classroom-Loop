# CLASSROOM LOOP — ULTIMATE SINGLE MASTER EXECUTION PROMPT

You are the **principal product architect, senior full-stack engineer, AI/ML engineer, frontend engineer, backend engineer, mobile UX engineer, database engineer, security engineer, performance engineer, DevOps engineer, QA engineer, UX/UI designer, and technical reviewer** for the existing CLASSROOM LOOP project.

Your job is to take the CURRENT REPOSITORY from its current state to the **best realistic, working, polished, secure, mobile-first, AI-centric, hackathon-ready MVP possible**.

Do NOT treat this as a request to simply write more code.

Your complete responsibility is:

**INSPECT → UNDERSTAND → AUDIT → PLAN → IMPLEMENT → INTEGRATE → DEBUG → OPTIMIZE → TEST → RE-AUDIT → POLISH → VERIFY → REPORT**

Do not stop after one stage.

Do not repeatedly ask me to explain requirements already defined in this prompt.

Use the existing repository as the source of truth for the current implementation.

Preserve good existing work.

Replace broken work where necessary.

Do not rewrite the entire project without a technical reason.

Do not add unrelated features.

---

# GOAL 1 — UNDERSTAND THE PRODUCT

## Product

**CLASSROOM LOOP**

## Subtitle

**From Teacher Training to Classroom Practice**

## Positioning

> An AI-powered implementation and coaching layer that follows teacher training into the classroom and makes practice, evidence, feedback, retry, and adoption measurable.

## Specific problem

The product focuses on:

> **Closing the gap between teacher training and actual classroom implementation.**

The key question is:

> **"After a teacher completes training, did that training actually become classroom practice?"**

The product should transform:

**TRAINING COMPLETION**

into a measurable journey:

**TRAIN → UNDERSTAND → PERSONALIZE → PRACTISE → APPLY → EVIDENCE → AI ANALYSIS → MENTOR REVIEW → FEEDBACK → RETRY → ADOPT**

This is the central product identity.

---

# GOAL 2 — KEEP THE PRODUCT FOCUSED

CLASSROOM LOOP is NOT:

* another LMS
* another course platform
* another teacher-training app
* a generic AI chatbot
* a teacher social network
* a teacher marketplace
* a teacher ranking system
* a teacher-quality scoring system
* an AI replacement for mentors
* a student surveillance system
* a national education ERP
* an unrelated analytics platform

Do not build features merely because they sound impressive.

Before adding a feature ask:

> **Does this strengthen the teacher implementation loop?**

If not, do not prioritize it.

Existing teacher-training systems such as DIKSHA should be treated as infrastructure that the product can complement rather than unnecessarily replace.

Do not claim existing systems are ineffective.

---

# GOAL 3 — FULL REPOSITORY AUDIT FIRST

Before making major changes, inspect the entire repository.

Inspect:

## Frontend

* framework
* routes
* pages
* components
* state management
* API integration
* styling
* responsive design
* accessibility
* loading states
* error states
* empty states
* offline UI
* performance
* duplicated code
* unused code
* unused dependencies

## Backend

* framework
* routes
* services
* database
* authentication
* authorization
* validation
* AI integration
* media handling
* offline synchronization
* error handling
* logs

## Database

* schema
* migrations
* models
* relationships
* constraints
* indexes
* queries
* data integrity

## AI

* providers
* models
* prompts
* context
* structured output
* parsing
* retries
* timeout handling
* fallback
* token usage
* privacy

## Infrastructure

* environment variables
* secrets
* `.env`
* `.env.example`
* `.gitignore`
* CORS
* storage
* build configuration
* deployment configuration

## Existing project state

Determine:

**WHAT WORKS**

**WHAT IS BROKEN**

**WHAT IS PARTIAL**

**WHAT IS MOCKED**

**WHAT IS MISSING**

**WHAT IS UNUSED**

**WHAT IS UNVERIFIED**

Do not assume a feature works because a page or function exists.

---

# GOAL 4 — CREATE THE CORE REQUIREMENTS MATRIX

Compare the repository against:

## Product

* Teacher
* Mentor
* Admin
* Implementation loop
* Implementation history
* Retry
* Adoption
* Analytics

## AI

* personalization
* practice generation
* evidence intelligence
* support detection
* feedback drafting
* structured output
* human approval

## Evidence

* text
* voice
* checklist
* photo
* optional video
* persistence
* upload
* compression

## Mobile

* mobile navigation
* touch UX
* camera
* microphone
* mobile forms
* responsive layout
* low-bandwidth behavior
* offline
* sync
* recovery

## Pipeline

* states
* events
* branching
* retry
* AI gates
* mentor gates
* adoption
* event history

## Security

* authentication
* authorization
* validation
* upload security
* secrets
* privacy

## Quality

* build
* lint
* type-check
* unit tests
* API tests
* integration tests
* mobile tests
* offline tests

Classify each requirement:

**✅ COMPLETE**

**⚠️ PARTIAL**

**❌ MISSING**

**🐞 BROKEN**

**🧪 UNVERIFIED**

---

# GOAL 5 — BUILD THE CORE END-TO-END JOURNEY

The highest-priority functionality is:

## Teacher A

**Login**

↓

**Dashboard**

↓

**Training Complete**

↓

**Competency**

↓

**Teacher Context**

↓

**AI Personalized Action**

↓

**Practice Scenario**

↓

**Classroom Action**

↓

**Evidence Submission**

↓

**AI Analysis**

↓

**Mentor Review**

↓

**Mentor Feedback**

↓

**Retry**

↓

**Implementation History**

↓

**Adoption Update**

↓

**Admin Analytics**

This must work with actual application logic.

No manually editing database records between steps.

No fake dashboard values.

No fake AI results for the core workflow unless clearly marked as simulation.

---

# GOAL 6 — BUILD THE COMPLEX IMPLEMENTATION PIPELINE ENGINE

The implementation loop is a REAL workflow engine.

Do not manage it with scattered frontend booleans.

Use a centralized state-driven model.

Possible states:

```text
NOT_STARTED
TRAINING_COMPLETE
CONTEXT_READY
ACTION_ASSIGNED
PRACTICE_PENDING
PRACTICE_COMPLETE
CLASSROOM_ATTEMPT_PENDING
CLASSROOM_ATTEMPT_RECORDED
EVIDENCE_PENDING
EVIDENCE_SUBMITTED
AI_ANALYSIS_PENDING
AI_ANALYSIS_COMPLETE
MENTOR_REVIEW_PENDING
MENTOR_REVIEWED
FEEDBACK_SENT
RETRY_REQUIRED
RETRY_IN_PROGRESS
RETRY_COMPLETED
REPEATED_IMPLEMENTATION
SUSTAINED_ADOPTION
SUPPORT_REQUIRED
SYNC_PENDING
SYNC_FAILED
```

Adapt this to the existing architecture if a better equivalent exists.

## Pipeline must support

* sequential stages
* branching
* retry loops
* support interventions
* AI gates
* mentor gates
* offline states
* synchronization
* recovery
* historical traceability

---

# GOAL 7 — IMPLEMENT PIPELINE EVENTS

Record meaningful events such as:

```text
TrainingCompleted
ContextUpdated
ActionGenerated
PracticeStarted
PracticeCompleted
ClassroomAttemptCreated
EvidenceSaved
EvidenceUploaded
AIAnalysisStarted
AIAnalysisCompleted
MentorReviewStarted
MentorFeedbackSent
RetryRequested
RetryCompleted
SupportRequested
AdoptionEventCreated
SyncQueued
SyncCompleted
```

Use:

**CURRENT STATE + EVENT HISTORY**

The current state alone must not be the only record.

---

# GOAL 8 — SUPPORT MULTIPLE ATTEMPTS

A teacher can attempt the same competency multiple times.

Never overwrite previous attempts.

Structure:

```text
Competency
├── Attempt #1
│   ├── Practice
│   ├── Classroom Attempt
│   ├── Evidence
│   ├── AI Analysis
│   └── Mentor Feedback
│
├── Attempt #2
│   ├── Practice
│   ├── Evidence
│   ├── AI Analysis
│   └── Mentor Feedback
│
└── Attempt #3
    ├── Evidence
    ├── AI Analysis
    └── Adoption
```

Retry is not a failure state.

The UX should communicate:

> **Try again with one focused improvement**

not:

> **You failed**

---

# GOAL 9 — BUILD THE AI INTELLIGENCE LAYER

AI must be central to the real workflow.

Do not create an AI chatbot and call the project AI-powered.

Implement at least:

## AI Capability 1 — Context-Aware Personalization

Use:

* experience
* grades
* subject
* class size
* school context
* single/multi-grade context
* competency
* competency result
* previous attempts
* evidence
* mentor feedback
* support needs

Generate:

* implementation action
* practice scenario
* difficulty
* micro-learning
* support recommendation

Core model:

**Experience + Context + Competency + Need**

Do not give every teacher the same action.

---

# GOAL 10 — ADD "WHY THIS RECOMMENDATION?"

Every important AI recommendation should have a concise explanation.

Example:

```text
Why this recommendation?

✓ Your competency result
✓ Your previous classroom attempt
✓ Your classroom context
✓ Your reported difficulty
```

Do not expose hidden chain-of-thought.

Only show concise user-relevant factors used for the recommendation.

---

# GOAL 11 — BUILD ADAPTIVE PRACTICE

Create a practice simulator connected to a competency rubric.

Example:

```text
CLASSROOM SCENARIO

Three students answer immediately.
Most students remain silent.

What would you do next?

[ Give thinking time ]
[ Pair students ]
[ Ask another question ]
[ Call on the same students ]
```

Practice must require reasoning or action.

Do not turn practice into another reading/course page.

---

# GOAL 12 — ADAPTIVE DIFFICULTY

Practice difficulty can increase when appropriate:

**Attempt 1**

Basic scenario

↓

**Attempt 2**

Mixed learning levels

↓

**Attempt 3**

Multi-grade + limited time

Use:

**Previous Attempt + Competency + Context + Support Need**

Do not artificially increase difficulty without reason.

---

# GOAL 13 — BUILD COMPETENCY RUBRICS

AI should not operate as an unrestricted judge.

Create structured competency rubrics.

Example:

### Effective Questioning

Possible criteria:

* asks open-ended questions
* gives response time
* encourages explanation
* includes multiple learners
* follows up on reasoning

Use:

**RUBRIC → AI INTERPRETATION → STRUCTURED OUTPUT → MENTOR REVIEW**

---

# GOAL 14 — BUILD AI EVIDENCE INTELLIGENCE

Evidence may contain:

* text reflection
* voice reflection
* checklist
* photo
* optional short video

Process:

**Evidence → Processing → Competency Signals → Summary → Recommendation**

Output:

### What appears to have happened

### Strength

### Possible gap

### Suggested next step

Always distinguish:

**Evidence**

from

**AI Interpretation**

from

**Recommendation**

Label it:

**AI-assisted insight**

Do not present inference as verified fact.

---

# GOAL 15 — BUILD EVIDENCE QUALITY ASSISTANT

Before submission, identify genuinely missing information.

Example:

```text
EVIDENCE CHECK

✓ Technique attempted
✓ Classroom context

Missing:
What happened after you tried it?

[ Add a short reflection ]
```

Do not reject evidence unnecessarily.

Explain why additional information is useful.

---

# GOAL 16 — BUILD VOICE-FIRST MOBILE EXPERIENCE

Because the application will be used on mobile, voice should be a major input method.

Flow:

**Tap → Speak → Save → Speech-to-Text → AI Analysis**

Support:

* microphone permission
* recording state
* timer
* stop
* playback
* retry
* local save
* sync
* error recovery

Use voice for:

* reflections
* implementation summaries
* support requests

Do not continuously record.

Do not retain unnecessary recordings indefinitely.

---

# GOAL 17 — BUILD MOBILE CAMERA EVIDENCE

Allow optional camera/gallery evidence.

Possible evidence:

* student work
* worksheet
* teaching material
* classroom artifact

Provide:

* camera
* gallery
* preview
* retake
* crop where useful
* compression
* upload
* offline save
* sync state

Avoid unnecessary student-identifying content.

Do not require video.

---

# GOAL 18 — MOBILE-FIRST APPLICATION

Mobile is a **first-class platform**, not simply a responsive desktop page.

Teacher experience must be optimized primarily for:

* smartphone
* touch
* one-hand use
* small screens
* low bandwidth
* inconsistent connectivity
* limited RAM
* camera
* microphone

Mentor/Admin may have desktop-oriented layouts but must remain usable on mobile/tablet.

Do NOT simply shrink desktop UI.

---

# GOAL 19 — MOBILE NAVIGATION

Use a deliberate mobile navigation strategy.

Recommended Teacher navigation:

```text
Home
Practice
Evidence
Feedback
Progress
```

Secondary items:

**More / Profile / Settings**

Use either:

* bottom navigation
* compact top bar + drawer
* another strong mobile pattern

Do not show a compressed desktop sidebar.

---

# GOAL 20 — MOBILE PIPELINE UX

On mobile use a vertical pipeline:

```text
✓ Training complete
│
✓ Context understood
│
✓ Action generated
│
✓ Practice complete
│
● Classroom attempt
│
○ Evidence
│
○ AI insight
│
○ Mentor review
│
○ Feedback
│
○ Retry
│
○ Adoption
```

The current stage expands.

Future stages stay compact.

Completed stages can expand.

Never force the full complex workflow into one crowded mobile screen.

---

# GOAL 21 — SIMPLE USER EXPERIENCE OVER COMPLEX ENGINE

The backend may contain:

* many states
* events
* branches
* AI jobs
* mentor gates
* synchronization
* retries

The teacher should see:

**What is happening now?**

**Why?**

**What should I do next?**

**What happened before?**

Complexity belongs underneath the UX.

---

# GOAL 22 — OFFLINE-FIRST MOBILE EXPERIENCE

Teacher must be able to continue important work during poor connectivity.

Support:

* opening previously synced tasks
* practice
* text reflection
* voice recording
* evidence capture
* local saving
* queued submission

Architecture:

**LOCAL SAVE**
→
**SYNC QUEUE**
→
**NETWORK RESTORED**
→
**SERVER**
→
**CONFIRMATION**
→
**UPDATED PIPELINE**

Show:

**Saved on device**

**Waiting to sync**

**Syncing**

**Synced**

**Sync failed — Retry**

Never silently lose evidence.

---

# GOAL 23 — LOW-BANDWIDTH MODE

Where practical, implement Data Saver behavior:

* compress media
* minimize unnecessary API requests
* avoid autoplay
* delay large uploads
* prioritize critical requests
* use cached content
* keep payloads small

Optimize for unstable mobile networks.

---

# GOAL 24 — SAFE SYNCHRONIZATION

Important operations must be idempotent.

Prevent:

* duplicate evidence
* duplicate retries
* duplicate events
* duplicate mentor feedback

Use appropriate:

* unique IDs
* event IDs
* idempotency keys
* database constraints

The exact approach should follow the existing architecture.

---

# GOAL 25 — MOBILE FAILURE RECOVERY

Test and support:

### Browser closes during upload

Resume/retry.

### Network lost

Evidence remains saved.

### Camera permission denied

Give fallback to gallery or another evidence type.

### Microphone denied

Allow text reflection.

### AI unavailable

Evidence remains safe and analysis can retry.

### Sync fails

Keep the local record and retry.

Never reset the journey because one operation failed.

---

# GOAL 26 — PWA WHERE APPROPRIATE

If web-based and technically suitable, implement:

* manifest
* installability
* application icon
* service worker
* cached shell
* offline state
* update handling

Clearly distinguish:

**Offline-capable**

from

**Network-required**

Do not claim complete offline functionality if AI/server operations still require connectivity.

---

# GOAL 27 — SMART NEXT STEP ENGINE

The main teacher dashboard should answer:

> **What should I do today?**

Example:

```text
YOUR NEXT CLASSROOM STEP

Effective Questioning

Try:
Use one open-ended question and give
students structured response time.

Why this step?

• Practice is complete.
• Last attempt showed a participation difficulty.
• This matches the classroom context.

~10 minutes

[ Practise Now ]
```

Recommendations should adapt to the teacher.

---

# GOAL 28 — RETRY COACH

After feedback:

```text
YOUR RETRY PLAN

Previous attempt:
Only a few students responded.

Focus:
Give students thinking time first.

Try:
Think → Pair → Share

[ Start Retry ]
```

Connect retry directly to:

* previous attempt
* AI insight
* mentor feedback

---

# GOAL 29 — "WHAT CHANGED?" COMPARISON

After retry, compare attempts.

Example:

```text
WHAT CHANGED?

ATTEMPT 1
• Open-ended question
• Few students responded

ATTEMPT 2
• Open-ended question
• Think-pair-share added
• Teacher reported broader participation

MENTOR NOTE
Keep the pair discussion strategy.
```

Do not present self-reported change as objective measurement.

Use wording such as:

> Teacher reported...

when appropriate.

---

# GOAL 30 — MICRO-LEARNING INTERVENTIONS

When support is needed, provide small targeted interventions.

Example:

```text
5-MINUTE SUPPORT

Watch — 2 min
Practise — 2 min
Reflect — 1 min
```

Do not automatically send teachers to a large course.

---

# GOAL 31 — TEACHER SUPPORT REQUEST

Add:

**Need Help?**

Possible choices:

```text
I don't understand the technique
I can't practise it
I tried it in class
I need mentor support
Something else
```

Store the request.

Use it as a support signal.

---

# GOAL 32 — MENTOR CO-PILOT

Mentors should receive AI assistance.

Example:

```text
TEACHER A

AI SUMMARY

Attempt:
Effective Questioning

Strength:
Encouraged explanations.

Possible support need:
Increase participation from quieter learners.

Suggested feedback:
Try a short pair discussion before whole-class responses.

[ Edit ]
[ Approve ]
[ Request Retry ]
```

Mentor is always the final authority.

---

# GOAL 33 — MENTOR PRIORITY QUEUE

Focus mentor attention on actionable signals.

Show:

```text
Needs Support
Retry Recommended
Evidence Pending
On Track
```

Prioritize using transparent signals:

* no classroom attempt
* evidence pending
* repeated difficulty
* support request
* mentor review pending

Never create:

**bad teacher**

or:

**AI quality ranking**

---

# GOAL 34 — MENTOR REVIEW GATE

Implement:

**AI Analysis**
↓
**Mentor Review Required**
↓
**Approve / Edit / Reject / Request More Evidence / Request Retry**
↓
**Feedback Released**

Store mentor decisions.

The mentor must be able to override AI.

---

# GOAL 35 — ADMIN ANALYTICS

Build system-level analytics.

Required views:

### Funnel

**Training → Practice → Evidence → Feedback → Retry → Adoption**

### Drop-Off

Where implementation stops.

### Support

Where teachers need help.

### Competency

Where implementation difficulty appears.

### Adoption

Where practices are being repeatedly attempted.

Do not create teacher leaderboards.

Do not rank teachers.

Use actual database data.

Clearly label simulated values:

**DEMO DATA**

---

# GOAL 36 — IMPLEMENTATION HISTORY

Create a universal traceable timeline:

```text
Training
↓
Practice
↓
Classroom Attempt
↓
Evidence
↓
AI Analysis
↓
Mentor Feedback
↓
Retry
↓
Repeated Implementation
↓
Adoption
```

Include timestamps where available.

Mentor/admin should be able to inspect history.

---

# GOAL 37 — "MY GROWTH" TEACHER EXPERIENCE

Create a personal implementation view showing:

* What I learned
* What I tried
* What happened
* What my mentor suggested
* What I changed
* What I should try next

This should feel like a coaching journey, not a course report.

---

# GOAL 38 — PIPELINE HEALTH + AI JOB PROCESSING

For complex asynchronous operations, support job states.

Example:

**Evidence → Queued → Processing → Completed**

If AI fails:

```text
Analysis unavailable

Your evidence is safe.

[ Retry Analysis ]
```

Create internal/admin diagnostics for:

* AI queue
* evidence sync
* mentor review queue
* database
* storage

Do not expose technical diagnostics to teachers.

---

# GOAL 39 — AUDIT TRAIL

Store meaningful decisions:

```text
AI recommendation generated
Mentor reviewed
Mentor edited
Mentor approved
Feedback sent
Teacher started retry
Adoption event recorded
```

This supports:

* trust
* debugging
* auditability
* support
* analytics

---

# GOAL 40 — DATA MODEL

Use or adapt entities such as:

```text
users
teachers
mentors
competencies
training_modules
competency_results
implementation_journeys
implementation_stages
implementation_attempts
practice_sessions
evidence_submissions
ai_analyses
mentor_reviews
mentor_feedback
support_actions
retry_attempts
adoption_events
pipeline_events
sync_jobs
```

Do not force everything into one large table.

Preserve previous attempts.

Use appropriate relationships and constraints.

---

# GOAL 41 — FRONTEND ARCHITECTURE

Use or adapt a clean structure:

```text
src/
├── app/
│   ├── login/
│   ├── teacher/
│   ├── mentor/
│   └── admin/
├── components/
│   ├── layout/
│   ├── ui/
│   ├── implementation/
│   ├── practice/
│   ├── evidence/
│   ├── ai/
│   ├── mentor/
│   └── analytics/
├── hooks/
├── services/
├── stores/
├── types/
├── utils/
├── lib/
└── styles/
```

Preserve a better existing structure if one already exists.

---

# GOAL 42 — BACKEND ARCHITECTURE

Prefer separation such as:

**API → Service → Data Layer**

Organize where appropriate:

```text
backend/
└── app/
    ├── api/
    ├── models/
    ├── schemas/
    ├── services/
    │   ├── ai/
    │   ├── evidence/
    │   ├── recommendations/
    │   ├── pipeline/
    │   └── analytics/
    ├── auth/
    ├── db/
    └── core/
```

Do not put all business logic inside route handlers.

---

# GOAL 43 — API INTEGRATION

Ensure real integration for:

```text
/auth
/teacher
/competencies
/implementation
/practice
/evidence
/ai
/mentor
/retry
/analytics
/sync
```

Adapt endpoint naming to the existing application.

Frontend and backend schemas must match.

---

# GOAL 44 — DESIGN SYSTEM

Create a consistent visual system.

Suggested palette:

```text
Deep Navy   #0F172A
Blue        #2563EB
Soft Blue   #EFF6FF
Teal        #0F766E
Success     #16A34A
Warning     #D97706
Danger      #DC2626
Background  #F8FAFC
Surface     #FFFFFF
Secondary   #64748B
Border      #E2E8F0
```

Typography:

**Inter / system-ui / sans-serif**

Maintain consistent:

* spacing
* typography
* radii
* borders
* shadows
* icons
* breakpoints

Use a coherent component system.

---

# GOAL 45 — UI/UX QUALITY

The interface should feel:

**premium + calm + trustworthy + intelligent + practical + modern**

Avoid:

* excessive gradients
* neon effects
* excessive glassmorphism
* stock-photo-heavy screens
* random icons
* decorative AI art
* tiny text
* inconsistent cards
* unnecessary animation

Beautiful means:

**clear + balanced + intentional + usable**

not:

**more decoration**

---

# GOAL 46 — TEACHER DASHBOARD UX

The teacher dashboard should answer:

> **What do I do next?**

Show:

### Next Classroom Step

### Implementation Journey

### Latest Feedback

### Evidence Status

### Support

### Recent History

Do not make analytics the primary Teacher dashboard.

---

# GOAL 47 — REUSABLE UI COMPONENTS

Build/reuse:

* Button
* Card
* Input
* Badge
* Modal
* Drawer
* Tabs
* Progress
* Timeline
* Skeleton
* EmptyState
* ErrorState
* ImplementationPipeline
* PipelineStage
* ImplementationActionCard
* EvidenceCard
* AIInsightCard
* FeedbackComposer
* MentorDecision
* RetryCoach
* AdoptionIndicator
* SyncStatus
* VoiceRecorder
* EvidenceUploader
* MetricCard
* FunnelChart

Do not create duplicate implementations of the same visual pattern.

---

# GOAL 48 — COMPLEX PIPELINE UI

Desktop should be able to show the full implementation pipeline.

Mobile should use a vertical stepper.

The current stage gets strongest visual emphasis.

Completed stages become quieter.

Future stages remain visible but secondary.

The pipeline should support:

* stage state
* owner
* timestamps
* evidence
* current action
* dependencies
* AI markers
* mentor markers
* retry
* support branches

The teacher should not need to understand every internal state.

---

# GOAL 49 — LOADING / EMPTY / ERROR / SUCCESS UX

Every major feature must have:

### Loading

Skeleton or meaningful progress.

### Empty

Explain what happens next.

### Error

Explain the problem and give recovery action.

### Success

Confirm completion.

### Offline

Explain local state.

### Syncing

Explain current state.

### Retry

Make recovery obvious.

Never leave blank screens.

---

# GOAL 50 — ACCESSIBILITY

Implement:

* semantic HTML
* form labels
* keyboard navigation
* focus states
* adequate contrast
* meaningful button names
* accessible error messaging
* alt text where needed
* color-independent status
* sufficient touch targets
* reduced-motion consideration

Do not rely solely on color.

---

# GOAL 51 — MULTI-LANGUAGE READINESS

Prepare the UI for future multiple-language support.

Avoid hardcoding every visible string directly inside components.

Create a localization-friendly structure.

AI content should also be architected so translated workflows can be supported later.

Do not let internationalization work break the existing UI.

---

# GOAL 52 — PERFORMANCE OPTIMIZATION

After functionality works, optimize the actual application.

## Frontend

Inspect:

* unnecessary re-renders
* excessive state
* repeated requests
* large bundles
* expensive components
* image loading
* excessive client rendering

## Backend

Inspect:

* repeated requests
* oversized responses
* slow services
* duplicated business logic

## Database

Inspect:

* N+1 queries
* missing useful indexes
* repeated queries
* unnecessary joins
* pagination

## AI

Inspect:

* prompt size
* context size
* repeated calls
* long outputs

## Mobile

Inspect:

* RAM
* CPU
* battery
* storage
* network usage

Do not optimize blindly.

Find real bottlenecks.

---

# GOAL 53 — CODE QUALITY

Clean genuinely unnecessary:

* duplicate components
* duplicate functions
* dead files
* unused imports
* unused dependencies
* obsolete routes
* duplicate types
* unsafe `any`
* unnecessary abstractions
* memory leaks
* missing cleanup

Before deleting:

**search references → verify unused → remove**

Do not delete intentional architecture.

---

# GOAL 54 — SECURITY

Audit:

## Authentication

* login
* sessions/tokens
* logout
* expiry

## Authorization

Backend-enforced role permissions.

## Input

Validate all user-controlled data.

## Uploads

Validate file type, size and destination.

## Secrets

No secrets in:

* frontend
* source control
* logs

Review:

* `.env`
* `.env.example`
* `.gitignore`

## APIs

Audit:

* validation
* CORS
* role enforcement
* unsafe errors
* sensitive data access

---

# GOAL 55 — PRIVACY

Minimize collected information.

Avoid unnecessary:

* student names
* student faces
* GPS
* background audio
* unnecessary video

Use:

* teacher IDs
* role-based access
* secure storage
* minimal evidence
* controlled retention

Do not make the product feel like teacher surveillance.

---

# GOAL 56 — MEDIA / STORAGE OPTIMIZATION

For evidence:

### Images

Resize/compress appropriately.

### Video

Compress when practical.

### Audio

Use suitable encoding.

Avoid:

* duplicate local copies
* oversized uploads
* unnecessary permanent storage

Clean temporary data where safe.

---

# GOAL 57 — DATA INTEGRITY

Verify the full chain:

**Teacher submits evidence**

↓

Evidence persisted

↓

AI analysis created/queued

↓

Mentor review item created

↓

Mentor feedback recorded

↓

Retry created

↓

Implementation history updated

↓

Adoption state updated

↓

Analytics updated

No manual database editing.

---

# GOAL 58 — DEMO DATA

Create coherent sample data:

### Teacher A

Multi-grade / single teacher.

### Teacher B

Early-career.

### Teacher C

Experienced.

At least one teacher should have:

**Training → Practice → Classroom → Evidence → AI → Mentor → Feedback → Retry → Adoption**

All simulated records must be labelled:

**DEMO DATA**

Do not present simulated people as real people.

---

# GOAL 59 — DEMO RESET

Where practical, create a safe seed/reset mechanism.

The hackathon demo should be repeatable.

Do not require manually editing SQL/database records between runs.

---

# GOAL 60 — NO FAKE CORE FUNCTIONALITY

Do not fake:

* AI analysis
* implementation history
* adoption
* analytics
* mentor decisions
* retry
* evidence persistence

If something is intentionally simulated:

**SIMULATED / DEMO**

must be clearly visible.

---

# GOAL 61 — COMPLETE PROJECT DEBUGGING

If anything is broken:

**REPRODUCE → ISOLATE → ROOT CAUSE → FIX → TEST → RE-TEST**

Do not apply random patches.

Do not hide errors.

Do not remove functionality merely because debugging is inconvenient.

Check:

* browser console
* network
* backend logs
* build output
* test output
* database errors
* AI responses

Classify:

**BLOCKING**

**NON-BLOCKING**

**COSMETIC**

Fix blocking issues first.

---

# GOAL 62 — FAILURE RECOVERY

Explicitly test:

1. AI timeout
2. AI malformed output
3. provider unavailable
4. database failure
5. upload failure
6. offline save
7. failed sync
8. duplicate evidence
9. duplicate feedback
10. duplicate retry
11. browser close during upload
12. camera permission denied
13. microphone permission denied
14. unauthorized pipeline transition
15. mentor rejecting AI recommendation
16. mentor requesting more evidence
17. multiple retries
18. mobile refresh during workflow

Every failure must lead to a recoverable state.

---

# GOAL 63 — FULL MOBILE TESTING

Test:

### Mobile

360–430px

### Tablet

768–1024px

### Desktop

1280–1440px

Where possible, test actual Android devices.

Verify:

* touch
* navigation
* keyboard
* camera
* microphone
* permission flows
* uploads
* offline
* sync
* refresh
* back button
* low memory
* slow network
* media handling

Do not assume desktop browser testing proves mobile correctness.

---

# GOAL 64 — AUTOMATED TESTING

Implement or improve tests for:

## Unit

* validators
* utilities
* pipeline transitions
* adoption logic
* AI parser
* synchronization/idempotency

## API

* auth
* evidence
* AI
* mentor feedback
* retry
* analytics
* sync

## Integration

The most important integration test:

**Training → Personalization → Practice → Evidence → AI → Mentor → Feedback → Retry → Adoption**

Prioritize the core flow over superficial test volume.

---

# GOAL 65 — BUILD VERIFICATION

Actually run:

## Frontend

* startup
* production build
* lint
* type check

## Backend

* startup
* imports
* API availability
* database connection

## Database

* migrations
* seed
* persistence

## AI

* real request
* structured output
* failure handling

## Mobile

* responsive behavior
* offline
* permissions
* media

Never claim a test passed unless it was actually executed.

---

# GOAL 66 — FINAL END-TO-END DEMO

Run the complete journey:

```text
Teacher Mobile Login
↓
Dashboard
↓
Training Complete
↓
Competency
↓
Context
↓
AI Personalized Action
↓
Practice Scenario
↓
Classroom Action
↓
Voice/Text Evidence
↓
Offline/Online Save
↓
AI Analysis
↓
Mentor Review
↓
Feedback
↓
Retry Coach
↓
Second Attempt
↓
Implementation History
↓
Adoption Update
↓
Admin Analytics
```

Test it as a real user.

Do not rely on manual database manipulation.

---

# GOAL 67 — FINAL PROJECT AUDIT

After all fixes:

1. rerun the application
2. rerun build
3. rerun lint
4. rerun type checking
5. rerun automated tests
6. rerun AI tests
7. rerun authorization tests
8. rerun offline tests
9. rerun mobile flow
10. rerun complete demo
11. inspect logs/console
12. audit requirements again

Do not stop after the first successful build.

---

# GOAL 68 — FINAL SCORING

Rate the actual final project:

| Category                 | Score |
| ------------------------ | ----: |
| Problem Alignment        |   /10 |
| Functional Completeness  |   /10 |
| Teacher UX               |   /10 |
| Mentor UX                |   /10 |
| Admin UX                 |   /10 |
| Mobile UX                |   /10 |
| AI Centrality            |   /10 |
| AI Reliability           |   /10 |
| End-to-End Integration   |   /10 |
| Pipeline Quality         |   /10 |
| Database/Data Integrity  |   /10 |
| Offline Readiness        |   /10 |
| Security                 |   /10 |
| Performance              |   /10 |
| Code Quality             |   /10 |
| UI/Visual Quality        |   /10 |
| Accessibility            |   /10 |
| Hackathon Demo Readiness |   /10 |

Use a transparent weighting to calculate an overall score out of 100.

Do not inflate the score.

A beautiful static mockup with broken backend must score poorly on functionality.

---

# GOAL 69 — DETERMINE EXACTLY WHAT IS REMAINING

Separate remaining work into:

## MUST FIX BEFORE HACKATHON

Only things that could:

* break the demo
* break the core journey
* compromise AI centrality
* cause data loss
* create serious security problems
* make mobile use unreliable

## SHOULD FIX

Important reliability, performance or UX issues.

## OPTIONAL

Non-essential enhancements.

## FUTURE PRODUCTION

Large-scale features beyond realistic hackathon scope.

Do not hide unfinished work.

Do not invent limitations that do not exist.

---

# GOAL 70 — FINAL CONSOLIDATED REPORT

After all feasible work is complete, provide ONE final report.

Use exactly:

# CLASSROOM LOOP — FINAL PROJECT REPORT

## 1. Overall Status

Choose:

**READY**

**READY WITH MINOR LIMITATIONS**

**PARTIALLY READY**

**BLOCKED**

Explain why.

## 2. Overall Score

**__/100**

Explain the main reasons.

## 3. Before vs After

Show major improvements.

## 4. Requirements Matrix

| Area          | Status | Notes |
| ------------- | ------ | ----- |
| Teacher       |        |       |
| Mentor        |        |       |
| Admin         |        |       |
| Core Pipeline |        |       |
| AI            |        |       |
| Evidence      |        |       |
| Retry         |        |       |
| Adoption      |        |       |
| Analytics     |        |       |
| Mobile        |        |       |
| Offline       |        |       |
| Security      |        |       |
| UI/UX         |        |       |
| Accessibility |        |       |
| Performance   |        |       |

Use:

✅ Complete
⚠️ Partial
❌ Missing
🐞 Broken
🧪 Unverified

## 5. Core Journey Test

| Step             | Result | Notes |
| ---------------- | ------ | ----- |
| Login            |        |       |
| Training         |        |       |
| Competency       |        |       |
| Context          |        |       |
| Personalization  |        |       |
| Practice         |        |       |
| Classroom Action |        |       |
| Evidence         |        |       |
| AI Analysis      |        |       |
| Mentor Review    |        |       |
| Feedback         |        |       |
| Retry            |        |       |
| Adoption         |        |       |
| Analytics        |        |       |

Use only:

**PASS / FAIL / PARTIAL / UNVERIFIED**

## 6. Mobile Test

Report:

* navigation
* touch
* camera
* microphone
* media
* offline
* sync
* permissions
* low-bandwidth
* refresh/recovery

## 7. AI Assessment

Explain:

* what AI actually does
* models/providers used
* context flow
* prompt architecture
* structured output
* evidence analysis
* personalization
* support detection
* feedback drafting
* error handling
* human review
* limitations

## 8. Pipeline Assessment

Explain:

* state machine
* events
* branching
* attempts
* AI gates
* mentor gates
* retry
* adoption
* synchronization
* recovery

## 9. UI/UX Assessment

Explain:

* design system
* Teacher UX
* Mentor UX
* Admin UX
* mobile UX
* accessibility
* loading states
* errors
* offline states

## 10. Performance

Report actual findings and optimizations.

Do not fabricate benchmarks.

## 11. Security & Privacy

Report actual protections.

## 12. Bugs Found and Fixed

Use:

**Problem → Root Cause → Fix → Test Result**

## 13. Remaining Work

### MUST FIX BEFORE HACKATHON

### SHOULD FIX

### OPTIONAL

### FUTURE PRODUCTION

## 14. Testing Performed

Report actual:

* build
* lint
* type checking
* unit
* API
* integration
* AI
* security
* offline
* mobile
* manual demo

## 15. Files Changed

List important files/directories only.

## 16. How to Run

Give exact commands.

## 17. Hackathon Demo Script

Give the shortest reliable click-by-click path.

## 18. Final Recommendation

Choose:

**READY TO DEMONSTRATE**

or

**NOT READY — CRITICAL FIXES REMAIN**

If not ready, list only the blockers.

---

# FINAL EXECUTION RULE

Do not stop at analysis.

Do not stop at UI.

Do not stop at the API.

Do not stop at AI integration.

Do not stop at mobile responsiveness.

Do not stop after the first successful build.

Do not stop after one successful demo.

Execute the whole process:

**INSPECT**
→
**UNDERSTAND**
→
**AUDIT**
→
**PLAN**
→
**BUILD**
→
**INTEGRATE**
→
**DEBUG**
→
**OPTIMIZE**
→
**MOBILE TEST**
→
**OFFLINE TEST**
→
**SECURITY TEST**
→
**END-TO-END TEST**
→
**RE-AUDIT**
→
**POLISH**
→
**VERIFY**
→
**REPORT**

---

# FINAL PRODUCT STANDARD

CLASSROOM LOOP should ultimately feel like:

> **A real AI-powered teacher implementation and coaching system**

not:

> **an LMS with an AI chatbot.**

The evaluator should be able to understand the product immediately:

**Training already happened.**

↓

**CLASSROOM LOOP understands the teacher's context.**

↓

**AI recommends what to practise.**

↓

**Teacher practises.**

↓

**Teacher tries it in the classroom.**

↓

**Teacher captures evidence from the phone.**

↓

**AI converts evidence into structured insight.**

↓

**A human mentor validates the guidance.**

↓

**Teacher retries.**

↓

**The system records what happened over time.**

↓

**Implementation and adoption become measurable.**

Everything must reinforce:

# TRAIN → PRACTISE → APPLY → EVIDENCE → AI → MENTOR → RETRY → ADOPT

And the product must satisfy these system-wide principles:

**MOBILE-FIRST**

**OFFLINE-AWARE**

**AI-CENTRIC**

**HUMAN-IN-THE-LOOP**

**PIPELINE-DRIVEN**

**PRIVACY-AWARE**

**SECURE**

**PERFORMANT**

**ACCESSIBLE**

**BEAUTIFUL**

**RELIABLE**

**HACKATHON-READY**
