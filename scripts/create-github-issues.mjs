import fs from 'fs';
import path from 'path';
import process from 'process';

const token = process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPO;
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

async function getOpenIssues() {
  const issues = [];
  let page = 1;
  while (true) {
    const batch = await gh(`/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`);
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
    `Dependencies: ${depsLine}`,
  ];
  if (subtasks) {
    lines.push('', 'Subtasks:', subtasks);
  }
  lines.push('', 'Labels: task-master');
  return lines.join('\n');
}

async function main() {
  const tasksPath = path.resolve('.taskmaster/tasks/tasks.json');
  if (!fs.existsSync(tasksPath)) {
    console.error(`Tasks file not found at ${tasksPath}`);
    process.exit(1);
  }
  const { tasks } = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
  if (!Array.isArray(tasks)) {
    console.error('Invalid tasks.json format');
    process.exit(1);
  }

  console.log(`Preparing to create/update ${tasks.length} issues in ${owner}/${repo} (dryRun=${dryRun})...`);

  // Ensure labels
  const priorityColors = { high: 'ef4444', medium: 'f59e0b', low: '10b981' };
  await ensureLabel('task-master', '3b82f6', 'Created by TaskMaster export');
  for (const p of ['high', 'medium', 'low']) {
    await ensureLabel(`priority: ${p}`, priorityColors[p], `Priority ${p}`);
  }

  const existing = await getOpenIssues();
  const existingByTitle = new Map(existing.map(i => [i.title, i]));

  const createdMap = new Map(); // taskId -> issueNumber

  // First pass: create or detect issues
  for (const task of tasks) {
    const title = `[TaskMaster #${task.id}] ${task.title}`;
    const labels = ['task-master', `priority: ${task.priority || 'medium'}`];
    let issue;
    if (existingByTitle.has(title)) {
      issue = existingByTitle.get(title);
      createdMap.set(task.id, issue.number);
      console.log(`Found existing issue #${issue.number} for task ${task.id}`);
      continue;
    }
    const body = buildIssueBody(task);
    if (dryRun) {
      console.log(`DRY: Would create issue: ${title}`);
      continue;
    }
    issue = await gh(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: { title, body, labels }
    });
    createdMap.set(task.id, issue.number);
    console.log(`Created issue #${issue.number} for task ${task.id}`);
  }

  if (dryRun) {
    console.log('DRY: Skipping dependency updates.');
    return;
  }

  // Second pass: update bodies with real dependency issue numbers
  for (const task of tasks) {
    const issueNumber = createdMap.get(task.id);
    if (!issueNumber) continue; // existed but not created in this run

    const dependencyIssueNumbers = (task.dependencies || [])
      .map(depId => createdMap.get(depId))
      .filter(Boolean);

    // Fetch current body (could be existing issue)
    const current = await gh(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    const updatedBody = buildIssueBody(task, dependencyIssueNumbers);

    if (current.body && current.body.trim() === updatedBody.trim()) {
      continue; // no change
    }

    await gh(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      body: { body: updatedBody }
    });
    console.log(`Updated issue #${issueNumber} dependencies.`);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
