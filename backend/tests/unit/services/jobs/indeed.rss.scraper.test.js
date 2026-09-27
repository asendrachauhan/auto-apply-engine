'use strict';
jest.mock('axios');
const axios = require('axios');
const { scrapeIndeed } = require('../../../../src/services/jobs/indeed.rss.scraper');

const rssWithSalary = (salary = '$80,000 - $100,000 a year') => `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Full Stack Engineer</title>
    <link>https://www.indeed.com/viewjob?jk=abc123&amp;tk=xyz</link>
    <source>Acme Inc</source>
    <description><![CDATA[Great remote role building things.]]></description>
    <pubDate>Fri, 21 Aug 2026 10:00:00 GMT</pubDate>
    <indeed:salary>${salary}</indeed:salary>
  </item>
</channel></rss>`;

describe('indeed.rss.scraper — regression: location/salary field mapping (Session 35)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('the <indeed:salary> tag populates the salary field, not location', async () => {
    axios.get.mockResolvedValue({ data: rssWithSalary('$80,000 - $100,000 a year') });
    const jobs = await scrapeIndeed('full stack engineer', 'Bengaluru, India');

    expect(jobs).toHaveLength(1);
    expect(jobs[0].salary).toBe('$80,000 - $100,000 a year');
  });

  test('location falls back to the search location parameter, since RSS items carry no distinct location tag', async () => {
    axios.get.mockResolvedValue({ data: rssWithSalary() });
    const jobs = await scrapeIndeed('full stack engineer', 'Bengaluru, India');

    expect(jobs[0].location).toBe('Bengaluru, India');
  });

  test('hits the working rss.indeed.com host, not www.indeed.com', async () => {
    axios.get.mockResolvedValue({ data: rssWithSalary() });
    await scrapeIndeed('full stack engineer', 'India');

    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toMatch(/^https:\/\/rss\.indeed\.com\/rss\?/);
  });

  test('sends a self-identifying User-Agent (no spoofing)', async () => {
    axios.get.mockResolvedValue({ data: rssWithSalary() });
    await scrapeIndeed('full stack engineer', 'India');

    const config = axios.get.mock.calls[0][1];
    expect(config.headers['User-Agent']).toMatch(/AutoApply/);
  });

  test('fails soft (returns []) on a network error rather than throwing', async () => {
    axios.get.mockRejectedValue(new Error('timeout'));
    const jobs = await scrapeIndeed('full stack engineer', 'India');
    expect(jobs).toEqual([]);
  });

  test('skips items missing a title or link', async () => {
    const incomplete = `<?xml version="1.0"?><rss><channel><item><source>Acme</source></item></channel></rss>`;
    axios.get.mockResolvedValue({ data: incomplete });
    const jobs = await scrapeIndeed('x', 'India');
    expect(jobs).toEqual([]);
  });
});
