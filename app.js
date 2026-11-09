import * as pdfjsLib from './node_modules/pdfjs-dist/build/pdf.min.mjs';
import { extractPdfText, findTerms, matchTerms, checkSections } from './match.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

$('pdf').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (file) await loadPdf(new Uint8Array(await file.arrayBuffer()), file.name);
  e.target.value = '';
});

$('sample').addEventListener('click', async () => {
  const [pdf, job] = await Promise.all([fetch('samples/resume.pdf'), fetch('samples/job.txt')]);
  $('job').value = await job.text();
  await loadPdf(new Uint8Array(await pdf.arrayBuffer()), 'samples/resume.pdf');
});

async function loadPdf(data, name) {
  $('pdfStatus').textContent = `Reading ${name}…`;
  $('pdfAlerts').innerHTML = '';
  try {
    const pages = await extractPdfText(pdfjsLib, data, { standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/' });
    const counts = pages.map(p => p.replace(/\s/g, '').length);
    $('resume').value = pages.join('\n\n');
    $('pdfStatus').textContent = `${name}: ${pages.length} page(s), ${counts.map((c, i) => `p${i + 1} ${c} chars`).join(', ')}`;
    const thin = counts.map((c, i) => c < 50 ? i + 1 : 0).filter(Boolean);
    if (thin.length) $('pdfAlerts').innerHTML = `<div class="alert bad">Page(s) ${thin.join(', ')} have almost no text layer (under 50 characters). This usually means a scanned or image-only PDF. A parser would see little or nothing there. Export from your editor as a text PDF instead.</div>`;
  } catch (err) {
    $('pdfStatus').textContent = '';
    $('pdfAlerts').innerHTML = `<div class="alert bad">Could not read this PDF: ${esc(String(err.message || err))}</div>`;
  }
  render();
}

function render() {
  const resume = $('resume').value, job = $('job').value;

  if (!resume.trim()) {
    $('sections').innerHTML = '<p class="note">Add résumé text to check headings.</p>';
  } else {
    const label = { ok: 'Found', warn: 'Check', missing: 'Not found' };
    $('sections').innerHTML = checkSections(resume).map(s =>
      `<div class="sec"><b>${s.name}</b> <span class="${s.status}">${label[s.status]}</span><br><span class="note">${esc(s.why)}</span></div>`).join('');
  }

  const terms = findTerms(job, $('extra').value);
  if (!resume.trim() || !terms.length) {
    $('match').innerHTML = `<p class="note">${!resume.trim() ? 'Add résumé text.' : 'No known skill terms found in the posting yet. Paste a posting or add extra terms.'}</p>`;
    return;
  }
  const { matched, missing, coverage } = matchTerms(resume, terms);
  $('match').innerHTML = `
    <div class="cov">${coverage}%</div>
    <p class="note"><b>Keyword coverage</b> = terms found in your résumé ÷ terms checked = ${matched.length} ÷ ${terms.length}, rounded.
    Each term counts once, however often it appears, and all terms are weighted equally. This is a rough self-check, not a screening score.</p>
    <h3>Missing (${missing.length})</h3>
    <div class="chips">${missing.map(t => `<span>${esc(t)}</span>`).join('') || '<span class="note">None</span>'}</div>
    <h3>Matched (${matched.length})</h3>
    <table><tr><th>Term</th><th>×</th><th>First excerpt from your résumé</th></tr>
    ${matched.map(m => `<tr><td class="term">${esc(m.term)}</td><td>${m.count}</td><td>${esc(m.before)}<mark>${esc(m.hit)}</mark>${esc(m.after)}</td></tr>`).join('')}</table>`;
}

for (const id of ['resume', 'job', 'extra']) $(id).addEventListener('input', render);
render();
