# Co-op Résumé Checker

An offline, ad-free résumé self-check for co-op applications. Everything runs on your machine. There are no uploads, analytics, ads or external requests. A Content-Security-Policy header from the local server blocks any request to another origin.

What it does:

1. **PDF text preview.** Pick a PDF to see its extracted text layer (via a locally installed copy of [PDF.js](https://github.com/mozilla/pdf.js)), with a per-page character count. It warns you when a page has almost no text, which usually means a scanned or image-only PDF. You can also paste or edit the text directly.
2. **Job posting match.** Paste a job description to see which skills and phrases are matched or missing. Each match comes with an excerpt from your résumé. Terms come from a built-in list of common skills that appear in the posting, plus any extra terms you add.
   - Matching respects word boundaries: `Java` won't match `JavaScript`, `C` won't match `C++`, `SQL` won't match `MySQL`, and `Go` won't match `Google`.
   - Multi-word terms still match across line breaks or hyphens (`machine\nlearning`, `object oriented`), and a plural `s` is allowed (`REST APIs`).
   - Matching is exact-term only. Aliases such as `JS` for `JavaScript` are not counted.
3. **Section checks.** Education, Experience, Projects and Skills are each marked **Found** (a standalone heading line), **Check** (the word only appears inside other text, or is letter-spaced like `S K I L L S`) or **Not found**. Every flag explains itself and gives a line number you can verify in the text box.

**Keyword coverage** = terms found ÷ terms checked × 100, rounded. Each term counts once and all terms are weighted equally. This is a rough self-check. It does not reproduce Workday, Greenhouse or any other applicant tracking system, and it does not predict whether you pass a screen.

## Run locally

Requires Node.js 20.11 or newer. Internet is only needed once, for `npm install`.

```bash
git clone https://github.com/vibhastallapalli/ats-checkere-trial.git
cd ats-checkere-trial
npm install
npm start
```

Open http://127.0.0.1:8080/ and click **Load sample** to try the dummy résumé and job posting. To use a different port, set `PORT` (for example `PORT=3000 npm start`, or `$env:PORT=3000; npm start` in PowerShell).

## Test

```bash
npm test
```

This rebuilds `samples/resume.pdf` from `samples/resume.txt`, extracts its text with PDF.js, checks that every line came through, and checks that an empty PDF is reported as having no text layer. It then runs keyword matching against `samples/job.txt` and the section checks, plus boundary cases such as `C++`, `Java`/`JavaScript` and `SQL`/`MySQL`.

## Files

- `index.html`, `app.js`: the UI
- `match.js`: term matching, section checks and PDF text extraction (shared by the UI and the tests)
- `server.js`: a static server built on the Node standard library. It binds to `127.0.0.1` only and serves just the app files and PDF.js.
- `test.js`: tests
- `samples/`: the dummy résumé and job posting
