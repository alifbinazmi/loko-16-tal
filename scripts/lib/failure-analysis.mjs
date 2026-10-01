// Shared failure-analysis logic used by scripts/daily-failure-report.mjs and
// scripts/weekly-failure-summary.mjs. Mirrors the same-named constants/functions
// in index.html so both reports always agree with what the dashboard shows live.

export const SUBSYSTEMS = [
  'Auxiliary', 'Bogie', 'Brake', 'Cooling', 'Electrical', 'Engine', 'Fuel', 'Lube',
  'Speedometer', 'Superstructure', 'Traction Motor', 'Wheel', 'Air System',
  'Safety Equipment System', 'Interior', 'Knuckle Coupler System', 'Impact Collision', 'NIL',
];

export const FOUR_M_CATEGORIES = ['Material', 'Method', 'Machine', 'Manpower'];

export const MYT_TZ = 'Asia/Kuala_Lumpur';

export function requireEnv(names) {
  const env = {};
  for (const name of names) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    env[name] = value;
  }
  return env;
}

export async function fetchAllFailures(supabase) {
  const { data, error } = await supabase
    .from('dashboard_store')
    .select('value')
    .eq('key', 'failures')
    .maybeSingle();
  if (error) throw error;
  return data && data.value ? JSON.parse(data.value) : [];
}

export function formatMYT(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MYT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function shiftDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Same logic as index.html's subsystemBucketFor/countableFailures/computeXTotals
export function subsystemBucketFor(raw) {
  const r = (raw || '').trim();
  return SUBSYSTEMS.find(s => r.toLowerCase().startsWith(s.toLowerCase())) || (r === '-' || r === '' ? 'NIL' : null);
}
export function countableFailures(rows) {
  return rows.filter(f => !f.parentRid);
}
export function computeSubsystemTotals(rows) {
  const totals = {};
  SUBSYSTEMS.forEach(s => totals[s] = 0);
  rows.forEach(f => {
    const match = subsystemBucketFor(f.subSystem);
    if (match) totals[match]++;
  });
  return totals;
}
export function computeAssetTotals(rows) {
  const totals = {};
  rows.forEach(f => {
    const a = f.asset || 'Unassigned';
    totals[a] = (totals[a] || 0) + 1;
  });
  return totals;
}
export function computeDepotTotals(rows) {
  const totals = {};
  rows.forEach(f => {
    const d = f.depoh || 'Unassigned';
    totals[d] = (totals[d] || 0) + 1;
  });
  return totals;
}
export function topEntry(totals) {
  let best = null;
  for (const [key, count] of Object.entries(totals)) {
    if (count > 0 && (!best || count > best.count)) best = { key, count };
  }
  return best;
}
export function trendArrow(currentCount, previousCount) {
  const prev = previousCount || 0;
  if (currentCount > prev) return '▲';
  if (currentCount < prev) return '▼';
  return '–';
}

// Repeat failure alerts: same asset + same sub-system happening 2+ times in the period
export function computeRepeatOffenders(rows) {
  const map = new Map();
  rows.forEach(f => {
    const asset = f.asset || 'Unassigned';
    const subSystem = f.subSystem || 'Unknown';
    const key = asset + '\u0000' + subSystem;
    const entry = map.get(key) || { asset, subSystem, count: 0 };
    entry.count++;
    map.set(key, entry);
  });
  return Array.from(map.values())
    .filter(e => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// 4M root-cause breakdown: tallies c1_4m..c4_4m across all component slots, ignoring unused slots ('' or '-')
export function compute4MTotals(rows) {
  const totals = {};
  FOUR_M_CATEGORIES.forEach(c => totals[c] = 0);
  rows.forEach(f => {
    for (let n = 1; n <= 4; n++) {
      const val = f['c' + n + '_4m'];
      if (FOUR_M_CATEGORIES.includes(val)) totals[val]++;
    }
  });
  return totals;
}

// Downtime totals: "HH:MM" per failure -> minutes
export function parseDowntimeMinutes(v) {
  const m = /^(\d{1,3}):(\d{2})$/.exec(String(v || '').trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}
export function sumDowntimeMinutes(rows) {
  return rows.reduce((sum, f) => sum + parseDowntimeMinutes(f.downtime), 0);
}
export function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}
export function averageDowntimeBySubsystem(rows) {
  const sums = {};
  const counts = {};
  rows.forEach(f => {
    const match = subsystemBucketFor(f.subSystem);
    if (!match) return;
    sums[match] = (sums[match] || 0) + parseDowntimeMinutes(f.downtime);
    counts[match] = (counts[match] || 0) + 1;
  });
  return Object.keys(counts)
    .map(k => ({ subSystem: k, avgMinutes: Math.round(sums[k] / counts[k]), count: counts[k] }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes);
}

export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- Shared HTML rendering ----------------

export function renderFailureTable(rows, { emptyLabel, showDate = false } = {}) {
  if (!rows.length) return `<p style="color:#666;">${esc(emptyLabel || 'No failures reported.')}</p>`;
  const rowsHtml = rows.map(f => `
    <tr>
      ${showDate ? `<td style="padding:6px 10px;border:1px solid #ddd;">${esc(f.dateReceive)}</td>` : ''}
      <td style="padding:6px 10px;border:1px solid #ddd;">${esc(f.asset)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${esc(f.depoh)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${esc(f.subSystem)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${esc(f.reportByOps || f.reportByDepot)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${esc(f.downtime)}</td>
    </tr>`).join('');
  return `
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead>
        <tr style="background:#f2f2f2;">
          ${showDate ? '<th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Date</th>' : ''}
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Asset</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Depot</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Sub-System</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Reported Defect</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Downtime</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

export function renderRepeatOffenders(rows, { emptyLabel, periodLabel } = {}) {
  if (!rows.length) return `<p style="color:#666;">${esc(emptyLabel || 'No repeat failures found.')}</p>`;
  const items = rows.map(r => `<li>Loco <strong>${esc(r.asset)}</strong> &mdash; ${esc(r.subSystem)}: <strong>${r.count}x</strong> ${esc(periodLabel || 'this period')}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function renderLeaders({ topSubsystem, topAsset, topDepot, prevSubsystemTotals, prevAssetTotals, prevDepotTotals, prevLabel }) {
  const subsystemPrev = topSubsystem ? (prevSubsystemTotals[topSubsystem.key] || 0) : 0;
  const assetPrev = topAsset ? (prevAssetTotals[topAsset.key] || 0) : 0;
  const depotPrev = topDepot ? (prevDepotTotals[topDepot.key] || 0) : 0;
  const trendText = (current, prev) => ` ${trendArrow(current, prev)} <span style="color:#888;">(was ${prev} ${prevLabel})</span>`;
  return `
    <ul>
      <li>Top failing sub-system: <strong>${topSubsystem ? `${esc(topSubsystem.key)} (${topSubsystem.count})` : '&mdash;'}</strong>${topSubsystem ? trendText(topSubsystem.count, subsystemPrev) : ''}</li>
      <li>Top failing locomotive: <strong>${topAsset ? `${esc(topAsset.key)} (${topAsset.count})` : '&mdash;'}</strong>${topAsset ? trendText(topAsset.count, assetPrev) : ''}</li>
      <li>Top depot by failures: <strong>${topDepot ? `${esc(topDepot.key)} (${topDepot.count})` : '&mdash;'}</strong>${topDepot ? trendText(topDepot.count, depotPrev) : ''}</li>
    </ul>`;
}

export function render4M(totals) {
  const entries = FOUR_M_CATEGORIES.map(c => [c, totals[c]]).filter(([, count]) => count > 0);
  if (!entries.length) return '<p style="color:#666;">No root-cause (4M) data logged for this period.</p>';
  const items = entries.map(([c, count]) => `<li>${esc(c)}: <strong>${count}</strong></li>`).join('');
  return `<ul>${items}</ul>`;
}

export function renderDowntime({ totalMinutes, avgBySubsystem, totalLabel }) {
  const bySubsystemRows = avgBySubsystem.map(r => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;">${esc(r.subSystem)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${formatMinutes(r.avgMinutes)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${r.count}</td>
    </tr>`).join('');
  const table = avgBySubsystem.length ? `
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:10px;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Sub-System</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Avg Downtime</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Failures</th>
        </tr>
      </thead>
      <tbody>${bySubsystemRows}</tbody>
    </table>` : '';
  return `
    <p>${esc(totalLabel)}: <strong>${formatMinutes(totalMinutes)}</strong></p>
    ${table}`;
}
