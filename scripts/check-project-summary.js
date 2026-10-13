const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/11-session-activity-init.js'), 'utf8');
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const data = {
  project: { name: 'Sample infrastructure project', stage: 'Implementation' },
  documents: [{ stage: 'Implementation', document_type_name: 'Detailed Engineering Design and Technical Specifications', requirement_state: 'Required', assigned_username: 'Sample reviewer', status: 'Checked', file_path: 'sample.pdf', file_name: 'VeryLongDocumentFilenameWithoutSpaces_'.repeat(4) + '.pdf', upload_date: '21 Sep 2026, 09:00 AM', checked_at: '21 Sep 2026, 10:00 AM', due_date: '22 Sep 2026', remarks: 'Review complete.\nConfirm measurements <before> construction & retain signed copies.' }],
  printed_by: 'Sample user', print_date: '21 Sep 2026'
};
let html;
const context = vm.createContext({
  requirePrivilege: () => true,
  getPrintableProjectData: async () => data,
  isCountableRequirement: () => true,
  ownerDisplayName: doc => doc.assigned_username || 'Unassigned',
  projectOutcome: () => 'Active', esc,
  fmtDateTime: date => date || '-', fmtDueDate: date => date || '-',
  openPrintableWindow(title, body) { html = body; },
  toast(message) { throw new Error(message); }
});
vm.runInContext(source.slice(source.indexOf('    async function printProjectSummary()'), source.indexOf('    async function printRequirementsChecklist()')), context);
(async () => {
  await context.printProjectSummary();
  const table = html.slice(html.indexOf('<table class="print-documents-table">'));
  assert.equal((table.match(/<th>/g) || []).length, 6);
  assert.equal((table.match(/<td[ >]/g) || []).length, 6);
  assert.ok(table.includes(esc(data.documents[0].remarks)));
  assert.ok(table.includes(data.documents[0].file_name));
  for (const label of ['Uploaded:', 'Checked:', 'Due:', 'State:', 'Remarks']) assert.ok(table.includes(label));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/application.css"></head><body style="margin:0;background:#ddd"><main id="printPreviewOverlay"><div id="printPreviewShell" style="width:210mm;margin:auto;background:white"><div id="printPreviewContent" class="print-preview-content" style="padding:10mm">${html}</div></div></main></body></html>`);
  data.documents = [];
  await context.printProjectSummary();
  assert.ok(html.includes('<td colspan="6">No documents.</td>'));
  console.log('Project summary checks passed: six columns, complete escaped remarks, file details, dates, and empty state.');
})().catch(error => { console.error(error); process.exitCode = 1; });
