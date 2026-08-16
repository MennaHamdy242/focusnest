import { getState, updateData } from './state.js';
import { uid, todayISO, addDaysISO, formatDate, formatDateTime, escapeHTML, parseTags, priorityRank, isToday, isUpcoming } from './utils.js';
import { cleanupAttachments } from './attachments.js';

export function createTask(payload) {
  const now = new Date().toISOString();
  const task = {
    id: uid('task'), title: payload.title.trim(), description: payload.description?.trim() || '', completed:false,
    important:Boolean(payload.important), favorite:Boolean(payload.favorite), priority:payload.priority || 'medium',
    dueDate:payload.dueDate || '', tags:payload.tags || [], attachments:payload.attachments || [], createdAt:now, updatedAt:now
  };
  updateData(d => d.tasks.unshift(task));
  return task;
}

export function updateTask(id, patch) {
  updateData(d => {
    const task = d.tasks.find(t => t.id === id); if (!task) return;
    Object.assign(task, patch, { updatedAt:new Date().toISOString() });
  });
}

export async function deleteTask(id) {
  const task = getState().data.tasks.find(t => t.id === id);
  if (!task) return;
  await cleanupAttachments(task.attachments || []);
  updateData(d => { d.tasks = d.tasks.filter(t => t.id !== id); });
}

export function toggleTaskComplete(id) {
  const task = getState().data.tasks.find(t => t.id === id);
  if (!task) return;
  const nextCompleted = !task.completed;
  updateData(d => {
    const current = d.tasks.find(t => t.id === id);
    if (!current) return;
    current.completed = nextCompleted;
    current.updatedAt = new Date().toISOString();
    if (nextCompleted) {
      d.settings.focusStreak = Number(d.settings.focusStreak || 0) + 1;
    }
  });
}

export function filterAndSortTasks(tasks, filter, sort) {
  let list = [...tasks];
  switch(filter) {
    case 'active': list = list.filter(t => !t.completed); break;
    case 'completed': list = list.filter(t => t.completed); break;
    case 'high': list = list.filter(t => t.priority === 'high' && !t.completed); break;
    case 'today': list = list.filter(t => isToday(t.dueDate) && !t.completed); break;
    case 'upcoming': list = list.filter(t => isUpcoming(t.dueDate) && !t.completed); break;
  }
  list.sort((a,b) => {
    if (sort === 'priority') return priorityRank(b.priority)-priorityRank(a.priority) || Number(a.completed)-Number(b.completed);
    if (sort === 'created') return new Date(b.createdAt)-new Date(a.createdAt);
    const ad=a.dueDate || '9999-12-31', bd=b.dueDate || '9999-12-31';
    return ad.localeCompare(bd) || (Number(a.completed)-Number(b.completed)) || (new Date(b.createdAt)-new Date(a.createdAt));
  });
  return list;
}

export function taskMarkup(task, attachmentSummary='') {
  const priorityLabel = task.priority[0].toUpperCase()+task.priority.slice(1);
  return `<article class="card task-card ${task.completed ? 'completed':''}" data-task-id="${task.id}">
    <button class="task-check ${task.completed?'checked':''}" type="button" data-task-complete="${task.id}" aria-label="${task.completed?'Mark task active':'Mark task complete'}">${task.completed?'✓':''}</button>
    <div>
      <div class="task-title">${escapeHTML(task.title)}</div>
      ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>`:''}
      <div class="task-meta">
        <span class="badge ${task.priority}">${priorityLabel}</span>
        ${task.dueDate ? `<span class="badge">Due ${escapeHTML(formatDate(task.dueDate))}</span>` : ''}
        ${task.important ? '<span class="badge favorite">★ Important</span>':''}
        ${task.favorite ? '<span class="badge favorite">♡ Favorite</span>':''}
        ${(task.tags||[]).slice(0,3).map(t=>`<span class="badge">#${escapeHTML(t)}</span>`).join('')}
      </div>
      ${attachmentSummary}
    </div>
    <div class="task-actions">
      <button class="small-icon" type="button" data-task-favorite="${task.id}" aria-label="${task.favorite?'Remove from favorites':'Add to favorites'}">${task.favorite?'♥':'♡'}</button>
      <button class="small-icon" type="button" data-task-edit="${task.id}" aria-label="Edit task">✎</button>
      <button class="small-icon" type="button" data-task-delete="${task.id}" aria-label="Delete task">×</button>
    </div>
  </article>`;
}

export function taskAttachmentPreview(task, renderedAttachments='') {
  const images = (task.attachments||[]).filter(a=>a.type==='image');
  const audios = (task.attachments||[]).filter(a=>a.type==='audio');
  if (!images.length && !audios.length) return '';
  return `<div class="attachments">${renderedAttachments || `<span class="badge">${images.length} image${images.length!==1?'s':''}${audios.length ? ` · ${audios.length} audio`:''}</span>`}</div>`;
}
