import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {
  requireEnv, fetchAllFailures, formatMYT, shiftMonthKey,
  countableFailures, computeSubsystemTotals, computeAssetTotals, computeDepotTotals, topEntry,
  computeRepeatOffenders, compute4MTotals, sumDowntimeMinutes, averageDowntimeBySubsystem,
  renderFailureTable, renderRepeatOffenders, renderLeaders, render4M, renderDowntime, esc,
} from './lib/failure-analysis.mjs';

const env = requireEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'RECIPIENT_EMAIL']);

const todayStr = formatMYT(new Date());
const yesterdayDate = new Date();
yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
const yesterdayStr = formatMYT(yesterdayDate);
const currentMonthKey = todayStr.slice(0, 7); // YYYY-MM
const previousMonthKey = shiftMonthKey(currentMonthKey, -1);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const allFailures = await fetchAllFailures(supabase);
const countable = countableFailures(allFailures);

const yesterdaysFailures = countable.filter(f => f.dateReceive === yesterdayStr);
const monthToDate = countable.filter(f => (f.dateReceive || '').startsWith(currentMonthKey));
const previousMonth = countable.filter(f => (f.dateReceive || '').startsWith(previousMonthKey));

const subsystemTotals = computeSubsystemTotals(monthToDate);
const assetTotals = computeAssetTotals(monthToDate);
const depotTotals = computeDepotTotals(monthToDate);
const prevSubsystemTotals = computeSubsystemTotals(previousMonth);
const prevAssetTotals = computeAssetTotals(previousMonth);
const prevDepotTotals = computeDepotTotals(previousMonth);

const topSubsystem = topEntry(subsystemTotals);
const topAsset = topEntry(assetTotals);
const topDepot = topEntry(depotTotals);

const repeatOffenders = computeRepeatOffenders(monthToDate);
const fourMTotals = compute4MTotals(monthToDate);
const downtimeYesterdayMinutes = sumDowntimeMinutes(yesterdaysFailures);
const downtimeMonthMinutes = sumDowntimeMinutes(monthToDate);
const avgDowntimeBySubsystem = averageDowntimeBySubsystem(monthToDate);

const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:700px;">
    <h2 style="margin-bottom:4px;">USW Failure Analysis &mdash; ${esc(yesterdayStr)}</h2>
    <p style="margin-top:0;color:#666;">Daily report generated ${esc(todayStr)} 08:30 (Asia/Kuala_Lumpur)</p>

    <h3>Failures reported yesterday (${yesterdaysFailures.length})</h3>
    ${renderFailureTable(yesterdaysFailures, { emptyLabel: 'No failures reported yesterday.' })}

    <h3 style="margin-top:24px;">Repeat failures this month</h3>
    ${renderRepeatOffenders(repeatOffenders, { emptyLabel: 'No asset has failed in the same sub-system more than once this month.', periodLabel: 'this month' })}

    <h3 style="margin-top:24px;">Month-to-date leaders (${esc(currentMonthKey)})</h3>
    ${renderLeaders({ topSubsystem, topAsset, topDepot, prevSubsystemTotals, prevAssetTotals, prevDepotTotals, prevLabel: 'last month' })}

    <h3 style="margin-top:24px;">Root-cause (4M) breakdown &mdash; month-to-date</h3>
    ${render4M(fourMTotals)}

    <h3 style="margin-top:24px;">Downtime</h3>
    ${renderDowntime({ totalMinutes: downtimeYesterdayMinutes, avgBySubsystem: [], totalLabel: 'Downtime yesterday' })}
    ${renderDowntime({ totalMinutes: downtimeMonthMinutes, avgBySubsystem: avgDowntimeBySubsystem, totalLabel: 'Downtime month-to-date' })}
  </div>`;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
});

await transporter.sendMail({
  from: env.GMAIL_USER,
  to: env.RECIPIENT_EMAIL,
  subject: `USW Failure Analysis Report — ${yesterdayStr}`,
  html,
});

console.log(`Report sent to ${env.RECIPIENT_EMAIL} for ${yesterdayStr} (${yesterdaysFailures.length} failures, ${repeatOffenders.length} repeat offenders, month-to-date leaders: subsystem=${topSubsystem?.key ?? 'none'}, asset=${topAsset?.key ?? 'none'}, depot=${topDepot?.key ?? 'none'})`);
