# Weather Stations: administrator setup and crop advisories

## Connect a station without manually editing weather.env

1. Sign in as an authorized **admin, superadmin, or system** user with the **Manage Weather Integration** privilege.
2. Open **ABEARC Map → Weather Stations**.
3. Under **Weather station integration**, paste your ZENTRA Cloud API token.
4. Select **Save & discover stations**. ABEARC validates the token against the ZENTRA devices endpoint before storing it; devices accessible to that account are discovered automatically.
5. Select a station to inspect its sensors, measurements, charts and crop advisories. Use **Discover again** for newly added devices.

The API token remains server-side and is not returned by the status API. ABEARC writes an AES-256-GCM encrypted token to the persistent application data folder as `.weather-credential.enc` and automatically creates a private 0600 file `.weather-credential.key`. ABEARC requires **both** files to restore that credential after backup/redeployment; preserve them with `/data`. The optional legacy `ZENTRA_API_KEY` server environment variable continues to work as a fallback. Do not add either secret file to source control or public exports. Protect LAN login and API-key entry with HTTPS where possible.

Users without the administrator role and the integration privilege cannot manage credentials. A user with a privilege assigned but a non-administrator role is also denied by the server.

## Crop-focused advisory library

The current library has 11 preliminary field-screening rules and covers measured heavy rainfall, excessive wetness, consecutive dry days, heat, cool conditions, high/low humidity, and forecast rainfall, extreme rain, strong wind, hot or cool weather. Each triggered advisory states whether it is based on **station observation** or **model forecast**. Missing rainfall is never treated as zero, and stale forecasts do not generate future-weather advisory triggers. The report contains crop-relevant actions for vegetables, seedlings, root crops, upland crops, trellised crops and young fruit plants—not livestock management.

Visit **Weather Station → Agriculture** for the current advisory cards, or download the **Farm Weather Advisory / A4 PDF**. The PDF includes the supplied City Agriculturist Office and Davao City logos, observed-data metric tiles, crop advisory cards, graphs, a separate modeled forecast outlook when selected, and method limitations. The PDF is created server-side from actual cached station observations and forecast responses rather than pre-rendered stock advice.

**Limits:** Screening thresholds are provisional workflow cues, not PAGASA warnings, formal flood probabilities, planting/chemical-spray authorizations, a seasonal El Niño forecast, or universal crop-yield/damage thresholds. Verify field conditions and official local/PAGASA advisories. Long-term climate outlooks are not invented from a few days of station history or a seven-day model forecast.
