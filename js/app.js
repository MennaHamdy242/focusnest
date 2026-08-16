import { getState, setView, patchUi, updateData } from './state.js';
import { todayISO, addDaysISO, debounce, formatDuration } from './utils.js';
import { filterAndSortTasks, taskMarkup, toggleTaskComplete, updateTask } from './tasks.js';
import { noteMarkup, updateNote } from './notes.js';
import { searchAll } from './search.js';
import { loadAttachmentUrl } from './attachments.js';
import { showTaskEditor, showNoteEditor, showDeleteConfirm, showImageViewer, showThemePicker, toast, closeModal } from './ui.js';
import { exportBackup, importBackup } from './backup.js';

const audioPlayers = new Map();
let deferredInstallPrompt = null;
let focusSeconds = 25 * 60;
let focusDuration = 25 * 60;
let focusRunning = false;
let focusInterval = null;
const quotes = ["Small progress is still progress. ✨","You do not need a perfect day — just one useful step. 🌷","Make it easy to start, then let momentum do the rest. ☕","Future you will thank you for the tiny things you finish today. 💕","A calm workspace makes room for a sharp mind. ✦"];

const refs = {
  views:[...document.querySelectorAll('.view')], nav:[...document.querySelectorAll('.nav-item[data-route]')],
  stats:document.getElementById('dashboardStats'), dashTasks:document.getElementById('dashboardTasks'), dashNotes:document.getElementById('dashboardNotes'),
  tasksList:document.getElementById('tasksList'), notesGrid:document.getElementById('notesGrid'), favorites:document.getElementById('favoritesContent'), searchResults:document.getElementById('searchResults'),
  globalSearch:document.getElementById('globalSearch'), notesSearch:document.getElementById('notesSearch'), homeDate:document.getElementById('homeDate'), taskFilters:document.getElementById('taskFilters'), taskSort:document.getElementById('taskSort'), pinnedFilter:document.getElementById('notesPinnedFilter'), clearCompleted:document.getElementById('clearCompleted'), installBtn:document.getElementById('installBtn'),
  streak:document.getElementById('streakValue'), vibe:document.getElementById('dailyVibe'), vibeSub:document.getElementById('dailyVibeSub'), completionInsight:document.getElementById('completionInsight'), completionMiniBar:document.getElementById('completionMiniBar'), focusSessions:document.getElementById('focusSessionsValue'), savedValue:document.getElementById('savedValue'),
  progressValue:document.getElementById('todayProgressValue'), progressBar:document.getElementById('todayProgressBar'), progressText:document.getElementById('todayProgressText'), greeting:document.getElementById('homeGreeting'), snapshot:document.getElementById('dashboardSnapshot'), quote:document.getElementById('dailyQuote'), focusTimer:document.getElementById('focusTimer'), timerRing:document.getElementById('timerRingFill'), focusStart:document.getElementById('focusStart'), focusReset:document.getElementById('focusReset'), focusStatus:document.getElementById('focusStatus')
};

function emptyState(icon, title, message, action='') { return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${message}</p>${action}</div>`; }
function route(view) { const allowed=['home','tasks','notes','favorites','search']; if(!allowed.includes(view)) view='home'; setView(view); }

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  updateData(d => { d.settings.theme = theme; });
}

function applySkin(skin) {
  document.documentElement.dataset.skin = skin;
  updateData(d => { d.settings.skin = skin; });
}

function renderApp() {
  const ui=getState();
  refs.views.forEach(v=>v.classList.toggle('active',v.dataset.view===ui.view));
  refs.nav.forEach(b=>b.classList.toggle('active',b.dataset.route===ui.view));
  renderDashboard(); renderTasks(); renderNotes(); renderFavorites(); renderSearch();
  refs.homeDate.textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
  refs.greeting.textContent = greeting();
}

function renderDashboard() {
  const {tasks,notes}=getState().data;
  const today = todayISO();
  const todayTasks=tasks.filter(t=>t.dueDate===today);
  const todayDone=todayTasks.filter(t=>t.completed).length;
  const progress=todayTasks.length ? Math.round(todayDone/todayTasks.length*100) : 0;
  refs.stats.innerHTML=[['Today',todayTasks.length,'📅'],['Completed',tasks.filter(t=>t.completed).length,'✓'],['Upcoming',tasks.filter(t=>!t.completed && t.dueDate > today).length,'✦'],['Notes',notes.length,'♡']]
    .map(([label,value,icon])=>`<div class="stat-card"><span class="stat-icon">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`).join('');
  if(refs.progressValue) refs.progressValue.textContent=`${progress}%`;
  if(refs.progressBar) refs.progressBar.style.width=`${progress}%`;
  if(refs.progressText) refs.progressText.textContent=todayTasks.length ? `${todayDone} of ${todayTasks.length} tasks complete` : 'A fresh page. Add something small.';
  const overdue=tasks.filter(t=>!t.completed && t.dueDate && t.dueDate < today).length;
  const favoriteCount=tasks.filter(t=>t.favorite).length + notes.filter(n=>n.favorite).length;
  const activeCount=tasks.filter(t=>!t.completed).length;
  if(refs.snapshot) refs.snapshot.innerHTML=[['Active tasks',activeCount],['Overdue',overdue],['Favorites',favoriteCount],['Pinned notes',notes.filter(n=>n.pinned).length]].map(([label,value])=>`<div class=\"snapshot-item\"><span>${label}</span><strong>${value}</strong></div>`).join('');
  if(refs.quote) refs.quote.textContent=quotes[new Date().getDate()%quotes.length];
  const settings=getState().data.settings||{};
  if(refs.streak) refs.streak.textContent=String(settings.focusStreak||0);
  if(refs.focusSessions) refs.focusSessions.textContent=String(settings.focusSessions||0);
  if(refs.savedValue) refs.savedValue.textContent=String(favoriteCount + notes.filter(n=>n.pinned).length);
  if(refs.completionInsight) refs.completionInsight.textContent=`${progress}%`;
  if(refs.completionMiniBar) refs.completionMiniBar.style.width=`${progress}%`;
  const vibes=[['Soft focus, sharp mind.','Pick one tiny thing and make it happen.'],['You’ve got this. ✨','No perfect day required — just a next step.'],['Main character energy. 🎀','Finish one thing, then celebrate it.'],['Tiny wins club. ♡','Your future self is quietly cheering.']];
  const vibe=vibes[new Date().getDate()%vibes.length]; if(refs.vibe) refs.vibe.textContent=vibe[0]; if(refs.vibeSub) refs.vibeSub.textContent=vibe[1];
  const todaySorted=tasks.filter(t=>t.dueDate===today || (!t.dueDate && !t.completed)).slice(0,4);
  refs.dashTasks.innerHTML=todaySorted.length ? todaySorted.map(t=>taskMarkup(t)).join('') : emptyState('♡','Nothing urgent today','You are clear. Add a task when you are ready.','<button class="btn empty-action" data-action="new-task">＋ New task</button>');
  refs.dashNotes.innerHTML=notes.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,3).map(noteMarkup).join('') || emptyState('✎','No notes yet','Capture your first idea.','<button class="btn empty-action" data-action="new-note">＋ New note</button>');
  hydrateNoteAttachments(refs.dashNotes, notes.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,3));
  hydrateAttachmentBadges(refs.dashTasks, todaySorted);
}

function renderTasks() {
  const ui=getState(); const tasks=filterAndSortTasks(ui.data.tasks,ui.taskFilter,ui.taskSort);
  refs.taskFilters.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===ui.taskFilter)); refs.taskSort.value=ui.taskSort;
  refs.tasksList.innerHTML=tasks.length ? tasks.map(taskMarkup).join('') : emptyState('✓','No tasks here','Try another filter or create a new task.','<button class="btn empty-action" data-action="new-task">＋ New task</button>');
  hydrateAttachmentBadges(refs.tasksList,tasks);
}

function renderNotes() {
  const ui=getState(); const q=(refs.notesSearch.value||'').trim().toLowerCase();
  const notes=ui.data.notes.filter(n=>{const match=!q||[n.title,n.content,(n.tags||[]).join(' ')].join(' ').toLowerCase().includes(q);return match&&(!ui.notesPinnedOnly||n.pinned);}).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt));
  refs.pinnedFilter.setAttribute('aria-pressed',String(ui.notesPinnedOnly)); refs.notesGrid.innerHTML=notes.length?notes.map(noteMarkup).join(''):emptyState('▤','No matching notes','Try a different search or create a fresh note.','<button class="btn empty-action" data-action="new-note">＋ New note</button>'); hydrateNoteAttachments(refs.notesGrid,notes);
}

function renderFavorites() {
  const ui=getState(),tab=ui.favoriteTab,tasks=ui.data.tasks.filter(t=>t.favorite),notes=ui.data.notes.filter(n=>n.favorite); let html='';
  if(tab==='all'||tab==='tasks') html+=`<div class="result-group"><div class="result-heading"><h2>Tasks</h2><span>${tasks.length}</span></div>${tasks.length?`<div class="stack-list">${tasks.map(taskMarkup).join('')}</div>`:emptyState('♡','No favorite tasks','Star tasks you want close at hand.').trim()}</div>`;
  if(tab==='all'||tab==='notes') html+=`<div class="result-group" style="margin-top:18px"><div class="result-heading"><h2>Notes</h2><span>${notes.length}</span></div>${notes.length?`<div class="notes-grid">${notes.map(noteMarkup).join('')}</div>`:emptyState('♡','No favorite notes','Favorite notes to keep them handy.').trim()}</div>`;
  refs.favorites.innerHTML=html||emptyState('♡','Nothing saved yet','Your favorites will appear here.'); document.querySelectorAll('[data-fav-tab]').forEach(b=>b.classList.toggle('active',b.dataset.favTab===tab));
}

function renderSearch() {
  const q=getState().searchQuery; if(refs.globalSearch.value!==q) refs.globalSearch.value=q;
  if(!q){refs.searchResults.innerHTML=emptyState('⌕','Start searching','Find tasks, notes, or tags across your workspace.');return;}
  const {tasks,notes}=searchAll(getState().data,q); refs.searchResults.innerHTML=(tasks.length||notes.length)?`${tasks.length?`<div class="result-group"><div class="result-heading"><h2>Tasks</h2><span>${tasks.length}</span></div><div class="stack-list">${tasks.map(taskMarkup).join('')}</div></div>`:''}${notes.length?`<div class="result-group"><div class="result-heading"><h2>Notes</h2><span>${notes.length}</span></div><div class="notes-grid">${notes.map(noteMarkup).join('')}</div></div>`:''}`:emptyState('⌕','No matches','Nothing found for that search.');
}

async function hydrateNoteAttachments(container, notes) {
  for(const note of notes){
    const card=container.querySelector(`[data-note-id="${note.id}"]`); if(!card||!(note.attachments||[]).length) continue;
    const attachmentsEl=document.createElement('div'); attachmentsEl.className='attachment-gallery';
    for(const a of note.attachments){
      if(a.type==='image'){const url=await loadAttachmentUrl(a.id);if(url){const img=document.createElement('img');img.className='gallery-thumb';img.src=url;img.alt='Note photo';img.loading='lazy';img.dataset.imageId=a.id;attachmentsEl.appendChild(img);}}
      else attachmentsEl.appendChild(audioCard(a));
    }
    card.appendChild(attachmentsEl);
  }
}

async function hydrateAttachmentBadges(container,tasks){
  for(const task of tasks){
    const card=container.querySelector(`[data-task-id="${task.id}"]`);if(!card||!(task.attachments||[]).length)continue;
    const attachmentsEl=document.createElement('div');attachmentsEl.className='attachment-gallery';
    for(const a of task.attachments){if(a.type==='image'){const url=await loadAttachmentUrl(a.id);if(url){const img=document.createElement('img');img.className='gallery-thumb';img.src=url;img.alt='Task photo';img.loading='lazy';img.dataset.imageId=a.id;attachmentsEl.appendChild(img);}}else attachmentsEl.appendChild(audioCard(a));}
    card.appendChild(attachmentsEl);
  }
}

function audioCard(a){
  const el=document.createElement('div');el.className='audio-attachment';el.innerHTML=`<button class="audio-play" type="button" data-audio-play="${a.id}" aria-label="Play voice note">▶</button><div class="audio-info"><div class="audio-name">${a.name||'Voice note'}</div><div class="audio-time">Voice note</div><div class="audio-progress"><span></span></div></div>`;return el;
}

function formatTimer(sec){const m=Math.floor(sec/60).toString().padStart(2,'0');const s=(sec%60).toString().padStart(2,'0');return `${m}:${s}`;}
function renderFocusTimer(){
  if(refs.focusTimer) refs.focusTimer.textContent=formatTimer(focusSeconds);
  if(refs.timerRing) refs.timerRing.style.width=`${(1-focusSeconds/focusDuration)*100}%`;
  if(refs.focusStart) refs.focusStart.textContent=focusRunning?'❚❚ Pause':'▶ Start';
}
function stopFocusTimer(){clearInterval(focusInterval);focusInterval=null;focusRunning=false;renderFocusTimer();}
function toggleFocusTimer(){
  if(focusRunning){stopFocusTimer();if(refs.focusStatus)refs.focusStatus.textContent='Paused. Come back when you are ready.';return;}
  focusRunning=true;renderFocusTimer();if(refs.focusStatus)refs.focusStatus.textContent='You are in a focus session. Notifications can wait. ✨';
  focusInterval=setInterval(()=>{focusSeconds--;renderFocusTimer();if(focusSeconds<=0){stopFocusTimer();const settings=getState().data.settings; updateData(d=>{d.settings.focusSessions=Number(d.settings.focusSessions||0)+1;}); focusSeconds=focusDuration;renderFocusTimer();if(refs.focusStatus)refs.focusStatus.textContent='Session complete. Tiny win unlocked! 💖';toast('Focus session complete! Take a tiny break. ✨');}},1000);
}
function resetFocusTimer(){stopFocusTimer();focusSeconds=focusDuration;renderFocusTimer();if(refs.focusStatus)refs.focusStatus.textContent='A tiny focused session is enough.';}

function initEvents(){
  document.addEventListener('click',async e=>{
    const routeBtn=e.target.closest('[data-route]');if(routeBtn){route(routeBtn.dataset.route);return;}
    const action=e.target.closest('[data-action]');if(action){const a=action.dataset.action;if(a==='new-task')await showTaskEditor();if(a==='new-note')await showNoteEditor();if(a==='theme')showThemePicker(getState().data.settings.theme||'system',applyTheme,getState().data.settings.skin||'sakura',applySkin);if(a==='export')try{await exportBackup();toast('Backup exported 💾');}catch(err){toast(err.message,'error');}if(a==='import')document.getElementById('importBackupInput')?.click();return;}
    const complete=e.target.closest('[data-task-complete]');if(complete){toggleTaskComplete(complete.dataset.taskComplete);return;}
    const favTask=e.target.closest('[data-task-favorite]');if(favTask){const id=favTask.dataset.taskFavorite,t=getState().data.tasks.find(x=>x.id===id);if(t)updateTask(id,{favorite:!t.favorite});return;}
    const editTask=e.target.closest('[data-task-edit]');if(editTask){const t=getState().data.tasks.find(x=>x.id===editTask.dataset.taskEdit);if(t)await showTaskEditor(t);return;}
    const delTask=e.target.closest('[data-task-delete]');if(delTask){const t=getState().data.tasks.find(x=>x.id===delTask.dataset.taskDelete);if(t)await showDeleteConfirm('task',t.id,t.title);return;}
    const favNote=e.target.closest('[data-note-favorite]');if(favNote){const n=getState().data.notes.find(x=>x.id===favNote.dataset.noteFavorite);if(n)updateNote(n.id,{favorite:!n.favorite});return;}
    const pinNote=e.target.closest('[data-note-pin]');if(pinNote){const n=getState().data.notes.find(x=>x.id===pinNote.dataset.notePin);if(n)updateNote(n.id,{pinned:!n.pinned});return;}
    const openNote=e.target.closest('[data-note-open]');if(openNote && !e.target.closest('button')){const n=getState().data.notes.find(x=>x.id===openNote.dataset.noteOpen);if(n)await showNoteEditor(n);return;}
    const editNote=e.target.closest('[data-note-edit]');if(editNote){const n=getState().data.notes.find(x=>x.id===editNote.dataset.noteEdit);if(n)await showNoteEditor(n);return;}
    const delNote=e.target.closest('[data-note-delete]');if(delNote){const n=getState().data.notes.find(x=>x.id===delNote.dataset.noteDelete);if(n)await showDeleteConfirm('note',n.id,n.title);return;}
    const image=e.target.closest('[data-image-id]');if(image){await showImageViewer(image.dataset.imageId);return;}
    const audio=e.target.closest('[data-audio-play]');if(audio){await toggleAudio(audio.dataset.audioPlay,audio);return;}
    if(e.target.closest('#profileBtn')){showThemePicker(getState().data.settings.theme||'system',applyTheme,getState().data.settings.skin||'sakura',applySkin);return;}
  });
  refs.taskFilters.addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;patchUi({taskFilter:b.dataset.filter});renderTasks();});
  refs.taskSort.addEventListener('change',()=>{patchUi({taskSort:refs.taskSort.value});renderTasks();});
  refs.clearCompleted.addEventListener('click',async()=>{const completed=getState().data.tasks.filter(t=>t.completed);if(!completed.length){toast('No completed tasks to clear.');return;}if(!confirm(`Delete ${completed.length} completed task${completed.length!==1?'s':''}?`))return;const {cleanupAttachments}=await import('./attachments.js');await Promise.all(completed.map(t=>cleanupAttachments(t.attachments||[])));updateData(d=>{d.tasks=d.tasks.filter(t=>!t.completed);});toast('Completed tasks cleared.');});
  refs.notesSearch.addEventListener('input',debounce(renderNotes,180)); refs.pinnedFilter.addEventListener('click',()=>{patchUi({notesPinnedOnly:!getState().notesPinnedOnly});renderNotes();});
  refs.globalSearch.addEventListener('input',debounce(()=>{patchUi({searchQuery:refs.globalSearch.value});renderSearch();},160));
  document.querySelectorAll('[data-fav-tab]').forEach(b=>b.addEventListener('click',()=>{patchUi({favoriteTab:b.dataset.favTab});renderFavorites();}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal(); if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault(); route('search'); setTimeout(()=>refs.globalSearch?.focus(),0);} if(e.code==='Space'&&document.activeElement?.tagName!=='INPUT'&&document.activeElement?.tagName!=='TEXTAREA'){e.preventDefault(); toggleFocusTimer();}});
  window.addEventListener('state:change',renderApp);window.addEventListener('view:change',renderApp);window.addEventListener('ui:change',()=>{renderNotes();renderFavorites();renderSearch();renderTasks();});
  const importInput=document.getElementById('importBackupInput'); importInput?.addEventListener('change',async()=>{try{if(await importBackup(importInput.files?.[0]))renderApp();}catch(err){toast(err.message,'error');}finally{importInput.value='';}});
  refs.focusStart?.addEventListener('click',toggleFocusTimer);
  refs.focusReset?.addEventListener('click',resetFocusTimer);
  document.querySelectorAll('[data-focus-min]').forEach(btn=>btn.addEventListener('click',()=>{
    if(focusRunning) stopFocusTimer();
    focusDuration=Number(btn.dataset.focusMin)*60; focusSeconds=focusDuration;
    document.querySelectorAll('[data-focus-min]').forEach(b=>b.classList.toggle('active',b===btn));
    if(refs.focusStatus) refs.focusStatus.textContent=`${btn.dataset.focusMin} minutes of cozy focus. ☕`;
    renderFocusTimer();
  }));
  renderFocusTimer();
}

async function toggleAudio(id,button){
  if(audioPlayers.has(id)){const audio=audioPlayers.get(id);if(audio.paused){await audio.play();button.textContent='❚❚';}else{audio.pause();button.textContent='▶';}return;}
  const url=await loadAttachmentUrl(id);if(!url){toast('That audio file is no longer available.','error');return;}
  const audio=new Audio(url);audioPlayers.set(id,audio);audio.ontimeupdate=()=>{const bar=button.parentElement?.querySelector('.audio-progress span');if(bar&&audio.duration)bar.style.width=`${audio.currentTime/audio.duration*100}%`;};audio.onended=()=>{button.textContent='▶';const bar=button.parentElement?.querySelector('.audio-progress span');if(bar)bar.style.width='0%';audioPlayers.delete(id);URL.revokeObjectURL(url);};
  try{await audio.play();button.textContent='❚❚';}catch{toast('Audio playback was blocked by the browser.','error');}
}

function seedDemo(){const s=getState();if(s.data.settings.demoSeeded||s.data.tasks.length||s.data.notes.length)return;const now=new Date().toISOString();updateData(d=>{d.tasks=[{id:'demo_task_1',title:'Study JavaScript arrays',description:'Practice map, filter, find, and reduce with five small examples.',completed:false,important:true,favorite:true,priority:'high',dueDate:todayISO(),tags:['javascript','study'],attachments:[],createdAt:now,updatedAt:now},{id:'demo_task_2',title:'Finish CSS practice',description:'Polish the responsive card layout.',completed:true,important:false,favorite:false,priority:'medium',dueDate:todayISO(),tags:['css'],attachments:[],createdAt:now,updatedAt:now},{id:'demo_task_3',title:'Plan next web project',description:'Write down the core user flow before coding.',completed:false,important:false,favorite:false,priority:'low',dueDate:addDaysISO(2),tags:['projects'],attachments:[],createdAt:now,updatedAt:now}];d.notes=[{id:'demo_note_1',title:'JavaScript Study Notes',content:'<p>Variables, data types, type coercion, and the debugging patterns I keep forgetting.</p>',tags:['javascript','study'],attachments:[],pinned:true,favorite:true,checklist:[],createdAt:now,updatedAt:now},{id:'demo_note_2',title:'Project Ideas',content:'<p>Todo + notebook app, AI career mentor, and a small habit tracker with useful mobile UX.</p>',tags:['ideas','projects'],attachments:[],pinned:false,favorite:false,checklist:[],createdAt:now,updatedAt:now}];d.settings.demoSeeded=true;});}

async function registerPWA(){if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./sw.js');}catch{}}window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;refs.installBtn.hidden=false;});refs.installBtn.addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;refs.installBtn.hidden=true;});}

initEvents();seedDemo();document.documentElement.dataset.theme=getState().data.settings.theme||'system';document.documentElement.dataset.skin=getState().data.settings.skin||'sakura';renderApp();registerPWA();
