// Pure analysis logic, shared by the browser UI (app.js) and the tests (test.js).

// Terms we look for in a pasted job posting. Exact-term matching only: aliases
// like "JS" for "JavaScript" are NOT counted. Add your own terms in the UI.
export const DICTIONARY = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', '.NET', 'Rust', 'Kotlin', 'Swift',
  'Ruby', 'PHP', 'Scala', 'MATLAB', 'Bash', 'PowerShell', 'SQL', 'NoSQL', 'PostgreSQL', 'MySQL',
  'MongoDB', 'Redis', 'HTML', 'CSS', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django',
  'Flask', 'Spring Boot', 'REST API', 'GraphQL', 'gRPC', 'microservices', 'Git', 'GitHub', 'Linux',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'GCP', 'Terraform', 'CI/CD', 'Jenkins',
  'unit testing', 'pytest', 'JUnit', 'Selenium', 'test automation', 'object-oriented programming',
  'data structures', 'algorithms', 'machine learning', 'deep learning', 'computer vision',
  'natural language processing', 'TensorFlow', 'PyTorch', 'scikit-learn', 'pandas', 'NumPy',
  'data analysis', 'data visualization', 'statistics', 'Excel', 'Power BI', 'Tableau', 'ETL',
  'Spark', 'Hadoop', 'embedded systems', 'microcontrollers', 'Arduino', 'Raspberry Pi', 'RTOS',
  'PCB design', 'Verilog', 'VHDL', 'FPGA', 'CAD', 'SolidWorks', 'AutoCAD', 'Simulink', 'PLC',
  'ROS', 'Agile', 'Scrum', 'Jira', 'technical writing', 'documentation', 'project management',
  'communication skills', 'teamwork', 'problem solving', 'leadership', 'customer service',
  'Figma', 'UX', 'accessibility', 'cybersecurity', 'networking', 'TCP/IP', 'Salesforce', 'SAP',
];

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Boundaries: a term may not touch letters, digits, _, + or # on either side,
// nor a "." before it. So "Java" won't hit "JavaScript", "C" won't hit "C++",
// "SQL" won't hit "MySQL". Words inside a term may be split by spaces, line
// breaks or hyphens ("machine\nlearning", "object oriented"). A trailing "s"
// is allowed so "REST API" matches "REST APIs".
export function termRegex(term) {
  const body = term.trim().split(/[\s-]+/).map(escapeRe).join('[\\s-]+');
  return new RegExp(`(?<![\\w+#.])${body}s?(?![\\w+#])`, 'gi');
}

export function findTerms(jobText, extraText = '') {
  const seen = new Set();
  const out = [];
  const add = t => { const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t); } };
  for (const t of DICTIONARY) if (termRegex(t).test(jobText)) add(t);
  for (const t of extraText.split(/[,\n]/)) add(t.trim());
  return out;
}

export function matchTerms(resumeText, terms) {
  const flat = resumeText.replace(/\s+/g, ' ');
  const matched = [], missing = [];
  for (const term of terms) {
    const hits = [...flat.matchAll(termRegex(term))];
    if (!hits.length) { missing.push(term); continue; }
    const { index, 0: hit } = hits[0];
    const a = Math.max(0, index - 60), b = Math.min(flat.length, index + hit.length + 60);
    matched.push({
      term, count: hits.length,
      before: (a ? '…' : '') + flat.slice(a, index), hit, after: flat.slice(index + hit.length, b) + (b < flat.length ? '…' : ''),
    });
  }
  const coverage = terms.length ? Math.round((matched.length / terms.length) * 100) : null;
  return { matched, missing, coverage };
}

export const SECTIONS = {
  Education: ['education', 'academic background', 'academics', 'education and training'],
  Experience: ['experience', 'work experience', 'professional experience', 'relevant experience',
    'employment', 'employment history', 'work history', 'co-op experience'],
  Projects: ['projects', 'personal projects', 'academic projects', 'technical projects', 'selected projects'],
  Skills: ['skills', 'technical skills', 'core competencies', 'skills and tools', 'skills & tools', 'skills summary'],
};

const norm = s => s.toLowerCase().replace(/[^a-z&\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const squash = s => s.replace(/[\s-]/g, '');

// Returns one result per section: status ok | warn | missing, with an explanation.
export function checkSections(resumeText) {
  const lines = resumeText.split(/\r?\n/);
  return Object.entries(SECTIONS).map(([name, names]) => {
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim(), n = norm(raw);
      if (names.includes(n)) return { name, status: 'ok', line: i + 1, text: raw,
        why: `Line ${i + 1} is a standalone heading: "${raw}".` };
      if (/^(\S ){2,}\S/.test(n) && names.some(x => squash(x) === squash(n))) return { name, status: 'warn', line: i + 1, text: raw,
        why: `Line ${i + 1} looks like a letter-spaced heading ("${raw}"). Parsers can read it as separate letters, not the word "${name}". Type it as a normal word.` };
    }
    const re = new RegExp(`\\b(${names.map(escapeRe).join('|')})\\b`, 'i');
    const i = lines.findIndex(l => re.test(l));
    if (i >= 0) {
      const raw = lines[i].trim();
      return { name, status: 'warn', line: i + 1, text: raw,
        why: `"${raw.match(re)[0]}" appears on line ${i + 1}, but inside other text ("${raw.slice(0, 80)}${raw.length > 80 ? '…' : ''}"), not on its own line. A parser may not treat it as a heading. Put the heading on its own line.` };
    }
    return { name, status: 'missing',
      why: `No line contains ${names.map(n => `"${n}"`).join(', ')}. If you have this section, check the extracted text: it may use another name or have been lost in extraction.` };
  });
}

// Extract text per page with a pdf.js instance (browser or Node). Line breaks
// come from pdf.js end-of-line flags plus vertical position changes.
export async function extractPdfText(pdfjsLib, data, opts = {}) {
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false, ...opts });
  const doc = await task.promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    let text = '', lastY = null;
    for (const it of items) {
      if (!('str' in it)) continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2 && !text.endsWith('\n')) text += '\n';
      text += it.str + (it.hasEOL ? '\n' : '');
      lastY = y;
    }
    pages.push(text.trim());
  }
  await task.destroy();
  return pages;
}
