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
      content: `Rewrite the flagged sections of this resume and cover letter so they pass AI detection tools. Apply every rule below — no exceptions.
${HUMAN_WRITING_RULES}
Additional rewrite instructions:
- Replace every banned word with a concrete, plain-English alternative. Don't just swap one buzzword for another.
- Break up any sentence over 20 words. Cut anything that merely rephrases the sentence before it.
- If bullets start with the same word or follow the same grammatical structure, restructure them so each opens differently.
- Keep all factual content (job titles, companies, metrics, dates) exactly as-is. Only the language changes.
- The final text must read like a senior professional wrote it in a hurry — direct, specific, no filler.

Flagged sections:
${flaggedSections.join('\n---\n')}

Full resume JSON:
${resumeJson}

Full cover letter JSON:
${coverLetterJson}

Return the complete updated JSON in this exact format — JSON only, no commentary:
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

const HUMAN_WRITING_RULES = `
HUMAN WRITING STYLE — MANDATORY. Every word of prose, every bullet, every summary must pass AI detection.

Structural rules:
- Vary sentence length. Mix short sentences (5–10 words) with medium ones (11–20 words). Never write more than two consecutive sentences over 20 words.
- Keep paragraphs to 3–4 sentences max. Single-sentence paragraphs are fine for emphasis.
- Active voice only. "The team shipped the feature" — not "the feature was shipped by the team."
- Use natural contractions (don't, can't, it's, won't, we're) wherever they fit.
- Bullet points: never start two consecutive bullets with the same word, phrase, or grammatical structure. Vary the subject.
- Say a thing once, clearly. Don't follow a sentence with another that just rephrases it.
- Name specifics. Write "the billing database" not "the data layer." Write "15 engineers" not "a large team."

Banned words and phrases — using any of these fails the task:
Leverage, Utilize/Utilise, Seamlessly, Robust, Streamline, Cutting-edge, State-of-the-art, Comprehensive solution, Paradigm shift, Game-changer, Empower, Revolutionize/Revolutionise, Transformative, At its core, In the realm of, Dive into, Delve into, Unlock, Spearhead, Deliverables, Synergy, Dynamic, Innovative, Passionate about, Furthermore, Moreover, Additionally, In conclusion, Consequently, Therefore, It is worth noting, It is important to note, This ensures that, As previously mentioned, It could be argued, One might say, It may be the case that, Aims to, Seeks to, Endeavors to/Endeavours to.
`;

const buildSystemPrompt = (): string =>
  `You are a senior resume writer and career strategist. Generate tailored, ATS-optimised resumes and cover letters.
${HUMAN_WRITING_RULES}
Document rules:
- HARD LIMIT: Resume must fit in 2 pages maximum when rendered at 11pt font with standard 1-inch margins. Budget approximately 600–700 words of resume content total.
- Experience section: maximum 4 bullet points per role. Maximum 4 roles listed.
- Skills / summary sections: keep concise — 1 short paragraph or a compact list, not both.
- Cover letter: exactly 3 paragraphs, no more than 80 words each.
- If a second page is used, it must be at least half full (no near-empty second page).
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
            "location": "optional string — city and state/country e.g. Littleton, CO",
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

export const extractTextFromImage = async (imageBuffer: Buffer, mediaType: 'image/png' | 'image/jpeg'): Promise<string> => {
  const response = await client.messages.create({
    model: HAIKU,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') },
        },
        {
          type: 'text',
          text: 'Extract all text from this resume image. Output only the extracted text, preserving structure (sections, bullet points, dates). No commentary.',
        },
      ],
    }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
};

const buildDetectionPrompt = (resume: string, coverLetter: string): string =>
  `You are an AI-detection auditor. Analyse the resume and cover letter below against every criterion listed. Flag anything that would cause an AI detector to score the text as machine-generated.

Check for all of the following:

1. Banned words present (any occurrence fails): Leverage, Utilize/Utilise, Seamlessly, Robust, Streamline, Cutting-edge, State-of-the-art, Comprehensive solution, Paradigm shift, Game-changer, Empower, Revolutionize/Revolutionise, Transformative, At its core, In the realm of, Dive into, Delve into, Unlock, Spearhead, Deliverables, Synergy, Dynamic, Innovative, Passionate about.
2. Banned transitional phrases: Furthermore, Moreover, Additionally, In conclusion, Consequently, Therefore, It is worth noting, It is important to note, This ensures that, As previously mentioned.
3. Hedging phrases: It could be argued, One might say, It may be the case that, Aims to, Seeks to, Endeavors to/Endeavours to.
4. Passive voice constructions (e.g. "was delivered by", "is managed by").
5. Three or more consecutive sentences all over 20 words (uniform long-sentence rhythm).
6. Two or more consecutive bullet points starting with the same word or grammatical structure.
7. Sentences that merely rephrase the sentence immediately before them.
8. Vague abstractions instead of named specifics (e.g. "the data layer" instead of a real system name).

Return JSON only — no explanation, no preamble:
{ "clean": boolean, "flaggedSections": string[] }
flaggedSections: exact phrases or sentences that triggered a flag (empty array if clean).

Resume:
${resume}

Cover Letter:
${coverLetter}`;
