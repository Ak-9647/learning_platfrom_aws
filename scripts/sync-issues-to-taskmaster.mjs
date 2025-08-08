import fs from 'fs';
import path from 'path';

const token = process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPO || process.env.GITHUB_REPOSITORY;
const repoArg = process.argv[2];
const repoFull = repoEnv || repoArg;

if (!token) {
  console.error('Missing GITHUB_TOKEN');
  process.exit(1);
}
if (!repoFull || !repoFull.includes('/')) {
  console.error('Set GITHUB_REPO or pass owner/repo as first arg');
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
  return res.json();
}

async function getAllIssues() {
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

function loadTasks() {
  const tasksPath = path.resolve('.taskmaster/tasks/tasks.json');
  if (!fs.existsSync(tasksPath)) throw new Error(`Tasks file not found at ${tasksPath}`);
  const raw = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
  let tasks = null;
  let container = null;
  if (Array.isArray(raw?.tasks)) {
    tasks = raw.tasks;
    container = raw;
  } else {
    // pick first tag container (master preferred)
    const tag = raw.master ?? Object.values(raw)[0];
    if (!tag || !Array.isArray(tag.tasks)) throw new Error('Invalid Task Master file format');
    tasks = tag.tasks;
    container = tag;
  }
  return { raw, container, tasks, tasksPath: path.resolve('.taskmaster/tasks/tasks.json') };
}

function saveTasks(raw, tasksPath) {
  fs.writeFileSync(tasksPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
}

function parseTaskIdFromTitle(title) {
  // format: [TaskMaster #<id>] Title
  const m = title.match(/\[TaskMaster\s*#(\d+)\]/i);
  return m ? Number(m[1]) : null;
}

function statusFromIssue(issue) {
  if (issue.state === 'closed') return 'done';
  // try to infer from body
  const body = issue.body || '';
  const m = body.match(/Status:\s*(\w[\w-]*)/i);
  if (m) {
    const s = m[1].toLowerCase();
    if (['pending', 'in-progress', 'done', 'review', 'deferred', 'cancelled'].includes(s)) return s;
  }
  return 'pending';
}

async function main() {
  const issues = await getAllIssues();
  const { raw, container, tasks, tasksPath } = loadTasks();

  const byId = new Map(tasks.map(t => [t.id, t]));
  let changes = 0;

  for (const issue of issues) {
    const id = parseTaskIdFromTitle(issue.title);
    if (!id) continue;
    const task = byId.get(id);
    if (!task) continue;

    const desired = statusFromIssue(issue);
    if (task.status !== desired) {
      task.status = desired;
      changes++;
    }
  }

  if (changes > 0) {
    saveTasks(raw, tasksPath);
    console.log(`Updated ${changes} task(s) from GitHub issues.`);
  } else {
    console.log('No task updates needed.');
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
