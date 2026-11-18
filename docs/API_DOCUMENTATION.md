# API documentation

Base URL: `/api`

## Authentication

`Authorization: Bearer <Firebase ID token>`

Protected routes verify the Firebase token and authorize the mapped MongoDB role.

## Route groups

| Area | Routes |
|---|---|
| Auth | `/auth/*` |
| Employees | `/employees/*` |
| Employers | `/employers/*` |
| Skills | `/skills/*` |
| Job roles | `/job-roles/*` |
| AI | `/ai/analyze-skills`, `/ai/analyses` |
| Matching | `/matching/search`, `/matching/recommendations` |
| Shortlists | `/shortlists/*` |
| Admin users | `/admin/users/*` |
| Admin employees | `/admin/employees/*` |
| Admin employers | `/admin/employers/*` |
| Admin analytics | `/admin/analytics/*` |

All list endpoints use page, limit, sort, search, and filter query parameters.
Successful responses use `success` and resource data; errors use `success`,
`message`, and optional validation details.

## Employee profile

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/employees/me` | Employee | Read the signed-in employee's profile |
| PATCH | `/employees/me` | Employee | Update profile details, location, education, experience, preferences, or visibility |

Profile updates are partial and reject unknown fields. The authenticated user
can only read or modify the profile linked to their own account. Updates that
would leave the profile without any meaningful details are rejected. Employee
profiles are created on the first meaningful update; an empty draft returned
by `GET /employees/me` is not persisted.

## Employer profiles and verification

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/employers/me` | Employer | Read the signed-in employer's company profile and verification status |
| PATCH | `/employers/me` | Employer | Update company name, industry, size, website, and location |
| GET | `/employers/admin/verification?status=pending&limit=50` | Admin | List employer profiles for verification review |
| PATCH | `/employers/admin/verification/:profileId` | Admin | Verify or reject a company profile |

Employer updates cannot set verification status. Any profile edit returns the
company to `pending`, clears the previous decision note, and removes its
verified timestamp. Rejection requires a note that is shown to the employer.
The verification queue is limited to 100 profiles per request.

Administrators are not created through public registration. Promote an existing
active account from the server workspace with
`npm run promote-admin -- existing-account@example.com`.

## Skills

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/skills?search=&category=&limit=` | Authenticated | Search active skills |
| GET | `/skills/categories` | Authenticated | List active skill categories |
| POST | `/skills` | Admin | Add a catalog skill |
| PATCH | `/skills/:skillId` | Admin | Update a catalog skill or deactivate it |
| POST | `/employees/me/skills` | Employee | Add a catalog skill with proficiency and evidence |
| PATCH | `/employees/me/skills/:skillId` | Employee | Update proficiency, experience, or evidence |
| DELETE | `/employees/me/skills/:skillId` | Employee | Remove a skill from the signed-in employee's profile |

Catalog writes are admin-only. Employee skill operations use only active catalog
entries and are scoped to the authenticated employee.
Use `npm run seed:skills` to add the idempotent starter catalog to the configured
MongoDB database. The starter catalog includes healthcare, transportation,
construction trades, hospitality, agriculture, and manufacturing skills. The
seed command deactivates the previous generic/technical starter entries without
deleting existing employee skill records. Catalog entries describe work skills
and do not indicate immigration or visa eligibility.

## Job roles and skill utilization

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/job-roles?search=&sector=&limit=` | Authenticated | Search active role catalog entries |
| GET | `/job-roles/me/recommendations` | Employee | Return roles ranked by overlap with active profile skills |
| POST | `/job-roles` | Admin | Add a role with active catalog skill references |
| PATCH | `/job-roles/:roleId` | Admin | Update or deactivate a catalog role |

Recommendations include matched skills, missing catalog skills, common duties,
work settings, and examples of how listed skills may be used. The score is the
percentage of the role's active required catalog skills found on the employee
profile. It is a transparent skills-overlap measure, not a qualification,
employment, demand, or immigration assessment. No profile data is sent to an AI
provider for these recommendations.

Run `npm run seed:skills` before `npm run seed:job-roles` to add the idempotent
occupational starter data. Existing roles are left unchanged by the seed script.

## Employer employee search

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/matching/search?skill=&country=&limit=20` | Verified Employer | Search public employee profiles by active catalog skill and/or country |
| POST | `/matching/recommendations` | Verified Employer | Identify role skills with explicit consent and rank public profiles locally |

At least one filter is required; `limit` is 1–50. Private and consent-only
profiles are excluded. Results include only public profile name, city/region/
country, active skills, education qualification/field, experience titles,
target roles, and relocation preference. Phone, email, employer names, and
experience descriptions are not returned.

Recommendations require `{ "consent": true }`, a job title, and optional
job requirements and work country. Requests are limited to 5 per IP address
per hour. The AI service receives only the employer's job details and active
skill catalog; employee profiles are matched locally and are not sent to the
AI service. Results include up to 20 public profiles ranked by active catalog
skill overlap. The score is a skills-overlap measure, not a hiring decision.

## Transferable skills analysis

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/ai/analyze-skills` | Employee | Analyze active profile skills and return/save transferable occupation suggestions |
| GET | `/ai/analyses?limit=5` | Employee | Read the signed-in employee's latest saved analyses (1–20) |

Analysis requests must include `{ "consent": true }`; `destinationCountry` is
optional. Requests are limited to 10 per IP address per hour. The server sends
active skill names/categories/proficiency/experience, education qualification
and field of study, career preferences, and the optional destination country to
Gemini. Names, contact details, exact location, employer names, and work
descriptions are excluded. Results are career guidance, not visa eligibility,
immigration points, sponsorship, or verified labor-market advice.

Configure the server-only `GEMINI_API_KEY` and optional `GEMINI_MODEL` in the
environment. The client must not make an analysis request before the employee
explicitly checks consent and submits the form.
