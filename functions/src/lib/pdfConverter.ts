import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { ResumeSection, PersonalDetails, CoverLetterHeader } from './docRenderer';

const fonts = {
  Helvetica: {
    normal:      'Helvetica',
    bold:        'Helvetica-Bold',
    italics:     'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);

const MARGIN = 72; // 1 inch in points
const BODY   = 10;
const SMALL  = 9;

const hr = (): Content => ({
  canvas: [{ type: 'line', x1: 0, y1: 2, x2: 468, y2: 2, lineWidth: 0.5 }],
  margin: [0, 2, 0, 6],
});

const contactText = (parts: string[]): Content => ({
  text: parts.filter(Boolean).join('  |  '),
  fontSize: SMALL,
  alignment: 'center',
  margin: [0, 0, 0, 4],
  font: 'Helvetica',
});

const sectionHeading = (text: string): Content => ({
  text: text.toUpperCase(),
  bold: true,
  fontSize: BODY,
  decoration: 'underline',
  margin: [0, 8, 0, 3],
  font: 'Helvetica',
});

const bullet = (text: string): Content => ({
  text: `• ${text}`,
  fontSize: BODY,
  margin: [8, 1, 0, 1],
  font: 'Helvetica',
});

function makePdf(def: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = printer.createPdfKitDocument(def);
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export const renderResumePdf = async (
  sections: ResumeSection[],
  personal: PersonalDetails,
): Promise<Buffer> => {
  const content: Content[] = [];

  // Name
  content.push({ text: personal.fullName, bold: true, fontSize: 18, alignment: 'center', font: 'Helvetica', margin: [0, 0, 0, 4] });

  // Contact
  content.push(contactText([
    personal.email, personal.phone, `${personal.city}, ${personal.state}`, ...personal.urls,
  ]));
  content.push(hr());

  // Sections
  for (const section of sections) {
    content.push(sectionHeading(section.heading));
    for (const item of section.items) {
      if (item.title || item.subtitle || item.period) {
        const row: Content = {
          columns: [
            {
              text: [
                { text: item.title ?? '', bold: true, fontSize: BODY, font: 'Helvetica' },
                item.subtitle ? { text: `  —  ${item.subtitle}`, fontSize: BODY, font: 'Helvetica' } : '',
              ],
            },
            {
              text: item.period ?? '',
              alignment: 'right',
              italics: true,
              fontSize: BODY,
              font: 'Helvetica',
            },
          ],
          margin: [0, 4, 0, 2],
        };
        content.push(row);
      }
      if (item.text) {
        content.push({ text: item.text, fontSize: BODY, font: 'Helvetica', margin: [0, 1, 0, 2] });
      }
      for (const b of item.bullets ?? []) {
        content.push(bullet(b));
      }
    }
  }

  return makePdf({
    content,
    defaultStyle: { font: 'Helvetica', fontSize: BODY },
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
  });
};

export const renderCoverLetterPdf = async (
  body: string,
  personal: PersonalDetails,
  generationDate: string,
  header: CoverLetterHeader,
): Promise<Buffer> => {
  const content: Content[] = [];

  content.push({ text: personal.fullName, bold: true, fontSize: 18, alignment: 'center', font: 'Helvetica', margin: [0, 0, 0, 4] });
  content.push(contactText([
    personal.email, personal.phone, `${personal.city}, ${personal.state}`, ...personal.urls,
  ]));
  content.push(hr());

  content.push({ text: generationDate, fontSize: BODY, font: 'Helvetica', margin: [0, 8, 0, 8] });

  if (header.recipientName) {
    content.push({ text: header.recipientName, fontSize: BODY, font: 'Helvetica' });
  }
  content.push({ text: header.companyName, fontSize: BODY, font: 'Helvetica', margin: [0, 0, 0, 12] });

  for (const para of body.split(/\n\n+/)) {
    content.push({ text: para.replace(/\n/g, ' ').trim(), fontSize: BODY, font: 'Helvetica', margin: [0, 0, 0, 8] });
  }

  return makePdf({
    content,
    defaultStyle: { font: 'Helvetica', fontSize: BODY },
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
  });
};
