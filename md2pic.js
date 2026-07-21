#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import puppeteer from 'puppeteer';
import { marked } from 'marked';

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1f2328;
  background: #ffffff;
  padding: 40px 48px;
  max-width: 900px;
}
h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }
p { margin-bottom: 16px; }
a { color: #0969da; text-decoration: none; }
ul, ol { margin-bottom: 16px; padding-left: 2em; }
li { margin-bottom: 0.25em; }
blockquote {
  padding: 0 1em;
  color: #656d76;
  border-left: 0.25em solid #d0d7de;
  margin-bottom: 16px;
}
code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  background: #f6f8fa;
  padding: 0.2em 0.4em;
  border-radius: 6px;
  font-size: 85%;
}
pre {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 16px;
}
pre code {
  background: none;
  padding: 0;
  font-size: 85%;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}
th, td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
  text-align: left;
}
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
img { max-width: 100%; height: auto; }
hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background: #d0d7de;
  border: 0;
}
`;

function usage() {
  console.log('Usage: md2pic <markdown-file> [options]');
  console.log('');
  console.log('Options:');
  console.log('  -o, --output <path>  Output PNG file path (default: alongside source .md)');
  console.log('  -w, --width <px>     Output image width in pixels (default: 800)');
  console.log('  -h, --help           Show this help');
  process.exit(0);
}

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(args) {
  const opts = { width: 800, input: null, output: null };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') usage();
    else if (arg === '-o' || arg === '--output') {
      if (++i >= args.length) die('Missing value for --output');
      opts.output = args[i];
    } else if (arg === '-w' || arg === '--width') {
      if (++i >= args.length) die('Missing value for --width');
      const w = parseInt(args[i], 10);
      if (isNaN(w) || w < 100) die('Width must be a number >= 100');
      opts.width = w;
    } else if (!opts.input) {
      opts.input = arg;
    } else {
      die(`Unexpected argument: ${arg}`);
    }
    i++;
  }
  if (!opts.input) die('No input file specified.');
  return opts;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();
  const opts = parseArgs(args);

  const chrome = findChrome();
  if (!chrome) die(
    'Chrome/Chromium not found. Install Google Chrome or set CHROME_BIN env var.'
  );

  const absInput = resolve(opts.input);
  if (!existsSync(absInput)) die(`File not found: ${opts.input}`);

  const mdContent = readFileSync(absInput, 'utf-8');
  const htmlBody = marked.parse(mdContent, { async: false });

  const ext = extname(opts.input);
  const outputPath = opts.output || (opts.input.slice(0, -ext.length) + '.png');

  const baseUrl = 'file://' + resolve(dirname(absInput));

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<base href="${baseUrl}/">
<style>${CSS}</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  const tmpHtml = resolve(tmpdir(), `md2pic-${randomUUID()}.html`);
  writeFileSync(tmpHtml, fullHtml, 'utf-8');

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: opts.width, height: 600 });
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0', timeout: 15000 });

    const absOutput = resolve(outputPath);
    await page.screenshot({ path: absOutput, fullPage: true });
  } finally {
    await browser.close();
    if (existsSync(tmpHtml)) unlinkSync(tmpHtml);
  }

  console.log(`Created: ${outputPath}`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
