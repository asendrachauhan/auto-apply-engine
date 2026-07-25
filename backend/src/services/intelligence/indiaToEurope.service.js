'use strict';
const logger = require('../../utils/logger');

const VISA_PATHWAYS = {
  DE: { country:'Germany', flag:'DE', visaName:'EU Blue Card / Opportunity Card', minSalaryEUR:40800, processingDays:{min:30,max:90}, languages:['English B2+','German B1 preferred'], topCities:['Berlin','Munich','Frankfurt'], avgItSalaryEUR:{junior:48000,mid:62000,senior:80000}, strengths:['Largest EU tech market','Opportunity Card (no job offer needed)','Strong startup scene'], website:'https://www.make-it-in-germany.com' },
  NL: { country:'Netherlands', flag:'NL', visaName:'Highly Skilled Migrant (HSM)', minSalaryEUR:46107, processingDays:{min:14,max:30}, languages:['English-only tech scene'], topCities:['Amsterdam','Eindhoven','Utrecht'], avgItSalaryEUR:{junior:50000,mid:65000,senior:85000}, strengths:['Fastest EU visa (14 days)','English-only tech','30% tax ruling'], website:'https://ind.nl/en' },
  PT: { country:'Portugal', flag:'PT', visaName:'Tech Visa / D3', minSalaryEUR:25000, processingDays:{min:30,max:60}, languages:['English (Lisbon/Porto)'], topCities:['Lisbon','Porto'], avgItSalaryEUR:{junior:28000,mid:38000,senior:52000}, strengths:['Lowest cost of living','Tech Visa for tech workers','Growing startup scene'], website:'https://vistos.mne.gov.pt' },
  SE: { country:'Sweden', flag:'SE', visaName:'Work Permit', minSalaryEUR:0, processingDays:{min:30,max:90}, languages:['English universally spoken'], topCities:['Stockholm','Gothenburg'], avgItSalaryEUR:{junior:48000,mid:65000,senior:90000}, strengths:['Highest quality of life','No minimum salary','Excellent benefits'], website:'https://www.migrationsverket.se' },
};

const convertCTCToEuropean = (ctcLPA, targetCountry = 'DE') => {
  const pathway = VISA_PATHWAYS[targetCountry];
  if (!pathway) throw new Error(`Unsupported country: ${targetCountry}`);
  const ctcINR = ctcLPA * 100000;
  const ctcEUR = Math.round(ctcINR * 0.011);
  const marketAvgEUR = pathway.avgItSalaryEUR.mid;
  const upliftFactor = (marketAvgEUR / ctcEUR).toFixed(1);
  return {
    indiaCtcLPA: ctcLPA, equivalentEUR: ctcEUR, marketAverageEUR: marketAvgEUR,
    potentialUpliftX: parseFloat(upliftFactor), meetsVisaMinimum: ctcEUR >= pathway.minSalaryEUR,
    expectedRangeEUR: pathway.avgItSalaryEUR,
    negotiationGuidance: `Your ${ctcLPA} LPA (₹${(ctcINR/100000).toFixed(1)}L) ≈ €${ctcEUR.toLocaleString()}. In ${pathway.country}, mid-level devs earn €${marketAvgEUR.toLocaleString()} — a ${upliftFactor}x increase. Quote local market rate (€${pathway.avgItSalaryEUR.mid.toLocaleString()}–€${pathway.avgItSalaryEUR.senior.toLocaleString()}), not your Indian CTC.`,
    targetCountry,
  };
};

const checkVisaEligibility = (resumeData, targetCountry = 'DE') => {
  const pathway   = VISA_PATHWAYS[targetCountry];
  if (!pathway) return { eligible: false, reason: 'Country not supported' };
  const hasDegree = resumeData.education?.some(e => e.degree?.length > 2);
  const hasSkills = (resumeData.skills?.technical?.length || 0) >= 3;
  const positives = [], issues = [];
  if (hasDegree)  positives.push('Degree meets EU Blue Card education requirement');
  else            issues.push('No degree found — use Germany Opportunity Card or demonstrate equivalent skills');
  if (hasSkills)  positives.push('Technical skill set is in demand across EU');
  return {
    targetCountry, countryName: pathway.country, visaType: pathway.visaName,
    eligible: issues.length === 0, processingDays: pathway.processingDays,
    positives, issues, website: pathway.website,
    requiredDocuments: ['Valid passport (min 1 year remaining)','Signed EU employment contract','University degree certificate','Proof of qualifications','Health insurance','Proof of accommodation'],
  };
};

const getEuropeanResumeGuidance = (parsedResume, targetCountry = 'DE') => {
  const pathway = VISA_PATHWAYS[targetCountry];
  return {
    targetCountry,
    issues: [
      { issue:'Photo on resume', severity:'HIGH', fix:'Remove photo entirely. EU anti-discrimination law prohibits photos.' },
      { issue:'Including CTC/salary', severity:'HIGH', fix:'Never include Indian CTC. Quote expectations in EUR when asked.' },
      { issue:'Resume length > 2 pages', severity:'MEDIUM', fix:'Max 2 pages. Focus on last 5 years. Cut oldest experience.' },
      { issue:'Weak bullet format', severity:'HIGH', fix:'Every bullet: [Action verb] + [What you did] + [Quantified result]' },
      { issue:'Notice period ambiguity', severity:'MEDIUM', fix:`State "Available from [date]" explicitly. ${pathway?.country} standard is 1 month.` },
    ],
    culturalNotes: [
      `${pathway?.country} employers value directness — put biggest achievement in line 1 of summary`,
      'Cover letters are 150–200 words max and company-specific',
      'LinkedIn must match resume exactly — inconsistencies raise red flags',
      'References: "Available on request" is fine — do not list them',
    ],
  };
};

const getAllPathways = () => Object.values(VISA_PATHWAYS).map(p => ({
  country: p.country, flag: p.flag, visaName: p.visaName,
  processingDays: p.processingDays, languages: p.languages,
  avgMidSalaryEUR: p.avgItSalaryEUR.mid, strengths: p.strengths, website: p.website,
}));

const getEURelevanceBoost = (job, prefs = {}) => {
  let boost = 0;
  if (job.euMeta?.visaSponsorship) boost += 15;
  if (job.euMeta?.relocation)      boost += 10;
  if (!(job.description || '').toLowerCase().includes('german required')) boost += 5;
  return Math.min(boost, 30);
};

module.exports = { convertCTCToEuropean, checkVisaEligibility, getEuropeanResumeGuidance, getAllPathways, getEURelevanceBoost, VISA_PATHWAYS };
