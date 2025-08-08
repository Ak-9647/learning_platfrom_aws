import fs from 'fs';
import path from 'path';
import process from 'process';

const token = process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPO || process.env.GITHUB_REPOSITORY; // supports Actions default
const repoArg = process.argv[2];
const repoFull = repoEnv || repoArg;
const dryRun = process.env.DRY_RUN === '1';

if (!token) {
  console.error('Missing GITHUB_TOKEN. Create a PAT with repo/issues permissions and export GITHUB_TOKEN.');
  process.exit(1);
}
if (!repoFull || !repoFull.includes('/')) {
  console.error('Set GITHUB_REPO env or pass owner/repo as first arg. Example: Ak-9647/learning_platfrom_aws');
  process.exit(1);
}
const [owner, repo] = repoFull.split('/');

const baseUrl = 'https://api.github.com';

async function gh(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${pathname} failed: ${res.status} ${res.statusText} -> ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function ensureLabel(name, color = '0ea5e9', description = '') {
  try {
    const label = await gh(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
    return label;
  } catch (e) {
    // create
    return gh(`/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      body: { name, color, description }
    });
  }
}

async function getIssuesAllStates() {
  const issues = [];
  let page = 1;
  while (true) {
    const batch = await gh(`/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    issues.push(...batch.filter(i => !i.pull_request));
    page += 1;
  }
  return issues;
}

function buildIssueBody(task, dependencyIssueNumbers = []) {
  const depsLine = dependencyIssueNumbers.length
    ? dependencyIssueNumbers.map(n => `#${n}`).join(', ')
    : (task.dependencies && task.dependencies.length ? `task-ids: ${task.dependencies.join(', ')}` : 'none');

  const subtasks = (task.subtasks || []).map(st => `- [ ] ${st.title || st.description || String(st)}`).join('\n');

  const lines = [
    task.description ? task.description.trim() : '',
    '',
    `Priority: ${task.priority || 'medium'}`,
    `TaskMaster ID: ${task.id}`,
    `Status: ${task.status || 'pending'}`,
    `Dependencies: ${depsLine}`,
  ];
  if (subtasks) {
    lines.push('', 'Subtasks:', subtasks);
  }
  lines.push('', 'Labels: task-master');
  return lines.join('\n');
}

function extractTasks(data) {
  if (Array.isArray(data?.tasks)) return data.tasks;
  const tagKeys = Object.keys(data || {});
  for (const key of tagKeys) {
    const maybeTasks = data[key]?.tasks;
    if (Array.isArray(maybeTasks)) return maybeTasks;
  }
  return null;
}

function desiredLabelsForTask(task) {
  const labels = new Set(['task-master', `priority: ${task.priority || 'medium'}`]);
  return Array.from(labels);
}

async function main() {
  const tasksPath = path.resolve('.taskmaster/tasks/tasks.json');
  if (!fs.existsSync(tasksPath)) {
    console.error(`Tasks file not found at ${tasksPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
  const tasks = extractTasks(raw);
  if (!Array.isArray(tasks)) {
    console.error('Invalid tasks.json format');
    process.exit(1);
  }

  console.log(`Preparing to sync ${tasks.length} issues in ${owner}/${repo} (dryRun=${dryRun})...`);

  // Ensure labels
  const priorityColors = { high: 'ef4444', medium: 'f59e0b', low: '10b981' };
  await ensureLabel('task-master', '3b82f6', 'Created by TaskMaster export');
  for (const p of ['high', 'medium', 'low']) {
    await ensureLabel(`priority: ${p}`, priorityColors[p], `Priority ${p}`);
  }

  const existing = await getIssuesAllStates();
  const existingByTitle = new Map(existing.map(i => [i.title, i]));

  const createdMap = new Map(); // taskId -> issueNumber

  // First pass: create or detect issues
  for (const task of tasks) {
    const title = `[TaskMaster #${task.id}] ${task.title}`;
    const labels = desiredLabelsForTask(task);
    let issue = existingByTitle.get(title);

    if (!issue) {
      const body = buildIssueBody(task);
      if (dryRun) {
        console.log(`DRY: Would create issue: ${title}`);
      } else {
        issue = await gh(`/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          body: { title, body, labels }
        });
        console.log(`Created issue #${issue.number} for task ${task.id}`);
      }
    } else {
      // Update title/body/labels if needed
      if (!dryRun) {
        const dependencyIssueNumbers = (task.dependencies || []) // will be refined in second pass too
          .map(depId => createdMap.get(depId) || null)
          .filter(Boolean);
        const desiredBody = buildIssueBody(task, dependencyIssueNumbers);
        const desiredState = task.status === 'done' ? 'closed' : 'open';
        const currentLabels = new Set((issue.labels || []).map(l => (typeof l === 'string' ? l : l.name)));
        const desired = new Set(labels);
        const labelChanges = Array.from(desired).some(l => !currentLabels.has(l)) || Array.from(currentLabels).some(l => l.startsWith('priority: ') && !desired.has(l));
        const patch = {};
        if (issue.title !== title) patch.title = title;
        if ((issue.body || '').trim() !== desiredBody.trim()) patch.body = desiredBody;
        if (labelChanges) patch.labels = labels;
        if (issue.state !== desiredState) patch.state = desiredState;
        if (Object.keys(patch).length > 0) {
          issue = await gh(`/repos/${owner}/${repo}/issues/${issue.number}`, { method: 'PATCH', body: patch });
          console.log(`Updated issue #${issue.number} for task ${task.id}`);
        } else {
          console.log(`No changes for issue #${issue.number} (task ${task.id})`);
        }
      } else {
        console.log(`DRY: Would update existing issue #${issue.number} for task ${task.id}`);
      }
    }

    if (issue) createdMap.set(task.id, issue.number);
  }

  if (dryRun) {
    console.log('DRY: Skipping dependency updates.');
    return;
  }

  // Second pass: update bodies with real dependency issue numbers and enforce state
  for (const task of tasks) {
    const issueNumber = createdMap.get(task.id) || (existingByTitle.get(`[TaskMaster #${task.id}] ${task.title}`)?.number);
    if (!issueNumber) continue;

    const dependencyIssueNumbers = (task.dependencies || [])
      .map(depId => createdMap.get(depId) || (existingByTitle.get(`[TaskMaster #${depId}] ${tasks.find(t => t.id === depId)?.title}`)?.number))
      .filter(Boolean);

    const current = await gh(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    const desiredBody = buildIssueBody(task, dependencyIssueNumbers);
    const desiredState = task.status === 'done' ? 'closed' : 'open';
    const desiredLabels = desiredLabelsForTask(task);

    const currentLabels = new Set((current.labels || []).map(l => (typeof l === 'string' ? l : l.name)));
    const desired = new Set(desiredLabels);
    const labelChanges = Array.from(desired).some(l => !currentLabels.has(l)) || Array.from(currentLabels).some(l => l.startsWith('priority: ') && !desired.has(l));

    const patch = {};
    if ((current.body || '').trim() !== desiredBody.trim()) patch.body = desiredBody;
    if (current.state !== desiredState) patch.state = desiredState;
    if (labelChanges) patch.labels = desiredLabels;
    if (Object.keys(patch).length > 0) {
      await gh(`/repos/${owner}/${repo}/issues/${issueNumber}`, { method: 'PATCH', body: patch });
      console.log(`Synced issue #${issueNumber} dependencies/state/labels.`);
    }
  }

  console.log('Sync complete.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
