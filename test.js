// Run: npm test. Builds samples/resume.pdf from samples/resume.txt, extracts it
// with the bundled pdf.js, and checks keyword matching and section checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { termRegex, findTerms, matchTerms, checkSections, extractPdfText } from './match.js';

// Minimal one-page PDF with a real text layer (Helvetica, ASCII only).
function makePdf(lines) {
  const content = 'BT /F1 11 Tf 50 750 Td 14 TL\n' +
    lines.map(l => `(${l.replace(/[\\()]/g, '\\$&')}) Tj T*`).join('\n') + '\nET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const fonts = { standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' };
const has = (text, term) => termRegex(term).test(text);

// --- boundaries: no partial-word false positives
assert.ok(has('Wrote C++ drivers.', 'C++'));
assert.ok(!has('Wrote C drivers.', 'C++'));
assert.ok(!has('Wrote C++ drivers.', 'C'), '"C" must not hit "C++"');
assert.ok(!has('Built in JavaScript', 'Java'), '"Java" must not hit "JavaScript"');
assert.ok(!has('MySQL and PostgreSQL', 'SQL'), '"SQL" must not hit "MySQL"');
assert.ok(has('Skills: C#, .NET', 'C#') && has('Skills: C#, .NET', '.NET'));
assert.ok(!has('ASP.NET only', '.NET'));
assert.ok(!has('Google Cloud', 'Go'), '"Go" must not hit "Google"');
assert.ok(has('Node.js, Express', 'Node.js'));
// --- multi-word terms across line breaks / hyphens, plural
assert.ok(has('using machine\nlearning for', 'machine learning'));
assert.ok(has('object oriented programming', 'object-oriented programming'));
assert.ok(has('Built REST APIs', 'REST API'));
assert.ok(has('CI/CD pipelines', 'CI/CD'));

// --- PDF: build, extract, compare
const resumeTxt = fs.readFileSync('samples/resume.txt', 'utf8');
const pdf = makePdf(resumeTxt.trimEnd().split('\n'));
fs.writeFileSync('samples/resume.pdf', pdf);
const pages = await extractPdfText(pdfjsLib, new Uint8Array(pdf), fonts);
assert.equal(pages.length, 1);
const extracted = pages[0];
for (const line of resumeTxt.split('\n').filter(l => l.trim())) assert.ok(extracted.includes(line.trim()), `PDF text missing line: ${line}`);
const empty = await extractPdfText(pdfjsLib, new Uint8Array(makePdf([])), fonts);
assert.equal(empty[0].replace(/\s/g, '').length, 0, 'empty PDF should have no text layer');

// --- job match on extracted text
const job = fs.readFileSync('samples/job.txt', 'utf8');
const terms = findTerms(job, 'Go, firmware');
const { matched, missing, coverage } = matchTerms(extracted, terms);
const m = matched.map(x => x.term), miss = missing;
for (const t of ['C++', 'Python', 'SQL', 'Docker', 'machine learning', 'REST API', 'Git', 'AWS', 'Linux']) assert.ok(m.includes(t), `expected match: ${t}`);
for (const t of ['Java', 'Kubernetes', 'CI/CD', 'communication skills', 'Agile', 'TypeScript', 'Go', 'firmware']) assert.ok(miss.includes(t), `expected missing: ${t}`);
assert.equal(coverage, Math.round(matched.length / terms.length * 100));
assert.match(matched.find(x => x.term === 'machine learning').hit, /machine\s+learning/i);
assert.ok(matched.find(x => x.term === 'C++').before.includes('embedded'), 'excerpt should show context');

// --- sections
const s = Object.fromEntries(checkSections(extracted).map(x => [x.name, x]));
assert.equal(s.Education.status, 'ok');
assert.equal(s.Experience.status, 'ok');
assert.equal(s.Projects.status, 'warn'); // "P R O J E C T S" letter-spaced
assert.equal(s.Skills.status, 'warn');   // only inline "Technical Skills: ..."
assert.equal(checkSections('Jordan Lee\nHobbies')[0].status, 'missing');

console.log(`All checks passed. Terms: ${terms.length}, matched ${matched.length}, coverage ${coverage}%.`);
console.log('Matched:', m.join(', '));
console.log('Missing:', miss.join(', '));
for (const x of Object.values(s)) console.log(`${x.name}: ${x.status} - ${x.why}`);
