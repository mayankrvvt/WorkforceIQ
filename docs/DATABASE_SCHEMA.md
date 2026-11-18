# Database schema

## Collections

| Model | Key fields |
|---|---|
| User | firebaseUid, email, role, status, softDeletedAt |
| EmployeeProfile | userId, personal details, education, experience, preferences, visibility |
| EmployerProfile | userId, company details, industry, size, location, verificationStatus, verificationNote, verifiedAt |
| Skill | normalizedName, category, aliases, status |
| JobRole | title, normalizedTitle, sector, requiredSkills, skillUtilization, typicalDuties, workSettings, qualificationsToCheck, status |
| SkillAnalysis | employeeProfileId, requestedByUserId, promptVersion, model, destinationCountry, inputSnapshot, result |
| EmployerRequirement | employerProfileId, requirementText, extractedSkills, status |
| Recommendation | requirementId or analysisId, employeeProfileId, score, evidence, gaps |
| Shortlist | employerProfileId, employeeProfileId, internalName, notes |
| ContactRequest | employerProfileId, employeeProfileId, consent, status |
| ActivityLog | actorId, action, targetType, targetId, metadata |

## Relationships

- `User 1:1 EmployeeProfile` or `User 1:1 EmployerProfile`
- `JobRole N:M Skill` through required skill references
- `EmployeeProfile 1:N SkillAnalysis`
- `EmployeeProfile 1:N EmployeeSkill` (embedded skill records or a link collection)
- `EmployerProfile 1:N EmployerRequirement`
- `EmployerRequirement 1:N Recommendation`
- `EmployerProfile 1:N Shortlist`
- `Shortlist N:1 EmployeeProfile`
- `EmployerProfile 1:N ContactRequest`
- `EmployeeProfile 1:N ContactRequest`
- `User 1:N ActivityLog`

Every profile references `User`, not duplicated account identity fields.
MongoDB timestamps, indexes on Firebase UID and public search fields, and unique
constraints on accounts and shortlist pairs are required.

`SkillAnalysis` stores only the minimized input sent for the consented analysis
(active skill details, selected education fields, and career preferences), plus
the validated occupation suggestions. It does not store profile names, contact
details, exact location, or employer names.

`JobRole` is a curated catalog. Employee recommendations are calculated from
active `JobRole.requiredSkills` and active employee skill references; the
resulting overlap score is not persisted as a separate record.
