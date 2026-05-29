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

// Full prompt and parsing implemented in T13
export const generateDocuments = async (input: GenerateDocsInput) => {
  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(),
        // prompt caching — system prompt reused across calls
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
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
- Output valid JSON only.`;

const buildUserPrompt = (input: GenerateDocsInput): string =>
  JSON.stringify({ instruction: 'Generate resume and cover letter', ...input });

const buildDetectionPrompt = (resume: string, coverLetter: string): string =>
  `Analyse the following resume and cover letter for language patterns commonly flagged by AI-detection tools.
Return JSON: { "clean": boolean, "flaggedSections": string[] }
Resume:\n${resume}\n\nCover Letter:\n${coverLetter}`;
