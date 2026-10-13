const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const html = read('src/frontend/pages/map.page.html');
    const control = html.slice(html.indexOf('<div class="abearc-map-measure-tools'), html.indexOf('<button type="button" onclick="resetAbearcMapChanges()'));
    await page.setContent(`<style>${read('src/frontend/styles/application.css')}\n${read('src/frontend/styles/map-multi-measure.css')}</style><div id="mapPage">${control}</div><button id="outside">Outside</button>`);
    await page.evaluate(() => {
      document.querySelector('[data-map-measure-panel]').classList.remove('is-collapsed');
      window.exportsClicked = [];
      window.exportAllAbearcMapMeasurementsKml = () => window.exportsClicked.push('KML');
      window.exportAllAbearcMapMeasurementsGeoJson = () => window.exportsClicked.push('GeoJSON');
    });
    await page.addScriptTag({ content: read('src/frontend/scripts/20-context-menus.js') });
    const details = page.locator('.abearc-map-measure-export');
    const summary = details.locator('summary');
    assert.equal(await summary.innerText(), 'Export');
    await summary.click();
    const trigger = await summary.boundingBox();
    const menu = await details.locator('.abearc-map-measure-export-menu').boundingBox();
    assert(menu.y + menu.height < trigger.y, 'menu opens above footer without expanding it');
    await page.getByRole('button', { name: 'KML', exact: true }).click();
    assert.equal(await details.getAttribute('open'), null);
    await summary.click();
    await page.getByRole('button', { name: 'GeoJSON', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.exportsClicked), ['KML', 'GeoJSON']);
    await summary.click();
    await page.locator('#outside').click();
    assert.equal(await details.getAttribute('open'), null);
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.notEqual(await details.getAttribute('open'), null);
    await page.keyboard.press('Escape');
    assert.equal(await details.getAttribute('open'), null);
    assert(await summary.evaluate(el => el === document.activeElement));
    console.log('Measure export dropdown passed: placement, formats, outside click, keyboard and Escape.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
