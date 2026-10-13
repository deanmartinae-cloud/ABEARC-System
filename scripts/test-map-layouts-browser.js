// Synthetic layouts; exercises actual UI code without production data or writes.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const css = ['application', 'map-layouts'].map(name => read(`src/frontend/styles/${name}.css`)).join('\n');
    await page.setContent(`<style>body{margin:0;font-family:Arial}.hidden{display:none!important}*{box-sizing:border-box}${css}</style>${read('src/frontend/pages/map.page.html')}`);
    await page.evaluate(() => {
      const root = document.getElementById('mapPage');
      root.classList.remove('hidden'); root.style.height = '100vh'; root.style.display = 'flex';
      document.querySelector('[data-map-results-panel]').classList.add('hidden');
      document.querySelector('[data-map-layouts-panel]').classList.remove('hidden');
      window.API = '/api';
      window.toast = () => {};
      window.dirty = false;
      window.fetchJson = async url => ({ id: Number(url.split('/').at(-1)), name: 'Export test', state: { camera: {} } });
    });
    await page.addScriptTag({ content: read('src/frontend/scripts/16-map-layouts.js') });
    await page.addScriptTag({ content: read('src/frontend/scripts/20-context-menus.js') });
    await page.evaluate(async () => {
      window.layoutRequests = 0;
      window.fetchJson = (url, options) => {
        if (options.priority !== 'high') throw new Error('Layout list should take priority over map images');
        window.layoutRequests++;
        return new Promise((resolve, reject) => {
          window.resolveLayoutRequest = resolve;
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      };
      window.layoutLoading = loadAbearcMapLayouts(true);
      await loadAbearcMapLayouts(true);
    });
    assert.equal(await page.evaluate(() => window.layoutRequests), 1, 'opening again does not duplicate a pending request');
    assert(await page.locator('[data-map-layout-list]').innerText().then(text => text.includes('Loading layouts')));
    await page.evaluate(async () => {
      window.resolveLayoutRequest({ layouts: [{ id: 1, name: 'Loaded layout' }] });
      await window.layoutLoading;
    });
    assert(await page.locator('[data-map-layout-id="1"]').innerText().then(text => text.includes('Loaded layout')));
    await page.evaluate(async () => {
      const nativeTimeout = AbortSignal.timeout;
      AbortSignal.timeout = () => nativeTimeout.call(AbortSignal, 20);
      try { await loadAbearcMapLayouts(true); }
      finally { AbortSignal.timeout = nativeTimeout; }
    });
    assert(await page.getByRole('alert').innerText().then(text => text.includes('timed out')));
    await page.evaluate(() => { window.fetchJson = async () => ({ layouts: [] }); });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('No saved layouts yet.', { exact: false }).waitFor();
    await page.evaluate(async () => {
      window.fetchJson = async () => { throw new Error('Unable to load map layouts.'); };
      await loadAbearcMapLayouts(true);
    });
    assert(await page.getByRole('alert').innerText().then(text => text.includes('Unable to load')));
    await page.evaluate(() => {
      abearcMapLayoutsLoadError = '';
      window.fetchJson = async url => ({ id: Number(url.split('/').at(-1)), name: 'Export test', state: { camera: {} } });
      abearcMapLayoutHasUnsavedChanges = () => window.dirty;
      abearcMapLayouts = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Layout ${String(i + 1).padStart(2, '0')}`, updated_at: '2026-10-06' }));
      abearcMapActiveLayoutId = 1;
      renderAbearcMapLayouts();
    });
    const first = page.locator('[data-map-layout-id="1"]');
    await first.waitFor();
    assert(await page.locator('[data-map-layout-id]').count() < 30);
    assert.equal(await page.locator('[data-map-layout-active-summary]').count(), 0);
    assert.equal(await first.getByRole('button', { name: 'Save', exact: true }).isVisible(), false);
    await page.evaluate(() => { window.dirty = true; });
    await first.getByRole('button', { name: 'Save', exact: true }).waitFor({ state: 'visible' });
    await first.locator('summary').click();
    await page.locator('[data-map-layout-id="2"] summary').click();
    assert.equal(await page.locator('.abearc-map-layout-card-menu[open]').count(), 1);
    assert.equal(await first.locator('details').getAttribute('open'), null);
    await first.click({ button: 'right' });
    assert.equal(await first.locator('details').getAttribute('open'), '');
    assert.equal(await page.locator('.abearc-map-layout-card-menu[open]').count(), 1);
    assert.equal(await first.getByText('Update with current map').count(), 0);
    const downloadPromise = page.waitForEvent('download');
    await first.getByRole('button', { name: 'Export .abmap', exact: true }).click();
    const download = await downloadPromise;
    assert(download.suggestedFilename().endsWith('.abmap'));
    const out = path.join(root, 'docs/map-layouts/verification');
    fs.mkdirSync(out, { recursive: true });
    await download.saveAs(path.join(out, 'export-test.abmap'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'export-test.abmap'))).format, 'ABEARC_MAP_LAYOUT');
    await page.getByRole('button', { name: 'Next layouts page' }).click();
    assert.equal(await page.locator('[data-map-layout-id="1"]').count(), 0);
    await page.getByRole('button', { name: 'Previous layouts page' }).click();
    await page.getByRole('button', { name: 'Sort by name', exact: true }).click();
    assert.equal(await page.locator('[data-map-layout-sort]').getAttribute('data-sort'), 'name');
    await page.evaluate(() => {
      const blank = document.getElementById('abearcMapCanvas');
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      blank.dispatchEvent(event);
      if (!event.defaultPrevented) throw Error('Browser context menu is not suppressed');
      let handled = false;
      blank.addEventListener('contextmenu', () => { handled = true; }, { once: true });
      blank.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      if (!handled) throw Error('System context handler was blocked');
    });
    await page.screenshot({ path: path.join(out, 'paged-layouts.png') });
    await page.setViewportSize({ width: 390, height: 520 });
    await page.waitForTimeout(150);
    assert(await page.locator('[data-map-layout-id]').count() < 6);
    const fits = await page.locator('.abearc-map-layouts-body').evaluate(el => el.scrollHeight <= el.clientHeight + 1);
    assert(fits, 'Layouts must fit the panel without scrolling');
    assert.deepEqual(errors, []);
    console.log('Layout browser checks passed: paging, Save visibility, exclusive menus, right-click, export, sort and narrow-screen fit.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
