import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  BriefcaseBusiness,
  LoaderCircle,
  LogOut,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { firebaseAuth } from './lib/firebase';
import { apiRequest } from './lib/api';

function getAuthErrorMessage(error) {
  if (error.code === 'auth/configuration-not-found') {
    return 'Firebase Authentication is not configured for this project. In Firebase Console, open Authentication and choose Get started, then enable Email/Password under Sign-in method. Make sure you are editing the project configured in the app.';
  }

  if (error.code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is disabled. Enable it in Firebase Console under Authentication > Sign-in method.';
  }

  return error.message || 'Unable to complete authentication';
}

function hasMeaningfulProfileDetails(profile) {
  const values = [
    profile.personalDetails?.firstName,
    profile.personalDetails?.lastName,
    profile.personalDetails?.phone,
    profile.location?.city,
    profile.location?.state,
    profile.location?.country,
    ...(profile.preferences?.targetRoles || []),
    ...(profile.preferences?.preferredIndustries || []),
  ];

  return (
    values.some((value) => typeof value === 'string' && value.trim().length > 0) ||
    profile.education?.some((entry) =>
      [entry.institution, entry.qualification, entry.fieldOfStudy].some(
        (value) => typeof value === 'string' && value.trim().length > 0,
      ),
    ) ||
    profile.experience?.some((entry) =>
      [entry.title, entry.employer, entry.description].some(
        (value) => typeof value === 'string' && value.trim().length > 0,
      ),
    ) ||
    profile.skills?.length > 0
  );
}

function App() {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [employerProfile, setEmployerProfile] = useState(null);
  const [employerProfileLoading, setEmployerProfileLoading] = useState(false);
  const [employerProfileSaving, setEmployerProfileSaving] = useState(false);
  const [employerProfileError, setEmployerProfileError] = useState('');
  const [employerProfileMessage, setEmployerProfileMessage] = useState('');
  const [employeeSearchFilters, setEmployeeSearchFilters] = useState({
    skill: '',
    country: '',
  });
  const [employeeSearchResults, setEmployeeSearchResults] = useState(null);
  const [employeeSearchLoading, setEmployeeSearchLoading] = useState(false);
  const [employeeSearchError, setEmployeeSearchError] = useState('');
  const [hiringJob, setHiringJob] = useState({
    jobTitle: '',
    jobRequirements: '',
    country: '',
  });
  const [hiringConsent, setHiringConsent] = useState(false);
  const [hiringRecommendations, setHiringRecommendations] = useState(null);
  const [hiringRecommendationsLoading, setHiringRecommendationsLoading] =
    useState(false);
  const [hiringRecommendationsError, setHiringRecommendationsError] =
    useState('');
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [verificationQueueLoading, setVerificationQueueLoading] = useState(false);
  const [verificationQueueError, setVerificationQueueError] = useState('');
  const [verificationNotes, setVerificationNotes] = useState({});
  const [verificationSavingId, setVerificationSavingId] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [skillCatalog, setSkillCatalog] = useState([]);
  const [skillCatalogLoading, setSkillCatalogLoading] = useState(false);
  const [skillCatalogError, setSkillCatalogError] = useState('');
  const [skillActionError, setSkillActionError] = useState('');
  const [skillSaving, setSkillSaving] = useState(false);
  const [skillProficiency, setSkillProficiency] = useState('intermediate');
  const [skillYearsExperience, setSkillYearsExperience] = useState('');
  const [skillEvidence, setSkillEvidence] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [analysisConsent, setAnalysisConsent] = useState(false);
  const [skillAnalysis, setSkillAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisHistoryLoading, setAnalysisHistoryLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [roleMatches, setRoleMatches] = useState([]);
  const [roleMatchesLoading, setRoleMatchesLoading] = useState(false);
  const [roleMatchesError, setRoleMatchesError] = useState('');

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      setError('');

      if (!user) {
        setAccount(null);
        setLoading(false);
        return;
      }

      try {
        const response = await apiRequest('/auth/me');
        setAccount(response.data);
      } catch (authError) {
        setAccount(null);
        setError(
          authError.message ||
            'Unable to load your WorkforceIQ account. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (account?.role !== 'employee') {
      setProfile(null);
      return undefined;
    }

    let active = true;
    setProfileLoading(true);
    setProfileError('');

    apiRequest('/employees/me')
      .then((response) => {
        if (active) {
          setProfile(response.data);
        }
      })
      .catch((profileLoadError) => {
        if (active) {
          setProfileError(profileLoadError.message);
        }
      })
      .finally(() => {
        if (active) {
          setProfileLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [account?.role]);

  useEffect(() => {
    if (account?.role !== 'employer') {
      setEmployerProfile(null);
      setEmployerProfileError('');
      return undefined;
    }

    let active = true;
    setEmployerProfileLoading(true);
    setEmployerProfileError('');

    apiRequest('/employers/me')
      .then((response) => {
        if (active) {
          setEmployerProfile(response.data);
        }
      })
      .catch((requestError) => {
        if (active) {
          setEmployerProfileError(requestError.message);
        }
      })
      .finally(() => {
        if (active) {
          setEmployerProfileLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [account?.role]);

  useEffect(() => {
    if (account?.role !== 'admin') {
      setVerificationQueue([]);
      setVerificationQueueError('');
      setVerificationQueueLoading(false);
      return undefined;
    }

    let active = true;
    setVerificationQueueLoading(true);
    setVerificationQueueError('');

    apiRequest('/employers/admin/verification?status=pending&limit=50')
      .then((response) => {
        if (active) {
          setVerificationQueue(response.data);
        }
      })
      .catch((requestError) => {
        if (active) {
          setVerificationQueueError(requestError.message);
        }
      })
      .finally(() => {
        if (active) {
          setVerificationQueueLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [account?.role]);

  useEffect(() => {
    if (account?.role !== 'employee') {
      setSkillCatalog([]);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSkillCatalogLoading(true);
      setSkillCatalogError('');

      try {
        const query = skillQuery.trim();
        const path = query
          ? `/skills?search=${encodeURIComponent(query)}&limit=50`
          : '/skills?limit=50';
        const response = await apiRequest(path);
        if (active) {
          setSkillCatalog(response.data);
        }
      } catch (catalogError) {
        if (active) {
          setSkillCatalogError(catalogError.message);
        }
      } finally {
        if (active) {
          setSkillCatalogLoading(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [account?.role, skillQuery]);

  useEffect(() => {
    if (account?.role !== 'employee') {
      setSkillAnalysis(null);
      setAnalysisConsent(false);
      setAnalysisError('');
      setAnalysisHistoryLoading(false);
      return undefined;
    }

    let active = true;
    setAnalysisHistoryLoading(true);
    setAnalysisError('');

    apiRequest('/ai/analyses?limit=1')
      .then((response) => {
        if (active) {
          setSkillAnalysis(response.data[0] || null);
        }
      })
      .catch((historyError) => {
        if (active) {
          setAnalysisError(historyError.message);
        }
      })
      .finally(() => {
        if (active) {
          setAnalysisHistoryLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [account?.role]);

  useEffect(() => {
    if (account?.role !== 'employee' || profileLoading || !profile) {
      setRoleMatches([]);
      setRoleMatchesError('');
      setRoleMatchesLoading(false);
      return undefined;
    }

    let active = true;
    setRoleMatchesLoading(true);
    setRoleMatchesError('');

    apiRequest('/job-roles/me/recommendations')
      .then((response) => {
        if (active) {
          setRoleMatches(response.data);
        }
      })
      .catch((requestError) => {
        if (active) {
          setRoleMatchesError(requestError.message);
        }
      })
      .finally(() => {
        if (active) {
          setRoleMatchesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [account?.role, profileLoading, profile?.skills]);

  function updateProfileSection(section, field, value) {
    setProfile((current) =>
      current
        ? {
            ...current,
            [section]: {
              ...current[section],
              [field]: value,
            },
          }
        : current,
    );
    setProfileMessage('');
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    if (!profile) return;

    setProfileSaving(true);
    setProfileError('');
    setProfileMessage('');

    try {
      const response = await apiRequest('/employees/me', {
        method: 'PATCH',
        body: JSON.stringify({
          personalDetails: profile.personalDetails || {},
          location: profile.location || {},
          preferences: profile.preferences || {},
          visibility: profile.visibility || 'private',
        }),
      });
      setProfile(response.data);
      setProfileMessage('Profile saved successfully.');
    } catch (saveError) {
      setProfileError(saveError.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleEmployerProfileSave(event) {
    event.preventDefault();
    if (!employerProfile) return;

    setEmployerProfileSaving(true);
    setEmployerProfileError('');
    setEmployerProfileMessage('');

    try {
      const response = await apiRequest('/employers/me', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: employerProfile.companyName,
          industry: employerProfile.industry || '',
          ...(employerProfile.size ? { size: employerProfile.size } : {}),
          location: employerProfile.location || {},
          website: employerProfile.website || '',
        }),
      });
      setEmployerProfile(response.data);
      setEmployerProfileMessage(
        'Company details saved. Your profile is pending verification again.',
      );
    } catch (requestError) {
      setEmployerProfileError(requestError.message);
    } finally {
      setEmployerProfileSaving(false);
    }
  }

  async function handleEmployeeSearch(event) {
    event.preventDefault();
    setEmployeeSearchLoading(true);
    setEmployeeSearchError('');
    setEmployeeSearchResults(null);

    try {
      const query = ['limit=20'];
      if (employeeSearchFilters.skill.trim()) {
        query.push(
          `skill=${encodeURIComponent(employeeSearchFilters.skill.trim())}`,
        );
      }
      if (employeeSearchFilters.country.trim()) {
        query.push(
          `country=${encodeURIComponent(employeeSearchFilters.country.trim())}`,
        );
      }
      const response = await apiRequest(`/matching/search?${query.join('&')}`);
      setEmployeeSearchResults(response.data);
    } catch (requestError) {
      setEmployeeSearchError(requestError.message);
    } finally {
      setEmployeeSearchLoading(false);
    }
  }

  async function handleHiringRecommendations(event) {
    event.preventDefault();
    if (!hiringConsent) return;

    setHiringConsent(false);
    setHiringRecommendationsLoading(true);
    setHiringRecommendationsError('');
    setHiringRecommendations(null);

    try {
      const response = await apiRequest('/matching/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          consent: true,
          jobTitle: hiringJob.jobTitle.trim(),
          ...(hiringJob.jobRequirements.trim()
            ? { jobRequirements: hiringJob.jobRequirements.trim() }
            : {}),
          ...(hiringJob.country.trim()
            ? { country: hiringJob.country.trim() }
            : {}),
        }),
      });
      setHiringRecommendations(response.data);
    } catch (requestError) {
      setHiringRecommendationsError(requestError.message);
    } finally {
      setHiringRecommendationsLoading(false);
    }
  }

  async function handleEmployerVerification(profileId, verificationStatus) {
    const verificationNote = verificationNotes[profileId]?.trim() || '';
    if (verificationStatus === 'rejected' && !verificationNote) return;

    setVerificationSavingId(profileId);
    setVerificationQueueError('');

    try {
      await apiRequest(`/employers/admin/verification/${profileId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          verificationStatus,
          ...(verificationStatus === 'rejected' ? { verificationNote } : {}),
        }),
      });
      setVerificationQueue((current) =>
        current.filter((profileEntry) => profileEntry._id !== profileId),
      );
      setVerificationNotes((current) => ({ ...current, [profileId]: '' }));
    } catch (requestError) {
      setVerificationQueueError(requestError.message);
    } finally {
      setVerificationSavingId('');
    }
  }

  async function handleAddSkill(skill) {
    setSkillSaving(true);
    setSkillActionError('');

    try {
      const response = await apiRequest('/employees/me/skills', {
        method: 'POST',
        body: JSON.stringify({
          skillId: skill._id,
          proficiency: skillProficiency,
          ...(skillYearsExperience !== ''
            ? { yearsExperience: Number(skillYearsExperience) }
            : {}),
          ...(skillEvidence.trim() ? { evidence: skillEvidence.trim() } : {}),
        }),
      });
      setProfile(response.data);
      setSkillYearsExperience('');
      setSkillEvidence('');
    } catch (skillError) {
      setSkillActionError(skillError.message);
    } finally {
      setSkillSaving(false);
    }
  }

  async function handleSkillProficiencyChange(skillId, proficiency) {
    setSkillSaving(true);
    setSkillActionError('');

    try {
      const response = await apiRequest(`/employees/me/skills/${skillId}`, {
        method: 'PATCH',
        body: JSON.stringify({ proficiency }),
      });
      setProfile(response.data);
    } catch (skillError) {
      setSkillActionError(skillError.message);
    } finally {
      setSkillSaving(false);
    }
  }

  async function handleRemoveSkill(skillId) {
    setSkillSaving(true);
    setSkillActionError('');

    try {
      const response = await apiRequest(`/employees/me/skills/${skillId}`, {
        method: 'DELETE',
      });
      setProfile(response.data);
    } catch (skillError) {
      setSkillActionError(skillError.message);
    } finally {
      setSkillSaving(false);
    }
  }

  async function handleSkillAnalysis(event) {
    event.preventDefault();
    if (!analysisConsent) return;

    setAnalysisConsent(false);
    setAnalysisLoading(true);
    setAnalysisError('');

    try {
      const response = await apiRequest('/ai/analyze-skills', {
        method: 'POST',
        body: JSON.stringify({
          consent: true,
          ...(destinationCountry.trim()
            ? { destinationCountry: destinationCountry.trim() }
            : {}),
        }),
      });
      setSkillAnalysis(response.data);
    } catch (requestError) {
      setAnalysisError(requestError.message);
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'register') {
        const signedInUser = firebaseAuth.currentUser;
        const user =
          signedInUser?.email?.toLowerCase() === email.trim().toLowerCase()
            ? signedInUser
            : (
                await createUserWithEmailAndPassword(
                  firebaseAuth,
                  email,
                  password,
                )
              ).user;
        const idToken = await user.getIdToken();
        const response = await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            idToken,
            role,
            ...(role === 'employer' ? { companyName } : {}),
          }),
        });
        setAccount(response.data);
      } else {
        await signInWithEmailAndPassword(
          firebaseAuth,
          email,
          password,
        );
        const response = await apiRequest('/auth/me');
        setAccount(response.data);
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await signOut(firebaseAuth);
    setAccount(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="animate-spin text-brand-600" />
      </main>
    );
  }

  if (firebaseUser && account) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                <BriefcaseBusiness size={21} />
              </div>
              <div>
                <p className="font-semibold text-slate-950">WorkforceIQ</p>
                <p className="text-sm text-slate-500">{account.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-600">
              {account.role} workspace
            </p>
            <h1 className="text-3xl font-bold text-slate-950">Welcome to WorkforceIQ</h1>
            <p className="mt-3 text-slate-600">
              Authentication and role authorization are active. Account status:
              {' '}{account.status}.
            </p>
          </div>
          {account.role === 'employer' && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Company profile
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Complete your company details for administrator verification.
                </p>
              </div>

              {employerProfileLoading && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Loading company profile...
                </p>
              )}
              {employerProfileError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {employerProfileError}
                </p>
              )}
              {employerProfile && !employerProfileLoading && (
                <>
                  <div className="mb-5 rounded-lg bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      Verification status:{' '}
                      <span className="capitalize">
                        {employerProfile.verificationStatus}
                      </span>
                    </p>
                    {employerProfile.verificationStatus === 'pending' && (
                      <p className="mt-1 text-sm text-slate-600">
                        Your company details are awaiting administrator review.
                      </p>
                    )}
                    {employerProfile.verificationStatus === 'verified' && (
                      <p className="mt-1 text-sm text-slate-600">
                        Your company is verified. Saving any profile edit will
                        return it to pending review.
                      </p>
                    )}
                    {employerProfile.verificationStatus === 'rejected' && (
                      <p className="mt-1 text-sm text-slate-600">
                        {employerProfile.verificationNote ||
                          'Please update your company details and resubmit for review.'}
                      </p>
                    )}
                  </div>

                  <form
                    onSubmit={handleEmployerProfileSave}
                    className="space-y-5"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Company name
                        <input
                          required
                          minLength={2}
                          maxLength={160}
                          value={employerProfile.companyName || ''}
                          onChange={(event) =>
                            setEmployerProfile((current) => ({
                              ...current,
                              companyName: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                        />
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Industry
                        <input
                          maxLength={100}
                          value={employerProfile.industry || ''}
                          onChange={(event) =>
                            setEmployerProfile((current) => ({
                              ...current,
                              industry: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                        />
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Company size
                        <select
                          value={employerProfile.size || ''}
                          onChange={(event) =>
                            setEmployerProfile((current) => ({
                              ...current,
                              size: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
                        >
                          <option value="">Select size</option>
                          {[
                            '1-10',
                            '11-50',
                            '51-200',
                            '201-500',
                            '501-1000',
                            '1000+',
                          ].map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Website
                        <input
                          type="url"
                          maxLength={200}
                          value={employerProfile.website || ''}
                          onChange={(event) =>
                            setEmployerProfile((current) => ({
                              ...current,
                              website: event.target.value,
                            }))
                          }
                          placeholder="https://example.com"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                        />
                      </label>
                      {['city', 'state', 'country'].map((field) => (
                        <label
                          key={field}
                          className="text-sm font-semibold capitalize text-slate-700"
                        >
                          {field === 'state' ? 'State / region' : field}
                          <input
                            maxLength={100}
                            value={employerProfile.location?.[field] || ''}
                            onChange={(event) =>
                              setEmployerProfile((current) => ({
                                ...current,
                                location: {
                                  ...current.location,
                                  [field]: event.target.value,
                                },
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                          />
                        </label>
                      ))}
                    </div>

                    {employerProfileMessage && (
                      <p className="text-sm text-emerald-700">
                        {employerProfileMessage}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={employerProfileSaving}
                      className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {employerProfileSaving ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Save company profile
                    </button>
                  </form>
                </>
              )}
            </section>
          )}
          {account.role === 'employer' &&
            employerProfile?.verificationStatus === 'verified' && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-950">
                    Employee search
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Search by an occupational skill, country, or both. Only
                    employees who set their profiles to public appear. Contact
                    details and employer names are not shown.
                  </p>
                </div>

                <form
                  onSubmit={handleEmployeeSearch}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <label className="text-sm font-semibold text-slate-700">
                    Skill
                    <input
                      maxLength={80}
                      value={employeeSearchFilters.skill}
                      onChange={(event) => {
                        setEmployeeSearchFilters((current) => ({
                          ...current,
                          skill: event.target.value,
                        }));
                        setEmployeeSearchResults(null);
                        setEmployeeSearchError('');
                      }}
                      placeholder="For example, patient care"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Country
                    <input
                      maxLength={100}
                      value={employeeSearchFilters.country}
                      onChange={(event) => {
                        setEmployeeSearchFilters((current) => ({
                          ...current,
                          country: event.target.value,
                        }));
                        setEmployeeSearchResults(null);
                        setEmployeeSearchError('');
                      }}
                      placeholder="Country"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      employeeSearchLoading ||
                      (!employeeSearchFilters.skill.trim() &&
                        !employeeSearchFilters.country.trim())
                    }
                    className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
                  >
                    {employeeSearchLoading ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : null}
                    {employeeSearchLoading ? 'Searching...' : 'Search employees'}
                  </button>
                </form>

                {employeeSearchError && (
                  <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {employeeSearchError}
                  </p>
                )}
                {employeeSearchResults?.length === 0 && (
                  <p className="mt-5 text-sm text-slate-500">
                    No public employee profiles matched those filters.
                  </p>
                )}
                {employeeSearchResults?.length > 0 && (
                  <div className="mt-5 space-y-4">
                    {employeeSearchResults.map((employee) => (
                      <article
                        key={employee._id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold text-slate-950">
                            {employee.displayName}
                          </h3>
                          <span className="text-sm text-slate-500">
                            {[
                              employee.location.city,
                              employee.location.state,
                              employee.location.country,
                            ]
                              .filter(Boolean)
                              .join(', ') || 'Location not listed'}
                          </span>
                        </div>
                        {employee.targetRoles.length > 0 && (
                          <p className="mt-2 text-sm text-slate-700">
                            Interested roles: {employee.targetRoles.join(', ')}
                          </p>
                        )}
                        {employee.skills.length > 0 && (
                          <p className="mt-2 text-sm text-slate-700">
                            Skills:{' '}
                            {employee.skills
                              .map((skill) => `${skill.name} (${skill.proficiency})`)
                              .join(', ')}
                          </p>
                        )}
                        {employee.education.length > 0 && (
                          <p className="mt-2 text-sm text-slate-600">
                            Education:{' '}
                            {employee.education
                              .map((entry) =>
                                [entry.qualification, entry.fieldOfStudy]
                                  .filter(Boolean)
                                  .join(' — '),
                              )
                              .filter(Boolean)
                              .join('; ')}
                          </p>
                        )}
                        {employee.experience.length > 0 && (
                          <p className="mt-2 text-sm text-slate-600">
                            Experience:{' '}
                            {employee.experience
                              .map((entry) => entry.title)
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                        {employee.willingToRelocate && (
                          <p className="mt-2 text-sm text-slate-600">
                            Open to relocation
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          {account.role === 'employer' &&
            employerProfile?.verificationStatus === 'verified' && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="mb-6">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-950">
                    <Sparkles size={20} className="text-brand-600" />
                    AI-assisted candidate recommendations
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Describe the role to identify relevant skills and rank
                    matching public profiles. The match score reflects skill
                    overlap only; it is not a hiring decision.
                  </p>
                </div>

                <form
                  onSubmit={handleHiringRecommendations}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Job title
                      <input
                        required
                        minLength={2}
                        maxLength={160}
                        value={hiringJob.jobTitle}
                        onChange={(event) => {
                          setHiringJob((current) => ({
                            ...current,
                            jobTitle: event.target.value,
                          }));
                          setHiringConsent(false);
                          setHiringRecommendations(null);
                          setHiringRecommendationsError('');
                        }}
                        placeholder="For example, care assistant"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Work country (optional)
                      <input
                        maxLength={100}
                        value={hiringJob.country}
                        onChange={(event) => {
                          setHiringJob((current) => ({
                            ...current,
                            country: event.target.value,
                          }));
                          setHiringConsent(false);
                          setHiringRecommendations(null);
                          setHiringRecommendationsError('');
                        }}
                        placeholder="Country"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Job requirements (optional)
                    <textarea
                      maxLength={3000}
                      rows={4}
                      value={hiringJob.jobRequirements}
                      onChange={(event) => {
                        setHiringJob((current) => ({
                          ...current,
                          jobRequirements: event.target.value,
                        }));
                        setHiringConsent(false);
                        setHiringRecommendations(null);
                        setHiringRecommendationsError('');
                      }}
                      placeholder="Describe the job-related skills and duties. Do not include applicant or employee personal information."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>

                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    <p>
                      Your job title and requirements are processed by our AI
                      service to identify catalog skills. Candidate profiles
                      are not sent to that service; matching happens within
                      WorkforceIQ using public profiles. Do not include
                      applicant personal information in the job details.
                    </p>
                    <label className="mt-3 flex items-center gap-3 text-slate-700">
                      <input
                        type="checkbox"
                        checked={hiringConsent}
                        disabled={hiringRecommendationsLoading}
                        onChange={(event) =>
                          setHiringConsent(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      />
                      <span>I agree</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      hiringRecommendationsLoading ||
                      !hiringConsent ||
                      hiringJob.jobTitle.trim().length < 2
                    }
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {hiringRecommendationsLoading ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {hiringRecommendationsLoading
                      ? 'Finding skill matches...'
                      : 'Recommend candidates'}
                  </button>
                </form>

                {hiringRecommendationsError && (
                  <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {hiringRecommendationsError}
                  </p>
                )}
                {hiringRecommendations && (
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="font-semibold text-slate-950">
                      Skills identified for {hiringRecommendations.jobTitle}
                    </h3>
                    {hiringRecommendations.criteriaSkills.length > 0 ? (
                      <p className="mt-2 text-sm text-slate-700">
                        {hiringRecommendations.criteriaSkills
                          .map((skill) => skill.name)
                          .join(', ')}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">
                        No skills from the active catalog were identified.
                        Try adding more job-related detail.
                      </p>
                    )}

                    {hiringRecommendations.criteriaSkills.length > 0 &&
                      hiringRecommendations.candidates.length === 0 && (
                        <p className="mt-4 text-sm text-slate-500">
                          No public profiles matched these skills and location.
                        </p>
                      )}
                    {hiringRecommendations.candidates.length > 0 && (
                      <div className="mt-4 space-y-4">
                        {hiringRecommendations.candidates.map((candidate) => (
                          <article
                            key={candidate._id}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <h4 className="font-semibold text-slate-950">
                                {candidate.displayName}
                              </h4>
                              <span className="text-sm font-semibold text-brand-700">
                                {candidate.matchScore}% skill overlap
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {[
                                candidate.location.city,
                                candidate.location.state,
                                candidate.location.country,
                              ]
                                .filter(Boolean)
                                .join(', ') || 'Location not listed'}
                            </p>
                            <p className="mt-2 text-sm text-slate-700">
                              Matched skills: {candidate.matchedSkills.join(', ')}
                            </p>
                            {candidate.missingSkills.length > 0 && (
                              <p className="mt-1 text-sm text-slate-600">
                                Other identified skills:{' '}
                                {candidate.missingSkills.join(', ')}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                    <p className="mt-4 text-xs text-slate-500">
                      Recommendations use active catalog skills and public
                      profiles only. Verify qualifications and assess candidates
                      fairly through your own hiring process.
                    </p>
                  </div>
                )}
              </section>
            )}
          {account.role === 'admin' && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Employer verification queue
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Review company details and approve or reject pending profiles.
                </p>
              </div>

              {verificationQueueError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {verificationQueueError}
                </p>
              )}
              {verificationQueueLoading && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Loading pending companies...
                </p>
              )}
              {!verificationQueueLoading &&
                !verificationQueueError &&
                verificationQueue.length === 0 && (
                  <p className="text-sm text-slate-500">
                    There are no pending employer profiles.
                  </p>
                )}
              {!verificationQueueLoading && verificationQueue.length > 0 && (
                <div className="space-y-4">
                  {verificationQueue.map((entry) => (
                    <article
                      key={entry._id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <h3 className="font-semibold text-slate-950">
                        {entry.companyName}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {entry.userId?.email}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {[entry.industry, entry.size, entry.location?.city,
                          entry.location?.state, entry.location?.country]
                          .filter(Boolean)
                          .join(' · ') || 'No additional company details'}
                      </p>
                      {entry.website && (
                        <p className="mt-1 text-sm text-slate-600">
                          Website: {entry.website}
                        </p>
                      )}
                      <label className="mt-4 block text-sm font-semibold text-slate-700">
                        Rejection note (required to reject)
                        <textarea
                          maxLength={500}
                          value={verificationNotes[entry._id] || ''}
                          onChange={(event) =>
                            setVerificationNotes((current) => ({
                              ...current,
                              [entry._id]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={verificationSavingId === entry._id}
                          onClick={() =>
                            handleEmployerVerification(entry._id, 'verified')
                          }
                          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          Verify company
                        </button>
                        <button
                          type="button"
                          disabled={
                            verificationSavingId === entry._id ||
                            !verificationNotes[entry._id]?.trim()
                          }
                          onClick={() =>
                            handleEmployerVerification(entry._id, 'rejected')
                          }
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {account.role === 'employee' && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">Employee profile</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Add your details and work preferences to complete your profile.
                </p>
              </div>

              {profileLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Loading profile...
                </div>
              )}
              {profileError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {profileError}
                </p>
              )}
              {profile && !profileLoading && (
                <form onSubmit={handleProfileSave} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">
                      First name
                      <input
                        value={profile.personalDetails?.firstName || ''}
                        onChange={(event) =>
                          updateProfileSection(
                            'personalDetails',
                            'firstName',
                            event.target.value,
                          )
                        }
                        maxLength={80}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Last name
                      <input
                        value={profile.personalDetails?.lastName || ''}
                        onChange={(event) =>
                          updateProfileSection(
                            'personalDetails',
                            'lastName',
                            event.target.value,
                          )
                        }
                        maxLength={80}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Phone
                      <input
                        type="tel"
                        value={profile.personalDetails?.phone || ''}
                        onChange={(event) =>
                          updateProfileSection(
                            'personalDetails',
                            'phone',
                            event.target.value,
                          )
                        }
                        maxLength={32}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      City
                      <input
                        value={profile.location?.city || ''}
                        onChange={(event) =>
                          updateProfileSection('location', 'city', event.target.value)
                        }
                        maxLength={100}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      State / region
                      <input
                        value={profile.location?.state || ''}
                        onChange={(event) =>
                          updateProfileSection('location', 'state', event.target.value)
                        }
                        maxLength={100}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Country
                      <input
                        value={profile.location?.country || ''}
                        onChange={(event) =>
                          updateProfileSection(
                            'location',
                            'country',
                            event.target.value,
                          )
                        }
                        maxLength={100}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Preferred work mode
                      <select
                        value={profile.preferences?.workMode || 'any'}
                        onChange={(event) =>
                          updateProfileSection(
                            'preferences',
                            'workMode',
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
                      >
                        <option value="any">Any</option>
                        <option value="onsite">On-site</option>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Profile visibility
                      <select
                        value={profile.visibility || 'private'}
                        onChange={(event) => {
                          setProfile((current) =>
                            current
                              ? { ...current, visibility: event.target.value }
                              : current,
                          );
                          setProfileMessage('');
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
                      >
                        <option value="private">Private</option>
                        <option value="consent_only">By consent</option>
                        <option value="public">Public</option>
                      </select>
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={profile.preferences?.willingToRelocate || false}
                      onChange={(event) =>
                        updateProfileSection(
                          'preferences',
                          'willingToRelocate',
                          event.target.checked,
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    Willing to relocate
                  </label>

                  {profileMessage && (
                    <p className="text-sm text-emerald-700">{profileMessage}</p>
                  )}
                  {!hasMeaningfulProfileDetails(profile) && (
                    <p className="text-sm text-slate-500">
                      Add at least one profile detail before saving.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={
                      profileSaving ||
                      profileLoading ||
                      !hasMeaningfulProfileDetails(profile)
                    }
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {profileSaving ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save profile
                  </button>
                </form>
              )}
            </section>
          )}
          {account.role === 'employee' && profile && !profileLoading && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Skill-based role matches
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  See where your listed work skills may be used, what duties are
                  common, and which catalog skills may be missing. The match score
                  measures skill overlap only; it is not a qualification,
                  employment, or immigration assessment.
                </p>
              </div>

              {roleMatchesError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {roleMatchesError}
                </p>
              )}
              {roleMatchesLoading && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Finding roles that use your skills...
                </p>
              )}
              {!roleMatchesLoading &&
                !roleMatchesError &&
                roleMatches.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Add active catalog skills to see matching job roles.
                  </p>
                )}

              {!roleMatchesLoading && roleMatches.length > 0 && (
                <div className="space-y-4">
                  {roleMatches.map((roleMatch) => (
                    <article
                      key={roleMatch._id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-slate-950">
                            {roleMatch.title}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {roleMatch.sector}
                          </p>
                        </div>
                        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                          {roleMatch.matchScore}% skill overlap
                        </span>
                      </div>
                      {roleMatch.overview && (
                        <p className="mt-3 text-sm text-slate-700">
                          {roleMatch.overview}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-slate-600">
                        Skills matched: {roleMatch.matchedSkills
                          .map((skill) => skill.name)
                          .join(', ')}
                      </p>
                      {roleMatch.skillGaps.length > 0 && (
                        <p className="mt-1 text-sm text-slate-600">
                          Other catalog skills to consider: {roleMatch.skillGaps.join(', ')}
                        </p>
                      )}
                      {[
                        ['How your skills may be used', roleMatch.skillUtilization],
                        ['Typical duties', roleMatch.typicalDuties],
                        ['Common work settings', roleMatch.workSettings],
                        [
                          'Requirements to verify',
                          roleMatch.qualificationsToCheck,
                        ],
                      ].map(
                        ([heading, items]) =>
                          items.length > 0 && (
                            <div key={heading} className="mt-3">
                              <h4 className="text-sm font-semibold text-slate-800">
                                {heading}
                              </h4>
                              <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                                {items.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ),
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {account.role === 'employee' && profile && !profileLoading && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">Skills</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Explore work skills across healthcare, transport, construction,
                  hospitality, agriculture, and manufacturing. These are not visa
                  eligibility recommendations.
                </p>
              </div>

              {skillActionError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {skillActionError}
                </p>
              )}

              {profile.skills?.length > 0 ? (
                <div className="mb-6 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {profile.skills.map((entry) => {
                    const skillId =
                      typeof entry.skillId === 'object'
                        ? entry.skillId._id
                        : entry.skillId;
                    const skillName =
                      typeof entry.skillId === 'object'
                        ? entry.skillId.normalizedName
                        : 'Skill';
                    const skillCategory =
                      typeof entry.skillId === 'object'
                        ? entry.skillId.category
                        : '';

                    return (
                      <div
                        key={skillId}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold capitalize text-slate-900">
                            {skillName}
                          </p>
                          <p className="text-sm text-slate-500">{skillCategory}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`${skillName} proficiency`}
                            value={entry.proficiency}
                            disabled={skillSaving}
                            onChange={(event) =>
                              handleSkillProficiencyChange(
                                skillId,
                                event.target.value,
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                            <option value="expert">Expert</option>
                          </select>
                          <button
                            type="button"
                            aria-label={`Remove ${skillName}`}
                            disabled={skillSaving}
                            onClick={() => handleRemoveSkill(skillId)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mb-6 text-sm text-slate-500">
                  No skills added to your profile yet.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Search the skills catalog
                  <input
                    value={skillQuery}
                    onChange={(event) => setSkillQuery(event.target.value)}
                    maxLength={80}
                    placeholder="Search skills"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Proficiency
                  <select
                    value={skillProficiency}
                    onChange={(event) => setSkillProficiency(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Years of experience
                  <input
                    type="number"
                    min="0"
                    max="80"
                    step="0.5"
                    value={skillYearsExperience}
                    onChange={(event) =>
                      setSkillYearsExperience(event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Evidence or example (optional)
                  <input
                    value={skillEvidence}
                    onChange={(event) => setSkillEvidence(event.target.value)}
                    maxLength={2000}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  />
                </label>
              </div>

              {skillCatalogError && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {skillCatalogError}
                </p>
              )}
              {skillCatalogLoading && (
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Searching skills...
                </p>
              )}
              {!skillCatalogLoading &&
                !skillCatalogError &&
                skillCatalog.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">
                    No active skills found. Ask an administrator to add skills to
                    the catalog.
                  </p>
                )}
              {!skillCatalogLoading && skillCatalog.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {skillCatalog.map((skill) => {
                    const alreadyAdded = profile.skills?.some(
                      (entry) =>
                        (typeof entry.skillId === 'object'
                          ? entry.skillId._id
                          : entry.skillId) === skill._id,
                    );

                    return (
                      <li
                        key={skill._id}
                        className="flex items-center justify-between gap-4 p-3"
                      >
                        <div>
                          <p className="font-medium capitalize text-slate-900">
                            {skill.normalizedName}
                          </p>
                          <p className="text-sm text-slate-500">{skill.category}</p>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyAdded || skillSaving}
                          onClick={() => handleAddSkill(skill)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50"
                        >
                          <Plus size={15} />
                          {alreadyAdded ? 'Added' : 'Add'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
          {account.role === 'employee' && profile && !profileLoading && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Transferable skills analysis
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Explore occupations that may fit your work skills. This is career
                  guidance, not immigration or visa advice.
                </p>
              </div>

              <form onSubmit={handleSkillAnalysis} className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Destination country (optional)
                  <input
                    value={destinationCountry}
                    onChange={(event) => setDestinationCountry(event.target.value)}
                    maxLength={100}
                    placeholder="For example, Canada"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  />
                </label>

                <p className="text-sm text-slate-600">
                  This analysis uses your active skills, education, career
                  preferences, and optional destination country. Your name, contact
                  details, exact location, and employer names are not included.
                </p>
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={analysisConsent}
                    disabled={analysisLoading}
                    onChange={(event) => setAnalysisConsent(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span>I agree</span>
                </label>

                {analysisError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {analysisError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    analysisLoading ||
                    !analysisConsent ||
                    !profile.skills?.some(
                      (entry) => entry.skillId?.status === 'active',
                    )
                  }
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {analysisLoading ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : null}
                  {analysisLoading ? 'Analyzing...' : 'Analyze my skills'}
                </button>
                {!profile.skills?.some(
                  (entry) => entry.skillId?.status === 'active',
                ) && (
                  <p className="text-sm text-slate-500">
                    Add at least one active catalog skill before requesting an
                    analysis.
                  </p>
                )}
              </form>

              {analysisHistoryLoading && !skillAnalysis && (
                <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Loading your latest analysis...
                </p>
              )}

              {skillAnalysis?.result && (
                <div className="mt-6 space-y-5 border-t border-slate-200 pt-5">
                  <div>
                    <h3 className="font-semibold text-slate-950">
                      Analysis summary
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      {skillAnalysis.result.summary}
                    </p>
                    {skillAnalysis.createdAt && (
                      <p className="mt-2 text-xs text-slate-500">
                        Saved {new Date(skillAnalysis.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {skillAnalysis.result.occupations.map((occupation) => (
                      <article
                        key={`${occupation.title}-${occupation.sector}`}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold text-slate-950">
                            {occupation.title}
                          </h3>
                          <span className="text-sm text-slate-500">
                            {occupation.sector} · Fit {occupation.relevance}/5
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">
                          {occupation.rationale}
                        </p>
                        {[
                          ['Skills that may transfer', occupation.supportingSkills],
                          ['Potential skill gaps', occupation.skillGaps],
                          ['Typical duties', occupation.typicalDuties],
                          [
                            'Qualifications to verify',
                            occupation.qualificationsToCheck,
                          ],
                          ['Training ideas', occupation.trainingSuggestions],
                        ].map(
                          ([heading, items]) =>
                            items.length > 0 && (
                              <div key={heading} className="mt-3">
                                <h4 className="text-sm font-semibold text-slate-800">
                                  {heading}
                                </h4>
                                <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                                  {items.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ),
                        )}
                      </article>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    AI results may be inaccurate. Confirm job, licensing, and
                    immigration requirements with official sources.
                  </p>
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <BriefcaseBusiness size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Access your WorkforceIQ workspace.
          </p>

          {mode === 'register' && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {['employee', 'employer'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${
                    role === option
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && role === 'employer' && (
              <label className="block text-sm font-semibold text-slate-700">
                Company name
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                  required
                />
              </label>
            )}
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                required
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                minLength={6}
                required
              />
            </label>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting && <LoaderCircle size={16} className="animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="mt-5 w-full text-sm font-semibold text-brand-600"
          >
            {mode === 'login'
              ? 'New to WorkforceIQ? Create account'
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
