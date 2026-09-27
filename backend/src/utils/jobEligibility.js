'use strict';

/**
 * Job Candidate Eligibility Evaluator
 *
 * Enforces location, remote preferences, and visa sponsorship rules:
 * - Candidate in India must NOT receive onsite/hybrid jobs in London, Berlin, etc.,
 *   UNLESS employer explicitly provides Visa Sponsorship or Relocation.
 * - Worldwide remote jobs are fully accessible to Indian/global candidates.
 * - Restrictive remote jobs ("US only", "UK only") are filtered out for overseas candidates.
 */

const isJobEligible = (job, preferences = {}) => {
  if (!job) return false;

  const userLocations = (preferences?.locations || []).map(l => l.toLowerCase().trim()).filter(Boolean);
  const remoteOnly = Boolean(preferences?.remoteOnly);
  const visaRequired = Boolean(preferences?.visaSponsorshipRequired);

  const jobLoc = (job.location || '').toLowerCase();
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();

  // Check if job is remote
  const isJobRemote = Boolean(job.remote) ||
    /remote|anywhere|work from home|telecommute|worldwide/i.test(jobLoc) ||
    /\b(remote|work from anywhere)\b/i.test(jobTitle);

  // Check if job offers visa sponsorship or relocation
  const hasVisa = Boolean(job.euMeta?.visaSponsorship) ||
    Boolean(job.euMeta?.relocation) ||
    Boolean(job.visaSponsorship) ||
    /visa (sponsorship|sponsor|supported|assistance)|relocation (package|assistance|support)/i.test(jobDesc) ||
    /visa (sponsorship|sponsor)/i.test(jobTitle);

  // Check if candidate is based in India
  const isCandidateInIndia = userLocations.length === 0 || userLocations.some(l =>
    /india|pune|bangalore|bengaluru|delhi|mumbai|hyderabad|chennai|noida|gurgaon|remote/i.test(l)
  );

  // 1. If candidate explicitly checked "Remote Only", reject any onsite/hybrid job
  if (remoteOnly && !isJobRemote) {
    return false;
  }

  // 2. If candidate requires visa sponsorship, reject jobs that don't offer it (unless fully remote)
  if (visaRequired && !hasVisa && !isJobRemote) {
    return false;
  }

  // 3. Remote jobs evaluation
  if (isJobRemote) {
    // If candidate is in India, reject remote jobs restricted to US/UK/EU residents only
    if (isCandidateInIndia) {
      const isRestrictedAbroad = /\b(us only|usa only|uk only|eu only|canada only|must reside in the us|must reside in the uk|must be located in the united states|must be based in the us|must be based in the uk)\b/i.test(jobLoc) ||
        /\b(must reside in the us|must reside in the uk|must be located in the united states|must be based in the us|must be based in the uk)\b/i.test(jobDesc);
      if (isRestrictedAbroad) return false;
    }
    return true;
  }

  // 4. Onsite / Hybrid jobs evaluation:
  // If the foreign employer provides visa sponsorship or relocation, ALLOW!
  if (hasVisa) {
    return true;
  }

  // If NO visa sponsorship:
  // Candidate in India CANNOT work onsite/hybrid in Europe/UK/US!
  if (isCandidateInIndia && /london|united kingdom|\buk\b|germany|berlin|munich|netherlands|amsterdam|france|paris|united states|new york|california|switzerland|austria/i.test(jobLoc)) {
    return false;
  }

  // Check if physical location matches any of the candidate's preferred locations
  const physicalLocations = userLocations.filter(l => l !== 'remote');
  if (physicalLocations.length > 0) {
    if (!jobLoc) return true;
    const matchesLoc = physicalLocations.some(loc => jobLoc.includes(loc));
    if (matchesLoc) return true;

    // If candidate location is in India, allow jobs within Indian states and cities
    if (isCandidateInIndia && /india|maharashtra|karnataka|tamil nadu|telangana|delhi|ncr|uttar pradesh|gujarat|rajasthan|madhya pradesh|punjab|haryana|bengal|kerala|andhra|pune|bangalore|bengaluru|mumbai|hyderabad|chennai|noida|gurgaon|gurugram|mohali|indore|jaipur|chandigarh|kolkata|ahmedabad|surat|remote/i.test(jobLoc)) {
      return true;
    }

    return false;
  }

  return true;
};

module.exports = { isJobEligible };
