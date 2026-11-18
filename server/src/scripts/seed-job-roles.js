import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { JobRole } from '../models/job-role.model.js';
import { Skill } from '../models/skill.model.js';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const starterRoles = [
  {
    title: 'Care Assistant',
    sector: 'Healthcare & Care',
    aliases: ['personal support worker', 'care worker'],
    overview: 'Supports people with everyday care needs under appropriate supervision.',
    requiredSkillNames: [
      'healthcare assistance',
      'patient care assistance',
      'elder care',
      'home care',
    ],
    skillUtilization: [
      'Use patient and home-care skills to support daily routines and comfort.',
      'Apply elder-care experience when assisting older adults.',
    ],
    typicalDuties: [
      'Assist with daily living activities',
      'Support safe routines and report changes to the care team',
    ],
    workSettings: ['Home care', 'Residential care', 'Community support'],
    qualificationsToCheck: [
      'Verify local care-work credentials, screening, and training requirements.',
    ],
  },
  {
    title: 'Home Care Worker',
    sector: 'Healthcare & Care',
    aliases: ['home support worker'],
    overview: 'Provides practical support to people in their homes.',
    requiredSkillNames: [
      'home care',
      'elder care',
      'patient care assistance',
      'first aid and cpr',
    ],
    skillUtilization: [
      'Use home-care skills to assist with routines in a client home.',
      'Apply first-aid training within its certified scope and workplace policy.',
    ],
    typicalDuties: [
      'Assist with daily routines and agreed care plans',
      'Communicate observations to the appropriate care contact',
    ],
    workSettings: ['Private homes', 'Home-care agencies', 'Community programs'],
    qualificationsToCheck: [
      'Verify local care credentials, screening, and first-aid requirements.',
    ],
  },
  {
    title: 'Childcare Assistant',
    sector: 'Healthcare & Care',
    aliases: ['child care assistant', 'early years assistant'],
    overview: 'Helps provide safe, age-appropriate care in a childcare setting.',
    requiredSkillNames: ['childcare', 'first aid and cpr', 'healthcare assistance'],
    skillUtilization: [
      'Use childcare skills to support supervised play and daily routines.',
      'Apply first-aid training according to certification and site procedures.',
    ],
    typicalDuties: [
      'Assist with supervised activities and transitions',
      'Maintain a safe and orderly care environment',
    ],
    workSettings: ['Childcare centers', 'Family programs', 'After-school programs'],
    qualificationsToCheck: [
      'Verify local childcare credentials, screening, and first-aid requirements.',
    ],
  },
  {
    title: 'Delivery Driver',
    sector: 'Transportation & Logistics',
    aliases: ['courier driver', 'delivery courier'],
    overview: 'Transports goods and completes scheduled deliveries.',
    requiredSkillNames: ['driver', 'delivery driving'],
    skillUtilization: [
      'Use driving experience to complete assigned delivery routes safely.',
      'Apply delivery-driving skills to handle handoffs and proof of delivery.',
    ],
    typicalDuties: [
      'Inspect the assigned vehicle before routes',
      'Deliver orders and record completed handoffs',
    ],
    workSettings: ['Courier services', 'Retail delivery', 'Food distribution'],
    qualificationsToCheck: [
      'Verify local licence class, driving record, and employer requirements.',
    ],
  },
  {
    title: 'Heavy Vehicle Driver',
    sector: 'Transportation & Logistics',
    aliases: ['truck driver', 'commercial driver'],
    overview: 'Operates a heavy vehicle for commercial or freight transport.',
    requiredSkillNames: ['heavy vehicle driving', 'driver'],
    skillUtilization: [
      'Use heavy-vehicle experience for planned freight or passenger routes.',
      'Apply general driving skills to inspections and safe vehicle operation.',
    ],
    typicalDuties: [
      'Complete pre-trip and post-trip vehicle checks',
      'Transport assigned freight or passengers and maintain trip records',
    ],
    workSettings: ['Freight transport', 'Distribution', 'Passenger transport'],
    qualificationsToCheck: [
      'Verify the required local commercial licence class and endorsements.',
    ],
  },
  {
    title: 'Warehouse Associate',
    sector: 'Transportation & Logistics',
    aliases: ['warehouse worker', 'distribution associate'],
    overview: 'Supports the movement, storage, and checking of goods.',
    requiredSkillNames: [
      'warehouse operations',
      'forklift operation',
      'quality inspection',
    ],
    skillUtilization: [
      'Use warehouse skills to receive, organize, and prepare goods for dispatch.',
      'Apply inspection skills to identify visible order or packaging issues.',
    ],
    typicalDuties: [
      'Receive, sort, pick, and pack goods',
      'Record stock movements and follow site safety procedures',
    ],
    workSettings: ['Warehouses', 'Distribution centers', 'Manufacturing stores'],
    qualificationsToCheck: [
      'Verify site-specific equipment certification and safety training.',
    ],
  },
  {
    title: 'Electrical Installation Helper',
    sector: 'Construction & Skilled Trades',
    aliases: ['electrical helper', 'electrician assistant'],
    overview: 'Assists qualified tradespeople with supervised installation work.',
    requiredSkillNames: ['electrical installation', 'construction safety'],
    skillUtilization: [
      'Use installation experience for supervised material preparation and tasks.',
      'Apply construction-safety practices on an active worksite.',
    ],
    typicalDuties: [
      'Prepare tools and materials for assigned work',
      'Follow instructions and site safety procedures under supervision',
    ],
    workSettings: ['Construction sites', 'Building maintenance', 'Renovation'],
    qualificationsToCheck: [
      'Verify local electrical licensing rules and permitted supervised tasks.',
    ],
  },
  {
    title: 'Plumbing Helper',
    sector: 'Construction & Skilled Trades',
    aliases: ['plumber assistant', 'plumbing apprentice helper'],
    overview: 'Supports plumbing installation and repair work under supervision.',
    requiredSkillNames: ['plumbing', 'construction safety'],
    skillUtilization: [
      'Use plumbing skills for supervised preparation and repair tasks.',
      'Apply safety practices while working around tools and building systems.',
    ],
    typicalDuties: [
      'Prepare tools and materials for assigned work',
      'Assist with installations and keep the work area organized',
    ],
    workSettings: ['Construction sites', 'Building maintenance', 'Renovation'],
    qualificationsToCheck: [
      'Verify local trade registration, licensing, and supervision requirements.',
    ],
  },
  {
    title: 'Welder',
    sector: 'Construction & Skilled Trades',
    aliases: ['fabrication welder'],
    overview: 'Joins or repairs metal components using approved processes.',
    requiredSkillNames: ['welding', 'construction safety'],
    skillUtilization: [
      'Use welding skills to join components to job specifications.',
      'Apply site-safety practices and required protective equipment.',
    ],
    typicalDuties: [
      'Prepare materials and equipment for assigned welds',
      'Check finished work against instructions and report defects',
    ],
    workSettings: ['Fabrication shops', 'Construction sites', 'Repair facilities'],
    qualificationsToCheck: [
      'Verify process-specific trade credentials, testing, and safety requirements.',
    ],
  },
  {
    title: 'Food Preparation Worker',
    sector: 'Hospitality & Food Service',
    aliases: ['kitchen assistant', 'food prep worker'],
    overview: 'Prepares ingredients and supports safe kitchen operations.',
    requiredSkillNames: ['food preparation', 'food safety', 'cooking'],
    skillUtilization: [
      'Use preparation and cooking skills to support a consistent service workflow.',
      'Apply food-safety practices during storage and preparation.',
    ],
    typicalDuties: [
      'Prepare ingredients and keep workstations organized',
      'Follow recipes, cleaning schedules, and food-handling procedures',
    ],
    workSettings: ['Restaurants', 'Hotels', 'Institutional kitchens'],
    qualificationsToCheck: [
      'Verify local food-handler training and employer requirements.',
    ],
  },
  {
    title: 'Housekeeping Attendant',
    sector: 'Hospitality & Food Service',
    aliases: ['room attendant', 'cleaning attendant'],
    overview: 'Maintains clean, orderly guest or service areas.',
    requiredSkillNames: ['housekeeping', 'hotel service'],
    skillUtilization: [
      'Use housekeeping skills to prepare rooms and shared areas.',
      'Apply hotel-service practices when responding to routine guest requests.',
    ],
    typicalDuties: [
      'Clean and reset assigned rooms or areas',
      'Report maintenance needs and replenish approved supplies',
    ],
    workSettings: ['Hotels', 'Resorts', 'Facilities services'],
    qualificationsToCheck: [
      'Verify employer-specific safety and cleaning-product training.',
    ],
  },
  {
    title: 'Farm Worker',
    sector: 'Agriculture',
    aliases: ['agricultural worker', 'farm assistant'],
    overview: 'Supports crop or livestock operations and routine farm work.',
    requiredSkillNames: [
      'crop farming',
      'livestock care',
      'farm equipment operation',
    ],
    skillUtilization: [
      'Use crop and livestock skills for seasonal farm routines.',
      'Apply equipment experience only to machinery for which training is verified.',
    ],
    typicalDuties: [
      'Assist with crop, livestock, or farm-maintenance tasks',
      'Follow site procedures for equipment and animal handling',
    ],
    workSettings: ['Crop farms', 'Livestock farms', 'Agricultural operations'],
    qualificationsToCheck: [
      'Verify employer-specific equipment, animal-handling, and safety training.',
    ],
  },
  {
    title: 'Machine Operator',
    sector: 'Manufacturing',
    aliases: ['production machine operator'],
    overview: 'Operates assigned production equipment and checks output.',
    requiredSkillNames: ['machine operation', 'quality inspection'],
    skillUtilization: [
      'Use machine-operation skills to run assigned equipment to work instructions.',
      'Apply inspection skills to identify and report output variation.',
    ],
    typicalDuties: [
      'Set up and monitor assigned production equipment',
      'Record checks and report equipment or quality issues',
    ],
    workSettings: ['Manufacturing plants', 'Production lines', 'Processing facilities'],
    qualificationsToCheck: [
      'Verify equipment-specific training and site safety requirements.',
    ],
  },
];

try {
  await connectDatabase();

  const skillNames = [
    ...new Set(starterRoles.flatMap((role) => role.requiredSkillNames)),
  ];
  const skills = await Skill.find({
    normalizedName: { $in: skillNames },
    status: 'active',
  })
    .select('_id normalizedName')
    .lean();
  const skillByName = new Map(
    skills.map((skill) => [skill.normalizedName, skill._id]),
  );
  const missingSkills = skillNames.filter((name) => !skillByName.has(name));
  if (missingSkills.length > 0) {
    throw new Error(
      `Missing active skills (${missingSkills.join(', ')}); run npm run seed:skills first`,
    );
  }

  let inserted = 0;
  for (const role of starterRoles) {
    const { requiredSkillNames, ...fields } = role;
    const result = await JobRole.updateOne(
      { normalizedTitle: role.title.toLowerCase() },
      {
        $setOnInsert: {
          ...fields,
          normalizedTitle: role.title.toLowerCase(),
          requiredSkills: requiredSkillNames.map((name) => ({
            skillId: skillByName.get(name),
          })),
        },
      },
      { upsert: true },
    );
    inserted += result.upsertedCount;
  }

  console.log(
    `Job role catalog ready; added ${inserted} starter roles. Existing roles were left unchanged.`,
  );
} catch (error) {
  console.error(`Job role catalog seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
