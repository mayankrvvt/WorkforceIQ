# System architecture

## Proposed architecture

```text
Browser
  | Firebase ID token
React SPA
  | REST / JSON
Express API
  | Mongoose
MongoDB Atlas

Express AI services
  | server-only credential
Google Gemini
```

The frontend and backend are independent deployable applications. Firebase
owns authentication; MongoDB stores application users and domain records.
The backend verifies Firebase ID tokens and maps the Firebase UID to a MongoDB
User record before enforcing role authorization.

## Module purposes

| Module | Purpose |
|---|---|
| Public/auth UI | Registration, login, recovery, and public product pages |
| Employee pipeline | Profile, work history, education, certifications, skills |
| AI engine | Consent-gated transferable-skills analysis |
| Job-role catalog | Curated roles, duties, work settings, and deterministic skill matches |
| Employer pipeline | Company verification, profile search, workforce matching, shortlists |
| Admin pipeline | Independent employee/employer management and platform controls |
| Shared components | Navigation, tables, filters, cards, dialogs, badges, pagination |
| Backend middleware | Auth, authorization, validation, rate limits, audit and errors |

## Employee pipeline

1. Firebase account creation and MongoDB user synchronization.
2. Profile, location, languages, preferences, and employment details.
3. Multiple categorized skills with proficiency and evidence.
4. The backend ranks curated roles using overlap with the employee's active
   catalog skills and shows duties, settings, and skill gaps. This calculation
   is local and deterministic.
5. The employee reviews what will be shared, explicitly consents, and submits an
   optional Gemini analysis request.
6. Backend sends only active skill details, education qualification/field,
   career preferences, and the optional destination country to Gemini.
7. AI output is validated against a strict schema and persisted as SkillAnalysis.
8. The employee can review the latest saved AI analysis and rerun it after giving
   consent again.

## Employer pipeline

1. Employer registers and maintains a company profile.
2. The employer submits profile details for administrator review.
3. Admin verifies or rejects the company; rejection includes a note for the employer.
4. Any employer profile edit clears the prior decision and returns it to pending.
5. Verified employers can search only public employee profiles; private and
   consent-only profiles are excluded until an explicit sharing workflow exists.
6. Employers may submit job details after explicit consent; only those details
   and active catalog skills are sent to the AI service to identify role skills.
7. WorkforceIQ matches those skills locally against public profiles and returns
   allowlisted fields with a transparent skills-overlap score. Candidate data
   is not sent to the AI service.
8. Employers can shortlist, annotate, compare, and send consent-aware contact requests.

## AI pipeline

AI logic is isolated in `server/src/services/ai/`. The implemented transferable-skills analysis uses
Gemini with a versioned prompt, strict Zod output validation, explicit per-run
consent, employee-scoped persistence, and a per-IP rate limit. Personal
identifiers, exact location, and employer details are excluded from provider
input. Separately, `server/src/services/role-matching.js` ranks the curated job
role catalog by active skill overlap without contacting an AI provider.
Recommendations are indicative career guidance, not immigration or visa advice;
regulated work and credentials must be checked with official sources.

## Admin pipeline

Employee Management and Employer Management remain separate modules with
separate models, routes, pages, filters, exports, and actions. Admin actions
that change verification state are role-authorized. Persistent admin audit
logging remains a future platform capability.
