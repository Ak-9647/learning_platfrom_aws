import fs from 'fs';
import path from 'path';

const tasksPath = path.resolve('.taskmaster/tasks/tasks.json');

function extractTasks(data) {
  if (Array.isArray(data?.tasks)) return data.tasks;
  for (const key of Object.keys(data || {})) {
    if (Array.isArray(data[key]?.tasks)) return data[key].tasks;
  }
  return null;
}

function validate(tasks) {
  const errors = [];
  const allowedPriorities = new Set(['high', 'medium', 'low']);
  const allowedStatus = new Set(['pending', 'in-progress', 'done', 'review', 'deferred', 'cancelled']);

  if (!Array.isArray(tasks) || tasks.length === 0) {
    errors.push('No tasks found.');
    return errors;
  }

  const seenIds = new Set();
  for (const t of tasks) {
    if (typeof t.id !== 'number') errors.push(`Task missing numeric id: ${JSON.stringify(t)}`);
    else if (seenIds.has(t.id)) errors.push(`Duplicate task id: ${t.id}`);
    else seenIds.add(t.id);

    if (!t.title || typeof t.title !== 'string') errors.push(`Task ${t.id} missing title`);
    if (!t.description || typeof t.description !== 'string') errors.push(`Task ${t.id} missing description`);

    if (!allowedPriorities.has(t.priority)) errors.push(`Task ${t.id} has invalid priority: ${t.priority}`);
    if (t.status && !allowedStatus.has(t.status)) errors.push(`Task ${t.id} has invalid status: ${t.status}`);

    if (t.dependencies && !Array.isArray(t.dependencies)) errors.push(`Task ${t.id} dependencies must be array`);
    if (t.subtasks && !Array.isArray(t.subtasks)) errors.push(`Task ${t.id} subtasks must be array`);
  }

  return errors;
}

function main() {
  if (!fs.existsSync(tasksPath)) {
    console.error(`Tasks file not found at ${tasksPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
  const tasks = extractTasks(raw);
  const errors = validate(tasks || []);
  if (errors.length) {
    console.error('Task validation failed with errors:');
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log('Task validation passed.');
}

main();
