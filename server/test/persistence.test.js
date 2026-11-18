import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { EmployeeProfile } from '../src/models/employee-profile.model.js';
import { EmployerProfile } from '../src/models/employer-profile.model.js';
import { JobRole } from '../src/models/job-role.model.js';
import { requireRoles } from '../src/middleware/auth.js';
import {
  employeeSkillInputSchema,
  employeeSkillUpdateSchema,
  employeeProfileUpdateSchema,
  hasMeaningfulProfileDetails,
} from '../src/routes/employee.routes.js';
import {
  createSkillSchema,
  updateSkillSchema,
} from '../src/routes/skill.routes.js';
import {
  createJobRoleSchema,
  updateJobRoleSchema,
} from '../src/routes/job-role.routes.js';
import {
  buildEmployerProfileUpdate,
  companyProfileUpdateSchema,
  verificationDecisionSchema,
} from '../src/routes/employer.routes.js';
import {
  buildEmployeeSearchFilter,
  rankPublicEmployeeProfiles,
  recommendationRequestSchema,
  searchSchema as employeeSearchSchema,
  toPublicEmployeeSearchResult,
} from '../src/routes/matching.routes.js';
import { analyzeRequestSchema } from '../src/routes/ai.routes.js';
import {
  buildSkillAnalysisSnapshot,
  skillAnalysisResultSchema,
} from '../src/services/ai/skill-analysis.js';
import {
  buildHiringCriteriaPrompt,
  filterActiveHiringSkillIds,
  hiringCriteriaSchema,
} from '../src/services/ai/hiring-recommendations.js';
import { scoreJobRoles } from '../src/services/role-matching.js';

test('health endpoint reports API status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, 'healthy');
});

test('core models validate required fields', () => {
  const user = new User({
    firebaseUid: 'firebase-123',
    email: 'Employee@Example.com',
  });
  assert.equal(user.validateSync(), undefined);
  assert.equal(user.email, 'employee@example.com');
  assert.equal(user.role, 'employee');

  const employee = new EmployeeProfile({
    userId: '507f1f77bcf86cd799439011',
  });
  assert.equal(employee.validateSync(), undefined);

  const employer = new EmployerProfile({
    userId: '507f1f77bcf86cd799439011',
    companyName: 'Example Company',
  });
  assert.equal(employer.validateSync(), undefined);

  const jobRole = new JobRole({
    title: 'Care Assistant',
    normalizedTitle: 'care assistant',
    sector: 'Healthcare & Care',
    requiredSkills: [{ skillId: '507f1f77bcf86cd799439011' }],
  });
  assert.equal(jobRole.validateSync(), undefined);

  const Skill = mongoose.model('Skill');
  const skill = new Skill({
    normalizedName: 'JavaScript',
    category: 'Programming',
  });
  assert.equal(skill.validateSync(), undefined);
  assert.equal(skill.normalizedName, 'javascript');
});

test('authentication route rejects missing bearer token', async () => {
  const response = await request(app).get('/api/auth/me');

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
});

test('employee profile routes reject requests without authentication', async () => {
  const getResponse = await request(app).get('/api/employees/me');
  const patchResponse = await request(app)
    .patch('/api/employees/me')
    .send({ personalDetails: { firstName: 'Taylor' } });

  assert.equal(getResponse.status, 401);
  assert.equal(patchResponse.status, 401);
});

test('employer routes require authentication', async () => {
  const profileResponse = await request(app).get('/api/employers/me');
  const updateResponse = await request(app)
    .patch('/api/employers/me')
    .send({ companyName: 'Example Company' });
  const queueResponse = await request(app).get(
    '/api/employers/admin/verification',
  );
  const decisionResponse = await request(app)
    .patch('/api/employers/admin/verification/507f1f77bcf86cd799439011')
    .send({ verificationStatus: 'verified' });

  assert.equal(profileResponse.status, 401);
  assert.equal(updateResponse.status, 401);
  assert.equal(queueResponse.status, 401);
  assert.equal(decisionResponse.status, 401);
});

test('employer profile schema rejects verification fields and invalid websites', () => {
  assert.equal(
    companyProfileUpdateSchema.safeParse({
      companyName: 'Example Company',
      website: 'https://example.com',
      location: { city: 'Toronto' },
    }).success,
    true,
  );
  assert.equal(
    companyProfileUpdateSchema.safeParse({
      verificationStatus: 'verified',
    }).success,
    false,
  );
  assert.equal(
    companyProfileUpdateSchema.safeParse({
      website: 'javascript:alert(1)',
    }).success,
    false,
  );
});

test('any employer profile edit resets verification and clears prior notes', () => {
  assert.deepEqual(
    buildEmployerProfileUpdate({ location: { city: 'Toronto' } }),
    {
      $set: {
        'location.city': 'Toronto',
        verificationStatus: 'pending',
        verifiedAt: null,
      },
      $unset: { verificationNote: 1 },
    },
  );
});

test('employer verification decisions require rejection notes', () => {
  assert.equal(
    verificationDecisionSchema.safeParse({
      verificationStatus: 'verified',
    }).success,
    true,
  );
  assert.equal(
    verificationDecisionSchema.safeParse({
      verificationStatus: 'rejected',
    }).success,
    false,
  );
  assert.equal(
    verificationDecisionSchema.safeParse({
      verificationStatus: 'rejected',
      verificationNote: 'Please provide a company website.',
    }).success,
    true,
  );
});

test('employee search requires authentication', async () => {
  const response = await request(app)
    .get('/api/matching/search')
    .query({ skill: 'driver' });

  assert.equal(response.status, 401);
});

test('employee search requires a filter and limits results', () => {
  assert.equal(employeeSearchSchema.safeParse({ skill: 'driver' }).success, true);
  assert.equal(employeeSearchSchema.safeParse({}).success, false);
  assert.equal(
    employeeSearchSchema.safeParse({
      country: 'Canada',
      limit: 51,
    }).success,
    false,
  );
});

test('employee search filters to public profiles and allowlists returned data', () => {
  const filter = buildEmployeeSearchFilter({
    country: 'Canada',
    skillIds: ['507f1f77bcf86cd799439011'],
  });
  assert.equal(filter.visibility, 'public');
  assert.equal(filter['location.country'].test('Canada'), true);
  assert.equal(filter['location.country'].test('Other'), false);

  const result = toPublicEmployeeSearchResult({
    _id: 'profile-1',
    personalDetails: {
      firstName: 'Taylor',
      lastName: 'Example',
      phone: '555-0100',
    },
    location: { city: 'Toronto', country: 'Canada' },
    education: [
      {
        institution: 'Private College',
        qualification: 'Certificate',
        fieldOfStudy: 'Health care',
      },
    ],
    experience: [
      {
        title: 'Care worker',
        employer: 'Private Employer',
        description: 'Private work history',
      },
    ],
    skills: [
      {
        skillId: {
          normalizedName: 'patient care assistance',
          category: 'Healthcare & Care',
          status: 'active',
        },
        proficiency: 'advanced',
      },
    ],
    preferences: { targetRoles: ['care assistant'], willingToRelocate: true },
    visibility: 'public',
  });

  assert.deepEqual(result, {
    _id: 'profile-1',
    displayName: 'Taylor Example',
    location: { city: 'Toronto', state: '', country: 'Canada' },
    skills: [
      {
        name: 'patient care assistance',
        category: 'Healthcare & Care',
        proficiency: 'advanced',
      },
    ],
    education: [{ qualification: 'Certificate', fieldOfStudy: 'Health care' }],
    experience: [{ title: 'Care worker' }],
    targetRoles: ['care assistant'],
    willingToRelocate: true,
  });
  assert.doesNotMatch(JSON.stringify(result), /555-0100|Private/);
});

test('employer recommendations require authentication and explicit consent', async () => {
  const response = await request(app)
    .post('/api/matching/recommendations')
    .send({ consent: true, jobTitle: 'Care assistant' });

  assert.equal(response.status, 401);
  assert.equal(
    recommendationRequestSchema.safeParse({
      consent: true,
      jobTitle: 'Care assistant',
    }).success,
    true,
  );
  assert.equal(
    recommendationRequestSchema.safeParse({
      consent: false,
      jobTitle: 'Care assistant',
    }).success,
    false,
  );
  assert.equal(
    recommendationRequestSchema.safeParse({
      consent: true,
      jobTitle: 'Care assistant',
      employeeProfile: {},
    }).success,
    false,
  );
});

test('hiring criteria prompt contains role details but no candidate profile data', () => {
  const prompt = buildHiringCriteriaPrompt(
    {
      jobTitle: 'Care assistant',
      jobRequirements: 'Support people with daily activities.',
    },
    [
      {
        id: '507f1f77bcf86cd799439011',
        normalizedName: 'patient care assistance',
        category: 'Healthcare & Care',
      },
    ],
  );

  assert.match(prompt, /Care assistant/);
  assert.match(prompt, /patient care assistance/);
  assert.doesNotMatch(prompt, /Taylor|Private Employer|555-0100/);
});

test('hiring criteria only retain unique active catalog skill IDs', () => {
  const activeId = '507f1f77bcf86cd799439011';
  const inactiveId = '507f1f77bcf86cd799439012';

  assert.equal(
    hiringCriteriaSchema.safeParse({ skillIds: [activeId] }).success,
    true,
  );
  assert.deepEqual(
    filterActiveHiringSkillIds(
      [activeId, activeId, inactiveId],
      [{ id: activeId }],
    ),
    [activeId],
  );
});

test('employer candidate ranking uses public-profile skill overlap only', () => {
  const careSkillId = '507f1f77bcf86cd799439011';
  const firstAidSkillId = '507f1f77bcf86cd799439012';
  const candidates = rankPublicEmployeeProfiles(
    [
      {
        _id: 'complete-match',
        personalDetails: { firstName: 'Alex' },
        skills: [
          {
            skillId: {
              _id: careSkillId,
              normalizedName: 'patient care assistance',
              status: 'active',
            },
            proficiency: 'advanced',
          },
          {
            skillId: {
              _id: firstAidSkillId,
              normalizedName: 'first aid and cpr',
              status: 'active',
            },
            proficiency: 'intermediate',
          },
        ],
      },
      {
        _id: 'partial-match',
        personalDetails: { firstName: 'Sam' },
        skills: [
          {
            skillId: {
              _id: careSkillId,
              normalizedName: 'patient care assistance',
              status: 'active',
            },
            proficiency: 'intermediate',
          },
        ],
      },
      {
        _id: 'inactive-only',
        skills: [
          {
            skillId: {
              _id: firstAidSkillId,
              normalizedName: 'first aid and cpr',
              status: 'inactive',
            },
          },
        ],
      },
    ],
    [
      { _id: careSkillId, normalizedName: 'patient care assistance' },
      { _id: firstAidSkillId, normalizedName: 'first aid and cpr' },
    ],
  );

  assert.deepEqual(
    candidates.map(({ _id, matchScore }) => ({ _id, matchScore })),
    [
      { _id: 'complete-match', matchScore: 100 },
      { _id: 'partial-match', matchScore: 50 },
    ],
  );
  assert.deepEqual(candidates[1].missingSkills, ['first aid and cpr']);
});

test('skill catalog and employee skill routes require authentication', async () => {
  const catalogResponse = await request(app).get('/api/skills');
  const categoriesResponse = await request(app).get('/api/skills/categories');
  const addResponse = await request(app)
    .post('/api/employees/me/skills')
    .send({
      skillId: '507f1f77bcf86cd799439011',
      proficiency: 'intermediate',
    });
  const catalogWriteResponse = await request(app)
    .post('/api/skills')
    .send({ normalizedName: 'Python', category: 'Technology' });

  assert.equal(catalogResponse.status, 401);
  assert.equal(categoriesResponse.status, 401);
  assert.equal(addResponse.status, 401);
  assert.equal(catalogWriteResponse.status, 401);
});

test('job role routes require authentication', async () => {
  const catalogResponse = await request(app).get('/api/job-roles');
  const recommendationsResponse = await request(app).get(
    '/api/job-roles/me/recommendations',
  );
  const createResponse = await request(app)
    .post('/api/job-roles')
    .send({ title: 'Care Assistant' });

  assert.equal(catalogResponse.status, 401);
  assert.equal(recommendationsResponse.status, 401);
  assert.equal(createResponse.status, 401);
});

test('job role schemas validate required skills and reject unknown fields', () => {
  const valid = createJobRoleSchema.safeParse({
    title: 'Care Assistant',
    sector: 'Healthcare & Care',
    requiredSkillIds: ['507f1f77bcf86cd799439011'],
    skillUtilization: ['Support daily routines'],
  });
  const missingSkills = createJobRoleSchema.safeParse({
    title: 'Care Assistant',
    sector: 'Healthcare & Care',
    requiredSkillIds: [],
  });
  const invalidUpdate = updateJobRoleSchema.safeParse({
    createdAt: new Date(),
  });

  assert.equal(valid.success, true);
  assert.equal(missingSkills.success, false);
  assert.equal(invalidUpdate.success, false);
});

test('role matching reports active skill overlap and filters unmatched roles', () => {
  const careSkillId = '507f1f77bcf86cd799439011';
  const firstAidSkillId = '507f1f77bcf86cd799439012';
  const inactiveSkillId = '507f1f77bcf86cd799439013';
  const recommendations = scoreJobRoles(
    [
      {
        skillId: {
          _id: careSkillId,
          normalizedName: 'patient care assistance',
          status: 'active',
        },
        proficiency: 'advanced',
        yearsExperience: 3,
      },
      {
        skillId: {
          _id: inactiveSkillId,
          normalizedName: 'retired skill',
          status: 'inactive',
        },
        proficiency: 'expert',
      },
    ],
    [
      {
        _id: 'role-care',
        title: 'Care Assistant',
        sector: 'Healthcare & Care',
        requiredSkills: [
          {
            skillId: {
              _id: careSkillId,
              normalizedName: 'patient care assistance',
              status: 'active',
            },
          },
          {
            skillId: {
              _id: firstAidSkillId,
              normalizedName: 'first aid and cpr',
              status: 'active',
            },
          },
        ],
        skillUtilization: ['Support daily routines'],
      },
      {
        _id: 'role-inactive',
        title: 'Inactive Role',
        sector: 'Legacy',
        requiredSkills: [
          {
            skillId: {
              _id: inactiveSkillId,
              normalizedName: 'retired skill',
              status: 'inactive',
            },
          },
        ],
      },
    ],
  );

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].matchScore, 50);
  assert.equal(recommendations[0].matchedSkills[0].proficiency, 'advanced');
  assert.deepEqual(recommendations[0].skillGaps, ['first aid and cpr']);
  assert.deepEqual(recommendations[0].skillUtilization, [
    'Support daily routines',
  ]);
});

test('AI analysis routes require employee authentication', async () => {
  const historyResponse = await request(app).get('/api/ai/analyses');
  const analysisResponse = await request(app)
    .post('/api/ai/analyze-skills')
    .send({ consent: true });

  assert.equal(historyResponse.status, 401);
  assert.equal(analysisResponse.status, 401);
});

test('AI analysis request requires explicit consent', () => {
  assert.equal(analyzeRequestSchema.safeParse({ consent: true }).success, true);
  assert.equal(analyzeRequestSchema.safeParse({ consent: false }).success, false);
  assert.equal(
    analyzeRequestSchema.safeParse({ consent: true, profile: {} }).success,
    false,
  );
});

test('AI profile snapshot includes only the approved analysis fields', () => {
  const snapshot = buildSkillAnalysisSnapshot({
    personalDetails: { firstName: 'Private Name', phone: '555-0100' },
    location: { city: 'Private City', country: 'Private Country' },
    experience: [{ employer: 'Private Employer', description: 'Private detail' }],
    skills: [
      {
        skillId: {
          normalizedName: 'care assistant',
          category: 'Healthcare & Care',
          status: 'active',
        },
        proficiency: 'advanced',
        yearsExperience: 4,
        evidence: 'Private evidence',
      },
      {
        skillId: {
          normalizedName: 'retired skill',
          category: 'Legacy',
          status: 'inactive',
        },
        proficiency: 'beginner',
      },
    ],
    education: [
      {
        institution: 'Private School',
        qualification: 'Certificate',
        fieldOfStudy: 'Health care',
      },
    ],
    preferences: {
      targetRoles: ['care assistant'],
      preferredIndustries: ['healthcare'],
      workMode: 'remote',
    },
  });

  assert.deepEqual(snapshot, {
    skills: [
      {
        name: 'care assistant',
        category: 'Healthcare & Care',
        proficiency: 'advanced',
        yearsExperience: 4,
      },
    ],
    education: [{ qualification: 'Certificate', fieldOfStudy: 'Health care' }],
    targetRoles: ['care assistant'],
    preferredIndustries: ['healthcare'],
  });
  assert.doesNotMatch(JSON.stringify(snapshot), /Private|retired skill/);
});

test('AI result schema accepts valid output and rejects out-of-range fit scores', () => {
  const validResult = {
    summary: 'Care work skills may transfer to related support roles.',
    occupations: [
      {
        title: 'Care assistant',
        sector: 'Healthcare & Care',
        relevance: 4,
        rationale: 'The listed care skills are relevant.',
        supportingSkills: ['patient support'],
        skillGaps: [],
        typicalDuties: ['Assist with daily activities'],
        qualificationsToCheck: ['Local care certification'],
        trainingSuggestions: ['First aid'],
      },
    ],
  };

  assert.equal(skillAnalysisResultSchema.safeParse(validResult).success, true);
  assert.equal(
    skillAnalysisResultSchema.safeParse({
      ...validResult,
      occupations: [{ ...validResult.occupations[0], relevance: 6 }],
    }).success,
    false,
  );
});

test('employee profile updates allow profile fields but reject account fields', () => {
  const valid = employeeProfileUpdateSchema.safeParse({
    personalDetails: { firstName: 'Taylor' },
    location: { city: 'Toronto' },
    preferences: { workMode: 'remote' },
  });
  const invalid = employeeProfileUpdateSchema.safeParse({
    userId: '507f1f77bcf86cd799439011',
  });
  const empty = employeeProfileUpdateSchema.safeParse({});

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
  assert.equal(empty.success, false);
});

test('skill catalog schemas validate and limit writable fields', () => {
  const valid = createSkillSchema.safeParse({
    normalizedName: 'Data Analysis',
    category: 'Analytics',
    aliases: ['data analytics'],
  });
  const invalidCreate = createSkillSchema.safeParse({
    normalizedName: 'Data Analysis',
    category: 'Analytics',
    status: 'inactive',
  });
  const invalidUpdate = updateSkillSchema.safeParse({
    createdAt: new Date(),
  });

  assert.equal(valid.success, true);
  assert.equal(invalidCreate.success, false);
  assert.equal(invalidUpdate.success, false);
});

test('employee skill schemas validate catalog references and proficiency', () => {
  const validAdd = employeeSkillInputSchema.safeParse({
    skillId: '507f1f77bcf86cd799439011',
    proficiency: 'advanced',
    yearsExperience: 3,
  });
  const invalidAdd = employeeSkillInputSchema.safeParse({
    skillId: 'not-an-object-id',
    proficiency: 'expert',
  });
  const validUpdate = employeeSkillUpdateSchema.safeParse({
    proficiency: 'expert',
  });
  const emptyUpdate = employeeSkillUpdateSchema.safeParse({});

  assert.equal(validAdd.success, true);
  assert.equal(invalidAdd.success, false);
  assert.equal(validUpdate.success, true);
  assert.equal(emptyUpdate.success, false);
});

test('blank employee profiles are not considered saveable', () => {
  assert.equal(hasMeaningfulProfileDetails({}), false);
  assert.equal(
    hasMeaningfulProfileDetails({
      personalDetails: { firstName: '  ' },
      location: { city: '' },
      preferences: { workMode: 'any' },
      visibility: 'private',
    }),
    false,
  );
  assert.equal(
    hasMeaningfulProfileDetails({
      personalDetails: { firstName: 'Taylor' },
    }),
    true,
  );
});

test('employee routes register the Skill model required for profile population', () => {
  assert.equal(mongoose.modelNames().includes('Skill'), true);
});

test('role authorization allows only configured roles', () => {
  const allowedEmployer = requireRoles('employer');
  let statusCode;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  let nextCalled = false;

  allowedEmployer(
    { auth: { user: { role: 'employee' } } },
    response,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);

  allowedEmployer(
    { auth: { user: { role: 'employer' } } },
    response,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);
});
