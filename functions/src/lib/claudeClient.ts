import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const SONNET = 'claude-sonnet-4-6';
export const HAIKU  = 'claude-haiku-4-5-20251001';

export interface GenerateDocsInput {
  baseResumeText: string;
  jobDescription: string;
  companyProfile: string;
  roleInfo: string;
  personalDetails: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    urls: string[];
  };
  generationDate: string;
}

// Prompt caching deferred — use client.beta.promptCaching.messages.create() when TypeScript types are available
export const generateDocuments = async (input: GenerateDocsInput): Promise<string> => {
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
};

export const rewriteFlaggedSections = async (
  resumeJson: string,
  coverLetterJson: string,
  flaggedSections: string[],
): Promise<string> => {
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `The following sections of a resume and cover letter were flagged as potentially AI-generated. Rewrite them using natural, human, varied language. Avoid clichés, corporate jargon, and any phrasing that sounds automated.

Flagged sections:
${flaggedSections.join('\n---\n')}

Full resume JSON:
${resumeJson}

Full cover letter JSON:
${coverLetterJson}

Return the complete updated JSON in this exact format:
{"resume":{"sections":[...]},"coverLetter":{"header":{...},"body":"..."}}`,
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
};

export const checkAiDetection = async (resumeText: string, coverLetterText: string): Promise<{
  clean: boolean;
  flaggedSections: string[];
}> => {
  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: buildDetectionPrompt(resumeText, coverLetterText),
    }],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try { return JSON.parse(text); } catch { return { clean: true, flaggedSections: [] }; }
};

const buildSystemPrompt = (): string =>
  `You are an expert resume writer and career coach. Generate tailored, ATS-optimised resumes and cover letters.

Rules:
- Maximum 2 pages per document. If a second page is used, it must be at least half full.
- Do not use words commonly flagged by AI detectors: leverage, utilise, spearhead, deliverables, synergy, cutting-edge, passionate about, dynamic, innovative, robust, comprehensive.
- Use varied, natural, human-idiomatic language.
- Tailor all content tightly to the job description keywords and requirements.
- Output valid JSON only — no markdown, no explanation, no preamble.

Output this exact JSON structure:
{
  "resume": {
    "sections": [
      {
        "heading": "string — section title e.g. Professional Summary, Experience, Education, Skills",
        "items": [
          {
            "title": "optional string — job title or degree",
            "subtitle": "optional string — company or institution",
            "period": "optional string — e.g. Jan 2020 – Present",
            "bullets": ["optional array of bullet point strings"],
            "text": "optional plain text string — for summary or skills sections"
          }
        ]
      }
    ]
  },
  "coverLetter": {
    "header": {
      "recipientName": "optional string — e.g. Hiring Manager",
      "companyName": "string"
    },
    "body": "string — full cover letter body text, paragraphs separated by double newlines"
  }
}`;

const buildUserPrompt = (input: GenerateDocsInput): string => `Generate a tailored resume and cover letter.

Personal details:
Name: ${input.personalDetails.fullName}
Email: ${input.personalDetails.email}
Phone: ${input.personalDetails.phone}
Location: ${input.personalDetails.city}, ${input.personalDetails.state}
URLs: ${input.personalDetails.urls.join(', ') || 'none'}
Generation date: ${input.generationDate}

Base resume (extract relevant experience — do not copy verbatim):
${input.baseResumeText}

Job description:
${input.jobDescription}

Company profile:
${input.companyProfile}

Role public information:
${input.roleInfo}`;

const buildDetectionPrompt = (resume: string, coverLetter: string): string =>
  `Analyse the following resume and cover letter for language patterns commonly flagged by AI-detection tools (e.g. overused corporate phrases, unnatural cadence, repetitive structures).
Return JSON only: { "clean": boolean, "flaggedSections": string[] }
Where flaggedSections contains the exact text of flagged phrases or sentences (empty array if clean).

Resume:
${resume}

Cover Letter:
${coverLetter}`;
