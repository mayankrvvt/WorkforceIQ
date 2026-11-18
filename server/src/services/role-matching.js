function getSkillId(skill) {
  return String(skill?._id || skill);
}

export function scoreJobRoles(profileSkills, roles) {
  const employeeSkills = new Map(
    (profileSkills || [])
      .filter((entry) => entry.skillId?.status === 'active')
      .map((entry) => [getSkillId(entry.skillId), entry]),
  );

  return roles
    .map((role) => {
      const requiredSkills = (role.requiredSkills || [])
        .map((entry) => entry.skillId)
        .filter((skill) => skill?.status === 'active');

      if (requiredSkills.length === 0) return null;

      const matchedSkills = [];
      const skillGaps = [];

      for (const skill of requiredSkills) {
        const employeeSkill = employeeSkills.get(getSkillId(skill));
        if (employeeSkill) {
          matchedSkills.push({
            name: skill.normalizedName,
            proficiency: employeeSkill.proficiency,
            yearsExperience: employeeSkill.yearsExperience ?? null,
          });
        } else {
          skillGaps.push(skill.normalizedName);
        }
      }

      return {
        _id: role._id,
        title: role.title,
        sector: role.sector,
        overview: role.overview,
        matchScore: Math.round(
          (matchedSkills.length / requiredSkills.length) * 100,
        ),
        matchedSkills,
        skillGaps,
        skillUtilization: role.skillUtilization || [],
        typicalDuties: role.typicalDuties || [],
        workSettings: role.workSettings || [],
        qualificationsToCheck: role.qualificationsToCheck || [],
      };
    })
    .filter((role) => role && role.matchedSkills.length > 0)
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore ||
        left.title.localeCompare(right.title),
    );
}
