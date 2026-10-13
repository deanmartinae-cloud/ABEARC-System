
    function feedbackLabel(value) {
      return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
    }

    function submittedFeedbackSectionHtml() {
      return `
        <div id="submittedFeedbackSection" class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 overflow-hidden">
          <div class="px-4 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <div class="font-black text-gray-900 dark:text-gray-100">Submitted Feedback</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">System / Maintenance review queue for bugs, change requests, and improvements.</div>
          </div>
          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_170px_190px_160px] gap-3">
              <input id="submittedFeedbackSearch" type="search" oninput="filterSubmittedFeedback()" placeholder="Search title, details, or submitted by..." class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2.5">
              <select id="submittedFeedbackStatusFilter" onchange="filterSubmittedFeedback()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2.5">
                <option value="">All Statuses</option>
                ${submittedFeedbackStatuses.map(status => `<option value="${status}">${feedbackLabel(status)}</option>`).join('')}
              </select>
              <select id="submittedFeedbackTypeFilter" onchange="filterSubmittedFeedback()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2.5">
                <option value="">All Types</option>
                <option value="bug">Bug</option>
                <option value="change_request">Change Request</option>
                <option value="improvement">Improvement</option>
              </select>
              <select id="submittedFeedbackPriorityFilter" onchange="filterSubmittedFeedback()" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2.5">
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div id="submittedFeedbackList"><div class="py-8 text-center text-sm text-gray-500">Loading submitted feedback...</div></div>
          </div>
        </div>`;
    }

    function feedbackPriorityBadge(priority) {
      const styles = {
        low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200',
        normal: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
        urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      };
      return `<span class="inline-flex px-2 py-1 rounded-full text-xs font-black ${styles[priority] || styles.normal}">${esc(feedbackLabel(priority || 'normal'))}</span>`;
    }

    function feedbackStatusSelect(feedback) {
      return `<select onchange="updateSubmittedFeedbackStatus(${Number(feedback.id)}, this.value, this)" class="w-full min-w-32 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-xs font-bold">
        ${submittedFeedbackStatuses.map(status => `<option value="${status}" ${feedback.status === status ? 'selected' : ''}>${feedbackLabel(status)}</option>`).join('')}
      </select>`;
    }

    function feedbackAttachmentButtons(feedback) {
      if (!feedback.attachment_path) return '';
      const base = `${API}/changelog/feedback/${Number(feedback.id)}/attachment`;
      return `<div class="mt-2 flex flex-wrap gap-2">
        <button type="button" onclick="viewProtectedFile('${base}/view')" class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold">View Attachment</button>
        <button type="button" onclick="downloadProtectedFile('${base}/download')" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">Download</button>
      </div>`;
    }

    function renderSubmittedFeedbackList(rows) {
      const target = document.getElementById('submittedFeedbackList');
      if (!target) return;
      const items = Array.isArray(rows) ? rows : [];
      if (!items.length) {
        target.innerHTML = '<div class="py-8 text-center text-sm text-gray-500">No feedback submissions match the selected filters.</div>';
        return;
      }
      const tableRows = items.map(feedback => `
        <tr class="border-t border-gray-200 dark:border-gray-700 align-top">
          <td class="px-3 py-3"><div class="font-black text-gray-900 dark:text-gray-100">${esc(feedbackLabel(feedback.type))}</div>${feedbackPriorityBadge(feedback.priority)}</td>
          <td class="px-3 py-3 max-w-lg"><div class="font-bold text-gray-900 dark:text-gray-100">${esc(feedback.title)}</div><div class="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-300">${esc(feedback.details)}</div>${feedbackAttachmentButtons(feedback)}</td>
          <td class="px-3 py-3">${esc(feedback.submitted_by_username || '-')}</td>
          <td class="px-3 py-3">${feedbackStatusSelect(feedback)}</td>
          <td class="px-3 py-3 text-xs text-gray-600 dark:text-gray-300"><div><strong>Created:</strong> ${fmtDateTime(feedback.created_at)}</div><div class="mt-1"><strong>Updated:</strong> ${fmtDateTime(feedback.updated_at)}</div></td>
        </tr>`).join('');
      const cards = items.map(feedback => `
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3"><div><div class="text-xs font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">${esc(feedbackLabel(feedback.type))}</div><div class="font-black text-gray-900 dark:text-gray-100">${esc(feedback.title)}</div></div>${feedbackPriorityBadge(feedback.priority)}</div>
          <div class="text-sm leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-300">${esc(feedback.details)}</div>
          ${feedbackAttachmentButtons(feedback)}
          <div class="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400"><div>Submitted by<br><strong class="text-gray-700 dark:text-gray-200">${esc(feedback.submitted_by_username || '-')}</strong></div><div>Created<br><strong class="text-gray-700 dark:text-gray-200">${fmtDateTime(feedback.created_at)}</strong></div><div>Updated<br><strong class="text-gray-700 dark:text-gray-200">${fmtDateTime(feedback.updated_at)}</strong></div><div>Status<br>${feedbackStatusSelect(feedback)}</div></div>
        </div>`).join('');
      target.innerHTML = `
        <div class="hidden lg:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400"><tr><th class="px-3 py-3">Type / Priority</th><th class="px-3 py-3">Title / Details</th><th class="px-3 py-3">Submitted By</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Dates</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div class="lg:hidden space-y-3">${cards}</div>`;
    }

    async function loadSubmittedFeedback() {
      if (!isSystemUser()) return;
      const target = document.getElementById('submittedFeedbackList');
      if (target) target.innerHTML = '<div class="py-8 text-center text-sm text-gray-500">Loading submitted feedback...</div>';
      try {
        const data = await fetchJson(`${API}/changelog/feedback`, { silentLoading: true });
        submittedFeedbackCache = data.feedback || [];
        filterSubmittedFeedback();
      } catch (e) {
        if (target) target.innerHTML = `<div class="py-8 text-center text-sm text-red-600">${esc(e.message || 'Failed to load submitted feedback.')}</div>`;
      }
    }

    function filterSubmittedFeedback() {
      if (!isSystemUser()) return;
      const term = (document.getElementById('submittedFeedbackSearch')?.value || '').trim().toLowerCase();
      const status = document.getElementById('submittedFeedbackStatusFilter')?.value || '';
      const type = document.getElementById('submittedFeedbackTypeFilter')?.value || '';
      const priority = document.getElementById('submittedFeedbackPriorityFilter')?.value || '';
      const rows = submittedFeedbackCache.filter(feedback => {
        const haystack = [feedback.title, feedback.details, feedback.submitted_by_username].join(' ').toLowerCase();
        return (!term || haystack.includes(term))
          && (!status || feedback.status === status)
          && (!type || feedback.type === type)
          && (!priority || feedback.priority === priority);
      });
      renderSubmittedFeedbackList(rows);
    }

    async function updateSubmittedFeedbackStatus(id, status, select) {
      if (!isSystemUser()) return toast('System / Maintenance access required.', 'error');
      const previous = submittedFeedbackCache.find(item => Number(item.id) === Number(id))?.status;
      if (select) select.disabled = true;
      try {
        const data = await fetchJson(`${API}/changelog/feedback/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        const index = submittedFeedbackCache.findIndex(item => Number(item.id) === Number(id));
        if (index >= 0) submittedFeedbackCache[index] = data.feedback;
        toast('Feedback status updated');
        filterSubmittedFeedback();
      } catch (e) {
        if (select && previous) select.value = previous;
        toast(e.message || 'Failed to update feedback status.', 'error');
      } finally {
        if (select?.isConnected) select.disabled = false;
      }
    }

    function renderChangelog() {
        const el = document.getElementById('content-changelog');
        if (!el) return;
        el.innerHTML = `
          <div class="space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div class="text-xs font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Current Version</div>
                <h4 class="text-xl font-black text-gray-950 dark:text-gray-50">ABEARC Projects &amp; Services Monitoring Information System v1.53</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Release notes for the latest ABEARC updates.</p>
              </div>
              <div class="flex flex-col sm:items-end gap-2">
                <span class="inline-flex w-fit rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 px-3 py-1 text-xs font-black text-cyan-800 dark:text-cyan-200">v1.53</span>
                <button type="button" onclick="openChangelogFeedbackModal()" class="px-3 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-gray-950 text-xs font-black">Submit Bug / Change / Improvement</button>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.53</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">October 13, 2026 update: Ram-Pump engineering, automated weather stations, forecasts and farm advisories, Telegram distribution, and map/interface refinements.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Ram-Pump System Layout</div><ul class="list-disc pl-5 space-y-1"><li>Adds Generate Ram Pump System Layout to the Distance Measure context menu.</li><li>Treats Point A as Water Source / Intake and Point B as Service Area / Reservoir.</li><li>Searches surrounding terrain for practical pump sites instead of forcing the pump onto the original A→B line.</li><li>Retains up to three spatially separated candidate sites.</li><li>Uses strict descending terrain routing for the drive side and a separate pressure-capable terrain route for the delivery side.</li><li>Provides editable source, pump, destination, drive/delivery vertices and movable engineering annotations.</li><li>Integrates with My Map Layouts, Undo, Print Mode, progress/cancellation and responsive map drawers.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Ram-Pump hydraulics, pipe sizing and feasibility</div><ul class="list-disc pl-5 space-y-1"><li>Calculates drive head, delivery head, H/h ratio, route lengths/slopes, high-point lift and Hazen-Williams losses.</li><li>Calculates net drive head, estimated delivery flow, waste flow, source/delivery/waste daily volumes and planning efficiency.</li><li>Adds automatic/manual drive and delivery pipe sizing with standard-diameter, velocity and head-loss screening.</li><li>Supports desired delivery flow and solves required source flow when a delivery target is entered.</li><li>Adds governing delivery-lift checking with a configurable limit up to 180 m.</li><li>Provides Feasible, Engineering Review Required, and No Practical Ram Pump Layout Found diagnostics with engineering reasons.</li><li>Includes an offline Gilman model catalog and conservative model suggestion/cross-check without runtime vendor queries.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Drive-pipe construction, profile and drawing</div><ul class="list-disc pl-5 space-y-1"><li>Adds On Ground / Terrain-Following and Elevated on Support Frames installation modes.</li><li>Adds Straight Preferred, Terrain-Following Allowed and Straight Only alignment choices.</li><li>Calculates descending design grade, required variable support-frame heights, maximum support height and terrain intrusion.</li><li>Adds downloadable, expandable and movable/dockable combined elevation profile.</li><li>Adds a full calculation sheet with substituted equations, pipe-size screening and engineering limitations.</li><li>Reworks the hydraulic-ram schematic to a physically coherent source → drive pipe → pump/waste branch → delivery check/air chamber → delivery line → reservoir arrangement.</li><li>Adds SVG export and AutoCAD-compatible R12 DXF export.</li><li>Hides the originating distance measurement after successful Ram-Pump generation and restores it when the layout is cleared.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Peace Corps / Warwick S-2 reference and long-drive treatment</div><ul class="list-disc pl-5 space-y-1"><li>Adds selectable Peace Corps / Warwick S-2 screening.</li><li>Adds rigid drive-pipe guideline checks using Lmin = 150D and Lmax = 1000D.</li><li>Adds automatic open standpipe or optional drive-tank treatment when the source-to-pump run exceeds the reference maximum.</li><li>Separates upstream supply pipe from the final rigid drive pipe and applies friction/straightness/support checks to the effective rigid segment.</li><li>Adds standpipe/drive-tank chainage, elevations, riser height, supply length and diameters.</li><li>Adds an engineering-review warning for flexible HDPE/PE when the rigid-pipe reference rule is selected.</li><li>Extends map/profile/CSV/GeoJSON/drawing output for supply pipe, rigid drive and dissipation device.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Automated Weather Stations / ZENTRA Cloud</div><ul class="list-disc pl-5 space-y-1"><li>Adds a native Automated Weather Stations map layer with clustered health-aware markers and cached current-condition popups.</li><li>Adds a backend-only ZENTRA Cloud v5 provider using X-API-Key; credentials never reach browser assets or exports.</li><li>Adds multi-station/device/sensor discovery and normalized station/series metadata.</li><li>Adds local SQLite tables for stations, series, readings, sync state, backfill jobs, sync runs, alert rules/events and weather system settings.</li><li>Adds reading-ID incremental synchronization, duplicate prevention, durable pagination/cursor state and restart-safe retry/backoff for historical backfill.</li><li>Adds station health logic based on configured upload/logging intervals.</li><li>Adds station settings, weather privileges, alerts and existing-notification-system integration.</li><li>Persists weather-layer visibility through My Map Layouts.</li><li>Persists the server credential in NAS/local data/weather.env across container recreation.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Weather dashboard, analytics and exports</div><ul class="list-disc pl-5 space-y-1"><li>Adds Overview, Charts, Rainfall, Agriculture, Data Table, Reports and Station views.</li><li>Adds measurement-specific aggregation for rainfall/counts, temperature/RH, wind/gust/direction and solar irradiance/energy.</li><li>Preserves missing/null measurements separately from genuine zero values and surfaces source error codes.</li><li>Adds configurable GDD, VPD and guarded FAO-56 Penman-Monteith ET0, with measured reference ET preferred where available.</li><li>Adds crop coefficient inputs and clearly labeled indicative crop-water deficit.</li><li>Adds interactive tooltips, series visibility, dense-series Fit/Detail pan mode, rainfall bars and PNG chart export.</li><li>Adds CSV, XLSX and A4 PDF weather exports/reports.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Telegram weather distribution</div><ul class="list-disc pl-5 space-y-1"><li>Adds backend-only bot configuration, connection tests, approved chat registration with single-use expiring codes, and target management.</li><li>Routes triggered/cleared weather alerts to registered chats and schedules daily, weekly and monthly station-local reports.</li><li>Adds durable delivery queues, duplicate prevention, retry/backoff, rate-limit handling, restart recovery and delivery audit history.</li><li>Adds Telegram integration privileges and administrator credential management.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Weather setup, forecast and farm advisories</div><ul class="list-disc pl-5 space-y-1"><li>Adds administrator ZENTRA token validation, encrypted persistent credential storage and automatic station discovery through the interface.</li><li>Adds modeled forecast outlooks, explicitly separated from station observations, with stale-forecast guards.</li><li>Adds crop-focused advisory cards for observed rainfall, wetness, dry days, temperature/humidity and forecast rain, wind and temperature.</li><li>Adds the Farm Weather Advisory A4 PDF with City Agriculturist Office/Davao City branding, observed metrics, charts, advisory cards and optional forecast outlook.</li><li>Refines sensor/unit handling, weather report charts, station icons/popups and sidebar presentation, and weather alert rate handling.</li></ul></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map and interface refinements</div><ul class="list-disc pl-5 space-y-1"><li>Refines Ram-Pump/weather controls and responsive map panels.</li><li>Updates orthomosaic integration, map printing and saved-layout handling, plus frontend build/cache recovery and project/dashboard integration.</li></ul></div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.52</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">October 6, 2026 update: Geotag Map monitoring timeline, offline barangay/district GIS, geotag-photo workflows, NAMRIA-only gravity routing, and map reliability improvements.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Monitoring Timeline and Site History</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds a viewport-aware historical photo timeline with three states: a Timeline icon beside Search, a compact mini timeline, and a full timeline.</li>
                    <li>Uses real capture-date spacing with clickable observation marks, photo counts, All Dates, Exact Date and As-of Date modes, Previous/Next, playback, and timeline zoom.</li>
                    <li>Adds conflict-safe keyboard navigation for timeline dates and staged Escape behavior for full timeline, mini timeline, and closed state.</li>
                    <li>Groups repeated monitoring photos into Site History series, with observation navigation, before/after comparison, privilege-aware per-photo deletion, and preview-driven map thumbnail/bearing updates.</li>
                    <li>Automatically shortens the full timeline when Photo Details or Site History is open and recenters selected photos within the unobstructed map area.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Map Performance and Photo Interaction</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Changes geotag-photo loading to viewport-scoped requests with buffered bounds and incremental background synchronization instead of repeatedly loading the entire archive.</li>
                    <li>Enforces map-media visibility server-side and adds supporting database indexes for large geotag-photo collections.</li>
                    <li>Adds adaptive cluster zoom so clicking a cluster continues to a useful zoom level until the cluster breaks into fewer groups or individual photos.</li>
                    <li>Moves Reset Map Photo Layout below Measure Tools and asks for confirmation only when a moved, resized, expanded, annotated, or exploded photo layout can actually be reset.</li>
                    <li>Improves Photo Details and Site History map centering so the selected location stays centered in the visible map area beside the open drawer.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Offline Barangay and District GIS</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Packages the CPDO Davao City administrative boundary dataset for offline use, covering 186 barangays and 11 administrative districts.</li>
                    <li>Removes the CPDO GeoServer fallback for barangay/district lookup; search and coordinate identification now use the local boundary database only.</li>
                    <li>Adds fuzzy barangay/district search for misspellings, highlights the selected polygon, fits the map to its extent, and filters geotagged photos by true point-in-polygon location.</li>
                    <li>Adds clear no-result and local-database error feedback instead of silently doing nothing when a boundary cannot be found.</li>
                    <li>Makes searched administrative polygons right-clickable through the area-measure menu and labels them with barangay/district name and hectares, with label placement adjusted away from visible photo markers where possible.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Photo Upload, Metadata, and Sidebar</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds compact Upload and Eye controls to the Geotag Photos sidebar and moves Drone Orthomap upload to a matching icon beside its visibility control.</li>
                    <li>Unifies Geotag Photos naming and counters so the sidebar and map do not present conflicting photo totals.</li>
                    <li>Requires valid GPS coordinates embedded in the original image metadata for manual geotag-photo upload; non-geotagged files are rejected individually with accepted/rejected batch summaries.</li>
                    <li>Prioritizes original capture time for map/timeline dates instead of upload time and adds recovery paths for missing capture metadata.</li>
                    <li>Adds coordinate-based enrichment and repair paths for missing barangay, district, and zoning metadata using local spatial datasets while preserving valid existing values.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Gravity Flow Path</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Standardizes Gravity Flow Path on the local NAMRIA DTM 5 m PRS92 dataset and removes other DEM sources from gravity routing while leaving them available to unrelated terrain tools where supported.</li>
                    <li>Uses the native server-side NAMRIA raster solver with reverse reachability, masked path search, sub-cell interpolation, contour-guided rescue, and bottleneck/any-angle connections for difficult terrain.</li>
                    <li>Preserves strict final-profile validation so an accepted gravity route remains level/downhill when resampled from the same NAMRIA terrain source.</li>
                    <li>Improves routing diagnostics, progress behavior, and compatibility with generated contours and multi-measure workflows.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Search, Keyboard, Permissions, and Deployment Reliability</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds two-stage Escape handling in Search: first Escape clears the current search/result state, second Escape exits the search field; a free Escape on the map fits the full Davao City extent.</li>
                    <li>Applies keyboard shortcuts only when their owning feature has focus or no conflicting action is active, preserving existing map and text-entry shortcuts.</li>
                    <li>Retains owner deletion of My geotagged photos and dedicated cross-owner delete privileges, including privilege-aware Site History delete controls.</li>
                    <li>Updates Docker/runtime wiring checks for the expanded offline-boundary routes while preserving the frontend DOM compatibility baseline and deployment safety checks.</li>
                    <li>Improves sidebar, search, map drawer, cluster, and refresh-state behavior without changing unrelated ABEARC project-management workflows.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.51</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">September 16, 2026 update: advances ABEARC to version 1.51.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Version update</div><p>Updates the system version and release information to v1.51.</p></div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.50</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">September 7, 2026 update: Calendar 2.0 scheduling, availability, recurring activities, conflict detection, responsive views, and linked project and monitoring context.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Scheduling and collaboration</div><p>Introduces month, week, day, and agenda views, participant availability, server-side conflict warnings, reminders, four response states, and recurring activity series controls.</p></div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3"><div class="font-black text-gray-900 dark:text-gray-100 mb-1">Connected field work</div><p>Links schedules to projects, documents, and monitoring inventory while retaining permissions, notifications, audit history, attachments, exports, and dark-mode responsive layouts.</p></div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.49</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">September 7, 2026 update: professional map measurement and terrain analysis, richer coordinate search, refined calendar interactions, and stronger interface persistence.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Measurement and KML Workflows</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds KML import for individual or multiple line and polygon measurements, including overlapping geometry, accurate interior labels, selection stacking, and editable vertices.</li>
                    <li>Adds Ctrl-click multi-selection, Ctrl+A select all, Escape deselect all, and Ctrl+Z measurement editing shortcuts.</li>
                    <li>Adds selected-polygon totals for area and perimeter, contextual editing rules, point insertion and removal, and consistent manual/imported measurement styling.</li>
                    <li>Adds georeferenced KML export for measurements and lets users choose between area perimeter and generated contours when both are available.</li>
                    <li>Corrects polygon interaction so users can add points, pan, and zoom while the pointer is inside a measured area.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Elevation Profiles and Annotations</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds local NAMRIA DTM 5 m PRS92 terrain data as the default elevation source while retaining supported online elevation datasets.</li>
                    <li>Marks measurement vertices on the elevation graph and synchronizes the active point between graph and map.</li>
                    <li>Adds movable, automatically sized text annotations with adaptive guide lines on both the graph and map, including contextual removal.</li>
                    <li>Updates affected profile values and points without replacing the whole graph tile and places progress feedback along the chart axis.</li>
                    <li>Adds confirmed elevation-profile image download without a date-time stamp and keeps the profile panel draggable.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Contour Analysis</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds terrain contour generation for one or multiple selected polygons with adjustable contour and index intervals.</li>
                    <li>Uses the elevation-profile source menu for contour datasets, defaults to NAMRIA DTM, and removes the redundant Open Topo Data Mapzen option.</li>
                    <li>Places elevation labels along contour lines using index-contour conventions and supports Enter to apply interval changes.</li>
                    <li>Exports georeferenced 3D contour KML with preserved elevation and supports importing exported contours back into ABEARC Map.</li>
                    <li>Introduces a compact draggable contour tile with source selection, pending-change feedback, terrain metrics, legend, and dataset summary.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Search, Boundaries, and Layers</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds coordinate entry and pinned search results with barangay, district, zoning, and CPDO source details.</li>
                    <li>Adds reusable map-search history and displays verified barangay or district boundaries for administrative searches.</li>
                    <li>Aligns the Davao City outline with the CPDO zoning extent and keeps Project NOAH flood hazards on their fast direct source for all available areas.</li>
                    <li>Improves measurement annotation contrast automatically for satellite and other basemaps.</li>
                    <li>Refines Drone Orthomap area reporting, thumbnail alignment, grouped-series controls, opacity layout, menus, and persistent visibility defaults.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Calendar and Dashboard Experience</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Redesigns quick filters with aligned controls, clear actions inside expanded groups, selected states, mutual My Calendar/ABE Calendar expansion, and smooth animations.</li>
                    <li>Makes cleared calendar groups select all applicable filters and animates the quick-filter sidebar when hidden or restored.</li>
                    <li>Displays newly created schedules immediately, changes calendar months without blurring the whole page, and preserves continuous week-view day boundaries while scrolling.</li>
                    <li>Retains dashboard pagination and View all preferences after refresh.</li>
                    <li>Renames Established assets to Established Projects and Established Projects Monitoring to Monitoring Dashboard.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Permissions and Reliability</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds a role privilege for deleting other users' Geotag Map photos while preserving owner deletion of My geotag photos.</li>
                    <li>Hides unavailable delete actions completely instead of displaying controls that end in permission errors.</li>
                    <li>Improves request handling to reduce avoidable HTTP 429 responses without slowing normal map interaction.</li>
                    <li>Corrects Docker deployment wiring for frontend validation and required runtime assets while preserving NAS data and databases.</li>
                    <li>Improves map drawer, contextual-menu, measurement, and refresh-state reliability across user roles.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.48</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">August 20, 2026 update: drone orthomap time series, refined map controls and overlays, reliable project-document output, and repeatable NAS deployment.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Drone Orthomaps and Time Series</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds a dedicated compact Drone Orthomaps drawer with centered thumbnails, selection states, show-all visibility, opacity, and contextual management actions.</li>
                    <li>Makes ready orthomaps visible to every authenticated role while keeping upload, rename, activation, and deletion behind the explicit management privilege.</li>
                    <li>Groups strongly overlapping survey captures into dated series with capture-count badges, expandable history, latest-only defaults, timeline scrubbing, playback speeds, and before/after blending.</li>
                    <li>Keeps group expansion independent from map zoom, zooms from the main group row, and automatically collapses a previous series when another orthomap is selected.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Layers and Controls</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Separates Satellite, Terrain, and TopoMap basemaps from Zoning and Flood Hazard overlays and preserves overlay order above drone imagery.</li>
                    <li>Improves Terrain with topography and elevation while reducing rendering lag.</li>
                    <li>Refines environmental-layer toggles, exclusive selection, manual expansion, separators, and popup close controls.</li>
                    <li>Adds draggable elevation profiles, collapsible map search, and restores usable filter fields beside the compact search control.</li>
                    <li>Adds a user-role privilege for deleting other users' Geotag Map photos while owners retain deletion of their own uploads.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Documents and NAS Deployment</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Makes Export Project Documents available outside monitoring, completed, and inactive project stages.</li>
                    <li>Formats exported project documents for extended long paper in portrait orientation and rotates landscape pages appropriately.</li>
                    <li>Corrects document-download failures across project requirements while preserving valid downloads.</li>
                    <li>Adds full-stack NAS copy automation that preserves data and databases, validates required frontend assets, and builds the Docker image before replacing the running container.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-emerald-200 dark:border-emerald-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.47</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">August 2026 consolidated update: stronger Geotag Map and GeoCam workflows, established-asset monitoring refinements, asset-specific visit inspections, printable checklists, and interface reliability improvements.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Map and Photo Management</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Allows authorized users to view the shared Geotag Map while keeping rename, edit, and delete actions limited to photo owners.</li>
                    <li>Adds multi-photo selection, owner-safe bulk download, rename and delete actions, contextual photo actions, keyboard shortcuts, and clearer selection states.</li>
                    <li>Keeps map results synchronized, preserves the active view, and improves photo focusing, highlighting, zooming, overlays, and adaptive zoning labels.</li>
                    <li>Corrects Saved-photo badge counts immediately after a saved photo is deleted or removed.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">ABEDGeoCam Delivery and Upload Reliability</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Fixes the Geotag Map upload failure caused by a mismatch between SQL columns and submitted values while preserving successful My Drive delivery.</li>
                    <li>Retains stamped-photo, GPS, capture-date, ownership, duplicate, and Davao-boundary validation for GeoCam uploads.</li>
                    <li>Changes Geotag Map's Get app action to the Forms &amp; Tools ABEDGeoCam share workflow with a secure link, QR code, copy action, download action, and expiration details.</li>
                    <li>Improves server-side upload diagnostics and compatible handling of GeoCam photo metadata and destinations.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Established Asset Monitoring Workspace</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Refines monitoring metrics with icons beside their values, clickable filtering behavior, and hover details instead of persistent information buttons.</li>
                    <li>Uses consistent document-and-magnifier monitoring icons in the page and sidebar, with corrected visual size and alignment.</li>
                    <li>Fixes the More actions popup stacking order and removes the redundant row details icon and Monitoring Inventory Dashboard button.</li>
                    <li>Keeps each inventory row directly clickable and preserves compact desktop and responsive mobile monitoring layouts.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Asset-aware Inventory and Visit Forms</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Shows machinery and equipment specification fields only when they apply, allowing infrastructure and other asset records to use relevant master-record fields.</li>
                    <li>Adds inspection sections selected automatically for Machinery &amp; Equipment, Infrastructure, Irrigation System, Facility, Vehicle, and Other assets.</li>
                    <li>Includes type-specific points such as engine, transmission, hydraulics and safety for machinery, and structure, foundation, drainage and site condition for infrastructure.</li>
                    <li>Requires a condition for every applicable inspection point and supports an optional observation for each item.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Inspection Records and Printable Checklists</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Stores validated, structured inspection answers with every new monitoring visit and displays them in monitoring history.</li>
                    <li>Adds a blank print-ready checklist from each Record Monitoring Visit form with asset information already filled in.</li>
                    <li>Adds More &gt; Print inspection checklist for exporting a template for any supported asset type.</li>
                    <li>Includes condition boxes, observations, findings, recommendations, inspector details, and signature fields in the print preview.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Automation, Navigation, and Live Synchronization</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Publishes verified project-document geotag photos to Geotag Map after review, links them to their project, enriches remarks, and prevents duplicate copies.</li>
                    <li>Adds consistent Escape, Enter, focus-trap, menu, and list keyboard behavior across dialogs and overlays.</li>
                    <li>Synchronizes My Drive Android uploads while the web page remains open without losing the current folder or file selection.</li>
                    <li>Adds a bottom-aligned Get app action to My Drive that opens the ABEDMyDrive Android app's secure Forms &amp; Tools share link, QR code, and download options.</li>
                    <li>Refines the My Drive sidebar by removing the Get app icon's box highlight and the divider between Trash and the available-storage indicator.</li>
                    <li>Refreshes a Forms &amp; Tools item's displayed upload date when its actual file is replaced, without changing the date for metadata-only edits or downloads.</li>
                    <li>Adds database migration and server validation for asset inspection data while preserving existing monitoring history.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-emerald-200 dark:border-emerald-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.46</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Shared Geotag Map visibility, project-aware stamped-photo automation, owner-safe photo management, adaptive zoning labels, keyboard navigation, and live MyDrive synchronization.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Photo Results and Multiple Selection</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Double-clicking a Photo Results entry keeps the map preview unobstructed, centers and highlights the photo, resets tilt, and zooms fully until the metric scale reads 10 m.</li>
                    <li>Adds Select multiple photos with individual checkboxes and a Select all mine action.</li>
                    <li>Supports downloading, renaming, or deleting selected owned photos with compact system-icon actions, clear selection counts, and confirmation.</li>
                    <li>Adds Download to photo right-click menus while keeping ownership restrictions on Rename and Delete.</li>
                    <li>Adds selection shortcuts: Esc closes Photo details before cancelling selection on the next press, Delete or Backspace deletes, F2 renames, Ctrl/Cmd+D downloads, and Ctrl/Cmd+A selects all manageable photos.</li>
                    <li>Keeps non-owned photos outside user bulk-management actions.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Shared Map Visibility</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Allows user-role accounts to view all uploaded Geotag Map photos just like administrators.</li>
                    <li>Restricts user edit, rename, and delete controls to their own uploads.</li>
                    <li>Retains server-side ownership authorization for single and bulk changes.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Adaptive Zoning Labels</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Moves label controls into a right-click menu on every map-layer thumbnail.</li>
                    <li>Adds optional Google-style area and place labels to Satellite, Terrain, and TopoMap while retaining data-driven zoning names.</li>
                    <li>Uses stricter priority, spacing, duplicate, and zoom rules to keep zoning labels readable as the map moves.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Keyboard and Overlay Navigation</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Makes Escape close the topmost open menu, popup, preview, drawer, or dismissible modal before affecting the page behind it.</li>
                    <li>Uses Enter for the primary dialog action and Ctrl/Cmd+Enter when confirming from a multiline field.</li>
                    <li>Keeps Tab and Shift+Tab focus inside open dialogs, with Arrow keys, Home, and End navigation for open menus and lists.</li>
                    <li>Preserves focused-input behavior and existing page-specific shortcuts while making Escape cancel Geotag Map photo multi-selection immediately.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Live MyDrive Synchronization</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Automatically detects files uploaded from the ABEARC MyDrive Android app while the web MyDrive page remains open.</li>
                    <li>Updates the visible folder within about three seconds without requiring a browser or page refresh.</li>
                    <li>Continues syncing while a file is selected or the Details panel is open and preserves current selection state.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Project Geotag Photo Automation</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Validates uploaded project images using their visible geotag QR payload, embedded stamp details, capture time, coordinates, and GPS accuracy.</li>
                    <li>Stages valid stamped photos from project document requirements and publishes them to Geotag Map only after the source document is checked.</li>
                    <li>Links the map photo to its project and creates a sentence-style remark containing the project name, progress stage, document name, filename, and uploader when available.</li>
                    <li>Prevents duplicate map copies by matching the image hash and safely enriches an existing map entry when appropriate.</li>
                    <li>Protects published project-document photos from direct map deletion and removes them automatically when their source file or project is deleted.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-emerald-200 dark:border-emerald-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.45</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Established Project &amp; Asset Monitoring with the complete January 2026 AFME inventory.</div>
              </div>
              <div class="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Permanent Monitoring Registry</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds a master registry for machinery and equipment, infrastructure, irrigation systems, facilities, vehicles, and other established outputs.</li>
                    <li>Packages and automatically migrates all 218 AFME inventory records, including 92 historical monitoring visits and the original remarks and recommendations.</li>
                    <li>Supports project linkage, assignees, coordinates, technical specifications, lifecycle status, monitoring intervals, and Excel import/export.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Visits, Tasks, and Priority Scheduling</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Records repeat monitoring history, condition, utilization, findings, recommendations, next visit, and evidence files.</li>
                    <li>Adds follow-up tasks, condition-based priority analysis, overdue and never-monitored queues, district analytics, and assigned-user views.</li>
                    <li>Creates monitoring schedules in the existing calendar and sends consolidated daily monitoring alerts without one notification per asset.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.44</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map automation, Davao zoning, bulk photo management, and control refinements.</div>
              </div>
              <div class="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Live Geotag Map Workspace</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Removes the manual refresh workflow and automatically synchronizes newly uploaded GeoCam photos every five seconds.</li>
                    <li>Preserves the map center, zoom, bearing, and pitch across page refreshes and user sessions.</li>
                    <li>Removes the photo-summary and location-review blocks, expands the map into the freed space, and removes the redundant loaded-photo counter.</li>
                    <li>Keeps the ABEARC Workspace sidebar header fixed while scrolling only the navigation content beneath it.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Search and Photo Results</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Runs map searches only when Enter or the in-field search icon is pressed, preventing incomplete searches while typing.</li>
                    <li>Matches category searches accurately and treats an All search as a request to show and frame every available mapped photo.</li>
                    <li>Places barangay and district beneath each photo category and improves category, location, and result-count hierarchy.</li>
                    <li>Uses concise age labels such as days, months, or years ago and retains singular wording for one day.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Bulk Photo Management</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds a My Drive-aligned three-dot menu beside the Photo results count for Rename all category, Download all, and Delete all.</li>
                    <li>Adds confirmation dialogs before every bulk action and packages authorized downloads into one ZIP archive.</li>
                    <li>Processes bulk deletion in safe database chunks so all selected photos are removed instead of stopping at an earlier result limit.</li>
                    <li>Moves single-photo deletion to a consistent icon action beneath the image and standardizes delete and rename icons across the system.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Davao City Layers and Boundaries</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds an authenticated, cached Davao zoning layer rendered from the packaged GeoCam zoning database with matching zoning colors.</li>
                    <li>Adds OpenTopoMap alongside Terrain, Satellite, and Zoning with the required OpenStreetMap, SRTM, and OpenTopoMap attribution.</li>
                    <li>Aligns every layer thumbnail to the same Davao zoom and position, including a real zoning overlay preview.</li>
                    <li>Rebuilds the displayed Davao boundary from the zoning perimeter and updates the full-city extent to the same coverage.</li>
                    <li>Rejects single and batch GeoCam uploads whose geotag coordinates fall outside the Davao City perimeter before files are stored.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Controls and Measurement</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Moves zoom, reset-view, extent, and attribution controls away from the Photo details drawer to prevent overlap.</li>
                    <li>Adds a responsive metric scale beside the Layers thumbnail and refreshes the neutral full-Davao extent control.</li>
                    <li>Reworks Measure as a collapsible elevated control with clearer ruler, distance, and area icons while retaining the standard clear icon.</li>
                    <li>Prevents the Distance, Area, and Clear button corners and shadows from being clipped during hover.</li>
                    <li>Improves spacing, control alignment, menu styling, and light/dark consistency throughout the Geotag Map.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.43</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GeoCam map layers and offline terrain.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">GeoCam Map Layers</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Groups GeoCam map controls into Base Map, Zoning, Labels, Administrative Areas, and Map Content sections.</li>
                    <li>Separates zoning, barangay, and district label visibility for finer map control.</li>
                    <li>Adds a downloadable Davao City topographic layer with shaded relief, contours, offline storage, progress, cancellation, removal, and source attribution.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.42</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map product naming.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Map</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Renames the photo-map workspace, navigation, permissions, messages, and documentation to Geotag Map.</li>
                    <li>Aligns GeoCam's destination, progress, permission, duplicate, and upload-error text with the Geotag Map name.</li>
                    <li>Preserves existing API routes, privilege keys, storage paths, and internal identifiers for deployment compatibility.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.41</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map terminology cleanup.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Labels</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Standardizes the product name as Geotag Map and uses direct photo-centered labels throughout the page.</li>
                    <li>Renames the current filter summary to All map photos and the side panel to Photo library.</li>
                    <li>Aligns GeoCam's upload destination description with the same Geotag Map terminology.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.40</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GeoCam signed-in upload UI refinement.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">GeoCam Send to ABEARC</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Hides Send to ABEARC actions when GeoCam is not linked to an ABEARC account.</li>
                    <li>Replaces the plain destination list with icon-led My Drive and Geotag Map choices, clear descriptions, and a photo count.</li>
                    <li>Clarifies that moved-photo categories come from the authoritative GeoCam folder path used during later uploads.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.39</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GeoCam ABEARC destination selection.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Send to ABEARC</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adds My Drive and Geotag Map as explicit destinations when sending GeoCam photos.</li>
                    <li>Restores organized My Drive uploads with metadata and duplicate skipping while keeping Map uploads in dedicated Map storage.</li>
                    <li>Retains the valid ABEDGEOCAM image-stamp requirement for the Geotag Map destination.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.38</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GeoCam stamped-photo upload enforcement.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Map Uploads</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Prevents GeoCam raw copies and photos without a valid ABEDGEOCAM image stamp from being sent to Geotag Map.</li>
                    <li>Continues uploading stamped photos from mixed selections and reports unstamped skips separately from existing duplicates.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.37</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Search-result map framing.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Map Search</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Makes text searches query the complete mapped-photo dataset instead of only the current map viewport.</li>
                    <li>Automatically fits the map to cover every returned search result, with single-result zoom and details-drawer-aware padding.</li>
                    <li>Prevents pan and zoom actions from repeatedly reloading or re-fitting an unchanged search.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.36</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Commercial-grade Geotag Map workspace redesign.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Map UI/UX</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Rebuilt the Map page as an operational photo workspace with a compact command bar, live result totals, sync status, and clearer action hierarchy.</li>
                    <li>Redesigned the filter rail with labeled controls, active-filter summaries, quick clearing, richer photo rows, and selected-photo states.</li>
                    <li>Moved measurement controls into a map-native toolbar and retained the Google Maps-style Layers tile without control overlap.</li>
                    <li>Replaced the photo popup with a structured details drawer for image review, capture status, coordinates, zoning, project, uploader, and editable remarks.</li>
                    <li>Added a mobile filter drawer, compact icon controls, responsive details sheet, and fixed-viewport behavior for smaller screens.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.35</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GeoCam effective zoning display alignment.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">GeoCam Photo Details</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Simplifies GeoCam Photo Details to show Zoning and Details without the Zoning Details heading.</li>
                    <li>Uses facing zoning as the effective zoning for road captures while retaining separate facing and location metadata for ABEARC uploads.</li>
                  </ul>
                </div>
              </div>
            </div>            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.34</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Full-height Geotag Map measurement overlays.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Measurement</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Extends the ruler and area measurement overlay to the complete map canvas, including the lower edge.</li>
                    <li>Synchronizes the measurement SVG viewport with MapLibre whenever the map is resized.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.33</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Click-only Geotag Map layer selection.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Layers</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Prevents the Layers tray from opening when the mouse pointer merely hovers over its thumbnail.</li>
                    <li>Opens and closes the layer options only through an explicit click on the Layers control.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.32</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map edit modal design alignment.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Photo Editing</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Replaces the browser prompt for category and remarks with the standard ABEARC modal design.</li>
                    <li>Uses the existing responsive bottom-sheet and desktop dialog layout, including matching headers, fields, and action buttons.</li>
                    <li>Supports backdrop, close-button, Cancel, and Escape dismissal while keeping failed-save errors inside the modal.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.31</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Google Maps-style Layers tray, Alt cluster explosion, and fixed map viewport.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Controls</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Matches Google Maps more closely with a full-image Layers tile, overlaid caption, and horizontal thumbnail tray.</li>
                    <li>Replaces Ctrl with Alt for manually exploding a photo cluster and collapsing it when Alt is released.</li>
                    <li>Locks the Geotag Map page to the available browser viewport so the page itself does not scroll.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.30</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Persistent Ctrl cluster explosions, Google Maps-style layer control, and full-page photo viewing.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Experience</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Keeps Ctrl-triggered cluster explosions open while panning, rotating, zooming, refreshing map data, or selecting an image.</li>
                    <li>Moves the basemap selector into a Google Maps-style thumbnail control at the lower-left of the map.</li>
                    <li>Displays original photos across the full browser viewport with contain scaling for portrait and landscape images.</li>
                    <li>Makes Escape activate the visible photo-details Close action.</li>
                    <li>Updates GeoCam photo details and EXIF metadata with zoning descriptions while removing the Map link row.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.29</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map max-zoom cluster explosion and selected-photo highlighting.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Selection</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Explodes clustered photos when zoom is already maxed out and the photos remain clustered.</li>
                    <li>Keeps max-zoom explosions open while selecting exploded photos, then collapses them on zoom-out or empty map click.</li>
                    <li>Keeps Ctrl explosions open while selecting exploded photos and collapses them only when Ctrl is released.</li>
                    <li>Highlights the selected photo thumbnail in yellow on the map, including normal markers, cluster markers, and exploded thumbnails.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.28</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map Ctrl-release unexplode animation and exploded-photo direction arrows.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Cluster Explosion</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added compass-correct bearing arrows directly on exploded photo thumbnails.</li>
                    <li>Added a reverse unexplode animation that sends each photo back toward its own coordinate point.</li>
                    <li>Changed exploded clusters to collapse when the Ctrl key is released, while photo clicks keep the exploded layout open.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.27</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map compass-correct thumbnail bearing arrows.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Bearing Arrows</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Adjusted photo thumbnail bearing arrows to subtract the current map rotation so they remain tied to compass direction.</li>
                    <li>Updated exploded photo thumbnails to show the same compass-correct bearing arrow and refresh during map rotation.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.26</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map pinned explosion behavior and leader-line refinement.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Cluster Explosion</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Hid the source clustered-photo marker immediately once its photos are exploded.</li>
                    <li>Added animated exploded thumbnails, white leader lines, and coordinate origin dots.</li>
                    <li>Improved placement so exploded photos avoid existing thumbnails and leader lines avoid crossing other explosion lines.</li>
                    <li>Kept exploded clusters open during normal map/photo clicks; use Escape or Ctrl-click to collapse.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.25</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map thumbnail bearing, explosion placement, original preview, hide removal, and zoning recovery.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Photo Map Refinements</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Moved the bearing arrow from the detail image to the outline of the map photo thumbnail.</li>
                    <li>Changed cluster explosion lines and placement to originate from each photo coordinate and avoid occupied thumbnails.</li>
                    <li>Removed the hide-photo controls, made the detail thumbnail open the original image, and expanded original preview to the full tab.</li>
                    <li>Added stronger zoning recovery from GeoCam stamp text, legacy remarks, original image metadata, and known zoning names.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.24</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map clustered-photo zoom range correction.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Cluster Zoom</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Changed clustered-photo clicks to continue zooming in until the map reaches its true maximum zoom.</li>
                    <li>Removed the earlier cluster-configuration zoom cap from screen clusters, source clusters, and close-photo group clicks.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.23</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map detail actions, zoning fallback, ruler area labels, and Ctrl-held explosion behavior.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Corrections</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Bound Open Original and edit-icon controls with direct event listeners so popup actions respond reliably.</li>
                    <li>Recovered zoning from GeoCam stamp text stored in either stamp metadata or legacy remarks.</li>
                    <li>Closed area ruler polygons, centered area labels, added photo-coordinate measure points, and kept explosion active only while Ctrl is held.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.22</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map clustered-photo click behavior correction.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Cluster Zoom</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Restored normal click-to-zoom-in behavior for clustered photo pins.</li>
                    <li>Kept Ctrl-click as the explicit cluster explosion action.</li>
                    <li>Prevented clustered-photo clicks from reducing the current map zoom level.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.21</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map live ruler, editable details reliability, in-page original viewer, and GeoCam zoning fallback.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Interaction Fixes</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Made Open Original, category edit, remarks edit, ruler, hidden-photo, and review queue controls callable from the built map page.</li>
                    <li>Improved map measurement so ruler graphics update during live pan/zoom, points can be dragged, and double-click removes a point.</li>
                    <li>Added zoning fallback from GeoCam image-stamp text, stronger default ABEDGEOCAM upload remarks display, a clearer bearing arrow, and no-zoom cluster clicks.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.20</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map photo details editing, viewer, ruler, and Ctrl explosion controls.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Details and Tools</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Improved photo details zoning, location, age status, fallback remarks, and bearing arrow display.</li>
                    <li>Added editable category and remarks from photo details and photo list entries.</li>
                    <li>Added same-page original image preview, hidden-photo restore workflow, Ctrl-click cluster explosion, and distance/area ruler tools.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.19</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map authenticated thumbnails and stable Samsung-style clusters.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Photo Pins</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Fixed broken thumbnail images by adding authenticated token access to map thumbnail, original, and exploded photo URLs.</li>
                    <li>Changed cluster grouping from pan-relative screen buckets to stable zoom-scaled Mercator buckets so clusters no longer shake while panning.</li>
                    <li>Updated cluster markers toward the Samsung Gallery map style with stacked photo cards and a blue count badge.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.18</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map photo pin visibility fix.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Photo Pins</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Changed thumbnail marker rendering to use the loaded map photo list directly instead of MapLibre source query timing.</li>
                    <li>Kept GeoCamera-style latest-thumbnail cluster markers and photo counts visible immediately after map photos load.</li>
                    <li>Updated marker positioning while panning and zooming so the pins stay aligned with the map.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.17</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map GeoCamera-style thumbnail photo pins.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Photo Pins</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Changed Geotag Map photo clusters from plain circles to GeoCamera-style thumbnail photo pins.</li>
                    <li>Shows the latest photo thumbnail inside each cluster marker.</li>
                    <li>Overlays the photo count on clustered photo markers while keeping cluster zoom and exploded photo group behavior.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.16</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map photo list and GeoJSON formatter wiring.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Photo Loading</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Loaded the Geotag Map media model in the backend manifest so mapMediaGeoJsonFeature is available to /api/map/media.</li>
                    <li>Restored the map photo public-field formatter used by details, thumbnail, cluster, and list endpoints.</li>
                    <li>Fixed the Geotag Map popup that said "Failed to load map photos" after a successful GeoCamera upload.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.15</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GeoCamera to Geotag Map backend upload service wiring.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Upload Reliability</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Loaded the Geotag Map media service in the backend manifest so mobile uploads can call storeMapMediaUpload.</li>
                    <li>Restored the shared map-media query and file lookup service functions used by the map view and media endpoints.</li>
                    <li>Fixed the GeoCamera upload failure that returned "storeMapMediaUpload is not defined".</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.14</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map basemap rendering stability.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Rendering</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Fixed the Geotag Map area so Google Terrain and Google Satellite have a stable visible canvas height when the map view opens.</li>
                    <li>Prevented early MapLibre tile or style errors from replacing the selected basemap with a blank fallback style.</li>
                    <li>Re-attached ABEARC photo clusters and pins after basemap style loading completes.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.13</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">GeoCamera to Geotag Map upload diagnostics and multipart compatibility.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Upload Reliability</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Improved Geotag Map upload error responses for invalid image types so the server returns a clear client error.</li>
                    <li>Allowed the mobile map-media upload endpoint to accept both photo and files multipart field names for compatibility.</li>
                    <li>Updated GeoCamera to display the Geotag Map server response and HTTP status instead of hiding failures behind a generic connection message.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.12</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map basemap layer selection.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Layers</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added a Geotag Map layer selector for Google Terrain and Google Satellite.</li>
                    <li>Kept ABEARC photo clusters, cluster counts, pins, exploded photo groups, and leader lines active when switching basemaps.</li>
                    <li>Saved the selected map layer in the browser so the preferred basemap is restored when reopening Geotag Map.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.11</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Geotag Map, direct GeoCamera map uploads, map-media storage, clustering, exploded photo groups, and backup coverage.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Geotag Map</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added the Map navigation entry and Geotag Map workspace for geotagged field photos and mapped photos.</li>
                    <li>Added local MapLibre GL JS assets, configurable basemap settings, and a fallback so map photos remain usable if the basemap fails.</li>
                    <li>Added map filters, photo list, photo details drawer, and Needs Location Review filtering.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Map Media Backend</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added the dedicated MapMedia table, indexes, location status handling, duplicate protection, and authenticated map-media API routes.</li>
                    <li>Stored map photos under /data/map-media/originals and /data/map-media/thumbnails instead of My Drive.</li>
                    <li>Generated EXIF-oriented thumbnails with sharp while preserving original images without destructive recompression.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Clustering and Exploded Groups</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added map-native zoom-dependent clustering with cluster counts and expansion zoom behavior.</li>
                    <li>Added GeoCamera-style close-range exploded photo groups with compact alternating multi-rings.</li>
                    <li>Added leader lines from exploded thumbnails back to the true coordinate and collapse behavior for Escape, map tap, pan, zoom, and filtering.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">GeoCamera and Deployment</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Changed GeoCamera Send to ABEARC to Send to Geotag Map using /api/mobile/map-media/upload.</li>
                    <li>Sent per-photo capture metadata, stable client_capture_id, coordinates, zoning, stamp text, and category directly to Geotag Map.</li>
                    <li>Included map media in backup and restore, Docker directory creation, storage health, documentation, and the Synology deployment package.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.10</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Admin-controlled Requirements reload override.</div>
              </div>
              <div class="p-4 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Requirements Config</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added an admin-only toggle for Reload Requirements override in Requirements Config.</li>
                    <li>Allowed admins to reload Proposal or Implementation requirement lists/order after uploads or stage progression.</li>
                    <li>Preserved uploaded document rows while syncing missing and empty requirement placeholders.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.09</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Mobile ABEARC linking, Doc Scanner upload foldering, GeoCam bulk sync, and duplicate-safe mobile uploads.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Mobile Account Linking</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added QR login exchange support for ABEARC mobile apps.</li>
                    <li>Supported linked-account status display for ABED Doc Scanner and ABEDGEOCAM users.</li>
                    <li>Improved mobile upload authentication using bearer-token based ABEARC sessions.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">ABED Doc Scanner</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Routed ABED Doc Scanner uploads into the ABEDOCSCAN Uploads folder instead of the My Drive root.</li>
                    <li>Detected Doc Scanner mobile uploads by their app tags while keeping normal My Drive uploads unchanged.</li>
                    <li>Preserved uploaded PDF metadata, titles, descriptions, and tags for My Drive search and organization.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">ABEDGEOCAM Sync</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added duplicate-safe handling for ABEDGEOCAM mobile uploads.</li>
                    <li>Skipped existing GeoCam files in the same target folder instead of creating renamed duplicates.</li>
                    <li>Returned uploaded and skipped counts so the mobile app can show accurate sync results.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">My Drive Mobile Organization</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Kept ABEDGEOCAM uploads organized under ABEDGEOCAM Uploads by year, district, barangay, category, and date.</li>
                    <li>Kept ABED Doc Scanner uploads grouped under ABEDOCSCAN Uploads for easier review.</li>
                    <li>Improved activity logs for mobile upload actions and skipped duplicate files.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.08</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Work Assignment simplification, For Review routing, schedule participant safeguards, My Drive upgrades, and configuration request cleanup.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Work Assignment</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added a cleaner Work Assignment workspace focused on unassigned, due soon, and overdue work.</li>
                    <li>Grouped assignment items by project for easier viewing of project owners and document owners.</li>
                    <li>Added project-level assignment controls, including Assign all unassigned documents.</li>
                    <li>Added Bulk Assign mode for selected project and document work items.</li>
                    <li>Added backend support for bulk assignment through /api/work-assignments/bulk.</li>
                    <li>Improved the assignment picker with user workload, role, and direct superior details.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">For Review</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added a dedicated For Review side tab for documents that need review.</li>
                    <li>Added /api/documents/for-review for the review queue.</li>
                    <li>Limited For Review visibility so users see their own uploads or documents uploaded by users under their direct supervision.</li>
                    <li>Added sidebar badge support for For Review document counts.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Calendar and Scheduling</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added participant summary display in the schedule form.</li>
                    <li>Added warnings when saving with no participants or when the creator is not included.</li>
                    <li>Added an option to quickly add the current user as a participant before saving.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">My Drive</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Improved My Drive with Mine, Shared, and Trash areas.</li>
                    <li>Added list/grid view controls, details panel, sorting, file type filter, and modified-date filter.</li>
                    <li>Added folder download as ZIP, shared folder access, and owner transfer for files and folders.</li>
                    <li>Improved storage usage calculations.</li>
                    <li>Added multi-select actions, drag selection support, and undo support for recent drive actions.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Configuration Approvals</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Improved pending configuration request display with clearer Current, Requested Change, and Current Now labels.</li>
                    <li>Added stale request clearing through /api/configuration-change-requests/:id/clear-stale.</li>
                    <li>Added safeguards so outdated configuration requests can be cleared without applying old changes.</li>
                    <li>Improved activity logging for stale configuration request cleanup.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Branding and Navigation</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Updated system branding to ABEARC Projects &amp; Services Monitoring Information System.</li>
                    <li>Added ABEARC workspace sidebar navigation.</li>
                    <li>Added selected-state highlighting for sidebar items.</li>
                    <li>Added grouped sidebar sections for Project Control, Schedule, Documents, and Administration.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.07</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">ABE ARC branding, sidebar selection highlight, and My Drive workspace features.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Branding and navigation</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Updated the system name to Analytics, Records &amp; Connectivity (ARC) and Projects &amp; Services Monitoring Information System.</li>
                    <li>Updated the sidebar workspace title to Projects &amp; Services.</li>
                    <li>Added selected-state highlighting for sidebar navigation items.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">My Drive</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added a personal My Drive workspace with Mine, Shared, and Trash areas.</li>
                    <li>Added file uploads, folder creation, search, type filters, modified-date filters, grid view, and list view.</li>
                    <li>Added file details, storage usage display, multi-select actions, drag selection, and undo support for recent drive actions.</li>
                    <li>Added sharing to selected users with shared-file access from the Shared tab.</li>
                    <li>Added copy actions from My Drive into project documents, project documentation, calendar attachments, or another My Drive folder.</li>
                    <li>Added trash, restore, and permanent delete flows for My Drive files and folders.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.06</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Backup restore safeguards, upload consistency, requirements UI polish, calendar reminder wording, and My Schedule filter fixes.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Backup and restore</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added a login-page Restore backup flow with a dedicated restore modal before sign-in.</li>
                    <li>Added required system restore password validation for restore attempts.</li>
                    <li>Moved Settings restore into a modal with backup ZIP upload, password entry, and inline errors.</li>
                    <li>Added restore progress only after password and backup validation pass.</li>
                    <li>Changed backup creation to ask for confirmation first and create without auto-downloading.</li>
                    <li>Added confirmation before downloading existing backups.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Upload experience</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Standardized visible upload controls with drag-and-drop zones and click-to-browse support.</li>
                    <li>Applied the shared upload style to backup restore, login restore, config import, closure and disposition attachments, and calendar attachments.</li>
                    <li>Added selected filename and size display to newly standardized upload zones.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Requirements configuration</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Improved Selected Requirements drag-and-drop ordering, including downward moves, bottom append, and invalid-drop order restoration.</li>
                    <li>Moved Available Documents search into the Available Documents panel.</li>
                    <li>Replaced inline document creation with a + New Document button and modal.</li>
                    <li>Renamed Remove Selected to Remove All and hid Remove All or Select All when no matching items exist.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Calendar and schedules</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Changed calendar reminder wording from raw minute counts to readable units such as in 1 day, in 2 days, and in 2 hours.</li>
                    <li>Normalized old stored reminder notifications when displayed.</li>
                    <li>Updated My Schedule past detection to use schedule end date with start-date fallback.</li>
                    <li>Excluded past schedules from Pending Invitations counts and filter results, and reordered filters to Upcoming, Pending Invitations, Past, and All.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.05</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Configuration approvals, audit IP improvements, role defaults, and unrestricted Downloads & Forms uploads.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Configuration approvals</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added Direct Superior approval requests for user-role changes in Settings > Configuration.</li>
                    <li>Kept admin, superadmin, and system maintenance configuration changes immediate.</li>
                    <li>Added Configuration Requests inside Pending Confirmations with approve, reject, requester history, and final status display.</li>
                    <li>Added conflict protection so stale pending requests do not overwrite newer configuration changes.</li>
                    <li>Added focused notifications and activity logs for submitted, approved, rejected, applied, and blocked configuration requests.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Configuration permissions</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Updated default user-role privileges to include stage transition, project disposition management, requirements, document types, project types, and requestees.</li>
                    <li>Blocked configuration request submission when no valid Direct Superior is assigned and logged the failed attempt.</li>
                    <li>Prevented requesters and unrelated users from approving or rejecting configuration requests.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Downloads & Forms</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Allowed all file types in Downloads & Forms uploads and replacements while keeping the existing upload size limit.</li>
                    <li>Added a drag-and-drop file upload zone in the upload modal with click-to-browse support.</li>
                    <li>Displayed the selected filename and size after choosing or dropping a file.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Activity logs</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Improved Activity Logs IP capture by honoring forwarded client IP headers from trusted local or private proxy hops.</li>
                    <li>Normalized logged IP addresses so forwarded device IPs can replace Docker bridge addresses when the deployment passes the headers through.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 overflow-hidden">
              <div class="px-4 py-3 border-b border-cyan-200 dark:border-cyan-800">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.04</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">System maintenance controls, calendar refinements, file transfer visibility, and secure QR sharing.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">System / Maintenance role</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added a dedicated System / Maintenance role separate from operational superadmin authority.</li>
                    <li>Excluded system accounts from calendar invitations, workload lists, direct superior selection, and project or document assignments.</li>
                    <li>Added safe database migration support and conversion checks for existing accounts.</li>
                    <li>Kept system account actions visible in activity and security logs.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Privileges and diagnostics</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added role-based default privileges with a Default action in user management.</li>
                    <li>Protected maintenance-only privileges from automatic superadmin bypass.</li>
                    <li>Added System Health Check and System Diagnostic Test tools.</li>
                    <li>Restricted feedback notifications and review access to System / Maintenance accounts only.</li>
                    <li>Added a System-only Submitted Feedback queue with search, filters, full submission details, and status management.</li>
                    <li>Logged feedback status changes for audit review.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Calendar refinements</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added a required custom schedule-type description when Others is selected.</li>
                    <li>Displayed the custom type consistently in calendar cards, details, notifications, and exports.</li>
                    <li>Kept System / Maintenance accounts out of participant search and invitation workflows.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Downloads & Forms</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added visible upload and download progress with byte counts and cancellation.</li>
                    <li>Added Share buttons for active files with scannable QR codes and links shown below.</li>
                    <li>Added Copy Link and direct Download actions inside the sharing modal.</li>
                    <li>Protected shared downloads with signed, tamper-resistant links that expire after 24 hours.</li>
                    <li>Generated LAN-reachable links so another device on the network can scan and download.</li>
                    <li>Prevented QR scanner previews and duplicate requests from inflating download counts.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.03</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Calendar participation, ABE-wide viewing, confirmation, and feedback improvements.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Calendar participants</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Unified the schedule participant picker with the calendar user-search experience.</li>
                    <li>Kept modal participants independent from sidebar calendar filters.</li>
                    <li>Corrected My Calendar visibility so creators appear only when explicitly involved.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Visibility and workflows</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Made ABE Calendar schedules viewable to every user with calendar access.</li>
                    <li>Preserved existing creator and administrator edit restrictions.</li>
                    <li>Replaced remaining browser prompts with app-styled confirmation forms.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3 md:col-span-2">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Feedback</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added persistent Bug, Change Request, and Improvement submissions for all logged-in users.</li>
                    <li>Added administrator notifications for newly submitted feedback.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div class="font-black text-gray-900 dark:text-gray-100">v1.02</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Project disposition, closure confirmation, downloads, and notification routing updates.</div>
              </div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Project outcomes</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added Irreparable and Decommissioned disposition outcomes.</li>
                    <li>Updated dashboard filters, badges, and disposition forms.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Confirmation workflows</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added superadmin confirmation for project dispositions.</li>
                    <li>Added close-project requests with supporting attachments.</li>
                    <li>Added Settings > Pending Confirmations.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Users and notifications</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Added Direct Superior assignment for users.</li>
                    <li>Improved routine notification routing to reduce broad admin alerts.</li>
                    <li>Added new privileges for closure, disposition, and direct superior management.</li>
                  </ul>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3">
                  <div class="font-black text-gray-900 dark:text-gray-100 mb-1">Documents and staff files</div>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>Fixed document review confirmation state behavior.</li>
                    <li>Expanded Project Summary with disposition, reopen, approval, and attachment details.</li>
                    <li>Added Downloads & Forms for staff-downloadable files.</li>
                  </ul>
                </div>
              </div>
            </div>
            ${isSystemUser() ? submittedFeedbackSectionHtml() : ''}
          </div>`;
        if (isSystemUser()) loadSubmittedFeedback();
    }

    let changelogFeedbackAttachmentFile = null;

    function updateChangelogFeedbackDropZone({ dragging = false, uploading = false } = {}) {
      const dropZone = document.getElementById('changelogFeedbackDropZone');
      const dropText = document.getElementById('changelogFeedbackDropText');
      if (!dropZone || !dropText) return;
      dropZone.classList.toggle('border-cyan-500', dragging || uploading);
      dropZone.classList.toggle('bg-cyan-50', dragging || uploading);
      dropZone.classList.toggle('dark:bg-cyan-950/20', dragging || uploading);
      dropZone.classList.toggle('opacity-70', uploading);
      dropText.textContent = uploading ? 'Submitting...' : 'Drag and drop file here, or click to browse';
    }

    function setChangelogFeedbackAttachment(file) {
      const input = document.getElementById('changelogFeedbackAttachment');
      const selected = document.getElementById('changelogFeedbackSelectedFile');
      if (!input || !selected) return false;
      if (!file || file.size > UPLOAD_MAX_FILE_SIZE) {
        changelogFeedbackAttachmentFile = null;
        input.value = '';
        selected.classList.add('hidden');
        selected.textContent = '';
        toast(!file ? 'Please choose a file to upload.' : 'File too large. Maximum size is 50MB.', 'error');
        return false;
      }
      changelogFeedbackAttachmentFile = file;
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
      } catch (e) {}
      selected.textContent = `Selected file: ${file.name}`;
      selected.classList.remove('hidden');
      return true;
    }

    function resetChangelogFeedbackAttachment() {
      changelogFeedbackAttachmentFile = null;
      document.getElementById('changelogFeedbackAttachment') && (document.getElementById('changelogFeedbackAttachment').value = '');
      const selected = document.getElementById('changelogFeedbackSelectedFile');
      if (selected) {
        selected.classList.add('hidden');
        selected.textContent = '';
      }
      updateChangelogFeedbackDropZone();
    }

    function setupChangelogFeedbackDropZone() {
      const dropZone = document.getElementById('changelogFeedbackDropZone');
      const input = document.getElementById('changelogFeedbackAttachment');
      const modal = document.getElementById('changelogFeedbackModal');
      if (!dropZone || !input || !modal) return;
      const openPicker = () => input.click();
      dropZone.addEventListener('click', openPicker);
      dropZone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      });
      input.addEventListener('change', () => input.files?.[0] && setChangelogFeedbackAttachment(input.files[0]));
      ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        updateChangelogFeedbackDropZone({ dragging: true });
      }));
      ['dragleave', 'dragend'].forEach(name => dropZone.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        updateChangelogFeedbackDropZone();
      }));
      dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        updateChangelogFeedbackDropZone();
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return toast('No file was dropped.', 'error');
        if (files.length > 1) return toast('Please upload one file only.', 'error');
        setChangelogFeedbackAttachment(files[0]);
      });
      document.addEventListener('dragover', (event) => {
        if (!modal.classList.contains('hidden')) event.preventDefault();
      });
      document.addEventListener('drop', (event) => {
        if (!modal.classList.contains('hidden')) event.preventDefault();
      });
    }

    setupChangelogFeedbackDropZone();

    window.openChangelogFeedbackModal = function() {
      document.getElementById('changelogFeedbackForm')?.reset();
      resetChangelogFeedbackAttachment();
      document.getElementById('changelogFeedbackModal')?.classList.remove('hidden');
      setTimeout(() => document.getElementById('changelogFeedbackTitle')?.focus(), 50);
    };

    document.getElementById('changelogFeedbackForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const title = document.getElementById('changelogFeedbackTitle').value.trim();
      const details = document.getElementById('changelogFeedbackDetails').value.trim();
      if (!title || !details) return toast('Title and details are required.', 'error');
      const body = new FormData();
      body.append('type', document.getElementById('changelogFeedbackType').value);
      body.append('title', title);
      body.append('details', details);
      body.append('priority', document.getElementById('changelogFeedbackPriority').value);
      const file = changelogFeedbackAttachmentFile || document.getElementById('changelogFeedbackAttachment')?.files?.[0];
      if (file) body.append('attachment', file);
      try {
        updateChangelogFeedbackDropZone({ uploading: true });
        await fetchJson(`${API}/changelog/feedback`, {
          method: 'POST',
          body
        });
        closeModal('changelogFeedbackModal');
        toast('Feedback submitted successfully.');
        if (isSystemUser() && activeSettingsSection === 'changelog') loadSubmittedFeedback();
      } catch (e) {
        toast(e.message || 'Failed to submit feedback.', 'error');
      } finally {
        updateChangelogFeedbackDropZone();
      }
    });

    async function renderPendingConfirmations() {
        const el = document.getElementById('content-pending-confirmations');
        if (!el) return;
        el.innerHTML = '<div class="settings-card p-4 text-sm text-gray-500">Loading pending confirmations...</div>';
        try {
            const [dispositions, closures, configRequests] = await Promise.all([
                canApproveProjectDisposition() ? fetchJson(`${API}/project-disposition-requests?status=pending`, { silentLoading: true }).catch(() => []) : Promise.resolve([]),
                canApproveProjectClosure() ? fetchJson(`${API}/project-closure-requests?status=pending`, { silentLoading: true }).catch(() => []) : Promise.resolve([]),
                fetchJson(`${API}/configuration-change-requests?status=${encodeURIComponent(configurationRequestFilter)}`, { silentLoading: true }).catch(() => [])
            ]);
            el.innerHTML = `
              <div class="grid grid-cols-1 gap-4">
                ${renderConfigurationRequestSection(configRequests)}
                ${renderPendingConfirmationSection('Pending Project Dispositions', dispositions, 'disposition')}
                ${renderPendingConfirmationSection('Pending Project Closures', closures, 'closure')}
              </div>`;
            updatePendingConfirmationsBadge();
            if (configurationRequestHighlightId) {
                const id = configurationRequestHighlightId;
                configurationRequestHighlightId = null;
                setTimeout(() => {
                    const target = document.getElementById(`configuration-request-${id}`);
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    highlightElement(target, true);
                }, 200);
            }
        } catch (e) {
            el.innerHTML = `<div class="settings-card p-4 text-red-600">${esc(e.message || 'Failed to load pending confirmations')}</div>`;
        }
    }

    function setConfigurationRequestFilter(filter) {
        configurationRequestFilter = filter || 'pending';
        renderPendingConfirmations();
    }

    function configRequestStatusBadge(status) {
        const classes = {
          pending: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
          approved: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
          rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
          conflict: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800',
          already_changed: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800',
          cancelled: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
        };
        return classes[status] || classes.pending;
    }

    function renderConfigRequestFields(fields = []) {
        const rows = Array.isArray(fields) ? fields : [];
        return rows.length ? rows.map(item => `
          <div class="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
            <div class="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400">${esc(item.label || '-')}</div>
            <div class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">${esc(item.value ?? '-')}</div>
          </div>`).join('') : '<div class="text-sm text-gray-500 dark:text-gray-400">No details available.</div>';
    }

    function renderConfigRequestPanel(label, fields, tone = 'gray') {
        const styles = tone === 'indigo'
          ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
          : tone === 'orange'
            ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
        const labelClass = tone === 'indigo' ? 'text-indigo-700 dark:text-indigo-300' : tone === 'orange' ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-300';
        return `
          <div class="rounded-lg border ${styles} p-3">
            <div class="text-xs font-black uppercase mb-2 ${labelClass}">${esc(label)}</div>
            ${renderConfigRequestFields(fields)}
          </div>`;
    }

    function renderConfigurationRequestSection(rows = []) {
        const pendingCount = rows.filter(r => r.status === 'pending').length;
        const filters = [
          ['pending', 'Pending'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
          ['conflict', 'Conflict'],
          ['all', 'All']
        ];
        const cards = rows.map(renderConfigurationRequestCard).join('');
        return `
          <div class="settings-card p-4 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 class="text-lg font-black text-gray-900 dark:text-gray-100">Configuration Requests</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400">Pending Direct Superior approvals and recent request history.</p>
              </div>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">${pendingCount} pending</span>
            </div>
            <div class="flex flex-wrap gap-2">
              ${filters.map(([value, label]) => `<button type="button" onclick="setConfigurationRequestFilter('${value}')" class="px-3 py-1.5 rounded-lg text-xs font-black border ${configurationRequestFilter === value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}">${label}</button>`).join('')}
            </div>
            <div class="space-y-3">${cards || '<div class="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4">No configuration requests.</div>'}</div>
          </div>`;
    }

    function renderConfigurationRequestCard(row) {
        const preview = row.preview || {};
        const statusClass = configRequestStatusBadge(row.status || 'pending');
        const canDecide = !!preview.canApprove;
        const canCancel = row.status === 'pending' && (currentUser?.role === 'superadmin' || Number(row.requester_user_id) === Number(currentUser?.id));
        const canClearStale = row.status === 'pending'
          && !canDecide
          && preview.conflictStatus
          && Number(row.requester_user_id) !== Number(currentUser?.id)
          && (currentUser?.role === 'superadmin' || Number(row.direct_superior_user_id) === Number(currentUser?.id));
        const finalStatus = row.status && row.status !== 'pending';
        const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
        return `
          <div id="configuration-request-${row.id}" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div class="min-w-0 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-base font-black text-gray-950 dark:text-gray-50">${esc(preview.title || row.config_section || 'Configuration Request')}</span>
                  <span class="px-2 py-0.5 rounded-full border text-xs font-black ${statusClass}">${esc(row.status || 'pending')}</span>
                </div>
                <div class="text-gray-600 dark:text-gray-300">${esc(preview.summary || '')}</div>
                <div><strong>Target:</strong> ${esc(preview.target || row.target_display_name || row.config_key || '-')}</div>
                <div><strong>Action:</strong> ${esc(preview.actionLabel || row.action_type || '-')}</div>
                <div><strong>Requested by:</strong> ${esc(row.requester_username || '-')} on ${fmtDateTime(row.created_at)}</div>
                <div><strong>Direct Superior:</strong> ${esc(row.direct_superior_username || '-')}</div>
                ${row.approver_username ? `<div><strong>Decided by:</strong> ${esc(row.approver_username)} on ${fmtDateTime(row.decided_at)}</div>` : ''}
                ${row.approver_remarks ? `<div><strong>Remarks:</strong> ${esc(row.approver_remarks)}</div>` : ''}
                ${row.conflict_reason ? `<div class="text-red-600 dark:text-red-300"><strong>Conflict:</strong> ${esc(row.conflict_reason)}</div>` : ''}
                ${warnings.length ? `<div class="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3 text-orange-800 dark:text-orange-200 text-sm">${warnings.map(esc).join('<br>')}</div>` : ''}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  ${renderConfigRequestPanel('Current:', preview.currentFields || [], 'gray')}
                  ${renderConfigRequestPanel('Requested Change:', preview.requestedChangeFields || [], 'indigo')}
                </div>
                ${preview.currentNowFields?.length ? `<div class="mt-3">${renderConfigRequestPanel('Current Now:', preview.currentNowFields, 'orange')}</div>` : ''}
              </div>
              <div class="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                ${canDecide ? `<button onclick="approveConfigurationRequest(${row.id})" class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold">Approve</button><button onclick="rejectConfigurationRequest(${row.id})" class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Reject</button>` : ''}
                ${canClearStale ? `<button onclick="clearStaleConfigurationRequest(${row.id})" class="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold">Clear Pending</button>` : ''}
                ${canCancel && !canDecide ? `<button onclick="cancelConfigurationRequest(${row.id})" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold">Cancel</button>` : ''}
                ${finalStatus ? `<span class="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-black text-center text-gray-500 dark:text-gray-400">Final</span>` : ''}
              </div>
            </div>
          </div>`;
    }

    async function approveConfigurationRequest(id) {
        openConfirmModal('Approve and apply this configuration change request?', async () => {
            try {
                await fetchJson(`${API}/configuration-change-requests/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remarks: '' }) });
                toast('Configuration request approved and applied.');
                await refreshAfterMutation({ refreshNotifications: true, silent: true }).catch(() => {});
                renderPendingConfirmations();
            } catch (e) {
                toast(e.message, 'error');
            }
        });
        const btn = document.getElementById('confirmActionBtn');
        if (btn) btn.textContent = 'Approve Request';
    }

    async function clearStaleConfigurationRequest(id) {
        openConfirmModal('Clear this stale request from pending? This will not apply the requested configuration change.', async () => {
            try {
                await fetchJson(`${API}/configuration-change-requests/${id}/clear-stale`, { method: 'POST' });
                toast('Configuration request cleared from pending.');
                await refreshAfterMutation({ refreshNotifications: true, silent: true }).catch(() => {});
                renderPendingConfirmations();
            } catch (e) {
                toast(e.message, 'error');
            }
        });
        const btn = document.getElementById('confirmActionBtn');
        if (btn) btn.textContent = 'Clear Pending';
    }

    async function rejectConfigurationRequest(id) {
        openConfirmModal(`
          <div class="space-y-3 text-sm">
            <div>Reject this configuration change request?</div>
            <label class="block"><span class="font-bold">Rejection remarks</span><textarea id="configRejectRemarks" rows="3" class="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800"></textarea></label>
          </div>`, null);
        const btn = document.getElementById('confirmActionBtn');
        btn.textContent = 'Reject Request';
        btn.className = 'px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium';
        btn.onclick = async () => {
            try {
                const remarks = document.getElementById('configRejectRemarks')?.value.trim() || '';
                if (!remarks) {
                    toast('Rejection remarks are required.', 'error');
                    return;
                }
                await fetchJson(`${API}/configuration-change-requests/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remarks }) });
                closeConfirmModal();
                toast('Configuration request rejected.');
                await refreshAfterMutation({ refreshNotifications: true, silent: true }).catch(() => {});
                renderPendingConfirmations();
            } catch (e) {
                toast(e.message, 'error');
            }
        };
    }

    async function cancelConfigurationRequest(id) {
        openConfirmModal('Cancel this pending configuration change request?', async () => {
            try {
                await fetchJson(`${API}/configuration-change-requests/${id}/cancel`, { method: 'POST' });
                toast('Configuration request cancelled.');
                await refreshAfterMutation({ refreshNotifications: true, silent: true }).catch(() => {});
                renderPendingConfirmations();
            } catch (e) {
                toast(e.message, 'error');
            }
        });
    }

    function renderPendingConfirmationSection(title, rows, type) {
        const cards = (rows || []).map(row => renderPendingConfirmationCard(row, type)).join('');
        return `
          <div class="settings-card p-4 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h4 class="text-lg font-black text-gray-900 dark:text-gray-100">${esc(title)}</h4>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">${(rows || []).length} pending</span>
            </div>
            <div class="space-y-3">${cards || '<div class="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4">No pending requests.</div>'}</div>
          </div>`;
    }

    function renderPendingConfirmationCard(row, type) {
        const isDisposition = type === 'disposition';
        const attachmentId = row.attachment_path ? `${isDisposition ? 'disposition' : 'closure'}-${row.id}` : '';
        const attachmentButtons = attachmentId ? `
          <div class="flex flex-wrap gap-2 mt-2">
            <button onclick="viewProtectedFile('${API}/projects/${row.project_id}/closure-attachments/${attachmentId}/view')" class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold">View Attachment</button>
            <button onclick="downloadProtectedFile('${API}/projects/${row.project_id}/closure-attachments/${attachmentId}/download')" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">Download</button>
          </div>` : '';
        const detail = isDisposition
          ? `<div><strong>Requested outcome:</strong> ${esc(row.requested_outcome || '-')}</div><div><strong>Reason:</strong> ${esc(row.reason || '-')}</div><div><strong>Remarks:</strong> ${esc(row.remarks || '-')}</div>`
          : `<div><strong>Requested action:</strong> Close Project</div><div><strong>Stage remarks:</strong> ${esc(row.stage_remarks || '-')}</div><div><strong>Completion remarks:</strong> ${esc(row.completion_remarks || '-')}</div>`;
        return `
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div class="min-w-0 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <div class="text-base font-black text-gray-950 dark:text-gray-50">${esc(row.project_name || `Project #${row.project_id}`)}</div>
                ${detail}
                <div><strong>Requested by:</strong> ${esc(row.requested_by_username || '-')} on ${fmtDateTime(row.requested_at)}</div>
                ${attachmentButtons}
              </div>
              <div class="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                <button onclick="approvePendingConfirmation('${type}', ${row.id})" class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold">Approve</button>
                <button onclick="rejectPendingConfirmation('${type}', ${row.id})" class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Reject</button>
              </div>
            </div>
          </div>`;
    }

    async function approvePendingConfirmation(type, id) {
        const endpoint = type === 'disposition'
          ? `${API}/project-disposition-requests/${id}/approve`
          : `${API}/project-closure-requests/${id}/approve`;
        openConfirmModal('Approve this pending request?', async () => {
            try {
                await fetchJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ review_remarks: '' }) });
                toast('Request approved.');
                await refreshAfterMutation({ projectId: currentProjId, silent: true }).catch(() => {});
                renderPendingConfirmations();
                if (currentProjId) renderProjectDetailHeader(projCache.find(p => Number(p.id) === Number(currentProjId)));
            } catch (e) {
                toast(e.message, 'error');
            }
        });
    }

    async function rejectPendingConfirmation(type, id) {
        openConfirmModal(`
          <div class="space-y-3 text-sm">
            <div>Reject this pending request?</div>
            <label class="block"><span class="font-bold">Rejection remarks</span><textarea id="pendingRejectRemarks" rows="3" class="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800" required></textarea></label>
          </div>`, null);
        const btn = document.getElementById('confirmActionBtn');
        btn.textContent = 'Reject Request';
        btn.className = 'px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium';
        btn.onclick = async () => {
            const reviewRemarks = document.getElementById('pendingRejectRemarks')?.value.trim();
            if (!reviewRemarks) return toast('Rejection remarks are required.', 'error');
            const endpoint = type === 'disposition'
              ? `${API}/project-disposition-requests/${id}/reject`
              : `${API}/project-closure-requests/${id}/reject`;
            try {
                await fetchJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ review_remarks: reviewRemarks }) });
                closeConfirmModal();
                toast('Request rejected.');
                renderPendingConfirmations();
                if (currentProjId) renderProjectPendingConfirmations(currentProjId);
            } catch (e) {
                toast(e.message, 'error');
            }
        };
    }

    // User Management Functions (Manage Users privilege)
    const PRIVILEGE_CATEGORY_ORDER = [
      'Work Operation',
      'Document Management',
      'Calendar',
      'Reports / Printing',
      'Work Configuration',
      'Workforce / Work Administration',
      'Forms & Tools',
      'System Administration'
    ];

    function roleDisplayLabel(role) {
      if (role === 'superadmin') return 'Super Admin';
      if (role === 'system') return 'System / Maintenance';
      return role === 'admin' ? 'Admin' : 'User';
    }

    async function ensurePrivilegeDefaultsLoaded() {
      if (privilegeCatalogCache.length && Object.keys(roleDefaultPrivileges).length) return;
      const payload = await fetchJson(`${API}/privileges/defaults`, { silentLoading: true });
      privilegeCatalogCache = payload.catalog || [];
      roleDefaultPrivileges = payload.defaults || {};
    }

    function selectedPrivilegeMap(containerId) {
      const map = {};
      document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(checkbox => {
        map[checkbox.dataset.priv] = checkbox.checked;
      });
      return map;
    }

    function renderUserPrivilegeChecklist(containerId, privilegeMap, targetRole) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const grouped = {};
      PRIVILEGE_CATEGORY_ORDER.forEach(category => grouped[category] = []);
      privilegeCatalogCache.forEach(privilege => {
        (grouped[privilege.category] || (grouped[privilege.category] = [])).push(privilege);
      });
      const protectedPrivileges = new Set([
        'approve_project_disposition', 'approve_project_closure', 'manage_stage_edit_access',
        'manage_users', 'manage_backups', 'manage_maintenance', 'import_export_config',
        'view_activity_logs', 'system_testing', 'system_health_check'
      ]);
      const adminOnly = new Set(['view_workload_analytics', 'view_workload_dashboard']);
      const actorCanManageProtected = ['superadmin', 'system'].includes(currentUser?.role);
      const orderedCategories = [
        ...PRIVILEGE_CATEGORY_ORDER,
        ...Object.keys(grouped).filter(category => !PRIVILEGE_CATEGORY_ORDER.includes(category)).sort()
      ];
      container.innerHTML = orderedCategories.map(category => {
        const items = grouped[category] || [];
        if (!items.length) return '';
        const rows = items.map(privilege => {
          const restricted = (!actorCanManageProtected && protectedPrivileges.has(privilege.name))
            || (targetRole === 'user' && adminOnly.has(privilege.name));
          const checked = privilegeMap[privilege.name] === true ? 'checked' : '';
          const note = protectedPrivileges.has(privilege.name)
            ? 'Protected privilege.'
            : (adminOnly.has(privilege.name) ? 'Admin-level privilege.' : '');
          return `
            <label class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded ${restricted ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}">
              <input type="checkbox" data-priv="${privilege.name}" ${checked} ${restricted ? 'disabled' : ''} class="w-4 h-4 text-indigo-600 rounded">
              <div>
                <div class="font-medium text-gray-700 dark:text-gray-300">${esc(privilege.display_name || privilege.name.replace(/_/g, ' '))}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">${esc(privilege.description || '')} ${note ? `<span class="font-bold">${esc(note)}</span>` : ''}</div>
              </div>
            </label>`;
        }).join('');
        return `<div class="pt-2 first:pt-0"><div class="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">${esc(category)}</div><div class="space-y-1">${rows}</div></div>`;
      }).join('');
    }

    function applyRoleDefaultsToContainer(containerId, role) {
      const selected = new Set(roleDefaultPrivileges[role] || []);
      const map = Object.fromEntries(privilegeCatalogCache.map(item => [item.name, selected.has(item.name)]));
      renderUserPrivilegeChecklist(containerId, map, role);
    }

    async function renderUserManagement() {
        const container = document.getElementById('content-user-management');
        container.innerHTML = '<div class="flex items-center justify-center py-8"><div class="spinner w-8 h-8 border-4 border-t-indigo-600"></div></div>';
        
        try {
            const [users] = await Promise.all([
                fetchJson(`${API}/users`),
                ensurePrivilegeDefaultsLoaded()
            ]);
            
            let html = `
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-sm text-purple-800">
                    <strong>User Management:</strong> Create and manage operational or System / Maintenance accounts with granular privileges.
                </div>
                
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Users (${users.length})</h3>
                    <button onclick="openCreateUserModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Add User
                    </button>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                            <tr>
                                <th class="px-4 py-3">Username</th>
                                <th class="px-4 py-3">Role</th>
                                <th class="px-4 py-3">Direct Superior</th>
                                <th class="px-4 py-3">Privileges</th>
                                <th class="px-4 py-3">Created</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
            `;
            
            users.forEach(user => {
                const roleClass = user.role === 'system'
                    ? 'px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-800'
                    : user.role === 'superadmin'
                    ? 'px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700'
                    : user.role === 'admin'
                        ? 'px-2 py-1 rounded text-xs font-semibold bg-indigo-100 text-indigo-700'
                        : 'px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700';
                
                const createdDate = new Date(user.created_at).toLocaleDateString();
                
                html += `
                    <tr class="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">${esc(user.username)}</td>
                        <td class="px-4 py-3"><span class="${roleClass}">${esc(roleDisplayLabel(user.role))}</span>${user.role === 'system' ? '<div class="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Hidden from work workflows</div>' : ''}</td>
                        <td class="px-4 py-3 text-gray-600 dark:text-gray-400">${esc(user.direct_superior_username || '-')}</td>
                        <td class="px-4 py-3 text-gray-600 dark:text-gray-400">${user.privilege_count || 0} enabled</td>
                        <td class="px-4 py-3 text-gray-500 dark:text-gray-400">${createdDate}</td>
                        <td class="px-4 py-3 text-right space-x-2">
                            <button onclick="editUser(${user.id})" class="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                            ${user.role !== 'superadmin' ? `<button onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-800 font-medium">Delete</button>` : ''}
                        </td>
                    </tr>
                `;
            });
            
            html += `</tbody></table></div>`;
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = `<div class="text-red-600">Error loading users: ${esc(e.message)}</div>`;
        }
    }

    async function populateDirectSuperiorSelect(selectId, selectedId = '', excludedUserId = null) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="">None</option>';
        try {
            const users = filterVisibleWorkUsers(await fetchJson(`${API}/active-users`, { silentLoading: true }));
            users
              .filter(u => !excludedUserId || Number(u.id) !== Number(excludedUserId))
              .forEach(u => {
                const roleLabel = u.role === 'superadmin' ? 'Super Admin' : (u.role === 'admin' ? 'Admin' : 'User');
                select.innerHTML += `<option value="${u.id}" ${Number(selectedId || 0) === Number(u.id) ? 'selected' : ''}>${esc(u.username)} (${roleLabel})</option>`;
              });
        } catch (e) {
            select.innerHTML = '<option value="">None</option>';
        }
    }
    
    async function openCreateUserModal() {
        document.getElementById('createUserForm').reset();
        await ensurePrivilegeDefaultsLoaded();
        const roleSelect = document.getElementById('newUserRole');
        if (roleSelect && !['superadmin', 'system'].includes(currentUser?.role)) {
          roleSelect.innerHTML = '<option value="user">User</option><option value="admin">Admin</option>';
        } else if (roleSelect) {
          roleSelect.innerHTML = '<option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Super Admin</option><option value="system">System / Maintenance</option>';
        }
        await populateDirectSuperiorSelect('newDirectSuperior');
        handleCreateUserRoleChange();
        document.getElementById('createUserModal').classList.remove('hidden');
    }

    function handleCreateUserRoleChange() {
      const role = document.getElementById('newUserRole')?.value || 'user';
      const isSystem = role === 'system';
      document.getElementById('createSystemWarning')?.classList.toggle('hidden', !isSystem);
      document.getElementById('createDirectSuperiorField')?.classList.toggle('hidden', isSystem);
      if (isSystem) document.getElementById('newDirectSuperior').value = '';
      const help = document.getElementById('createUserRoleHelp');
      if (help) {
        help.textContent = isSystem
          ? 'System accounts are for backup, restore, testing, maintenance, and technical administration.'
          : 'Selecting a role applies its recommended default privileges.';
      }
      applyCreateRoleDefaults();
    }

    function applyCreateRoleDefaults() {
      const role = document.getElementById('newUserRole')?.value || 'user';
      applyRoleDefaultsToContainer('createPrivileges', role);
    }
    
    async function createUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('createUserPassword').value;
        const role = document.getElementById('newUserRole').value;
        const directSuperiorUserId = role === 'system' ? null : (document.getElementById('newDirectSuperior')?.value || null);
        const privileges = Array.from(document.querySelectorAll('#createPrivileges input[type="checkbox"]')).map(checkbox => ({
          privilege: checkbox.dataset.priv,
          enabled: checkbox.checked
        }));
        
        if (!username || !password) return toast('Username and password required', 'error');
        
        try {
            await fetchJson(`${API}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role, direct_superior_user_id: directSuperiorUserId, privileges })
            });
            toast('User created successfully');
            closeModal('createUserModal');
            renderUserManagement();
        } catch (e) {
            toast(e.message, 'error');
        }
    }
    
    async function editUser(userId) {
        try {
            const [user] = await Promise.all([
                fetchJson(`${API}/users/${userId}`),
                ensurePrivilegeDefaultsLoaded()
            ]);
            
            const privilegeMap = {};
            (user.privileges || []).forEach(p => { privilegeMap[p.privilege] = p.enabled === 1 || p.enabled === true; });
            
            const editableRoles = ['superadmin', 'system'].includes(currentUser?.role)
              ? ['superadmin', 'admin', 'user', 'system']
              : ['admin', 'user'];
            const roleOptions = editableRoles.map(r => 
                `<option value="${r}" ${r === user.role ? 'selected' : ''}>${roleDisplayLabel(r)}</option>`
            ).join('');
            
            document.getElementById('editUserId').value = userId;
            document.getElementById('editUsername').value = user.username;
            document.getElementById('editUserRole').innerHTML = roleOptions;
            await populateDirectSuperiorSelect('editDirectSuperior', user.direct_superior_user_id, userId);
            renderUserPrivilegeChecklist('editPrivileges', privilegeMap, user.role);
            document.getElementById('editSystemWarning')?.classList.toggle('hidden', user.role !== 'system');
            document.getElementById('editDirectSuperior')?.closest('div')?.classList.toggle('hidden', user.role === 'system');
            document.getElementById('editPrivilegeHelp').textContent = 'Default applies the recommended privileges for this user’s selected role.';
            document.getElementById('editUserModal').classList.remove('hidden');
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function setEditUserPrivileges(checked) {
        document.querySelectorAll('#editPrivileges input[type="checkbox"]:not(:disabled)').forEach(checkbox => {
            checkbox.checked = !!checked;
        });
    }

    function applyEditRoleDefaults() {
      const role = document.getElementById('editUserRole')?.value || 'user';
      applyRoleDefaultsToContainer('editPrivileges', role);
      const help = document.getElementById('editPrivilegeHelp');
      if (help) help.textContent = `Recommended ${roleDisplayLabel(role)} privileges applied.`;
    }

    function handleEditUserRoleChange() {
      const role = document.getElementById('editUserRole')?.value || 'user';
      const currentSelections = selectedPrivilegeMap('editPrivileges');
      renderUserPrivilegeChecklist('editPrivileges', currentSelections, role);
      const isSystem = role === 'system';
      document.getElementById('editSystemWarning')?.classList.toggle('hidden', !isSystem);
      const superiorSelect = document.getElementById('editDirectSuperior');
      superiorSelect?.closest('div')?.classList.toggle('hidden', isSystem);
      if (isSystem && superiorSelect) superiorSelect.value = '';
      const help = document.getElementById('editPrivilegeHelp');
      if (help) help.textContent = 'Role changed. Click Default to apply recommended privileges for this role.';
    }
    
    async function applyUserEdit() {
        const userId = document.getElementById('editUserId').value;
        const role = document.getElementById('editUserRole').value;
        const username = document.getElementById('editUsername').value.trim();
        const newPassword = document.getElementById('editNewPassword').value;
        const directSuperiorUserId = role === 'system' ? null : (document.getElementById('editDirectSuperior')?.value || null);
        if (!username) return toast('Username is required', 'error');
        
        try {
            // Update role
            await fetchJson(`${API}/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, username, direct_superior_user_id: directSuperiorUserId })
            });
            
            // Update password if provided
            if (newPassword) {
                await fetchJson(`${API}/users/${userId}/password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: newPassword })
                });
            }
            
            // Update privileges
            const privCheckboxes = document.querySelectorAll('#editPrivileges input[type="checkbox"]');
            const privileges = Array.from(privCheckboxes).map(cb => ({
                privilege: cb.dataset.priv,
                enabled: cb.checked
            }));
            
            await fetchJson(`${API}/users/${userId}/privileges`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ privileges })
            });
            
            toast('User updated successfully');
            renderUserManagement();
        } catch (e) {
            toast(e.message, 'error');
        }
    }
    
    async function saveUserEdit() {
        await applyUserEdit();
        closeModal('editUserModal');
    }
    
    async function deleteUser(userId) {
      openConfirmModal('Delete this user account? This action cannot be undone.', async () => {
        try {
          await fetchJson(`${API}/users/${userId}`, { method: 'DELETE' });
          toast('User deleted');
          renderUserManagement();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    }

    async function renderWorkloadAnalytics() {
      const container = document.getElementById('content-workload-analytics');
      if (!container) return;
      const today = new Date().toISOString().slice(0, 10);
      const past30 = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
      const startValue = document.getElementById('workloadStartDate')?.value || past30;
      const endValue = document.getElementById('workloadEndDate')?.value || today;
      container.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div id="workloadAnalyticsBody" class="text-sm text-gray-600 dark:text-gray-300">Loading...</div>
        </div>`;
      await loadWorkloadAnalyticsData(startValue, endValue);
    }

    async function loadWorkloadAnalyticsData(startDate = null, endDate = null) {
      const body = document.getElementById('workloadAnalyticsBody');
      if (!body) return;
      startDate = startDate || document.getElementById('workloadStartDate')?.value || '';
      endDate = endDate || document.getElementById('workloadEndDate')?.value || '';
      if (startDate && endDate && startDate > endDate) {
        body.innerHTML = `<div class="text-red-600">Start Date must be before or equal to End Date.</div>`;
        return;
      }
      body.innerHTML = 'Loading...';
      try {
        const qs = new URLSearchParams();
        if (startDate) qs.set('start_date', startDate);
        if (endDate) qs.set('end_date', endDate);
        const data = await fetchJson(`${API}/analytics/workload?${qs.toString()}`);
        const users = data.users || [];
        const history = data.history || [];
        const summary = data.summary || {};
        body.innerHTML = `
          <div class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Current Workload Summary</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div class="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">Most Assigned Documents: <strong>${esc(summary.most_assigned_user?.username || '-')}</strong> (${summary.most_assigned_user?.count || 0})</div>
            <div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">Most Overdue: <strong>${esc(summary.most_overdue_user?.username || '-')}</strong> (${summary.most_overdue_user?.count || 0})</div>
          </div>
          <div class="overflow-x-auto mb-4">
            <table class="w-full text-sm">
              <thead><tr class="text-left border-b dark:border-gray-700"><th class="py-2">User</th><th>Assigned Projects</th><th>Assigned Documents</th><th>Active Documents</th><th>Completed Documents</th><th>Overdue</th><th>Due in 5 Working Days</th><th>For Review</th></tr></thead>
              <tbody>
                ${users.map(u => `<tr class="border-b dark:border-gray-800"><td class="py-2 font-medium">${esc(u.username)}</td><td>${u.assigned_projects || 0}</td><td>${u.assigned_documents || 0}</td><td>${u.active_assigned_documents || 0}</td><td>${u.completed_documents || 0}</td><td>${u.overdue_documents || 0}</td><td>${u.due_within_5_days || 0}</td><td>${u.for_review_documents || 0}</td></tr>`).join('') || '<tr><td colspan="8" class="py-3 text-gray-500">No data</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="flex flex-col md:flex-row md:items-end gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 mb-4">
            <div><label class="block text-sm font-medium mb-1">Start Date</label><input id="workloadStartDate" type="date" value="${esc(startDate)}" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"></div>
            <div><label class="block text-sm font-medium mb-1">End Date</label><input id="workloadEndDate" type="date" value="${esc(endDate)}" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"></div>
            <button onclick="loadWorkloadAnalyticsData()" class="h-10 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold">Apply</button>
          </div>
          <div class="font-semibold mb-2">Assignment History for Selected Date Range</div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left border-b dark:border-gray-700"><th class="py-2">Date</th><th>Kind</th><th>Action</th><th>Changed By</th><th>From</th><th>To</th></tr></thead>
              <tbody>
                ${history.map(h => `<tr class="border-b dark:border-gray-800"><td class="py-2">${fmtDateTime(h.changed_at)}</td><td>${esc(h.kind)}</td><td>${esc(h.action || '-')}</td><td>${esc(h.changed_by_username || '-')}</td><td>${esc(h.previous_owner_username || 'Unassigned')}</td><td>${esc(h.new_owner_username || 'Unassigned')}</td></tr>`).join('') || '<tr><td colspan="6" class="py-3 text-gray-500">No history</td></tr>'}
              </tbody>
            </table>
          </div>`;
      } catch (e) {
        body.innerHTML = `<div class="text-red-600">${esc(e.message)}</div>`;
      }
    }
    window.loadWorkloadAnalyticsData = loadWorkloadAnalyticsData;
