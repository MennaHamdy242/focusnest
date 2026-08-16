import { storeFile } from './attachments.js';
import { formatDuration } from './utils.js';

export class AudioRecorder {
  constructor() { this.mediaRecorder = null; this.stream = null; this.chunks = []; this.startedAt = 0; this.timer = null; }

  supported() { return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }

  async start(onTick) {
    if (!this.supported()) throw new Error('Audio recording is not supported in this browser.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported?.(t));
    this.mediaRecorder = new MediaRecorder(this.stream, preferred ? { mimeType: preferred } : undefined);
    this.chunks = [];
    this.startedAt = Date.now();
    this.mediaRecorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    this.mediaRecorder.start(250);
    this.timer = setInterval(() => onTick?.((Date.now() - this.startedAt) / 1000), 250);
  }

  async stop() {
    if (!this.mediaRecorder) return null;
    return new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = async () => {
        try {
          const mime = this.mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type:mime });
          this.cleanup();
          const file = new File([blob], `Voice note ${new Date().toLocaleTimeString().replace(/:/g,'-')}.webm`, { type: mime });
          resolve(await storeFile(file, 'audio'));
        } catch (e) { this.cleanup(); reject(new Error('The recording could not be saved.')); }
      };
      this.mediaRecorder.onerror = () => { this.cleanup(); reject(new Error('The microphone stopped unexpectedly.')); };
      this.mediaRecorder.stop();
    });
  }

  cancel() { try { this.mediaRecorder?.stop(); } catch {} this.cleanup(); }
  cleanup() {
    clearInterval(this.timer); this.timer = null;
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; this.mediaRecorder = null; this.chunks = [];
  }
}

export function audioAttachmentMarkup(attachment) {
  return `<div class="audio-attachment" data-audio-id="${attachment.id}">
    <button class="audio-play" type="button" data-audio-play="${attachment.id}" aria-label="Play audio">▶</button>
    <div class="audio-info"><div class="audio-name">${attachment.name || 'Voice note'}</div><div class="audio-time">Voice attachment</div></div>
    <button class="small-icon" type="button" data-remove-attachment="${attachment.id}" aria-label="Delete audio attachment">×</button>
  </div>`;
}

export function setRecordingText(el, seconds) { if (el) el.textContent = formatDuration(seconds); }
