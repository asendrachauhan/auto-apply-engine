const {
  stripZeroWidthWatermarks,
  replaceAiCliches,
  humanizeBulletList,
  humanizeResumeData,
  sanitizePdfMetadata,
} = require('../../../../src/services/ai/aiHumanizer.service');
const { PDFDocument } = require('pdf-lib');

describe('AI Humanizer Service', () => {
  describe('stripZeroWidthWatermarks', () => {
    it('should strip zero-width spaces, joiners, and non-joiners', () => {
      // \u200B zero-width space, \u200C zwnj, \u200D zwj, \uFEFF bom
      const textWithWatermarks = 'Built\u200B a scalable\u200C cloud\u200D service\uFEFF.';
      const cleaned = stripZeroWidthWatermarks(textWithWatermarks);
      expect(cleaned).toBe('Built a scalable cloud service.');
    });

    it('should normalize typographical quotes and dashes', () => {
      const input = '“Software Engineer” — ‘Full-Stack’';
      const output = stripZeroWidthWatermarks(input);
      expect(output).toBe('"Software Engineer" - \'Full-Stack\'');
    });
  });

  describe('replaceAiCliches', () => {
    it('should replace telltale AI verbs with authentic candidate verbs', () => {
      const input = 'Spearheaded the migration and orchestrated cross-team deployments in order to foster collaboration.';
      const output = replaceAiCliches(input);
      expect(output).toContain('Led the migration');
      expect(output).toContain('organized cross-team deployments');
      expect(output).toContain('to build collaboration');
      expect(output).not.toContain('Spearheaded');
      expect(output).not.toContain('orchestrated');
    });

    it('should remove meaningless filler adverbs like seamlessly', () => {
      const input = 'Seamlessly integrated payment gateway and cutting-edge search.';
      const output = replaceAiCliches(input);
      expect(output).not.toMatch(/seamlessly/i);
      expect(output).toContain('modern search');
    });
  });

  describe('humanizeBulletList', () => {
    it('should avoid repetitive consecutive verb openings', () => {
      const bullets = [
        'Developed REST APIs for user onboarding.',
        'Developed microservices handling 50k RPM.',
        'Developed automated CI/CD pipelines.',
      ];
      const humanized = humanizeBulletList(bullets);
      expect(humanized.length).toBe(3);
      // Second bullet should have rotated to an alternate verb
      expect(humanized[1].startsWith('Developed')).toBe(false);
    });
  });

  describe('humanizeResumeData', () => {
    it('should sanitize summary, experience achievements, projects, and skills', () => {
      const resume = {
        summary: 'A testament to robust engineering, spearheaded 10+ projects.',
        experience: [
          {
            title: 'Senior\u200B Engineer',
            achievements: ['Spearheaded microservice architecture.', 'Spearheaded data pipeline.'],
          },
        ],
        skills: {
          technical: ['React\u200B', 'Node.js\uFEFF'],
        },
      };

      const result = humanizeResumeData(resume);
      expect(result.summary).not.toContain('testament to');
      expect(result.summary).not.toContain('spearheaded');
      expect(result.experience[0].title).toBe('Senior Engineer');
      expect(result.skills.technical).toEqual(['React', 'Node.js']);
    });
  });

  describe('sanitizePdfMetadata', () => {
    it('should overwrite PDF producer and creator with authentic signatures', async () => {
      // Create minimal PDF
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([600, 400]);
      pdfDoc.setProducer('Puppeteer / Chromium / Headless');
      pdfDoc.setCreator('PDFKit');
      const rawBytes = await pdfDoc.save();
      const rawBuffer = Buffer.from(rawBytes);

      const sanitizedBuffer = await sanitizePdfMetadata(rawBuffer, { candidateName: 'Jane Doe' });
      expect(Buffer.isBuffer(sanitizedBuffer)).toBe(true);

      const loaded = await PDFDocument.load(sanitizedBuffer, { updateMetadata: false });
      expect(loaded.getProducer()).toBe('macOS Version 14.4.1 (Build 23E224) Quartz PDFContext');
      expect(loaded.getCreator()).toBe('Microsoft Word');
      expect(loaded.getAuthor()).toBe('Jane Doe');
      expect(loaded.getTitle()).toBe('Jane Doe - Resume');
    });
  });
});
