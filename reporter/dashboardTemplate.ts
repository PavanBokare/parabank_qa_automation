import type { ReportData, ReportTestCase } from './reportTypes';

/**
 * Presentation layer of the custom dashboard reporter.
 * Pure function: ReportData -> self-contained HTML string.
 * No file-system access, no Playwright types, no external dependencies.
 */

/** The one and only primary accent color required by the assignment. */
const ACCENT = '#F48031';

/** Escapes dynamic test data before it is interpolated into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Formats milliseconds into a human-readable duration string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

const STATUS_LABELS: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  flaky: 'Flaky',
};

function renderRow(test: ReportTestCase): string {
  const label = STATUS_LABELS[test.status] ?? test.status;
  const errorDetails = test.errorMessage
    ? `<details class="error-details">
          <summary>Show error details</summary>
          <pre>${escapeHtml(test.errorMessage)}${
            test.errorStack ? `\n\n${escapeHtml(test.errorStack)}` : ''
          }</pre>
        </details>`
    : '';

  return `<tr class="test-row" data-status="${test.status}">
        <td><span class="status status-${test.status}"><span class="dot"></span>${label}</span></td>
        <td class="test-title">${escapeHtml(test.title)}${errorDetails}</td>
        <td class="test-file">${escapeHtml(test.file)}</td>
        <td class="num">${formatDuration(test.durationMs)}</td>
        <td class="num">${test.retries}</td>
        <td class="num">${test.workerIndex}</td>
      </tr>`;
}

/** Builds the complete self-contained glassmorphism dashboard HTML. */
export function buildDashboardHtml(data: ReportData): string {
  const { summary, tests } = data;
  const passRate =
    summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;
  const rateWidth =
    summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

  const globalErrorsHtml =
    data.errors && data.errors.length > 0
      ? `<section class="glass errors-card">
          <h2 class="section-title">Run Errors</h2>
          ${data.errors.map((e) => `<pre class="run-error">${escapeHtml(e)}</pre>`).join('')}
        </section>`
      : '';

  const rowsHtml = tests.map(renderRow).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ParaBank QA — Test Execution Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      color: #E5E7EB;
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 45%, #3B2010 100%);
      background-attachment: fixed;
    }

    /* ---------- Header (accent: #F48031) ---------- */
    .dashboard-header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 32px;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    }
    .brand { color: ${ACCENT}; font-size: 20px; font-weight: 700; letter-spacing: 0.4px; }
    .brand small { display: block; color: #94A3B8; font-size: 12px; font-weight: 500; letter-spacing: 0; margin-top: 3px; }
    .run-status {
      padding: 7px 16px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: 1px solid ${ACCENT};
      color: ${ACCENT};
      background: rgba(244, 128, 49, 0.14);
    }
    .run-status.failed { border-color: #EF4444; color: #EF4444; background: rgba(239, 68, 68, 0.14); }

    .container { max-width: 1240px; margin: 0 auto; padding: 28px 32px 56px; }
    /* ---------- Glassmorphism summary cards ---------- */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
      gap: 18px;
      margin-bottom: 26px;
    }
    .card {
      position: relative;
      overflow: hidden;
      padding: 18px 20px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: rgba(255, 255, 255, 0.18);
    }
    .card .label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #94A3B8;
      margin-bottom: 8px;
    }
    .card .value { font-size: 30px; font-weight: 700; line-height: 1; color: #F8FAFC; }
    .card.total::before { background: #64748B; }
    .card.passed::before { background: ${ACCENT}; }
    .card.passed .value { color: ${ACCENT}; }
    .card.failed::before { background: #EF4444; }
    .card.failed .value { color: #EF4444; }
    .card.skipped::before { background: #9CA3AF; }
    .card.skipped .value { color: #9CA3AF; }
    .card.flaky::before { background: #EAB308; }
    .card.flaky .value { color: #EAB308; }

    /* ---------- Pass-rate bar (passing indicator: #F48031) ---------- */
    .rate-card { margin-bottom: 26px; }
    .rate-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #94A3B8; margin-bottom: 10px; }
    .rate-head strong { color: ${ACCENT}; }
    .rate-track { height: 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
    .rate-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, ${ACCENT}, #FFA45C); box-shadow: 0 0 12px rgba(244, 128, 49, 0.55); }

    /* ---------- Tabs (active tab: #F48031) ---------- */
    .tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .tab {
      cursor: pointer;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      color: #CBD5E1;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: all 0.15s ease;
    }
    .tab:hover { border-color: rgba(244, 128, 49, 0.5); }
    .tab.active {
      color: ${ACCENT};
      background: rgba(244, 128, 49, 0.16);
      border-color: ${ACCENT};
      box-shadow: 0 0 14px rgba(244, 128, 49, 0.35);
    }
    /* ---------- Results table ---------- */
    .glass {
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.13);
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }
    .section-title { color: ${ACCENT}; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; padding: 16px 20px 0; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #94A3B8;
      padding: 14px 18px;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }
    tbody td { padding: 13px 18px; font-size: 13.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
    .num { text-align: right; font-variant-numeric: tabular-nums; color: #CBD5E1; }
    th.num { text-align: right; }
    .test-file { color: #94A3B8; font-size: 12.5px; }
    .test-title { font-weight: 600; color: #F1F5F9; }

    /* ---------- Status indicators (passing = #F48031, never for failures) ---------- */
    .status { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
    .status-passed { color: ${ACCENT}; }
    .status-passed .dot { background: ${ACCENT}; box-shadow: 0 0 9px rgba(244, 128, 49, 0.85); }
    .status-failed { color: #EF4444; }
    .status-failed .dot { background: #EF4444; box-shadow: 0 0 9px rgba(239, 68, 68, 0.85); }
    .status-skipped { color: #9CA3AF; }
    .status-skipped .dot { background: #9CA3AF; }
    .status-flaky { color: #EAB308; }
    .status-flaky .dot { background: #EAB308; box-shadow: 0 0 9px rgba(234, 179, 8, 0.7); }

    /* ---------- Errors ---------- */
    .error-details { margin-top: 8px; }
    .error-details summary { cursor: pointer; font-size: 12px; font-weight: 600; color: #EF4444; }
    .error-details pre, .run-error {
      white-space: pre-wrap;
      word-break: break-word;
      margin-top: 8px;
      padding: 12px;
      border-radius: 10px;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
      color: #FCA5A5;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.35);
    }
    .errors-card { margin-bottom: 22px; padding-bottom: 16px; }
    .run-error { margin: 12px 20px 0; }

    .empty { padding: 34px; text-align: center; color: #94A3B8; font-size: 14px; }
    footer { margin-top: 26px; text-align: center; color: #64748B; font-size: 12px; }
  </style>
</head>
<body>
  <header class="dashboard-header">
    <div class="brand">
      ParaBank QA — Execution Dashboard
      <small>Playwright + TypeScript · custom glassmorphism report</small>
    </div>
    <div class="run-status ${summary.status === 'passed' ? '' : 'failed'}">${escapeHtml(summary.status)}</div>
  </header>

  <main class="container">
    <section class="cards">
      <div class="card total"><div class="label">Total Tests</div><div class="value">${summary.total}</div></div>
      <div class="card passed"><div class="label">Passed</div><div class="value">${summary.passed}</div></div>
      <div class="card failed"><div class="label">Failed</div><div class="value">${summary.failed}</div></div>
      <div class="card skipped"><div class="label">Skipped</div><div class="value">${summary.skipped}</div></div>
      <div class="card flaky"><div class="label">Flaky</div><div class="value">${summary.flaky}</div></div>
      <div class="card"><div class="label">Duration</div><div class="value">${formatDuration(summary.durationMs)}</div></div>
    </section>
    <section class="glass rate-card">
      <div style="padding: 16px 20px 18px;">
        <div class="rate-head">
          <span>Pass Rate</span>
          <strong>${passRate}%</strong>
        </div>
        <div class="rate-track"><div class="rate-fill" style="width: ${rateWidth}%;"></div></div>
        <div class="rate-head" style="margin-top: 12px; text-transform: none; letter-spacing: 0.3px;">
          <span>Started ${escapeHtml(summary.startedAt)}</span>
          <span>Finished ${escapeHtml(summary.finishedAt)} · ${summary.workers} worker(s) · test time ${formatDuration(summary.totalTestTimeMs)}</span>
        </div>
      </div>
    </section>

    <nav class="tabs">
      <button class="tab active" data-filter="all">All (${summary.total})</button>
      <button class="tab" data-filter="passed">Passed (${summary.passed})</button>
      <button class="tab" data-filter="failed">Failed (${summary.failed})</button>
      <button class="tab" data-filter="skipped">Skipped (${summary.skipped})</button>
    </nav>

    <section class="glass">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Test</th>
            <th>Spec File</th>
            <th class="num">Duration</th>
            <th class="num">Retries</th>
            <th class="num">Worker</th>
          </tr>
        </thead>
        <tbody id="test-rows">
      ${rowsHtml || '<tr><td colspan="6" class="empty">No tests were executed.</td></tr>'}
        </tbody>
      </table>
    </section>

    ${globalErrorsHtml}

    <footer>Generated by GlassDashboardReporter · self-contained HTML (inline CSS + vanilla JS)</footer>
  </main>

  <script>
    (function () {
      var tabs = document.querySelectorAll('.tab');
      var rows = document.querySelectorAll('#test-rows .test-row');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          var filter = tab.getAttribute('data-filter');
          rows.forEach(function (row) {
            var status = row.getAttribute('data-status');
            var match = filter === 'all'
              || status === filter
              || (filter === 'passed' && status === 'flaky');
            row.style.display = match ? '' : 'none';
          });
        });
      });
    })();
  </script>
</body>
</html>`;
}
