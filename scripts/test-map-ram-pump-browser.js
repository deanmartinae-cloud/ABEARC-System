// Optional browser check: synthetic layout, no backend or production data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1280, height:760 }, acceptDownloads:true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>${read('src/frontend/styles/application.css')}\n${read('src/frontend/styles/map-ram-pump.css')} body{margin:0;font-family:Arial}.hidden{display:none!important}</style>${read('src/frontend/pages/map.page.html')}`);
    await page.evaluate(() => {
      document.getElementById('mapPage').classList.remove('hidden');
      document.querySelector('.abearc-map-stage').style.height = '700px';
      document.querySelector('.abearc-map-workspace').style.height = '700px';
      window.abearcMapMeasurements = [{ id:'test', name:'Source to reservoir · 950 m', visible:true, mode:'distance', points:[[125,7],[125.008,7]] }];
      window.abearcMapElevationSource = 'namria-dtm5-prs92';
      window.abearcMap = { project:point => ({ x:(point[0]-125)*50000+60, y:300 }), on() {}, off() {}, dragPan:{ enable() {}, disable() {} } };
      window.abearcMapCurrentBasemap = () => window.testBasemap || 'google-satellite';
      window.toast = () => {}; window.rememberAbearcMapLayoutChange = () => {};
      window.toggleAbearcMapLayoutsDrawer = window.toggleAbearcOrthomosaicDrawer = () => {};
    });
    await page.addScriptTag({ content:read('src/frontend/scripts/21-map-ram-pump-core.js') });
    await page.addScriptTag({ content:read('src/frontend/scripts/22-map-ram-pump.js') });
    await page.evaluate(() => {
      const hydraulic = abearcRamPumpCore.ramPumpSizing({ sourceFlowLps:5, driveHeadM:10, deliveryHeadM:40, drivePipeLengthM:150, drivePipeDiameterMm:90, deliveryPipeLengthM:800, deliveryPipeDiameterMm:63 });
      restoreAbearcRamPumpState({ name:'Browser test', measurementId:'test', source:[125,7], pump:[125.001,7], destination:[125.008,7], driveRoute:[[125,7],[125.001,7]], deliveryRoute:[[125.001,7],[125.008,7]], pumpChainageM:150,
        profile:[{chainageM:0,elevationM:100,segment:'drive'},{chainageM:150,elevationM:90,segment:'drive'},{chainageM:950,elevationM:130,segment:'delivery'}],
        metrics:{sourceElevationM:100,pumpElevationM:90,destinationElevationM:130,driveHeadM:10,deliveryHeadM:40,headRatio:4,driveLengthM:150,deliveryLengthM:800,totalPipeLengthM:950,drivePipe:{diameterMm:90},deliveryPipe:{diameterMm:63},hydraulic}, assessment:{level:'feasible',title:'Preliminary',reasons:[]} });
      toggleAbearcRamPumpDrawer(true);
    });
    const select = page.locator('[data-ram-measurement]');
    const form = page.locator('.abearc-ram-alignment-card');
    for (const viewport of [{width:1280,height:760},{width:390,height:700}]) {
      await page.setViewportSize(viewport);
      await select.scrollIntoViewIfNeeded();
      const a = await select.boundingBox(), b = await form.boundingBox();
      assert(a.height >= 34 && a.y + a.height <= b.y + b.height, 'Measurement selector must remain fully inside its form.');
      assert.equal(await select.inputValue(), 'test');
    }
    await page.setViewportSize({width:1280,height:760});
    assert.equal(await page.locator('[data-ram-source-flow]').inputValue(), '12');
    await page.locator('[data-ram-source-flow]').fill('600');
    await page.evaluate(() => updateAbearcRamPumpInputs());
    assert.equal(await page.evaluate(() => captureAbearcRamPumpState().inputs.sourceFlowLps), 10);
    await page.locator('[data-ram-source-flow]').fill('300');
    await page.evaluate(() => updateAbearcRamPumpInputs());
    const routes = await page.evaluate(() => JSON.stringify([captureAbearcRamPumpState().driveRoute, captureAbearcRamPumpState().deliveryRoute]));
    await page.evaluate(() => toggleAbearcRamPumpProfileFloating(true));
    const panel = page.locator('[data-ram-profile]');
    for (const edge of ['n','s','e','w','ne','nw','se','sw']) {
      const before=await panel.boundingBox(), handle=await panel.locator('[data-ram-profile-resize="'+edge+'"]').boundingBox();
      await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2); await page.mouse.down();
      await page.mouse.move(handle.x+handle.width/2+(edge.includes('w')?14:edge.includes('e')?-14:0),handle.y+handle.height/2+(edge.includes('n')?10:edge.includes('s')?-10:0)); await page.mouse.up();
      const after=await panel.boundingBox();
      assert(after.width<before.width || after.height<before.height, 'Resize handle '+edge+' should resize the window');
    }
    const label=panel.locator('[data-ram-profile-label="pump"]');
    const labelBox=await label.boundingBox();
    await page.mouse.move(labelBox.x+labelBox.width/2,labelBox.y+labelBox.height/2); await page.mouse.down(); await page.mouse.move(labelBox.x+labelBox.width/2+80,labelBox.y+labelBox.height/2-35); await page.mouse.up();
    assert.equal(await label.locator('..').locator('.ram-profile-label-leader').getAttribute('opacity'), '1');
    const offsets=await page.evaluate(() => captureAbearcRamPumpState().profileAnnotations);
    assert(offsets.pump && Math.abs(offsets.pump.dx)>20);
    await label.focus(); await page.keyboard.press('ArrowRight');
    assert((await page.evaluate(() => captureAbearcRamPumpState().profileAnnotations.pump.dx))>offsets.pump.dx);
    await page.evaluate(() => restoreAbearcRamPumpState(captureAbearcRamPumpState()));
    assert.equal(await label.locator('..').locator('.ram-profile-label-leader').getAttribute('opacity'), '1');
    assert.equal(await page.evaluate(() => JSON.stringify([captureAbearcRamPumpState().driveRoute,captureAbearcRamPumpState().deliveryRoute])),routes);
    for(const [basemap,stroke] of [['google-satellite','rgb(255, 255, 255)'],['google-terrain','rgb(23, 32, 51)']]) {
      await page.evaluate(value => { window.testBasemap=value; renderAbearcRamPumpOverlay(); },basemap);
      assert.equal(await page.locator('.abearc-ram-label-leader').first().evaluate(el=>getComputedStyle(el).stroke),stroke);
    }
    const download = page.waitForEvent('download');
    await panel.getByRole('button',{name:'Download elevation profile as PNG'}).click();
    const png=await download; assert(png.suggestedFilename().endsWith('.png'));
    fs.mkdirSync(path.join(root,'output'),{recursive:true}); await png.saveAs(path.join(root,'output/ram-pump-profile.png'));
    await panel.getByRole('button',{name:'Toggle larger elevation profile'}).click();
    assert(await panel.evaluate(el => el.classList.contains('is-expanded')));
    await panel.getByRole('button',{name:'Toggle larger elevation profile'}).click();
    await page.evaluate(() => toggleAbearcRamPumpProfileFloating(false));
    const csvDownload = page.waitForEvent('download');
    await page.evaluate(() => {
      const saved = captureAbearcRamPumpState();
      saved.name = '=1+1'; saved.elevationSourceLabel = 'Terrain, "Test"\nNAMRIA';
      saved.metrics.sourceToDestinationLiftM = -12.5;
      restoreAbearcRamPumpState(saved);
    });
    await page.getByRole('button',{name:'Export CSV',exact:true}).click();
    const csvFile = await csvDownload;
    assert(csvFile.suggestedFilename().endsWith('.csv'));
    const bytes = fs.readFileSync(await csvFile.path());
    assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf','CSV should include the Excel UTF-8 marker.');
    const XLSX = require('xlsx'), book = XLSX.read(bytes,{type:'buffer'});
    const csvRows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:''});
    assert.deepEqual(csvRows[0],['Parameter','Value','Unit']);
    assert(csvRows.every(row => row.length === 3));
    const csvRow = name => csvRows.find(row => row[0] === name);
    assert.deepEqual(csvRow('Available source / drive flow'),['Available source / drive flow',300,'L/min']);
    assert.equal(typeof csvRow('Estimated delivery flow')[1],'number');
    assert.deepEqual(csvRow('Daily source volume'),['Daily source volume',432,'m³/day']);
    assert.deepEqual(csvRow('Source to destination lift'),['Source to destination lift',-12.5,'m']);
    assert.equal(csvRow('Delivery high point elevation')[1],'','Missing values must not become zero.');
    assert.equal(csvRow('Layout')[1],"'=1+1",'User text must not become a spreadsheet formula.');
    assert.equal(csvRow('Elevation source')[1],'Terrain, "Test"\nNAMRIA');
    const popup = page.waitForEvent('popup');
    await page.getByRole('button',{name:'Show full calculation'}).click();
    const report = await popup; await report.waitForLoadState();
    assert((await report.locator('body').innerText()).includes('Ram-pump flow estimate'));
    assert.equal(await report.evaluate(() => window.opener), null);
    assert((await report.locator('body').innerText()).includes('300.00 L/min'));
    assert(!(await report.locator('body').innerText()).includes('L/s'));
    assert.equal(await report.locator('[data-ram-system-pump] [data-ram-isolation]').count(),2);
    await report.getByRole('link',{name:'See assembly B below'}).click();
    assert.equal(await report.evaluate(() => location.hash),'#ramAssemblyB');
    assert(await report.locator('#ramAssemblyB').isVisible());
    const deliveryTable = report.locator('.sizing-block').filter({has:report.getByRole('heading',{name:'Delivery pipe sizing',exact:true})});
    assert.equal(await deliveryTable.getByRole('columnheader',{name:'Equivalent D (in)'}).count(),1);
    const diameterRows = await deliveryTable.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent)));
    assert(diameterRows.every(row => row.length === 7 && row[1] === (Number(row[0])/25.4).toFixed(3)));
    await report.locator('.ram-figure').screenshot({path:path.join(root,'output/ram-pump-engineering-figure.png')});
    fs.mkdirSync(path.join(root,'output'),{recursive:true});
    await page.screenshot({path:path.join(root,'output/ram-pump-ui.png'),fullPage:true});
    assert.deepEqual(errors, []);
    console.log('Ram Pump browser passed: desktop/mobile form, L/min conversions, all eight resize handles, draggable labels, basemap contrast, PNG download, and engineering figure.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
