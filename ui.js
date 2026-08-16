import { escapeHTML, parseTags, formatDuration } from './utils.js';
import { loadAttachmentUrl, storeFile } from './attachments.js';
import { AudioRecorder } from './audio.js';
import { createTask, updateTask, deleteTask } from './tasks.js';
import { createNote, updateNote, deleteNote } from './notes.js';

const modalRoot = document.getElementById('modalRoot');
let recorder = null;
let pendingAttachments = [];
let pendingObjectUrls = [];
let autosaveTimer = null;

export function toast(message, type='info') {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3300);
}

export function closeModal() {
  try { recorder?.cancel(); } catch {}
  recorder = null;
  clearTimeout(autosaveTimer);
  pendingObjectUrls.forEach(URL.revokeObjectURL);
  pendingObjectUrls = [];
  pendingAttachments = [];
  modalRoot.innerHTML = '';
  document.body.style.overflow = '';
}

function openModal(title, bodyHTML, footerHTML='') {
  closeModal();
  modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head"><div><h2 id="modalTitle">${escapeHTML(title)}</h2><span class="autosave-status" id="autosaveStatus"></span></div><button class="icon-btn close" type="button" data-close-modal aria-label="Close">×</button></div>
      ${bodyHTML}
      <div class="modal-footer">${footerHTML}</div>
    </div></div>`;
  modalRoot.querySelector('.modal-backdrop').addEventListener('click', e => { if (e.target.hasAttribute('data-close-modal')) closeModal(); });
  document.body.style.overflow = 'hidden';
}

async function handleImageFiles(files, listEl) {
  for (const file of files) {
    try {
      if (!file.type.startsWith('image/')) throw new Error('Only image files are accepted.');
      const stored = await storeFile(file, 'image');
      pendingAttachments.push(stored);
      renderPending(listEl);
      toast('Photo added ✨');
    } catch (e) { toast(e.message || 'Could not add image.', 'error'); }
  }
}

async function handleAudioFile(file, listEl) {
  try {
    if (!file?.type?.startsWith('audio/')) throw new Error('Please choose an audio file.');
    const stored = await storeFile(file, 'audio');
    pendingAttachments.push(stored);
    renderPending(listEl);
    toast('Audio added 🎧');
  } catch (e) { toast(e.message || 'Could not add audio.', 'error'); }
}

function renderPending(listEl) {
  if (!listEl) return;
  listEl.innerHTML = pendingAttachments.map((a, idx) => a.type === 'image'
    ? `<div class="pending-item"><img class="pending-thumb" data-pending-image="${a.id}" alt="Selected image"><div class="pending-main"><div class="pending-name">Photo ${idx + 1}</div><div class="pending-meta">Ready to save</div></div><button class="remove-pending" type="button" data-pending-remove="${a.id}" aria-label="Remove image">×</button></div>`
    : `<div class="pending-item"><div class="pending-icon">🎙️</div><div class="pending-main"><div class="pending-name">${escapeHTML(a.name)}</div><div class="pending-meta">Audio ready</div><audio controls preload="metadata" data-pending-audio="${a.id}"></audio></div><button class="remove-pending" type="button" data-pending-remove="${a.id}" aria-label="Remove audio">×</button></div>`
  ).join('');
  pendingAttachments.forEach(async a => {
    const url = await loadAttachmentUrl(a.id);
    if (!url) return;
    if (a.type === 'image') { const img = listEl.querySelector(`[data-pending-image="${a.id}"]`); if (img) { img.src = url; pendingObjectUrls.push(url); } }
    if (a.type === 'audio') { const audio = listEl.querySelector(`[data-pending-audio="${a.id}"]`); if (audio) { audio.src = url; pendingObjectUrls.push(url); } }
  });
}

function attachmentUI(containerId) {
  return `<div class="field"><div class="field-label-row"><label>Attachments</label><span class="field-hint">Stored privately on this device</span></div>
    <div class="attachment-picker">
      <button type="button" class="picker-btn" data-add-image="${containerId}">＋ Photos</button>
      <button type="button" class="picker-btn" data-capture-image="${containerId}">📷 Camera</button>
      <button type="button" class="picker-btn" data-add-audio="${containerId}">🎧 Audio</button>
      <button type="button" class="picker-btn accent" data-record-audio="${containerId}">🎙️ Record</button>
    </div><div class="attachment-preview-list" id="${containerId}"></div></div>`;
}

function wireAttachmentControls(root, listId) {
  const listEl = root.querySelector(`#${listId}`);
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.hidden = true; root.appendChild(input);
  root.querySelector(`[data-add-image="${listId}"]`).onclick = () => input.click();
  input.onchange = () => handleImageFiles(input.files, listEl);
  const camera = document.createElement('input'); camera.type = 'file'; camera.accept = 'image/*'; camera.capture = 'environment'; camera.hidden = true; root.appendChild(camera);
  root.querySelector(`[data-capture-image="${listId}"]`).onclick = () => camera.click();
  camera.onchange = () => handleImageFiles(camera.files, listEl);
  const audio = document.createElement('input'); audio.type = 'file'; audio.accept = 'audio/*'; audio.hidden = true; root.appendChild(audio);
  root.querySelector(`[data-add-audio="${listId}"]`).onclick = () => audio.click();
  audio.onchange = () => handleAudioFile(audio.files?.[0], listEl);
  root.querySelector(`[data-record-audio="${listId}"]`).onclick = async () => startRecording(listEl);
  listEl.addEventListener('click', async e => {
    const btn = e.target.closest('[data-pending-remove]'); if (!btn) return;
    const id = btn.dataset.pendingRemove;
    try { const { removeAttachment } = await import('./attachments.js'); await removeAttachment(id); } catch {}
    pendingAttachments = pendingAttachments.filter(a => a.id !== id);
    renderPending(listEl); toast('Attachment removed.');
  });
}

async function startRecording(listEl) {
  try {
    recorder?.cancel(); recorder = new AudioRecorder();
    const box = document.createElement('div');
    box.className = 'recording-box';
    box.innerHTML = `<div class="recording-top"><span class="recording-dot"></span><div><strong>Recording your voice</strong><small>Speak naturally — you can listen before saving.</small></div><strong id="recordingTime">0:00</strong></div><div class="recording-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><button class="btn danger" type="button" id="stopRecording">Stop recording</button>`;
    listEl.prepend(box);
    await recorder.start(sec => { const el = box.querySelector('#recordingTime'); if (el) el.textContent = formatDuration(sec); });
    box.querySelector('#stopRecording').onclick = async () => {
      try { const saved = await recorder.stop(); pendingAttachments.push(saved); box.remove(); renderPending(listEl); toast('Voice note ready 💕'); }
      catch (e) { box.remove(); toast(e.message, 'error'); }
    };
  } catch (e) { toast(e.message || 'Microphone permission was denied.', 'error'); }
}

function richToolbar(targetId) {
  return `<div class="editor-toolbar" role="toolbar" aria-label="Text formatting">
    <button type="button" data-format="bold" data-target="${targetId}" aria-label="Bold"><strong>B</strong></button>
    <button type="button" data-format="italic" data-target="${targetId}" aria-label="Italic"><em>I</em></button>
    <button type="button" data-format="underline" data-target="${targetId}" aria-label="Underline"><u>U</u></button>
    <button type="button" data-format="insertUnorderedList" data-target="${targetId}" aria-label="Bulleted list">• List</button>
    <button type="button" data-format="formatBlock:h2" data-target="${targetId}" aria-label="Heading">H2</button>
    <button type="button" data-format="removeFormat" data-target="${targetId}" aria-label="Clear formatting">Clear</button>
  </div>`;
}

function checklistMarkup(items=[]) {
  return items.map((item, index) => `<div class="check-editor-row" data-check-row="${index}"><input type="checkbox" data-check-done="${index}" ${item.done ? 'checked' : ''}><input class="input" data-check-text="${index}" value="${escapeHTML(item.text)}"><button type="button" class="small-icon" data-check-remove="${index}" aria-label="Remove checklist item">×</button></div>`).join('');
}

function readChecklist(root) {
  return [...root.querySelectorAll('.check-editor-row')].map(row => ({
    text: row.querySelector('[data-check-text]')?.value.trim() || '',
    done: Boolean(row.querySelector('[data-check-done]')?.checked)
  })).filter(item => item.text);
}

function setupChecklist(root, initial=[]) {
  const box = root.querySelector('#checklistEditor');
  box.innerHTML = checklistMarkup(initial);
  root.querySelector('#addChecklistItem').onclick = () => {
    const items = readChecklist(root);
    items.push({ text: '', done: false });
    box.innerHTML = checklistMarkup(items);
    box.lastElementChild?.querySelector('input[type="text"], input:not([type="checkbox"])')?.focus();
    scheduleNoteAutosave(root);
  };
  box.addEventListener('click', e => {
    const remove = e.target.closest('[data-check-remove]');
    if (!remove) return;
    remove.closest('.check-editor-row')?.remove();
    scheduleNoteAutosave(root);
  });
}

function scheduleNoteAutosave(root) {
  const noteId = root.dataset.noteId;
  if (!noteId) return;
  clearTimeout(autosaveTimer);
  const status = root.querySelector('#autosaveStatus');
  if (status) status.textContent = 'Saving…';
  autosaveTimer = setTimeout(() => {
    const title = root.querySelector('#noteTitle').value.trim();
    const content = root.querySelector('#noteContent').innerHTML;
    const checklist = readChecklist(root);
    updateNote(noteId, {
      title: title || 'Untitled note', content,
      tags: parseTags(root.querySelector('#noteTags').value),
      pinned: root.querySelector('#notePinned').checked,
      favorite: root.querySelector('#noteFavorite').checked,
      cover: root.querySelector('#noteCover')?.value || 'blush',
      checklist,
      attachments: pendingAttachments
    });
    if (status) status.textContent = 'Saved just now';
  }, 650);
}

export async function showTaskEditor(task=null) {
  pendingAttachments = [...(task?.attachments || [])];
  const listId = `taskAttach_${Date.now()}`;
  const body = `<form id="taskForm" class="form-grid">
    <div class="field"><label for="taskTitle">Title</label><input id="taskTitle" class="input" required maxlength="120" value="${escapeHTML(task?.title || '')}" placeholder="What needs to get done?"></div>
    <div class="field"><label for="taskDesc">Description</label><textarea id="taskDesc" class="textarea" maxlength="2000" placeholder="Add context, details, or notes…">${escapeHTML(task?.description || '')}</textarea></div>
    <div class="form-row"><div class="field"><label for="taskPriority">Priority</label><select id="taskPriority" class="input"><option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Low</option><option value="medium" ${!task || task?.priority === 'medium' ? 'selected' : ''}>Medium</option><option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option></select></div><div class="field"><label for="taskDue">Due date</label><input id="taskDue" class="input" type="date" value="${task?.dueDate || ''}"></div></div>
    <div class="field"><label for="taskTags">Tags</label><input id="taskTags" class="input" value="${escapeHTML((task?.tags || []).join(', '))}" placeholder="study, javascript, personal"></div>
    <div class="checkbox-row"><input id="taskImportant" type="checkbox" ${task?.important ? 'checked' : ''}><label for="taskImportant">Mark as important</label></div>
    <div class="checkbox-row"><input id="taskFavorite" type="checkbox" ${task?.favorite ? 'checked' : ''}><label for="taskFavorite">Add to favorites</label></div>
    ${attachmentUI(listId)}
  </form>`;
  openModal(task ? 'Edit task' : 'New task', body, `<button type="button" class="btn" data-close-modal>Cancel</button><button type="submit" form="taskForm" class="btn primary">${task ? 'Save changes' : 'Create task'}</button>`);
  const root = modalRoot.querySelector('.modal'); wireAttachmentControls(root, listId); renderPending(root.querySelector(`#${listId}`));
  root.querySelector('#taskForm').onsubmit = e => {
    e.preventDefault(); const title = root.querySelector('#taskTitle').value.trim(); if (!title) { toast('Give the task a title first.', 'error'); return; }
    const payload = { title, description: root.querySelector('#taskDesc').value, priority: root.querySelector('#taskPriority').value, dueDate: root.querySelector('#taskDue').value, tags: parseTags(root.querySelector('#taskTags').value), important: root.querySelector('#taskImportant').checked, favorite: root.querySelector('#taskFavorite').checked, attachments: pendingAttachments };
    if (task) updateTask(task.id, payload); else createTask(payload);
    closeModal(); toast(task ? 'Task updated ✨' : 'Task created 💗');
  };
}

export async function showNoteEditor(note=null) {
  pendingAttachments = [...(note?.attachments || [])];
  const listId = `noteAttach_${Date.now()}`;
  const content = note?.content || '';
  const body = `<form id="noteForm" class="form-grid" data-note-id="${note?.id || ''}">
    <div class="field"><label for="noteTitle">Title</label><input id="noteTitle" class="input title-input" required maxlength="160" value="${escapeHTML(note?.title || '')}" placeholder="Give your idea a beautiful name…"></div>
    <div class="field"><div class="field-label-row"><label>Note</label><span class="field-hint">Changes auto-save when editing an existing note</span></div>${richToolbar('noteContent')}<div id="noteContent" class="rich-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write freely…">${content}</div></div>
    <div class="field"><div class="field-label-row"><label>Checklist</label><button type="button" class="mini-add" id="addChecklistItem">＋ Add item</button></div><div id="checklistEditor" class="checklist-editor"></div></div>
    <div class="field"><div class="field-label-row"><label for="noteCover">Notebook style</label><span class="field-hint">Pick a little mood 🎀</span></div><div class="cover-picker" id="noteCoverPicker">${[['blush','🌷','Blush'],['sky','☁️','Sky'],['lavender','✦','Dream'],['cream','🎀','Ribbon'],['berry','🌸','Berry']].map(([v,i,l]) => `<button type="button" class="cover-choice ${v === (note?.cover || 'blush') ? 'active' : ''}" data-cover-choice="${v}"><span class="cover-choice-art ${v}">${i}</span><b>${l}</b></button>`).join('')}</div><input id="noteCover" type="hidden" value="${escapeHTML(note?.cover || 'blush')}"></div>
    <div class="field"><label for="noteTags">Tags</label><input id="noteTags" class="input" value="${escapeHTML((note?.tags || []).join(', '))}" placeholder="idea, project, study"></div>
    <div class="checkbox-row"><input id="notePinned" type="checkbox" ${note?.pinned ? 'checked' : ''}><label for="notePinned">Pin this note</label></div>
    <div class="checkbox-row"><input id="noteFavorite" type="checkbox" ${note?.favorite ? 'checked' : ''}><label for="noteFavorite">Add to favorites</label></div>
    ${attachmentUI(listId)}
  </form>`;
  openModal(note ? 'Edit note' : 'New note', body, `<button type="button" class="btn" data-close-modal>Cancel</button><button type="submit" form="noteForm" class="btn primary">${note ? 'Save changes' : 'Save note'}</button>`);
  const root = modalRoot.querySelector('.modal');
  root.dataset.noteId = note?.id || '';
  wireAttachmentControls(root, listId); renderPending(root.querySelector(`#${listId}`));
  setupChecklist(root, note?.checklist || []);

  root.querySelectorAll('[data-cover-choice]').forEach(button => button.addEventListener('click', () => { const value=button.dataset.coverChoice; root.querySelector('#noteCover').value=value; root.querySelectorAll('[data-cover-choice]').forEach(x=>x.classList.toggle('active',x===button)); scheduleNoteAutosave(root); }));

  root.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
    const [command, value] = button.dataset.format.split(':');
    root.querySelector('#noteContent').focus();
    document.execCommand(command, false, value || null);
    scheduleNoteAutosave(root);
  }));

  root.addEventListener('input', e => {
    if (e.target.closest('#noteForm')) scheduleNoteAutosave(root);
  });
  root.querySelector('#noteForm').dataset.noteId = note?.id || '';
  root.querySelector('#noteForm').onsubmit = e => {
    e.preventDefault();
    const title = root.querySelector('#noteTitle').value.trim();
    if (!title) { toast('Give the note a title first.', 'error'); return; }
    const payload = {
      title,
      content: root.querySelector('#noteContent').innerHTML,
      tags: parseTags(root.querySelector('#noteTags').value),
      pinned: root.querySelector('#notePinned').checked,
      favorite: root.querySelector('#noteFavorite').checked,
      cover: root.querySelector('#noteCover')?.value || 'blush',
      attachments: pendingAttachments,
      checklist: readChecklist(root)
    };
    if (note) updateNote(note.id, payload); else createNote(payload);
    closeModal(); toast(note ? 'Note updated ✨' : 'Note saved 💗');
  };
}

export async function showDeleteConfirm(kind, id, label) {
  const action = kind === 'task' ? deleteTask : deleteNote;
  openModal(`Delete ${kind}`, `<p class="muted">Delete <strong>${escapeHTML(label)}</strong>? This also removes its local attachments.</p>`, `<button class="btn" type="button" data-close-modal>Cancel</button><button class="btn danger" type="button" id="confirmDelete">Delete</button>`);
  modalRoot.querySelector('#confirmDelete').onclick = async () => { try { await action(id); closeModal(); toast(`${kind[0].toUpperCase() + kind.slice(1)} deleted.`); } catch (e) { toast(e.message, 'error'); } };
}

export async function showImageViewer(id) {
  const url = await loadAttachmentUrl(id); if (!url) { toast('That image is no longer available.', 'error'); return; }
  modalRoot.innerHTML = `<div class="modal-backdrop image-viewer" data-close-modal><div class="modal"><div class="modal-head"><button class="icon-btn close" type="button" data-close-modal aria-label="Close">×</button></div><img class="fullscreen-image" src="${url}" alt="Attached image"></div></div>`;
  modalRoot.querySelector('.modal-backdrop').addEventListener('click', e => { if (e.target.hasAttribute('data-close-modal')) closeModal(); });
  document.body.style.overflow = 'hidden';
}

export function showThemePicker(current='system', onChange, currentSkin='sakura', onSkinChange) {
  const skins = [
    {id:'sakura',name:'Sakura Diary',sub:'pink paper + little flowers',cls:'skin-sakura'},
    {id:'clouds',name:'Cloudy Dream',sub:'powder blue + dreamy sky',cls:'skin-clouds'},
    {id:'strawberry',name:'Strawberry Milk',sub:'soft blush + coquette',cls:'skin-strawberry'},
    {id:'twilight',name:'Twilight Garden',sub:'lavender + midnight blue',cls:'skin-twilight'}
  ];
  openModal('Make it yours ✨', `<div class="theme-picker luxe-picker"><p class="muted">Pick the mood, then pick the lighting. You can change it anytime. 🎀</p><div class="skin-grid">${skins.map(x=>`<button type="button" class="skin-option ${x.id===currentSkin?'active':''} ${x.cls}" data-skin="${x.id}"><span class="skin-preview"></span><span class="skin-copy"><strong>${x.name}</strong><small>${x.sub}</small></span><i>♡</i></button>`).join('')}</div><div class="theme-divider"><span>Lighting</span></div><div class="theme-options">${['light','dark','system'].map(t => `<button type="button" class="theme-option ${t === current ? 'active' : ''}" data-theme="${t}"><span class="theme-swatch ${t}"></span><strong>${t[0].toUpperCase()+t.slice(1)}</strong><small>${t === 'light' ? 'Soft & airy' : t === 'dark' ? 'Cozy & calm' : 'Follow your phone'}</small></button>`).join('')}</div><div class="mascot-note"><img src="https://i.pinimg.com/736x/01/84/6a/01846a4dc8c3d6d9f738a638482cb4c0.jpg" alt="Cute bunny" loading="lazy"><div><strong>Your little FocusNest bunny 🐰</strong><small>Same mascot across the app for a more cohesive identity.</small></div></div></div>`, `<button type="button" class="btn primary" data-close-modal>Save the vibe ✨</button>`);
  modalRoot.querySelectorAll('[data-theme]').forEach(btn => btn.onclick = () => { modalRoot.querySelectorAll('[data-theme]').forEach(x => x.classList.remove('active')); btn.classList.add('active'); onChange?.(btn.dataset.theme); });
  modalRoot.querySelectorAll('[data-skin]').forEach(btn => btn.onclick = () => { modalRoot.querySelectorAll('[data-skin]').forEach(x => x.classList.remove('active')); btn.classList.add('active'); onSkinChange?.(btn.dataset.skin); });
}
