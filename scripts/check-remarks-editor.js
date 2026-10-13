const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const source = read('src/frontend/scripts/04-project-detail-documents.js');
const editor = source.slice(source.indexOf('    function openDocumentRemarks('), source.indexOf('    async function loadDocs('));
const doc = { id: 1, stage: 'Implementation', document_type_name: 'Detailed Engineering Design & Technical Specifications', remarks: 'Confirm the revised measurements before approval.' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const elements = {};
const element = id => elements[id] ||= { value: doc.remarks, focus() {}, click() { if (!this.disabled) return this.onclick(); } };
let fail = true, saved, closed = false;
const context = vm.createContext({
  window: { currentProjectDocumentsCache: [doc] }, currentProjId: 1, API: '/api',
  document: { getElementById: element }, requirePrivilege: () => true, esc, svgEdit: '',
  openConfirmModal() {}, closeConfirmModal() { closed = true; }, toast() {},
  refreshAfterMutation: async () => {},
  fetchJson: async (url, options) => { if (fail) throw Error('Connection lost. Please try again.'); saved = JSON.parse(options.body); }
});
vm.runInContext(editor, context);
(async () => {
  context.openDocumentRemarks(1);
  const input = element('documentRemarksInput'), button = element('confirmActionBtn');
  assert.equal(button.disabled, true);
  input.value = 'Revised note\nSecond line';
  input.oninput();
  assert.equal(button.disabled, false);
  assert.equal(element('documentRemarksCount').textContent, `${input.value.length} / 2,000`);
  await button.onclick();
  assert.equal(closed, false);
  assert.equal(input.value, 'Revised note\nSecond line');
  assert.equal(element('documentRemarksError').hidden, false);
  assert.equal(button.disabled, false);
  fail = false;
  await button.onclick();
  assert.equal(saved.remarks, input.value);
  assert.equal(closed, true);
  if (process.argv[2]) {
    const modalSource = read('src/frontend/modals/settings-users.modals.html');
    const modal = modalSource.slice(modalSource.indexOf('  <div id="confirmModal"'));
    const open = source.slice(source.indexOf('    function openConfirmModal('), source.indexOf('    function confirmModalChoice('));
    fs.writeFileSync(process.argv[2], read('src/frontend/layout/head.html') + `<body>${modal}<script>
      const currentProjId = 1, API = '/api', svgEdit = '<span aria-hidden="true">✎</span>';
      let confirmCallback, confirmPromiseResolver;
      window.currentProjectDocumentsCache = ${JSON.stringify([doc])};
      const esc = ${esc.toString()};
      const requirePrivilege = () => true;
      const fetchJson = async () => { throw Error('Sample save error. Your remarks are still here.'); };
      function closeConfirmModal() { document.getElementById('confirmModal').classList.add('hidden'); }
      ${open}\n${editor}\nopenDocumentRemarks(1);
    </script></body></html>`);
  }
  console.log('Remarks editor checks passed: unchanged state, counter, save, and draft retention after errors.');
})().catch(error => { console.error(error); process.exitCode = 1; });
