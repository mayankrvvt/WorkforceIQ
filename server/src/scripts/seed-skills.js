import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Skill } from '../models/skill.model.js';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const starterSkills = [
  { normalizedName: 'driver', category: 'Transportation & Logistics' },
  { normalizedName: 'delivery driving', category: 'Transportation & Logistics' },
  { normalizedName: 'heavy vehicle driving', category: 'Transportation & Logistics' },
  { normalizedName: 'forklift operation', category: 'Transportation & Logistics' },
  { normalizedName: 'warehouse operations', category: 'Transportation & Logistics' },
  { normalizedName: 'healthcare assistance', category: 'Healthcare & Care' },
  { normalizedName: 'patient care assistance', category: 'Healthcare & Care' },
  { normalizedName: 'elder care', category: 'Healthcare & Care' },
  { normalizedName: 'childcare', category: 'Healthcare & Care' },
  { normalizedName: 'disability support', category: 'Healthcare & Care' },
  { normalizedName: 'first aid and CPR', category: 'Healthcare & Care' },
  { normalizedName: 'home care', category: 'Healthcare & Care' },
  { normalizedName: 'medical administration', category: 'Healthcare & Care' },
  { normalizedName: 'welding', category: 'Construction & Skilled Trades' },
  { normalizedName: 'plumbing', category: 'Construction & Skilled Trades' },
  { normalizedName: 'carpentry', category: 'Construction & Skilled Trades' },
  { normalizedName: 'electrical installation', category: 'Construction & Skilled Trades' },
  { normalizedName: 'HVAC maintenance', category: 'Construction & Skilled Trades' },
  { normalizedName: 'construction safety', category: 'Construction & Skilled Trades' },
  { normalizedName: 'cooking', category: 'Hospitality & Food Service' },
  { normalizedName: 'food preparation', category: 'Hospitality & Food Service' },
  { normalizedName: 'food safety', category: 'Hospitality & Food Service' },
  { normalizedName: 'housekeeping', category: 'Hospitality & Food Service' },
  { normalizedName: 'hotel service', category: 'Hospitality & Food Service' },
  { normalizedName: 'restaurant service', category: 'Hospitality & Food Service' },
  { normalizedName: 'crop farming', category: 'Agriculture' },
  { normalizedName: 'livestock care', category: 'Agriculture' },
  { normalizedName: 'farm equipment operation', category: 'Agriculture' },
  { normalizedName: 'machine operation', category: 'Manufacturing' },
  { normalizedName: 'quality inspection', category: 'Manufacturing' },
];

const retiredSkills = [
  'cloud computing',
  'communication',
  'customer service',
  'data analysis',
  'javascript',
  'leadership',
  'problem solving',
  'project management',
  'python',
  'spreadsheet analysis',
  'sql',
  'ux design',
];

try {
  await connectDatabase();

  let inserted = 0;
  for (const skill of starterSkills) {
    const result = await Skill.updateOne(
      { normalizedName: skill.normalizedName },
      { $setOnInsert: skill },
      { upsert: true },
    );
    inserted += result.upsertedCount;
  }

  const deactivated = await Skill.updateMany(
    { normalizedName: { $in: retiredSkills } },
    { $set: { status: 'inactive' } },
  );

  console.log(
    `Skill catalog ready; added ${inserted} starter skills and deactivated ${deactivated.modifiedCount} legacy skills.`,
  );
} catch (error) {
  console.error(`Skill catalog seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
