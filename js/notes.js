import { getState, updateData } from './state.js';
import { uid, formatDateTime, escapeHTML } from './utils.js';
import { cleanupAttachments } from './attachments.js';

export function createNote(payload) {
  const now = new Date().toISOString();
  const note = {
    id: uid('note'), title: payload.title.trim(), content: payload.content || '', tags: payload.tags || [],
    attachments: payload.attachments || [], cover: payload.cover || 'blush', pinned: Boolean(payload.pinned), favorite: Boolean(payload.favorite),
    checklist: Array.isArray(payload.checklist) ? payload.checklist : [], createdAt: now, updatedAt: now
  };
  updateData(d => d.notes.unshift(note));
  return note;
}

export function updateNote(id, patch) {
  updateData(d => {
    const note = d.notes.find(n => n.id === id);
    if (!note) return;
    Object.assign(note, patch, { updatedAt: new Date().toISOString() });
  });
}

export async function deleteNote(id) {
  const note = getState().data.notes.find(n => n.id === id); if (!note) return;
  await cleanupAttachments(note.attachments || []);
  updateData(d => { d.notes = d.notes.filter(n => n.id !== id); });
}

function plainPreview(html='') {
  const box = document.createElement('div');
  box.innerHTML = html;
  return (box.textContent || '').replace(/\s+/g, ' ').trim();
}

export function noteMarkup(note) {
  const preview = plainPreview(note.content) || (note.checklist || []).map(i => i.text).join(' · ') || 'A tiny page waiting for you ✨';
  const attachments = note.attachments?.length ? `<span class="badge">${note.attachments.length} attachment${note.attachments.length !== 1 ? 's' : ''}</span>` : '';
  const checklistDone = (note.checklist || []).filter(i => i.done).length;
  const checklistBadge = note.checklist?.length ? `<span class="badge checklist-badge">✓ ${checklistDone}/${note.checklist.length}</span>` : '';
  const cover = ['blush','sky','lavender','cream','berry'].includes(note.cover) ? note.cover : 'blush';
  const coverArt = {
    blush:'<span class="doodle-bow" aria-hidden="true"><i></i><b></b><em></em></span>',
    sky:'<span class="doodle-cloud" aria-hidden="true"><i></i><b></b></span>',
    lavender:'<span class="doodle-stars" aria-hidden="true">✦  ˚  ✧</span>',
    cream:'<span class="doodle-bunny" aria-hidden="true">◡̈</span>',
    berry:'<span class="doodle-ribbon" aria-hidden="true">♡</span>'
  };
  return `<article class="card note-card note-card--${cover}" data-note-id="${note.id}" data-note-open="${note.id}">
    <div class="note-cover"><span class="note-cover-doodle">${coverArt[cover]}</span><span class="note-cover-tape"></span><span class="note-cover-title">${escapeHTML(note.title || 'Little note')}</span></div>
    ${note.pinned ? '<span class="badge note-pin">📌 Pinned</span>' : ''}
    <div class="task-actions note-actions" style="justify-content:flex-end">
      <button class="small-icon" type="button" data-note-favorite="${note.id}" aria-label="${note.favorite ? 'Remove from favorites' : 'Add to favorites'}">${note.favorite ? '♥' : '♡'}</button>
      <button class="small-icon" type="button" data-note-pin="${note.id}" aria-label="${note.pinned ? 'Unpin note' : 'Pin note'}">📌</button>
      <button class="small-icon" type="button" data-note-edit="${note.id}" aria-label="Edit note">✎</button>
      <button class="small-icon" type="button" data-note-delete="${note.id}" aria-label="Delete note">×</button>
    </div>
    <div class="note-body">
      <h3>${escapeHTML(note.title)}</h3>
      <div class="note-preview">${escapeHTML(preview)}</div>
    </div>
    <div class="note-footer">
      <div class="note-tags">${(note.tags || []).slice(0,3).map(t => `<span class="badge">#${escapeHTML(t)}</span>`).join('')}${attachments}${checklistBadge}</div>
      <span class="badge">${escapeHTML(formatDateTime(note.updatedAt))}</span>
    </div>
  </article>`;
}
