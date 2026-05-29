import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, convertInchesToTwip, TabStopType, UnderlineType,
} from 'docx';

export interface ResumeBulletItem {
  title?: string;
  subtitle?: string;
  period?: string;
  bullets?: string[];
  text?: string;
}

export interface ResumeSection {
  heading: string;
  items: ResumeBulletItem[];
}

export interface PersonalDetails {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  urls: string[];
}

export interface CoverLetterHeader {
  recipientName?: string;
  companyName: string;
}

const MARGIN = convertInchesToTwip(1);
const FONT   = 'Calibri';
const BODY_SIZE = 22;   // half-points → 11pt
const HEAD_SIZE = 22;
const NAME_SIZE = 36;   // 18pt

const hrParagraph = (): Paragraph =>
  new Paragraph({
    border: { bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 } },
    spacing: { after: 40 },
  });

const contactLine = (parts: string[]): Paragraph =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: parts.filter(Boolean).join('  |  '), size: 20, font: FONT })],
  });

const sectionHeading = (text: string): Paragraph =>
  new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: HEAD_SIZE,
        font: FONT,
        underline: { type: UnderlineType.SINGLE },
      }),
    ],
  });

const bulletParagraph = (text: string): Paragraph =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: BODY_SIZE, font: FONT })],
  });

const titleRow = (title: string, subtitle: string, period: string): Paragraph => {
  const tabStop = 8640; // right-align period ~6 inches
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: tabStop }],
    spacing: { before: 80, after: 20 },
    children: [
      new TextRun({ text: title, bold: true, size: BODY_SIZE, font: FONT }),
      subtitle ? new TextRun({ text: `  —  ${subtitle}`, size: BODY_SIZE, font: FONT }) : new TextRun(''),
      period ? new TextRun({ text: `\t${period}`, size: BODY_SIZE, font: FONT, italics: true }) : new TextRun(''),
    ],
  });
};

export const renderResume = async (
  sections: ResumeSection[],
  personal: PersonalDetails,
): Promise<Buffer> => {
  const children: Paragraph[] = [];

  // Name
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: personal.fullName, bold: true, size: NAME_SIZE, font: FONT })],
    }),
  );

  // Contact line
  children.push(contactLine([
    personal.email,
    personal.phone,
    `${personal.city}, ${personal.state}`,
    ...personal.urls,
  ]));

  children.push(hrParagraph());

  // Sections
  for (const section of sections) {
    children.push(sectionHeading(section.heading));
    for (const item of section.items) {
      if (item.title || item.subtitle || item.period) {
        children.push(titleRow(item.title ?? '', item.subtitle ?? '', item.period ?? ''));
      }
      if (item.text) {
        children.push(new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: item.text, size: BODY_SIZE, font: FONT })],
        }));
      }
      for (const bullet of item.bullets ?? []) {
        children.push(bulletParagraph(bullet));
      }
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
};

export const renderCoverLetter = async (
  body: string,
  personal: PersonalDetails,
  generationDate: string,
  header: CoverLetterHeader,
): Promise<Buffer> => {
  const children: Paragraph[] = [];

  // Header block
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: personal.fullName, bold: true, size: NAME_SIZE, font: FONT })],
    }),
  );
  children.push(contactLine([
    personal.email,
    personal.phone,
    `${personal.city}, ${personal.state}`,
    ...personal.urls,
  ]));
  children.push(hrParagraph());

  // Date
  children.push(new Paragraph({
    spacing: { before: 120, after: 120 },
    children: [new TextRun({ text: generationDate, size: BODY_SIZE, font: FONT })],
  }));

  // Recipient block
  if (header.recipientName) {
    children.push(new Paragraph({
      children: [new TextRun({ text: header.recipientName, size: BODY_SIZE, font: FONT })],
    }));
  }
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: header.companyName, size: BODY_SIZE, font: FONT })],
  }));

  // Body — split on double newlines into paragraphs
  for (const para of body.split(/\n\n+/)) {
    children.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: para.replace(/\n/g, ' ').trim(), size: BODY_SIZE, font: FONT })],
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
};
