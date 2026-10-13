const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/backend/controllers/12-documents-and-due-dates.controller.js'), 'utf8');
const colors = source.slice(source.indexOf('        const textColor ='), source.indexOf('        const truncateText ='));
const checklist = source.slice(source.indexOf('        const isCountableDoc ='), source.indexOf('        for (const doc of uploadedDocuments)'));

for (const missingCount of [0, 1, 35, 110]) {
  const missing = missingCount > 0;
  const draws = [];
  const pages = [{}];
  const documents = [
    { document_type_name: 'Required file', requirement_state: 'Required', file_path: missing ? null : 'file.pdf' },
    { document_type_name: 'Optional file', requirement_state: 'Optional' },
    { document_type_name: 'Not required file', requirement_state: 'Not Required' },
    { document_type_name: 'Uploaded file', requirement_state: 'Required', file_path: 'uploaded.pdf' }
  ];
  for (let i = 1; i < missingCount; i++) documents.push({ document_type_name: `Missing file ${i}`, requirement_state: 'Required' });
  vm.runInNewContext(`${colors}\nlet y = 665;\n${checklist}`, {
    checklistDocuments: documents, uploadedDocuments: documents.filter(doc => doc.file_path),
    normalizeRequirementState: state => state, cover: pages[0], boldFont: 'bold', font: 'normal',
    longPaperSize: [612, 936], pdfDoc: { addPage() { const page = {}; pages.push(page); return page; } },
    rgb: (r, g, b) => [r, g, b].join(','), truncateText: text => text,
    drawText: (page, text, x, y, _size, _font, color) => draws.push({ page, text, x, y, color })
  });
  const normal = '0.12,0.14,0.18', red = '0.75,0.12,0.12';
  const summary = draws.find(draw => draw.text === 'Missing documents:');
  assert.equal(summary.color, missing ? red : normal);
  assert.equal(draws.find(draw => draw.x === 230 && draw.y === summary.y).color, summary.color);
  const entries = draws.filter(draw => draw.x === 132);
  assert.equal(entries.length, documents.length, 'Every checklist document must be printed');
  assert.equal(entries.filter(draw => draw.color === red).length, missingCount);
  assert.equal(draws.find(draw => draw.x === 230 && draw.y === summary.y).text, missingCount);
  assert.ok(entries.every(draw => draw.y >= 58 && draw.y <= 868), 'Rows stay inside page margins');
  if (missingCount >= 35) assert.ok(pages.length > 1, 'Long checklists continue onto another page');
  for (const doc of documents) {
    const entry = draws.find(draw => String(draw.text).startsWith(`${doc.document_type_name} -`));
    assert.equal(entry.color, doc.requirement_state === 'Required' && !doc.file_path ? red : normal);
    assert.equal(draws.find(draw => draw.page === entry.page && draw.x === 64 && draw.y === entry.y).color, entry.color);
  }
}
console.log('Export checklist passed: 0, 1, 35 and 110 missing documents match red rows across all pages; optional and uploaded entries retain normal color.');
