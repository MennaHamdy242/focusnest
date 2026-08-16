import { getState, updateData } from './state.js';
import { getAllBlobs, putBlob, clearBlobs } from './indexedDB.js';
import { toast } from './ui.js';

const VERSION = 2;

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildBackup() {
  const blobs = await getAllBlobs();
  const attachments = [];
  for (const record of blobs) {
    attachments.push({
      ...record,
      blob: undefined,
      data: bufferToBase64(await record.blob.arrayBuffer())
    });
  }
  return {
    app: 'FocusNest',
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: structuredClone(getState().data),
    attachments
  };
}

export async function exportBackup() {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focusnest-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup;
}

export async function importBackup(file) {
  if (!file) return;
  if (file.size > 120 * 1024 * 1024) throw new Error('That backup is too large. Try a smaller backup file.');
  let parsed;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error('This backup file is not valid JSON.'); }
  if (parsed?.app !== 'FocusNest' || !parsed?.data || !Array.isArray(parsed.data.tasks) || !Array.isArray(parsed.data.notes)) {
    throw new Error('This does not look like a FocusNest backup.');
  }

  const ok = confirm('Import this backup? Your current local data will be replaced.');
  if (!ok) return false;

  await clearBlobs();
  for (const item of parsed.attachments || []) {
    if (!item.data) continue;
    const bytes = base64ToUint8Array(item.data);
    const blob = new Blob([bytes], { type: item.mimeType || 'application/octet-stream' });
    await putBlob({ ...item, blob, data: undefined });
  }

  updateData(d => {
    d.tasks = parsed.data.tasks;
    d.notes = parsed.data.notes;
    d.settings = { demoSeeded: true, theme: 'system', skin: 'sakura', ...(parsed.data.settings || {}) };
  });
  toast('Backup imported successfully.');
  return true;
}
