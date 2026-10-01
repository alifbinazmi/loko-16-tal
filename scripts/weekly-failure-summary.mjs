import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {
  requireEnv, fetchAllFailures, formatMYT, shiftDateStr,
  countableFailures, computeSubsystemTotals, computeAssetTotals, computeDepotTotals, topEntry,
  computeRepeatOffenders, compute4MTotals, sumDowntimeMinutes, averageDowntimeBySubsystem,
  renderFailureTable, renderRepeatOffenders, renderLeaders, render4M, renderDowntime, esc,
} from './lib/failure-analysis.mjs';

const env = requireEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'RECIPIENT_EMAIL']);

// Sent Monday mornings — covers the week that just ended: last Monday through yesterday (Sunday).
const todayStr = formatMYT(new Date());
const yesterdayDate = new Date();
yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
const weekEnd = formatMYT(yesterdayDate); // Sunday
const weekStart = shiftDateStr(weekEnd, -6); // Monday, 7 days inclusive

const prevWeekEnd = shiftDateStr(weekStart, -1);
const prevWeekStart = shiftDateStr(prevWeekEnd, -6);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const allFailures = await fetchAllFailures(supabase);
const countable = countableFailures(allFailures);

const weekFailures = countable.filter(f => f.dateReceive >= weekStart && f.dateReceive <= weekEnd);
const prevWeekFailures = countable.filter(f => f.dateReceive >= prevWeekStart && f.dateReceive <= prevWeekEnd);

const subsystemTotals = computeSubsystemTotals(weekFailures);
const assetTotals = computeAssetTotals(weekFailures);
const depotTotals = computeDepotTotals(weekFailures);
const prevSubsystemTotals = computeSubsystemTotals(prevWeekFailures);
const prevAssetTotals = computeAssetTotals(prevWeekFailures);
const prevDepotTotals = computeDepotTotals(prevWeekFailures);

const topSubsystem = topEntry(subsystemTotals);
const topAsset = topEntry(assetTotals);
const topDepot = topEntry(depotTotals);

const repeatOffenders = computeRepeatOffenders(weekFailures);
const fourMTotals = compute4MTotals(weekFailures);
const downtimeWeekMinutes = sumDowntimeMinutes(weekFailures);
const avgDowntimeBySubsystem = averageDowntimeBySubsystem(weekFailures);

const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:700px;">
    <h2 style="margin-bottom:4px;">USW Failure Analysis &mdash; Weekly Summary</h2>
    <p style="margin-top:0;color:#666;">Week of ${esc(weekStart)} to ${esc(weekEnd)} &middot; generated ${esc(todayStr)} 08:30 (Asia/Kuala_Lumpur)</p>

    <h3>Failures this week (${weekFailures.length})</h3>
    ${renderFailureTable(weekFailures, { emptyLabel: 'No failures reported this week.', showDate: true })}

    <h3 style="margin-top:24px;">Repeat failures this week</h3>
    ${renderRepeatOffenders(repeatOffenders, { emptyLabel: 'No asset failed in the same sub-system more than once this week.', periodLabel: 'this week' })}

    <h3 style="margin-top:24px;">Weekly leaders</h3>
    ${renderLeaders({ topSubsystem, topAsset, topDepot, prevSubsystemTotals, prevAssetTotals, prevDepotTotals, prevLabel: 'last week' })}

    <h3 style="margin-top:24px;">Root-cause (4M) breakdown &mdash; this week</h3>
    ${render4M(fourMTotals)}

    <h3 style="margin-top:24px;">Downtime this week</h3>
    ${renderDowntime({ totalMinutes: downtimeWeekMinutes, avgBySubsystem: avgDowntimeBySubsystem, totalLabel: 'Total downtime this week' })}
  </div>`;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
});

await transporter.sendMail({
  from: env.GMAIL_USER,
  to: env.RECIPIENT_EMAIL,
  subject: `USW Failure Analysis — Weekly Summary (${weekStart} to ${weekEnd})`,
  html,
});

console.log(`Weekly summary sent to ${env.RECIPIENT_EMAIL} for ${weekStart}..${weekEnd} (${weekFailures.length} failures, ${repeatOffenders.length} repeat offenders, leaders: subsystem=${topSubsystem?.key ?? 'none'}, asset=${topAsset?.key ?? 'none'}, depot=${topDepot?.key ?? 'none'})`);
