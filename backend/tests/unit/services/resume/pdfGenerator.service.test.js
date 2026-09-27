jest.mock('puppeteer');
const uploadMock = jest.fn();
const mockCloudinary = {
  uploader: {
    upload: uploadMock,
  },
};
jest.mock('../../../../src/config/cloudinary', () => ({
  cloudinary: mockCloudinary,
  getClient: () => mockCloudinary,
}));

const puppeteer = require('puppeteer');
const { cloudinary } = require('../../../../src/config/cloudinary');
const { buildResumeHtml, generateResumePDF } = require('../../../../src/services/resume/pdfGenerator.service');

describe('pdfGenerator.service', () => {
  const sampleResume = {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+91 9876543210',
    targetRoles: ['Senior Frontend Developer'],
    summary: 'Experienced developer building scalable web applications.',
    links: {
      linkedin: 'https://linkedin.com/in/janedoe',
      github: 'https://github.com/janedoe',
      portfolio: 'https://janedoe.dev',
    },
    skills: {
      technical: ['TypeScript', 'Angular', 'React'],
      tools: ['Git', 'Docker'],
      soft: ['Cross-functional Collaboration', 'Mentorship', 'Agile Leadership'],
      languages: ['English', 'Hindi', 'German'],
    },
    experience: [
      {
        title: 'Lead Frontend Engineer',
        company: 'TechCorp',
        duration: '2022 - Present',
        achievements: [
          'Architected high-performance web dashboard reducing TTI by 40%.',
          'Managed a team of 6 engineers.',
        ],
        technologies: ['Angular', 'RxJS', 'Node.js'],
      },
    ],
    education: [
      {
        degree: 'B.Tech',
        field: 'Computer Science',
        institution: 'Indian Institute of Technology',
        year: '2020',
        gpa: '8.8/10',
      },
    ],
    certifications: [
      {
        name: 'AWS Certified Solutions Architect',
        issuer: 'Amazon Web Services',
        year: '2023',
      },
    ],
    projects: [
      {
        name: 'AutoApply Suite',
        url: 'https://github.com/janedoe/autoapply',
        description: 'Autonomous job application tool.',
        technologies: ['Node.js', 'Angular'],
      },
    ],
  };

  const sampleJob = {
    title: 'Senior Frontend Engineer',
    company: 'NextGen Solutions',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildResumeHtml', () => {
    test('renders header, contact details, and summary', () => {
      const html = buildResumeHtml(sampleResume, sampleJob);
      expect(html).toContain('Jane Doe');
      expect(html).toContain('Senior Frontend Developer');
      expect(html).toContain('jane@example.com');
      expect(html).toContain('+91 9876543210');
      expect(html).toContain('https://linkedin.com/in/janedoe');
      expect(html).toContain('Experienced developer building scalable web applications.');
    });

    test('omits tailored badge/watermark to protect candidate ATS compliance', () => {
      const htmlWithJob = buildResumeHtml(sampleResume, sampleJob);
      expect(htmlWithJob).not.toContain('Tailored for:');
      const htmlWithoutJob = buildResumeHtml(sampleResume, null);
      expect(htmlWithoutJob).not.toContain('Tailored for:');
    });

    test('regression (Session 42): renders all 4 skill categories across Skills, Core Strengths, and Languages', () => {
      const html = buildResumeHtml(sampleResume, sampleJob);
      // Technical + tools
      expect(html).toContain('Skills');
      expect(html).toContain('TypeScript');
      expect(html).toContain('Docker');

      // Soft skills (Core Strengths)
      expect(html).toContain('Core Strengths');
      expect(html).toContain('Cross-functional Collaboration');
      expect(html).toContain('Mentorship');

      // Languages
      expect(html).toContain('Languages');
      expect(html).toContain('English');
      expect(html).toContain('German');
    });

    test('handles empty or missing skill categories without crashing', () => {
      const minimalResume = {
        fullName: 'John Minimal',
        skills: {
          technical: [],
          tools: [],
        },
      };
      const html = buildResumeHtml(minimalResume, null);
      expect(html).toContain('John Minimal');
      expect(html).not.toContain('Core Strengths');
      expect(html).not.toContain('Languages');
    });

    test('renders experience, education, certifications, and projects', () => {
      const html = buildResumeHtml(sampleResume, sampleJob);
      expect(html).toContain('Lead Frontend Engineer');
      expect(html).toContain('TechCorp');
      expect(html).toContain('Architected high-performance web dashboard');
      expect(html).toContain('B.Tech in Computer Science');
      expect(html).toContain('Indian Institute of Technology');
      expect(html).toContain('AWS Certified Solutions Architect');
      expect(html).toContain('AutoApply Suite');
    });
  });

  describe('generateResumePDF', () => {
    let mockPage;
    let mockBrowser;

    beforeEach(() => {
      mockPage = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-binary-data')),
      };
      mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn().mockResolvedValue(undefined),
      };
      puppeteer.launch.mockResolvedValue(mockBrowser);
    });

    test('happy path: generates PDF via Puppeteer and uploads to Cloudinary', async () => {
      cloudinary.uploader.upload.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/raw/upload/resume.pdf',
      });

      const result = await generateResumePDF(sampleResume, sampleJob, 'user-123');

      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
      expect(mockPage.setContent).toHaveBeenCalledTimes(1);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4', printBackground: true }));
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
      expect(cloudinary.uploader.upload).toHaveBeenCalledTimes(1);
      expect(result.pdfUrl).toBe('https://res.cloudinary.com/demo/raw/upload/resume.pdf');
      expect(result.html).toContain('Jane Doe');
    });

    test('handles Cloudinary upload failure gracefully by returning html with empty pdfUrl', async () => {
      cloudinary.uploader.upload.mockRejectedValue(new Error('Cloudinary rate limit exceeded'));

      const result = await generateResumePDF(sampleResume, sampleJob, 'user-123');

      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
      expect(result.pdfUrl).toBe('');
      expect(result.html).toContain('Jane Doe');
    });

    test('handles Puppeteer launch failure gracefully without throwing unhandled exceptions', async () => {
      puppeteer.launch.mockRejectedValue(new Error('Browser launch failed: Chromium crashed'));

      const result = await generateResumePDF(sampleResume, sampleJob, 'user-123');

      expect(result.pdfUrl).toBe('');
      expect(result.html).toContain('Jane Doe');
    });
  });
});
