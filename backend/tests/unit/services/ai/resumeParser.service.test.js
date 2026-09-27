'use strict';
jest.mock('pdf-parse');
jest.mock('../../../../src/services/ai/groq.service');
const pdfParse = require('pdf-parse');
const groq = require('../../../../src/services/ai/groq.service');
const { parseResume, parseText, extractText } = require('../../../../src/services/ai/resumeParser.service');

const longText = 'Experienced software engineer with 5 years building scalable systems. '.repeat(10);

describe('resumeParser.service — extractText', () => {
  test('uses pdf-parse for application/pdf', async () => {
    pdfParse.mockResolvedValue({ text: longText });
    const result = await extractText(Buffer.from('fake-pdf-bytes'), 'application/pdf');
    expect(pdfParse).toHaveBeenCalled();
    expect(result).toBe(longText);
  });

  test('reads text/plain buffers directly without pdf-parse', async () => {
    const result = await extractText(Buffer.from(longText), 'text/plain');
    expect(pdfParse).not.toHaveBeenCalled();
    expect(result).toBe(longText);
  });

  test('falls back to raw text decoding for DOCX (documented limitation, not a crash)', async () => {
    const buf = Buffer.from(longText);
    const result = await extractText(buf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(pdfParse).not.toHaveBeenCalled();
    expect(result).toBe(buf.toString('utf-8'));
  });
});

describe('resumeParser.service — parseText', () => {
  test('rejects text under 50 characters without calling Groq', async () => {
    await expect(parseText('too short')).rejects.toThrow(/could not extract enough text/i);
    expect(groq.chat).not.toHaveBeenCalled();
  });

  test('sends extracted text to Groq and returns the parsed JSON', async () => {
    groq.chat.mockResolvedValue('{"fullName":"Jane Doe"}');
    groq.parseJSON.mockReturnValue({ fullName: 'Jane Doe' });
    const result = await parseText(longText);
    expect(result).toEqual({ fullName: 'Jane Doe' });
    expect(groq.chat).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining(longText.slice(0, 50)) })]),
      expect.objectContaining({ maxTokens: 2000 })
    );
  });
});

describe('resumeParser.service — parseResume (full pipeline)', () => {
  test('extracts text from the buffer by mimetype, then parses it', async () => {
    pdfParse.mockResolvedValue({ text: longText });
    groq.chat.mockResolvedValue('{"fullName":"Jane Doe"}');
    groq.parseJSON.mockReturnValue({ fullName: 'Jane Doe' });

    const { rawText, parsed } = await parseResume(Buffer.from('fake-pdf'), 'application/pdf');
    expect(rawText).toBe(longText);
    expect(parsed).toEqual({ fullName: 'Jane Doe' });
  });

  test('propagates a "too short" error for an unreadable/empty file instead of calling Groq', async () => {
    pdfParse.mockResolvedValue({ text: '' });
    await expect(parseResume(Buffer.from(''), 'application/pdf')).rejects.toThrow(/could not extract enough text/i);
    expect(groq.chat).not.toHaveBeenCalled();
  });
});
