/* ABEARC Ram Pump Core
 * Pure geometry and hydraulic helpers for the Measure Tools ram-pump planner.
 * DOM-free so the calculations can be regression-tested in Node.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.abearcRamPumpCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  const EARTH_RADIUS_M = 6371008.8;
  const STANDARD_HDPE_DIAMETERS_MM = [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280, 315];
  const PEACE_CORPS_S2 = Object.freeze({
    name: 'Peace Corps / Warwick S-2',
    sourceFlowMinLpm: 40,
    sourceFlowMaxLpm: 120,
    driveHeadMinM: 2,
    driveHeadMaxM: 15,
    deliveryHeadMaxM: 100,
    drivePipeLengthMinFactor: 150,
    drivePipeLengthMaxFactor: 1000,
    standpipeFreeboardM: 0.3,
    standpipeOversizeMm: 25.4,
    supplyPipeOversizeMm: 12.7
  });

  function peaceCorpsS2DriveDiameterMm(flowLps) {
    const q = Number(flowLps);
    if (!(q > 0)) return null;
    if (q >= 0.66 && q <= 1.0) return 25.4;
    if (q > 1.0 && q <= 1.33) return 38.1;
    if (q > 1.33 && q <= 2.0) return 50.8;
    return null;
  }

  function peaceCorpsDrivePipeLengthLimits(diameterMm) {
    const dM = Number(diameterMm) / 1000;
    if (!(dM > 0)) return { minM: NaN, maxM: NaN };
    return { minM: PEACE_CORPS_S2.drivePipeLengthMinFactor * dM, maxM: PEACE_CORPS_S2.drivePipeLengthMaxFactor * dM };
  }

  function nextStandardDiameterMm(targetMm, diametersMm = STANDARD_HDPE_DIAMETERS_MM) {
    const target = Number(targetMm);
    if (!(target > 0)) return null;
    const found = diametersMm.find(value => Number(value) >= target);
    return found || diametersMm[diametersMm.length - 1] || null;
  }

  const GILMAN_CATALOG_SNAPSHOT = Object.freeze({"source":"Gilman Ram Pump & Enterprises product pages","sourceUrl":"https://gilmanrampump.com/products/","capturedAt":"2026-10-07","note":"Embedded offline snapshot. Technical suitability uses supply-flow and pump-lift parameters; prices and stock are informational snapshot values only.","products":[{"model":"GILMAN MF10","code":"MF10","duty":"LIGHT HEAVY DUTY","dailyOutput":"Up to 3,000 liters/day (site conditions dependent)","dailyOutputMinL":0,"dailyOutputMaxL":3000,"maxPumpLift":"20 meters","maxPumpLiftM":20,"drivePort":"1 inch NPT","deliveryPort":"1/2 inch NPT","supplyFlowMinLpm":20,"supplyFlowMaxLpm":30,"weight":"8 kg","packaging":"47 cm x 15 cm x 33 cm","salePricePhp":7547.75,"regularPricePhp":7945,"stock":1,"applications":["household water supply","drinking water systems","small gardens/backyard irrigation","remote low-resource sites"],"url":"https://gilmanrampump.com/product/modelmf10/"},{"model":"GILMAN MF15","code":"MF15","duty":"LIGHT HEAVY DUTY","dailyOutput":"5,000 to 10,000 liters/day","dailyOutputMinL":5000,"dailyOutputMaxL":10000,"maxPumpLift":"20 meters","maxPumpLiftM":20,"drivePort":"1-1/2 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":60,"supplyFlowMaxLpm":120,"weight":"38 kg","packaging":"90 cm x 30 cm x 50 cm","salePricePhp":33320,"regularPricePhp":41650,"stock":1,"applications":["small-farm irrigation","family swimming pools"],"url":"https://gilmanrampump.com/product/modelmf15/"},{"model":"GILMAN MF20","code":"MF20","duty":"LIGHT HEAVY DUTY","dailyOutput":"10,000 to 15,000 liters/day","dailyOutputMinL":10000,"dailyOutputMaxL":15000,"maxPumpLift":"20 meters","maxPumpLiftM":20,"drivePort":"2 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":96,"supplyFlowMaxLpm":180,"weight":"30 kg more or less","packaging":"100 cm x 40 cm x 60 cm","salePricePhp":54976,"regularPricePhp":68720,"stock":2,"applications":["rice paddies","fishpond water supply","higher-capacity low-lift irrigation"],"url":"https://gilmanrampump.com/product/modelmf20/"},{"model":"GILMAN RP75","code":"RP75","duty":"STANDARD HEAVY DUTY","dailyOutput":"700 to 1,200 liters/day","dailyOutputMinL":700,"dailyOutputMaxL":1200,"maxPumpLift":"50 meters","maxPumpLiftM":50,"drivePort":"3/4 inch","deliveryPort":"1/2 inch","supplyFlowMinLpm":12,"supplyFlowMaxLpm":18,"weight":"10 kg","packaging":"54 cm x 13 cm x 30 cm","salePricePhp":16620.25,"regularPricePhp":17495,"stock":14,"applications":["home use","small gardens","small irrigation systems"],"url":"https://gilmanrampump.com/product/modelrp75/"},{"model":"GILMAN RP75-H","code":"RP75-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"700 to 1,200 liters/day","dailyOutputMinL":700,"dailyOutputMaxL":1200,"maxPumpLift":"100 meters","maxPumpLiftM":100,"drivePort":"3/4 inch NPT","deliveryPort":"3/4 inch","supplyFlowMinLpm":12,"supplyFlowMaxLpm":18,"weight":"20 kg","packaging":"90 cm x 13 cm x 30 cm","salePricePhp":18710.25,"regularPricePhp":19695,"stock":3,"applications":["domestic/personal water supply","high-lift small systems"],"url":"https://gilmanrampump.com/product/modelrp75-H/"},{"model":"GILMAN RP100","code":"RP100","duty":"STANDARD HEAVY DUTY","dailyOutput":"1,000 to 5,000 liters/day","dailyOutputMinL":1000,"dailyOutputMaxL":5000,"maxPumpLift":"50 meters","maxPumpLiftM":50,"drivePort":"1 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":15,"supplyFlowMaxLpm":60,"weight":"30 kg","packaging":"100 cm x 25 cm x 50 cm","salePricePhp":35996,"regularPricePhp":44995,"stock":2,"applications":["large homesteads","small farms","clusters of houses"],"url":"https://gilmanrampump.com/product/modelrp100/"},{"model":"GILMAN RP100-H","code":"RP100-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"1,000 to 5,000 liters/day","dailyOutputMinL":1000,"dailyOutputMaxL":5000,"maxPumpLift":"100 meters","maxPumpLiftM":100,"drivePort":"1 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":15,"supplyFlowMaxLpm":60,"weight":"35 kg","packaging":"120 cm x 25 cm x 50 cm","salePricePhp":41396,"regularPricePhp":51745,"stock":2,"applications":["large homesteads","clusters of houses","small farms","high-lift systems"],"url":"https://gilmanrampump.com/product/modelrp100-H/"},{"model":"GILMAN RP125","code":"RP125","duty":"STANDARD HEAVY DUTY","dailyOutput":"3,600 to 6,500 liters/day","dailyOutputMinL":3600,"dailyOutputMaxL":6500,"maxPumpLift":"50 meters","maxPumpLiftM":50,"drivePort":"1-1/4 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":45,"supplyFlowMaxLpm":90,"weight":"45 kg","packaging":"124 cm x 35 cm x 55 cm","salePricePhp":51996,"regularPricePhp":64995,"stock":2,"applications":["small villages","vegetable farms"],"url":"https://gilmanrampump.com/product/modelrp125/"},{"model":"GILMAN RP125-H","code":"RP125-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"3,600 to 6,500 liters/day","dailyOutputMinL":3600,"dailyOutputMaxL":6500,"maxPumpLift":"100 meters","maxPumpLiftM":100,"drivePort":"1-1/4 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":45,"supplyFlowMaxLpm":90,"weight":"48 kg","packaging":"120 cm x 30 cm x 50 cm","salePricePhp":59796,"regularPricePhp":74745,"stock":2,"applications":["small villages","vegetable farms","high-lift systems"],"url":"https://gilmanrampump.com/product/modelrp125-H/"},{"model":"GILMAN RP150","code":"RP150","duty":"STANDARD HEAVY DUTY","dailyOutput":"6,900 to 10,000 liters/day","dailyOutputMinL":6900,"dailyOutputMaxL":10000,"maxPumpLift":"60 meters","maxPumpLiftM":60,"drivePort":"1-1/2 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":75,"supplyFlowMaxLpm":105,"weight":"60 kg","packaging":"100 cm x 40 cm x 60 cm","salePricePhp":71996,"regularPricePhp":89995,"stock":2,"applications":["small village water systems","vegetable gardens","small livestock farms","small pools"],"url":"https://gilmanrampump.com/product/modelrp150/"},{"model":"GILMAN RP150-H","code":"RP150-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"6,900 to 10,000 liters/day","dailyOutputMinL":6900,"dailyOutputMaxL":10000,"maxPumpLift":"100 meters","maxPumpLiftM":100,"drivePort":"1-1/2 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":75,"supplyFlowMaxLpm":105,"weight":"90 kg","packaging":"124 cm x 40 cm x 60 cm","salePricePhp":82796,"regularPricePhp":103495,"stock":2,"applications":["village water systems","vegetable farms","livestock","high-lift systems"],"url":"https://gilmanrampump.com/product/modelrp150-H/"},{"model":"GILMAN RP150-X","code":"RP150-X","duty":"EXTREME LIFT HEAVY DUTY","dailyOutput":"6,000 to 10,000 liters/day","dailyOutputMinL":6000,"dailyOutputMaxL":10000,"maxPumpLift":"Above 100 meters","maxPumpLiftM":null,"liftClassMinM":100,"drivePort":"1-1/2 inch flange type","deliveryPort":"1 inch flange type","supplyFlowMinLpm":75,"supplyFlowMaxLpm":105,"weight":"90 kg","packaging":"115 cm x 36 cm x 76 cm","salePricePhp":95216,"regularPricePhp":119020,"stock":1,"applications":["small villages","vegetable/fruit farms","small rice paddies 1–3 ha","extreme-lift sites"],"url":"https://gilmanrampump.com/product/modelrp150-X/"},{"model":"GILMAN RP200","code":"RP200","duty":"STANDARD HEAVY DUTY","dailyOutput":"8,000 to 15,000 liters/day","dailyOutputMinL":8000,"dailyOutputMaxL":15000,"maxPumpLift":"80 meters","maxPumpLiftM":80,"drivePort":"2 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":90,"supplyFlowMaxLpm":180,"weight":"70 kg","packaging":"124 cm x 50 cm x 70 cm","salePricePhp":91196,"regularPricePhp":113995,"stock":2,"applications":["Barangay Level II water systems","large vegetable gardens","small rice paddies"],"url":"https://gilmanrampump.com/product/modelrp200/"},{"model":"GILMAN RP200-H","code":"RP200-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"8,000 to 15,000 liters/day","dailyOutputMinL":8000,"dailyOutputMaxL":15000,"maxPumpLift":"150 meters","maxPumpLiftM":150,"drivePort":"2 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":90,"supplyFlowMaxLpm":180,"weight":"70 kg","packaging":"124 cm x 50 cm x 70 cm","salePricePhp":109436,"regularPricePhp":136795,"stock":2,"applications":["Barangay Level II water systems","large vegetable gardens","small rice paddies","high-lift systems"],"url":"https://gilmanrampump.com/product/modelrp200-H/"},{"model":"GILMAN RP200-X","code":"RP200-X","duty":"EXTREME LIFT HEAVY DUTY","dailyOutput":"8,000 to 15,000 liters/day","dailyOutputMinL":8000,"dailyOutputMaxL":15000,"maxPumpLift":"150 meters (working-parameter listing; product description references extreme conditions)","maxPumpLiftM":150,"drivePort":"2 inch NPT","deliveryPort":"1 inch","supplyFlowMinLpm":96,"supplyFlowMaxLpm":180,"weight":"155 kg","packaging":"124 cm x 50 cm x 70 cm","salePricePhp":120608,"regularPricePhp":150760,"stock":2,"applications":["village water networks","farm irrigation","poultry farms","extreme/high-elevation sites"],"url":"https://gilmanrampump.com/product/modelrp200-X/"},{"model":"GILMAN RP250","code":"RP250","duty":"STANDARD HEAVY DUTY","dailyOutput":"11,000 to 20,000 liters/day","dailyOutputMinL":11000,"dailyOutputMaxL":20000,"maxPumpLift":"50 meters","maxPumpLiftM":50,"drivePort":"2-1/2 inch NPT","deliveryPort":"1-1/4 inch","supplyFlowMinLpm":135,"supplyFlowMaxLpm":300,"weight":"125 kg","packaging":"124 cm x 60 cm x 80 cm","salePricePhp":100315.6,"regularPricePhp":125394.5,"stock":2,"applications":["farms","barangay water systems","irrigation"],"url":"https://gilmanrampump.com/product/modelrp250/"},{"model":"GILMAN RP250-H","code":"RP250-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"11,000 to 20,000 liters/day","dailyOutputMinL":11000,"dailyOutputMaxL":20000,"maxPumpLift":"150 meters","maxPumpLiftM":150,"drivePort":"2-1/2 inch NPT","deliveryPort":"1-1/4 inch","supplyFlowMinLpm":135,"supplyFlowMaxLpm":300,"weight":"160 kg","packaging":"124 cm x 60 cm x 80 cm","salePricePhp":120380,"regularPricePhp":150475,"stock":1,"applications":["farms","barangay water systems","irrigation","high-lift systems"],"url":"https://gilmanrampump.com/product/modelrp250-H/"},{"model":"GILMAN RP250-X","code":"RP250-X","duty":"EXTREME LIFT HEAVY DUTY","dailyOutput":"11,000 to 20,000 liters/day","dailyOutputMinL":11000,"dailyOutputMaxL":20000,"maxPumpLift":"150 meters (working-parameter listing)","maxPumpLiftM":150,"drivePort":"2-1/2 inch NPT","deliveryPort":"1-1/2 inch","supplyFlowMinLpm":135,"supplyFlowMaxLpm":300,"weight":"185 kg","packaging":"Not specified on product page","salePricePhp":132666.4,"regularPricePhp":165833,"stock":0,"applications":["farms","barangay water systems","irrigation","extreme/high-lift sites","parallel/tandem installations"],"url":"https://gilmanrampump.com/product/modelrp250-X/"},{"model":"GILMAN RP300","code":"RP300","duty":"STANDARD HEAVY DUTY","dailyOutput":"Up to 40,000 liters/day depending on source flow, drive head and lift","dailyOutputMinL":0,"dailyOutputMaxL":40000,"maxPumpLift":"50 meters","maxPumpLiftM":50,"drivePort":"3 inch NPS","deliveryPort":"1-1/2 inch NPS","supplyFlowMinLpm":180,"supplyFlowMaxLpm":480,"weight":"160 kg more or less","packaging":"Not specified on product page","salePricePhp":127196,"regularPricePhp":158995,"stock":1,"applications":["barangay water systems","resorts","irrigation","large springs/rivers","parallel/tandem installations"],"url":"https://gilmanrampump.com/product/modelrp300/"},{"model":"GILMAN RP300-H","code":"RP300-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"Up to 40,000 liters/day","dailyOutputMinL":0,"dailyOutputMaxL":40000,"maxPumpLift":"100 meters","maxPumpLiftM":100,"drivePort":"3 inch NPS","deliveryPort":"1-1/2 inch","supplyFlowMinLpm":180,"supplyFlowMaxLpm":480,"weight":"245 kg","packaging":"160 cm x 60 cm x 90 cm","salePricePhp":150282.4,"regularPricePhp":187853,"stock":1,"applications":["barangay water systems","highland resorts","farm irrigation","high-yield springs"],"url":"https://gilmanrampump.com/product/modelrp300-H/"},{"model":"GILMAN RP300-X","code":"RP300-X","duty":"EXTREME LIFT HEAVY DUTY","dailyOutput":"Up to 40,000 liters/day","dailyOutputMinL":0,"dailyOutputMaxL":40000,"maxPumpLift":"Above 100 meters","maxPumpLiftM":null,"liftClassMinM":100,"drivePort":"3 inch NPS flange end","deliveryPort":"1-1/2 inch NPS flange end","supplyFlowMinLpm":180,"supplyFlowMaxLpm":480,"weight":"210 kg","packaging":"Not specified on product page","salePricePhp":172824,"regularPricePhp":216030,"stock":0,"applications":["barangay water systems","resorts","irrigation","large springs/rivers","extreme-lift sites","parallel/tandem installations"],"url":"https://gilmanrampump.com/product/modelrp300-X/"},{"model":"GILMAN RP400","code":"RP400","duty":"STANDARD HEAVY DUTY","dailyOutput":"Up to 150,000 liters/day","dailyOutputMinL":0,"dailyOutputMaxL":150000,"maxPumpLift":"60 meters","maxPumpLiftM":60,"drivePort":"4 inch NPT","deliveryPort":"2 inch","supplyFlowMinLpm":600,"supplyFlowMaxLpm":1800,"weight":"205 kg","packaging":"130 cm x 80 cm x 100 cm","salePricePhp":197596,"regularPricePhp":246995,"stock":0,"applications":["large headwaters/rivers","large irrigation/water systems","parallel/tandem installations"],"url":"https://gilmanrampump.com/product/modelrp400/"},{"model":"GILMAN RP400-H","code":"RP400-H","duty":"HIGH LIFT HEAVY DUTY","dailyOutput":"Up to 150,000 liters/day","dailyOutputMinL":0,"dailyOutputMaxL":150000,"maxPumpLift":"100 meters","maxPumpLiftM":100,"drivePort":"4 inch NPS flange end","deliveryPort":"2 inch NPS flange end","supplyFlowMinLpm":600,"supplyFlowMaxLpm":1800,"weight":"245 kg","packaging":"180 cm x 80 cm x 100 cm","salePricePhp":227236,"regularPricePhp":284045,"stock":0,"applications":["large headwaters/rivers","large irrigation/water systems","high-lift systems","parallel/tandem installations"],"url":"https://gilmanrampump.com/product/modelrp400-H/"},{"model":"GILMAN RP400-X","code":"RP400-X","duty":"EXTREME LIFT HEAVY DUTY","dailyOutput":"Up to 150,000 liters/day depending on source flow, drive head and lift","dailyOutputMinL":0,"dailyOutputMaxL":150000,"maxPumpLift":"Above 100 meters","maxPumpLiftM":null,"liftClassMinM":100,"drivePort":"4 inch flange type","deliveryPort":"2 inch NPS flange type","supplyFlowMinLpm":600,"supplyFlowMaxLpm":1800,"weight":"185 kg","packaging":"150 cm x 100 cm x 100 cm","salePricePhp":261320,"regularPricePhp":326650,"stock":0,"applications":["commercial swimming pools","large irrigation projects","municipal water works","stone quarry washers","extreme-high elevation systems","parallel/tandem installations"],"url":"https://gilmanrampump.com/product/modelrp400-X/"}]});
  const GILMAN_RAM_PUMP_MODELS = Object.freeze(GILMAN_CATALOG_SNAPSHOT.products.map(product => Object.freeze({ pumpingDistance: 'Any Distance', ...product })));

  function gilmanModelLiftFits(model, deliveryHeadM) {
    const head = deliveryHeadM == null || deliveryHeadM === '' ? NaN : Number(deliveryHeadM);
    if (!Number.isFinite(head) || head <= 0) return true;
    if (Number.isFinite(Number(model.maxPumpLiftM))) return head <= Number(model.maxPumpLiftM) + 1e-9;
    return Number.isFinite(Number(model.liftClassMinM)) ? head >= 0 : true;
  }

  function gilmanDutyRank(duty) {
    const text = String(duty || '').toUpperCase();
    if (text.includes('LIGHT')) return 0;
    if (text.includes('STANDARD')) return 1;
    if (text.includes('HIGH')) return 2;
    if (text.includes('EXTREME')) return 3;
    return 4;
  }

  function recommendGilmanRamPump({ sourceFlowLpm = 0, deliveryHeadM = null, desiredDailyOutputL = 0 } = {}) {
    const flow = Math.max(0, Number(sourceFlowLpm) || 0);
    const head = deliveryHeadM == null || deliveryHeadM === '' ? NaN : Number(deliveryHeadM);
    const desiredDaily = Math.max(0, Number(desiredDailyOutputL) || 0);
    const byFlow = GILMAN_RAM_PUMP_MODELS.filter(model => flow >= Number(model.supplyFlowMinLpm) - 1e-9 && flow <= Number(model.supplyFlowMaxLpm) + 1e-9);
    const exact = byFlow.filter(model => gilmanModelLiftFits(model, head));
    const score = model => {
      const flowMid = (Number(model.supplyFlowMinLpm) + Number(model.supplyFlowMaxLpm)) / 2;
      const span = Math.max(1, Number(model.supplyFlowMaxLpm) - Number(model.supplyFlowMinLpm));
      const flowPenalty = Math.abs(flow - flowMid) / span;
      const liftPenalty = Number.isFinite(head) && Number.isFinite(Number(model.maxPumpLiftM))
        ? Math.max(0, (Number(model.maxPumpLiftM) - head) / Math.max(20, Number(model.maxPumpLiftM))) * 0.25
        : 0.35;
      const dutyPenalty = gilmanDutyRank(model.duty) * 0.12;
      const dailyPenalty = desiredDaily > 0 && Number(model.dailyOutputMaxL || 0) > 0 && desiredDaily > Number(model.dailyOutputMaxL)
        ? Math.min(4, (desiredDaily - Number(model.dailyOutputMaxL)) / Math.max(1, Number(model.dailyOutputMaxL)))
        : 0;
      const pricePenalty = Number(model.salePricePhp || model.regularPricePhp || 0) / 1000000;
      return flowPenalty + liftPenalty + dutyPenalty + dailyPenalty + pricePenalty;
    };
    exact.sort((a, b) => score(a) - score(b));
    if (exact.length) {
      return {
        status: 'matched',
        recommended: exact[0],
        alternatives: exact.slice(1, 4),
        exactFlowMatches: byFlow.length,
        reason: Number.isFinite(head)
          ? `Matches ${flow.toFixed(2)} L/min source flow and the preliminary ${head.toFixed(2)} m delivery head.`
          : `Matches the ${flow.toFixed(2)} L/min source-flow range. Generate the layout to confirm pump-lift suitability.`,
        requiresVerification: !Number.isFinite(Number(exact[0].maxPumpLiftM))
      };
    }
    const liftCapable = GILMAN_RAM_PUMP_MODELS.filter(model => gilmanModelLiftFits(model, head));
    const nearest = (liftCapable.length ? liftCapable : GILMAN_RAM_PUMP_MODELS).slice().sort((a, b) => {
      const distance = model => flow < model.supplyFlowMinLpm ? model.supplyFlowMinLpm - flow : flow > model.supplyFlowMaxLpm ? flow - model.supplyFlowMaxLpm : 0;
      return distance(a) - distance(b) || score(a) - score(b);
    }).slice(0, 3);
    const minCatalogFlow = Math.min(...GILMAN_RAM_PUMP_MODELS.map(model => Number(model.supplyFlowMinLpm)));
    const maxCatalogFlow = Math.max(...GILMAN_RAM_PUMP_MODELS.map(model => Number(model.supplyFlowMaxLpm)));
    let status = 'no-exact-match';
    let reason = `No embedded Gilman model simultaneously matches the entered source flow${Number.isFinite(head) ? ' and delivery head' : ''}.`;
    if (flow < minCatalogFlow) {
      status = 'below-catalog-flow';
      reason = `No Gilman model in the embedded catalog is rated as low as ${flow.toFixed(2)} L/min. The lowest published supply-flow requirement is ${minCatalogFlow.toFixed(0)} L/min.`;
    } else if (flow > maxCatalogFlow) {
      status = 'above-catalog-flow';
      reason = `The entered ${flow.toFixed(2)} L/min exceeds the single-pump supply-flow ranges in the embedded catalog. Consider parallel units only after manufacturer/engineering review.`;
    } else if (byFlow.length && Number.isFinite(head)) {
      status = 'lift-mismatch';
      reason = `The source flow matches ${byFlow.length} catalog model${byFlow.length === 1 ? '' : 's'}, but none has a published lift rating that clearly covers ${head.toFixed(2)} m.`;
    }
    return { status, recommended: null, alternatives: nearest, exactFlowMatches: byFlow.length, reason, requiresVerification: true };
  }

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
  const radians = degrees => Number(degrees) * Math.PI / 180;

  function validLngLat(point) {
    return Array.isArray(point) && point.length >= 2 && finite(point[0]) && finite(point[1])
      && Number(point[0]) >= -180 && Number(point[0]) <= 180
      && Number(point[1]) >= -90 && Number(point[1]) <= 90;
  }

  function toLngLat(value) {
    if (validLngLat(value)) return [Number(value[0]), Number(value[1])];
    const longitude = Number(value?.longitude ?? value?.lng);
    const latitude = Number(value?.latitude ?? value?.lat);
    return finite(longitude) && finite(latitude) ? [longitude, latitude] : null;
  }

  function haversineMetres(a, b) {
    a = toLngLat(a); b = toLngLat(b);
    if (!a || !b) return NaN;
    const latA = radians(a[1]), latB = radians(b[1]);
    const dLat = latB - latA, dLng = radians(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
  }

  function lineDistanceMetres(points) {
    const clean = (Array.isArray(points) ? points : []).map(toLngLat).filter(Boolean);
    let total = 0;
    for (let index = 1; index < clean.length; index++) total += haversineMetres(clean[index - 1], clean[index]);
    return total;
  }

  function localFrame(points) {
    const clean = (Array.isArray(points) ? points : []).map(toLngLat).filter(Boolean);
    if (!clean.length) return null;
    const longitude0 = clean.reduce((sum, point) => sum + point[0], 0) / clean.length;
    const latitude0 = clean.reduce((sum, point) => sum + point[1], 0) / clean.length;
    const cosLat = Math.max(0.1, Math.cos(radians(latitude0)));
    const metresPerDegreeX = 111320 * cosLat, metresPerDegreeY = 110574;
    return {
      origin: [longitude0, latitude0],
      project(point) {
        const ll = toLngLat(point);
        return ll ? [(ll[0] - longitude0) * metresPerDegreeX, (ll[1] - latitude0) * metresPerDegreeY] : null;
      },
      unproject(point) { return [longitude0 + Number(point[0]) / metresPerDegreeX, latitude0 + Number(point[1]) / metresPerDegreeY]; }
    };
  }

  function distancePointToSegmentM(point, a, b) {
    const frame = localFrame([point, a, b]);
    const p = frame?.project(point), x = frame?.project(a), y = frame?.project(b);
    if (!p || !x || !y) return NaN;
    const dx = y[0] - x[0], dy = y[1] - x[1], denom = dx * dx + dy * dy;
    const t = denom ? clamp(((p[0] - x[0]) * dx + (p[1] - x[1]) * dy) / denom, 0, 1) : 0;
    return Math.hypot(p[0] - (x[0] + dx * t), p[1] - (x[1] + dy * t));
  }

  function corridorPolygon(a, b, halfWidthM, alongMarginM = null) {
    a = toLngLat(a); b = toLngLat(b);
    if (!a || !b) return [];
    const frame = localFrame([a, b]);
    const pa = frame.project(a), pb = frame.project(b);
    const dx = pb[0] - pa[0], dy = pb[1] - pa[1], length = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
    const width = Math.max(20, Number(halfWidthM) || 100);
    const margin = alongMarginM == null ? Math.min(width, Math.max(25, length * 0.12)) : Math.max(0, Number(alongMarginM) || 0);
    const start = [pa[0] - ux * margin, pa[1] - uy * margin];
    const end = [pb[0] + ux * margin, pb[1] + uy * margin];
    return [
      frame.unproject([start[0] + nx * width, start[1] + ny * width]),
      frame.unproject([end[0] + nx * width, end[1] + ny * width]),
      frame.unproject([end[0] - nx * width, end[1] - ny * width]),
      frame.unproject([start[0] - nx * width, start[1] - ny * width])
    ];
  }

  function pointInPolygon(point, polygon) {
    point = toLngLat(point);
    const clean = (Array.isArray(polygon) ? polygon : []).map(toLngLat).filter(Boolean);
    if (!point || clean.length < 3) return false;
    let inside = false;
    for (let index = 0, previous = clean.length - 1; index < clean.length; previous = index++) {
      const a = clean[index], b = clean[previous];
      if ((a[1] > point[1]) !== (b[1] > point[1])
          && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  function createGridPlan(polygon, { maxSamples = 1800, preferredSpacingM = 20 } = {}) {
    const clean = (Array.isArray(polygon) ? polygon : []).map(toLngLat).filter(Boolean);
    if (clean.length < 3) throw new Error('A valid terrain search polygon is required.');
    const frame = localFrame(clean), xy = clean.map(frame.project);
    const minX = Math.min(...xy.map(point => point[0])), maxX = Math.max(...xy.map(point => point[0]));
    const minY = Math.min(...xy.map(point => point[1])), maxY = Math.max(...xy.map(point => point[1]));
    const width = Math.max(1, maxX - minX), height = Math.max(1, maxY - minY);
    let spacingM = Math.max(3, Number(preferredSpacingM) || 20);
    for (let i = 0; i < 12; i++) {
      const columns = Math.max(2, Math.ceil(width / spacingM) + 1), rows = Math.max(2, Math.ceil(height / spacingM) + 1);
      if (columns * rows <= Math.max(100, Number(maxSamples) || 1800)) break;
      spacingM *= Math.max(1.08, Math.sqrt(columns * rows / Math.max(100, Number(maxSamples) || 1800)) * 1.03);
    }
    const columns = Math.max(2, Math.ceil(width / spacingM) + 1), rows = Math.max(2, Math.ceil(height / spacingM) + 1);
    const dx = width / Math.max(1, columns - 1), dy = height / Math.max(1, rows - 1);
    const locations = [], mask = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const ll = frame.unproject([minX + col * dx, minY + row * dy]);
        locations.push({ longitude: ll[0], latitude: ll[1] });
        mask.push(pointInPolygon(ll, clean));
      }
    }
    return { polygon: clean, frame, minX, minY, width, height, columns, rows, dx, dy, spacingM: Math.max(dx, dy), locations, mask };
  }

  function interpolateLine(points, spacingM = 15) {
    const clean = (Array.isArray(points) ? points : []).map(toLngLat).filter(Boolean);
    if (clean.length < 2) return clean;
    const output = [clean[0]], spacing = Math.max(1, Number(spacingM) || 15);
    for (let index = 1; index < clean.length; index++) {
      const a = clean[index - 1], b = clean[index], length = haversineMetres(a, b);
      const steps = Math.max(1, Math.ceil(length / spacing));
      for (let step = 1; step <= steps; step++) {
        const ratio = step / steps;
        output.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]);
      }
    }
    return output;
  }

  function cumulativeProfile(points, elevations) {
    const clean = (Array.isArray(points) ? points : []).map(toLngLat).filter(Boolean);
    const result = [];
    let chainageM = 0;
    for (let index = 0; index < clean.length; index++) {
      if (index) chainageM += haversineMetres(clean[index - 1], clean[index]);
      result.push({ point: clean[index], chainageM, elevationM: Number(elevations?.[index]) });
    }
    return result;
  }

  function hazenWilliamsHeadLossM(lengthM, flowLps, diameterMm, coefficient = 140) {
    const length = Number(lengthM), flow = Number(flowLps) / 1000, diameter = Number(diameterMm) / 1000, c = Number(coefficient);
    if (!(length >= 0) || !(flow >= 0) || !(diameter > 0) || !(c > 0)) return NaN;
    if (!flow || !length) return 0;
    return 10.67 * length * Math.pow(flow, 1.852) / (Math.pow(c, 1.852) * Math.pow(diameter, 4.871));
  }

  function pipeVelocityMps(flowLps, diameterMm) {
    const flow = Number(flowLps) / 1000, diameter = Number(diameterMm) / 1000;
    if (!(flow >= 0) || !(diameter > 0)) return NaN;
    return flow / (Math.PI * diameter * diameter / 4);
  }

  function evaluatePipe({ flowLps, lengthM, diameterMm, coefficient = 140, minVelocityMps = 0.25, maxVelocityMps = 2.5 } = {}) {
    const velocityMps = pipeVelocityMps(flowLps, diameterMm);
    const headlossM = hazenWilliamsHeadLossM(lengthM, flowLps, diameterMm, coefficient);
    return { diameterMm: Number(diameterMm), velocityMps, headlossM, headlossPercent: Number(lengthM) > 0 ? headlossM / Number(lengthM) * 100 : 0,
      meetsCriteria: finite(velocityMps) && finite(headlossM) && velocityMps >= minVelocityMps && velocityMps <= maxVelocityMps };
  }

  function selectPipeDiameter({ flowLps, lengthM = 100, coefficient = 140, minVelocityMps = 0.25, maxVelocityMps = 2.5, maxHeadlossPercent = 10, diametersMm = STANDARD_HDPE_DIAMETERS_MM } = {}) {
    if (!(Number(flowLps) > 0)) return null;
    let fallback = null;
    for (const diameterMm of diametersMm) {
      const record = evaluatePipe({ flowLps, lengthM, diameterMm, coefficient, minVelocityMps, maxVelocityMps });
      record.meetsCriteria = record.meetsCriteria && record.headlossPercent <= maxHeadlossPercent;
      const penalty = Math.abs(record.velocityMps - 1.1) + Math.max(0, record.headlossPercent - maxHeadlossPercent) * 2;
      if (!fallback || penalty < fallback.penalty) fallback = { record, penalty };
      if (record.meetsCriteria) return record;
    }
    return fallback?.record || null;
  }

  function ramPumpSizing({ sourceFlowLps, driveHeadM, deliveryHeadM, efficiency = 0.6, drivePipeLengthM = 0, drivePipeDiameterMm = null, deliveryPipeLengthM = 0, deliveryPipeDiameterMm = null, hazenWilliamsC = 140, operatingHours = 24 } = {}) {
    const sourceFlow = Math.max(0, Number(sourceFlowLps) || 0), grossDriveHead = Math.max(0, Number(driveHeadM) || 0), grossDeliveryHead = Math.max(0, Number(deliveryHeadM) || 0);
    const eta = clamp(efficiency || 0.6, 0.2, 0.85);
    const driveLossM = drivePipeDiameterMm ? Math.max(0, hazenWilliamsHeadLossM(drivePipeLengthM, sourceFlow, drivePipeDiameterMm, hazenWilliamsC) || 0) : 0;
    const netDriveHeadM = Math.max(0, grossDriveHead - driveLossM);
    let deliveredFlowLps = 0, deliveryLossM = 0, iterations = 0, converged = true;
    if (sourceFlow > 0 && netDriveHeadM > 0 && grossDeliveryHead > 0) {
      deliveredFlowLps = sourceFlow * netDriveHeadM / grossDeliveryHead * eta;
      if (deliveryPipeDiameterMm && deliveryPipeLengthM >= 0) {
        converged = false;
        for (let i = 0; i < 40; i++) {
          iterations = i + 1;
          deliveryLossM = Math.max(0, hazenWilliamsHeadLossM(deliveryPipeLengthM, deliveredFlowLps, deliveryPipeDiameterMm, hazenWilliamsC) || 0);
          const totalDeliveryHead = grossDeliveryHead + deliveryLossM;
          const next = totalDeliveryHead > 0 ? sourceFlow * netDriveHeadM / totalDeliveryHead * eta : 0;
          if (Math.abs(next - deliveredFlowLps) < 0.0005) { deliveredFlowLps = next; converged = true; break; }
          deliveredFlowLps = Math.max(0, (deliveredFlowLps + next) / 2);
        }
      }
    }
    deliveredFlowLps = Math.min(sourceFlow, Math.max(0, deliveredFlowLps));
    const wasteFlowLps = Math.max(0, sourceFlow - deliveredFlowLps);
    const hours = clamp(operatingHours || 24, 0, 24);
    return {
      sourceFlowLps: sourceFlow, efficiency: eta, grossDriveHeadM: grossDriveHead, driveLossM, netDriveHeadM,
      grossDeliveryHeadM: grossDeliveryHead, deliveryLossM, totalDeliveryHeadM: grossDeliveryHead + deliveryLossM,
      deliveredFlowLps, wasteFlowLps, sourceM3Day: sourceFlow * 3.6 * hours, deliveredM3Day: deliveredFlowLps * 3.6 * hours, wasteM3Day: wasteFlowLps * 3.6 * hours,
      operatingHours: hours, converged, iterations, headRatio: grossDriveHead > 0 ? grossDeliveryHead / grossDriveHead : Infinity
    };
  }

  function requiredSourceFlowForDelivery({ desiredDeliveryFlowLps, driveHeadM, deliveryHeadM, efficiency = 0.6, drivePipeLengthM = 0, drivePipeDiameterMm = null, deliveryPipeLengthM = 0, deliveryPipeDiameterMm = null, hazenWilliamsC = 140 } = {}) {
    const desiredFlow = Math.max(0, Number(desiredDeliveryFlowLps) || 0);
    const grossDriveHeadM = Math.max(0, Number(driveHeadM) || 0);
    const grossDeliveryHeadM = Math.max(0, Number(deliveryHeadM) || 0);
    const eta = clamp(efficiency || 0.6, 0.2, 0.85);
    const deliveryLossM = deliveryPipeDiameterMm && desiredFlow > 0
      ? Math.max(0, hazenWilliamsHeadLossM(deliveryPipeLengthM, desiredFlow, deliveryPipeDiameterMm, hazenWilliamsC) || 0)
      : 0;
    const totalDeliveryHeadM = grossDeliveryHeadM + deliveryLossM;
    if (!(desiredFlow > 0)) return { requiredSourceFlowLps: 0, desiredDeliveryFlowLps: 0, grossDriveHeadM, driveLossM: 0, netDriveHeadM: grossDriveHeadM, grossDeliveryHeadM, deliveryLossM, totalDeliveryHeadM, efficiency: eta, converged: true, iterations: 0 };
    if (!(grossDriveHeadM > 0) || !(totalDeliveryHeadM > 0)) return { requiredSourceFlowLps: Infinity, desiredDeliveryFlowLps: desiredFlow, grossDriveHeadM, driveLossM: grossDriveHeadM, netDriveHeadM: 0, grossDeliveryHeadM, deliveryLossM, totalDeliveryHeadM, efficiency: eta, converged: false, iterations: 0 };
    let requiredSourceFlowLps = desiredFlow * totalDeliveryHeadM / Math.max(1e-9, eta * grossDriveHeadM);
    let driveLossM = 0, netDriveHeadM = grossDriveHeadM, converged = false, iterations = 0;
    for (let i = 0; i < 50; i++) {
      iterations = i + 1;
      driveLossM = drivePipeDiameterMm
        ? Math.max(0, hazenWilliamsHeadLossM(drivePipeLengthM, requiredSourceFlowLps, drivePipeDiameterMm, hazenWilliamsC) || 0)
        : 0;
      netDriveHeadM = grossDriveHeadM - driveLossM;
      if (!(netDriveHeadM > 1e-6)) {
        requiredSourceFlowLps = Infinity;
        break;
      }
      const next = desiredFlow * totalDeliveryHeadM / Math.max(1e-9, eta * netDriveHeadM);
      if (!Number.isFinite(next) || next > 1e5) { requiredSourceFlowLps = Infinity; break; }
      if (Math.abs(next - requiredSourceFlowLps) < 0.00001) { requiredSourceFlowLps = next; converged = true; break; }
      requiredSourceFlowLps = Math.max(0, (requiredSourceFlowLps + next) / 2);
    }
    if (Number.isFinite(requiredSourceFlowLps) && !converged) {
      driveLossM = drivePipeDiameterMm ? Math.max(0, hazenWilliamsHeadLossM(drivePipeLengthM, requiredSourceFlowLps, drivePipeDiameterMm, hazenWilliamsC) || 0) : 0;
      netDriveHeadM = grossDriveHeadM - driveLossM;
    }
    return { requiredSourceFlowLps, desiredDeliveryFlowLps: desiredFlow, grossDriveHeadM, driveLossM, netDriveHeadM, grossDeliveryHeadM, deliveryLossM, totalDeliveryHeadM, efficiency: eta, converged, iterations };
  }

  function findRamPumpCandidates({ grid, elevations, sourcePoint, destinationPoint, sourceElevationM, destinationElevationM, minDriveHeadM = 1.5, maxDriveHeadM = 30, maxDeliveryHeadM = 180, maxHeadRatio = 20, maxCandidates = 12 } = {}) {
    if (!grid || !Array.isArray(grid.locations) || !Array.isArray(elevations) || elevations.length !== grid.locations.length) throw new Error('Complete terrain grid elevations are required.');
    sourcePoint = toLngLat(sourcePoint); destinationPoint = toLngLat(destinationPoint);
    if (!sourcePoint || !destinationPoint || !finite(sourceElevationM) || !finite(destinationElevationM)) throw new Error('Source and destination terrain elevations are required.');
    const directDistance = haversineMetres(sourcePoint, destinationPoint);
    const raw = [];
    for (let index = 0; index < grid.locations.length; index++) {
      if (!grid.mask[index] || !finite(elevations[index])) continue;
      const location = toLngLat(grid.locations[index]), pumpElevationM = Number(elevations[index]);
      const driveHeadM = Number(sourceElevationM) - pumpElevationM;
      if (driveHeadM < Number(minDriveHeadM) || driveHeadM > Number(maxDriveHeadM)) continue;
      const deliveryHeadM = Number(destinationElevationM) - pumpElevationM;
      if (!(deliveryHeadM > 0.25) || deliveryHeadM > Number(maxDeliveryHeadM)) continue;
      const headRatio = deliveryHeadM / driveHeadM;
      if (!(headRatio > 0) || headRatio > Number(maxHeadRatio)) continue;
      const driveDistanceM = haversineMetres(sourcePoint, location), deliveryDistanceM = haversineMetres(location, destinationPoint);
      if (!(driveDistanceM > driveHeadM * 1.5) || driveDistanceM > Math.max(1200, directDistance * 1.6)) continue;
      const driveSlopePct = driveHeadM / driveDistanceM * 100;
      if (driveSlopePct < 0.5 || driveSlopePct > 45) continue;
      const lateralOffsetM = distancePointToSegmentM(location, sourcePoint, destinationPoint);
      const lengthPenalty = (driveDistanceM + deliveryDistanceM) / Math.max(1, directDistance);
      const ratioPenalty = Math.abs(Math.log(Math.max(1.01, headRatio) / 5));
      const slopePenalty = Math.abs(Math.log(Math.max(0.01, driveSlopePct) / 8));
      const offsetPenalty = lateralOffsetM / Math.max(150, directDistance * 0.5);
      const score = driveHeadM / Math.max(deliveryHeadM, 1) * 8 - lengthPenalty * 1.25 - ratioPenalty * 1.2 - slopePenalty * 0.65 - offsetPenalty * 0.45;
      raw.push({ index, location, pumpElevationM, sourceElevationM: Number(sourceElevationM), destinationElevationM: Number(destinationElevationM), driveHeadM, deliveryHeadM,
        headRatio, driveDistanceM, deliveryDistanceM, driveSlopePct, lateralOffsetM, score });
    }
    raw.sort((a, b) => b.score - a.score);
    const chosen = [];
    const separationM = Math.max(grid.spacingM * 2.5, Math.min(80, directDistance * 0.08));
    for (const candidate of raw) {
      if (chosen.some(existing => haversineMetres(existing.location, candidate.location) < separationM)) continue;
      chosen.push(candidate);
      if (chosen.length >= Math.max(1, Number(maxCandidates) || 12)) break;
    }
    return chosen;
  }

  class MinHeap {
    constructor() { this.items = []; }
    push(cost, node) { const item = { cost, node }, a = this.items; a.push(item); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].cost <= cost) break; a[i] = a[p]; i = p; } a[i] = item; }
    pop() { const a = this.items; if (!a.length) return null; const root = a[0], tail = a.pop(); if (!a.length) return root; let i = 0; while (true) { const l = i * 2 + 1; if (l >= a.length) break; const r = l + 1, c = r < a.length && a[r].cost < a[l].cost ? r : l; if (a[c].cost >= tail.cost) break; a[i] = a[c]; i = c; } a[i] = tail; return root; }
    get size() { return this.items.length; }
  }

  function deliveryRouteAStar(plan, elevations, { ascentPenalty = 8, highPointPenalty = 2, slopePenalty = 1.5 } = {}) {
    if (!plan || !Array.isArray(elevations) || elevations.length !== plan.rows * plan.columns) return null;
    const start = plan.startIndex, end = plan.endIndex;
    if (!finite(elevations[start]) || !finite(elevations[end])) return null;
    const count = elevations.length, cost = new Float64Array(count); cost.fill(Infinity);
    const previous = new Int32Array(count); previous.fill(-1); const closed = new Uint8Array(count); const heap = new MinHeap();
    const startElevation = Number(elevations[start]), endElevation = Number(elevations[end]), reference = Math.max(startElevation, endElevation);
    cost[start] = 0; heap.push(0, start);
    const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    while (heap.size) {
      const current = heap.pop().node; if (closed[current]) continue; closed[current] = 1; if (current === end) break;
      const row = Math.floor(current / plan.columns), col = current % plan.columns, currentLocal = plan.local[current], currentElevation = Number(elevations[current]);
      for (const [dr, dc] of offsets) {
        const nr = row + dr, nc = col + dc; if (nr < 0 || nr >= plan.rows || nc < 0 || nc >= plan.columns) continue;
        const next = nr * plan.columns + nc; if (closed[next] || (plan.activeMask && !plan.activeMask[next]) || !finite(elevations[next])) continue;
        const nextLocal = plan.local[next], nextElevation = Number(elevations[next]);
        const distanceM = Math.max(0.1, Math.hypot(nextLocal.x - currentLocal.x, nextLocal.y - currentLocal.y));
        const riseM = Math.max(0, nextElevation - currentElevation), grade = Math.abs(nextElevation - currentElevation) / distanceM;
        const high = Math.max(0, nextElevation - reference);
        const edge = distanceM + riseM * Number(ascentPenalty) + high * Number(highPointPenalty) + Math.max(0, grade - 0.25) * distanceM * Number(slopePenalty);
        const nextCost = cost[current] + edge;
        if (nextCost + 1e-9 >= cost[next]) continue;
        cost[next] = nextCost; previous[next] = current;
        const heuristic = Math.hypot(plan.local[end].x - nextLocal.x, plan.local[end].y - nextLocal.y);
        heap.push(nextCost + heuristic, next);
      }
    }
    if (end !== start && previous[end] < 0) return null;
    const indexes = []; let cursor = end;
    for (let step = 0; step <= count; step++) { indexes.push(cursor); if (cursor === start) break; cursor = previous[cursor]; if (cursor < 0) return null; }
    indexes.reverse(); return indexes[0] === start ? indexes : null;
  }

  function simplifyRoute(points, toleranceM = 3) {
    const clean = (Array.isArray(points) ? points : []).map(toLngLat).filter(Boolean);
    if (clean.length <= 2) return clean;
    const frame = localFrame(clean), xy = clean.map(frame.project);
    const keep = new Uint8Array(clean.length); keep[0] = 1; keep[clean.length - 1] = 1;
    const recurse = (first, last) => {
      const a = xy[first], b = xy[last], dx = b[0] - a[0], dy = b[1] - a[1], denom = dx * dx + dy * dy;
      let best = -1, bestDist = 0;
      for (let i = first + 1; i < last; i++) {
        const p = xy[i], t = denom ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom, 0, 1) : 0;
        const d = Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
        if (d > bestDist) { bestDist = d; best = i; }
      }
      if (best >= 0 && bestDist > toleranceM) { keep[best] = 1; recurse(first, best); recurse(best, last); }
    };
    recurse(0, clean.length - 1);
    return clean.filter((_, index) => keep[index]);
  }

  return {
    EARTH_RADIUS_M, STANDARD_HDPE_DIAMETERS_MM, validLngLat, toLngLat, haversineMetres, lineDistanceMetres, localFrame,
    distancePointToSegmentM, corridorPolygon, pointInPolygon, createGridPlan, interpolateLine, cumulativeProfile,
    hazenWilliamsHeadLossM, pipeVelocityMps, evaluatePipe, selectPipeDiameter, ramPumpSizing, requiredSourceFlowForDelivery, findRamPumpCandidates,
    deliveryRouteAStar, simplifyRoute, PEACE_CORPS_S2, peaceCorpsS2DriveDiameterMm, peaceCorpsDrivePipeLengthLimits, nextStandardDiameterMm, GILMAN_CATALOG_SNAPSHOT, GILMAN_RAM_PUMP_MODELS, recommendGilmanRamPump, gilmanModelLiftFits
  };
});
