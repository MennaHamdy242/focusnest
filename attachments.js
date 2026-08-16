import { uid, formatBytes } from './utils.js';
import { putBlob, getBlob, deleteBlob } from './indexedDB.js';

const IMAGE_MAX = 8 * 1024 * 1024;
const AUDIO_MAX = 25 * 1024 * 1024;

function assertSize(file, max) {
  if (file.size > max) throw new Error(`That file is too large. Maximum size is ${formatBytes(max)}.`);
}

function isImage(file) { return file?.type?.startsWith('image/'); }
function isAudio(file) { return file?.type?.startsWith('audio/'); }

export async function compressImage(file, maxDimension=1800, quality=.82) {
  assertSize(file, IMAGE_MAX);
  if (!isImage(file)) throw new Error('Please choose an image file.');
  if (typeof createImageBitmap !== 'function') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { alpha:false });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  return blob || file;
}

export async function storeFile(file, kind, extra={}) {
  if (kind === 'image') assertSize(file, IMAGE_MAX);
  if (kind === 'audio') assertSize(file, AUDIO_MAX);
  if (kind === 'image' && !isImage(file)) throw new Error('Invalid image file.');
  if (kind === 'audio' && !isAudio(file)) throw new Error('Invalid audio file.');
  const processed = kind === 'image' ? await compressImage(file) : file;
  const id = uid('att');
  const record = { id, blob: processed, type: kind, mimeType: processed.type || file.type, name: file.name || `Voice note.${(processed.type || 'audio/webm').split('/')[1] || 'bin'}`, size: processed.size, createdAt: new Date().toISOString(), ...extra };
  await putBlob(record);
  return { id, type: kind, name: record.name, mimeType: record.mimeType, size: record.size };
}

export async function loadAttachmentUrl(id) {
  const record = await getBlob(id);
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

export async function removeAttachment(id) { await deleteBlob(id); }

export async function cleanupAttachments(attachments=[]) {
  await Promise.all((attachments || []).map(a => removeAttachment(a.id).catch(() => {})));
}

export function fileInputHTML({ id, accept, capture='' }={}) {
  const captureAttr = capture ? ` capture="${capture}"` : '';
  return `<input id="${id}" type="file" accept="${accept}"${captureAttr} hidden>`;
}
