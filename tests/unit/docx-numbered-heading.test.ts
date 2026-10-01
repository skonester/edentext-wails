import { describe, it, expect } from 'vitest';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { getSchema } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildOdt } from '../../src/lib/export/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { builtinStyleSheet } from '../../src/lib/styles/styleSheet';
import { outlineCss, outlineLabel } from '../../src/lib/styles/outlineNumbering';
import { formatOrdinal } from '../../src/lib/utils/orderedListTypes';

// WPS states chapter numbering on the heading style and again on every heading paragraph.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const NUMPR = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';

function docx(opts: { styleNum: boolean; body?: string }): Uint8Array {
  const styles = `<?xml version="1.0"?><w:styles ${W}>
<w:style w:type="paragraph" w:default="1" w:styleId="1"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="2"><w:name w:val="heading 1"/>
<w:pPr><w:outlineLvl w:val="0"/>${opts.styleNum ? NUMPR : ''}</w:pPr></w:style></w:styles>`;
  const numbering = `<?xml version="1.0"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0">
<w:multiLevelType w:val="multilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/>
<w:numFmt w:val="chineseCountingThousand"/><w:lvlText w:val="%1、"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const heading = `<w:p><w:pPr><w:pStyle w:val="2"/>${NUMPR}</w:pPr><w:r><w:t>chapter</w:t></w:r></w:p>`;
  const document = `<?xml version="1.0"?><w:document ${W}><w:body>${opts.body ?? heading}<w:sectPr/></w:body></w:document>`;
  return zipSync({
    'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(styles),
    'word/numbering.xml': strToU8(numbering),
  });
}

const schema = getSchema(extensions);
const headingInCell = `<w:tbl><w:tr><w:tc><w:p><w:pPr><w:pStyle w:val="2"/>${NUMPR}</w:pPr><w:r><w:t>cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;

describe('a heading that states its numbering on itself', () => {
  it('stays a heading and opens', () => {
    const { content } = importDocx(docx({ styleNum: true }));
    expect(() => schema.nodeFromJSON(content).check()).not.toThrow();
    expect(content.content?.[0].type).toBe('heading');
  });

  it('stays a heading inside a table cell', () => {
    const { content } = importDocx(docx({ styleNum: true, body: headingInCell }));
    expect(() => schema.nodeFromJSON(content).check()).not.toThrow();
    expect(JSON.stringify(content)).not.toContain('orderedList');
  });

  it('keeps the CJK chapter numbering', () => {
    const outline = importDocx(docx({ styleNum: true })).styles?.outline;
    expect(outline?.[0]).toMatchObject({ format: '一, 二, 三, ...', suffix: '、' });
    expect(outlineLabel(outline, 1, [2], formatOrdinal)).toBe('二、');
    expect(outlineCss(outline)).toContain('simp-chinese-informal');
  });

  it('numbers chapters from the paragraph where the style carries none', () => {
    expect(importDocx(docx({ styleNum: false })).styles?.outline?.[0].format).toBe('一, 二, 三, ...');
  });

  it('carries the CJK chapter numbering through both formats', async () => {
    const sheet = { ...builtinStyleSheet(), outline: importDocx(docx({ styleNum: true })).styles!.outline };
    const doc = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'chapter' }] }] };
    const margins = { top: 2, bottom: 2, left: 2, right: 2 };
    const odt = await buildOdt(doc as never, margins as never, 'portrait', undefined, null, 'A4', sheet);
    expect(strFromU8(unzipSync(odt)['styles.xml'])).toContain('style:num-format="一, 二, 三, ..."');
    expect(importOdt(odt).styles?.outline?.[0].format).toBe('一, 二, 三, ...');
    const back = await buildDocx(doc as never, margins as never, 'portrait', undefined, null, 'A4', sheet);
    expect(importDocx(back).styles?.outline?.[0]).toMatchObject({ format: '一, 二, 三, ...', suffix: '、' });
  });
});
