const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/frontend/scripts/04-project-detail-documents.js'), 'utf8');
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    style: {}, attributes: {}, textContent: '',
    classList: { toggle() {} },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; }
  });
  return elements.get(id);
};
let request;
const context = vm.createContext({
  document: { getElementById: element },
  authToken: 'test-token',
  canUploadProjectDocumentation: () => true,
  canViewProjectDocumentation: () => true,
  currentProjectDocumentationStage: () => context.stage,
  stage: 'Proposal', projectDocumentationCounts: { Proposal: 2, Implementation: 0, Monitoring: 1 },
  formatBytes: n => `${n} bytes`,
  schedulePostMutationRefresh() {},
  handleServerSessionUnauthorized() { context.unauthorized = true; },
  XMLHttpRequest: class {
    constructor() { request = this; this.upload = {}; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this[key] = value; }
    send(body) { this.body = body; }
  }
});
for (const [start, end] of [
  ['    function updateProjectDocumentationButtons()', '    async function refreshProjectDocumentationCounts'],
  ['    function uploadProjectDocumentation(', "    document.getElementById('projectDocumentationUploadForm')"]
]) vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), context);

(async () => {
  for (const [stage, disabled] of [['Proposal', false], ['Implementation', true], ['Monitoring', false], ['Completed', true]]) {
    context.stage = stage;
    context.updateProjectDocumentationButtons();
    assert.equal(element('viewDocumentationBtn').disabled, disabled);
    assert.match(element('viewDocumentationBtn').className, disabled ? /cursor-not-allowed/ : /hover:bg-cyan/);
  }
  const pending = context.uploadProjectDocumentation('/documentation', 'form');
  assert.equal(request.Authorization, 'Bearer test-token');
  assert.equal(request.body, 'form');
  const bar = element('projectDocumentationUploadProgressBar');
  assert.equal(bar.style.width, '0%');
  for (const loaded of [10, 45, 90]) {
    request.upload.onprogress({ lengthComputable: true, loaded, total: 100 });
    assert.equal(bar.style.width, `${loaded}%`);
    assert.equal(bar.attributes['aria-valuenow'], String(loaded));
  }
  request.upload.onload();
  assert.match(element('projectDocumentationUploadProgressText').textContent, /Saving/);
  request.status = 201;
  request.responseText = '{"uploaded":[{"id":1}]}';
  request.onload();
  assert.equal((await pending).uploaded.length, 1);
  const failed = context.uploadProjectDocumentation('/documentation', 'form');
  assert.equal(bar.style.width, '0%');
  request.status = 401;
  request.responseText = '{"error":"Session expired"}';
  request.onload();
  await assert.rejects(failed, /Session expired/);
  assert.equal(context.unauthorized, true);
  const offline = context.uploadProjectDocumentation('/documentation', 'form');
  request.onerror();
  await assert.rejects(offline, /connection/);
  console.log('Documentation progress and stage button checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
