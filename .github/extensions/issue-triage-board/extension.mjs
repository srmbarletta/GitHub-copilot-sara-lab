import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { CanvasError, createCanvas, joinSession } from '@github/copilot-sdk/extension';

const execFileAsync = promisify(execFile);
const servers = new Map();
let session;
const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

async function getIssues() {
    const { stdout } = await execFileAsync('gh', [
        'issue', 'list', '--state', 'open', '--limit', '50',
        '--json', 'number,title,body,url,updatedAt,labels',
    ], { cwd: process.cwd(), maxBuffer: 2_000_000 });
    return JSON.parse(stdout).map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || 'No description provided.',
        url: issue.url,
        updatedAt: issue.updatedAt,
        labels: (issue.labels || []).map((label) => label.name.toLowerCase()),
    }));
}

function prioritize(issues) {
    const urgent = ['critical', 'security', 'urgent', 'blocker', 'priority: high', 'high priority'];
    const bugs = ['bug', 'regression', 'broken'];
    return [...issues].sort((left, right) => {
        const score = (issue) => issue.labels.reduce((total, label) =>
            total + (urgent.includes(label) ? 50 : bugs.includes(label) ? 25 : 0), 0)
            + Math.min(20, Math.max(0, Math.floor((Date.now() - Date.parse(issue.updatedAt)) / 86_400_000)));
        return score(right) - score(left) || left.number - right.number;
    }).map((issue, index) => {
        const signals = issue.labels.filter((label) => [...urgent, ...bugs].includes(label));
        return {
            ...issue,
            reason: signals.length
                ? `Ranked #${index + 1} because it is labeled ${signals.map((label) => `"${label}"`).join(', ')}, which signals immediate risk or user impact.`
                : `Ranked #${index + 1} because it has remained open longer than the other unlabelled issues, making it a timely candidate for triage before the backlog grows.`,
        };
    });
}

function card(issue, priority) {
    return `<article class="card ${priority ? 'priority-card' : ''}">
      <div class="card-top"><span class="number">#${issue.number}</span>${priority ? '<span class="badge">Needs attention</span>' : ''}</div>
      <h3><a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">${escapeHtml(issue.title)}</a></h3>
      <p class="description">${escapeHtml(issue.body)}</p>
      ${priority ? `<p class="reason"><strong>Why it is here:</strong> ${escapeHtml(issue.reason)}</p>` : ''}
      <div class="footer"><span class="labels">${issue.labels.length ? issue.labels.map((label) => `<span class="label">${escapeHtml(label)}</span>`).join('') : 'No labels'}</span>
      <button type="button" data-testid="add-issue-${issue.number}" data-issue="${issue.number}">Add to current context</button></div>
    </article>`;
}

function render(state) {
    if (state.error) return `<!doctype html><html><body><main><h1>Issue triage board</h1><p class="error">${escapeHtml(state.error)}</p></main></body></html>`;
    const priority = state.issues.slice(0, 3);
    const remainder = state.issues.slice(3);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Issue triage board</title>
<style>
:root{color-scheme:light dark;--surface:color-mix(in srgb,var(--background-color-default,#fff) 94%,var(--text-color-default,#1f2328) 6%);--muted:var(--text-color-muted,#59636e)}*{box-sizing:border-box}body{margin:0;background:var(--background-color-default,#fff);color:var(--text-color-default,#1f2328);font:var(--text-body-medium,14px)/var(--leading-body-medium,20px) var(--font-sans,system-ui,sans-serif)}main{max-width:1100px;margin:auto;padding:28px}header{border-bottom:1px solid var(--border-color-default,#d0d7de);margin-bottom:24px;padding-bottom:18px}h1{margin:0;font-size:30px}h2{margin:26px 0 12px;font-size:17px}.lede,.meta{color:var(--muted)}.lede{margin:7px 0 0}.cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.card{background:var(--surface);border:1px solid var(--border-color-default,#d0d7de);border-radius:12px;display:flex;flex-direction:column;padding:16px}.priority-card{border-color:color-mix(in srgb,var(--true-color-orange,#bf8700) 55%,var(--border-color-default,#d0d7de))}.card-top,.footer{align-items:center;display:flex;gap:8px;justify-content:space-between}.number{color:var(--muted);font-family:var(--font-mono,monospace);font-size:12px}.badge{background:var(--true-color-orange-muted,#fff8c5);border-radius:999px;color:var(--true-color-orange,#9a6700);font-size:11px;font-weight:600;padding:2px 8px}h3{font-size:16px;line-height:1.35;margin:10px 0 8px}h3 a{color:inherit}.description{color:var(--muted);display:-webkit-box;line-clamp:5;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;margin:0}.reason{background:color-mix(in srgb,var(--true-color-orange-muted,#fff8c5) 45%,transparent);border-left:3px solid var(--true-color-orange,#bf8700);margin:14px 0 0;padding:8px 10px}.footer{align-items:end;margin-top:18px}.labels{display:flex;flex-wrap:wrap;gap:4px}.label{border:1px solid var(--border-color-default,#d0d7de);border-radius:999px;color:var(--muted);font-size:11px;padding:2px 7px}button{background:var(--true-color-blue,#0969da);border:1px solid var(--true-color-blue,#0969da);border-radius:7px;color:var(--color-white,#fff);cursor:pointer;font:inherit;font-size:12px;font-weight:600;padding:7px 10px;white-space:nowrap}button:focus-visible{outline:2px solid var(--color-focus-outline,#0969da);outline-offset:2px}button:disabled{cursor:wait;opacity:.65}.error{color:var(--true-color-red,#cf222e)}@media(max-width:600px){main{padding:18px}.footer{align-items:start;flex-direction:column}}
</style></head><body><main><header><h1>Issue triage board</h1><p class="lede">Open issues ranked by urgency signals and recent activity. Add any issue to this session's context to start work immediately.</p><p class="meta">${state.issues.length} open issue${state.issues.length === 1 ? '' : 's'} loaded</p></header>
<section aria-labelledby="priority-heading"><h2 id="priority-heading">Top three needing attention</h2><div class="cards">${priority.length ? priority.map((issue) => card(issue, true)).join('') : '<p class="meta">No open issues found.</p>'}</div></section>
${remainder.length ? `<section aria-labelledby="backlog-heading"><h2 id="backlog-heading">Remaining open issues</h2><div class="cards">${remainder.map((issue) => card(issue, false)).join('')}</div></section>` : ''}<p id="status" class="meta" role="status" aria-live="polite"></p></main>
<script>document.querySelectorAll('button[data-issue]').forEach((button)=>button.addEventListener('click',async()=>{button.disabled=true;const status=document.querySelector('#status');status.textContent='Adding issue to the current context…';try{const response=await fetch('/attach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:Number(button.dataset.issue)})});const result=await response.json();if(!response.ok)throw new Error(result.error);status.textContent=result.message;button.textContent='Added to context'}catch(error){status.textContent=error.message;button.disabled=false}}));</script></body></html>`;
}

function body(request) {
    return new Promise((resolve, reject) => {
        let value = '';
        request.on('data', (chunk) => { value += chunk; if (value.length > 10_000) reject(new Error('Request body is too large.')); });
        request.on('end', () => resolve(value));
        request.on('error', reject);
    });
}

async function attachIssue(number, issues) {
    const issue = issues.find((candidate) => candidate.number === number);
    if (!issue) throw new CanvasError('issue_not_found', `Open issue #${number} was not found.`);
    await session.send({ prompt: `Work on GitHub issue #${issue.number}: ${issue.title}\n\nIssue description:\n${issue.body}\n\nIssue URL: ${issue.url}\n\nPlease inspect the repository, explain the likely fix, and begin implementing it.` });
    return { attached: true, issueNumber: issue.number };
}

async function startServer() {
    let issues = [];
    let error;
    try { issues = prioritize(await getIssues()); } catch (cause) {
        error = `Could not load open issues: ${cause.message}`;
        await session.log(error, { level: 'error' });
    }
    const server = createServer(async (request, response) => {
        try {
            if (request.method === 'POST' && request.url === '/attach') {
                const input = JSON.parse(await body(request));
                const number = Number(input.number);
                if (!Number.isInteger(number) || number < 1) throw new CanvasError('invalid_issue_number', 'Issue number must be a positive integer.');
                const result = await attachIssue(number, issues);
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ ...result, message: `Issue #${number} added to the current context.` }));
                return;
            }
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(render({ issues, error }));
        } catch (cause) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: cause.message }));
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return { server, url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/`, issues };
}

session = await joinSession({ canvases: [createCanvas({
    id: 'issue-triage-board',
    displayName: 'Issue triage board',
    description: 'Kanban board that ranks open repository issues and adds a selected issue to the current session context.',
    actions: [{
        name: 'attach_issue',
        description: 'Add an open issue to the current session context and ask the agent to begin work.',
        inputSchema: { type: 'object', properties: { number: { type: 'integer', minimum: 1 } }, required: ['number'], additionalProperties: false },
        handler: async (ctx) => {
            const entry = servers.get(ctx.instanceId);
            if (!entry) throw new CanvasError('canvas_not_open', 'Open the triage board before attaching an issue.');
            return attachIssue(Number(ctx.input.number), entry.issues);
        },
    }],
    open: async (ctx) => {
        let entry = servers.get(ctx.instanceId);
        if (!entry) { entry = await startServer(); servers.set(ctx.instanceId, entry); }
        return { title: 'Issue triage board', url: entry.url };
    },
    onClose: async (ctx) => {
        const entry = servers.get(ctx.instanceId);
        if (entry) { servers.delete(ctx.instanceId); await new Promise((resolve) => entry.server.close(resolve)); }
    },
})] });
