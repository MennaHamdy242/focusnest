# FocusNest — Todo + Notebook

A mobile-first, local-first productivity web app combining todos, a personal notebook, image attachments, and voice/audio attachments.

## Stack

- HTML5 / CSS3
- Vanilla JavaScript ES modules
- LocalStorage for structured metadata/state
- IndexedDB for image/audio binary blobs
- File API for mobile uploads
- MediaRecorder API for voice recording
- Responsive CSS Grid/Flexbox
- Optional PWA with service worker

## Folder structure

```text
focusnest/
├── index.html
├── manifest.json
├── sw.js
├── README.md
├── css/
│   ├── style.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── state.js
│   ├── storage.js
│   ├── indexedDB.js
│   ├── tasks.js
│   ├── notes.js
│   ├── attachments.js
│   ├── audio.js
│   ├── search.js
│   └── ui.js
└── icons/
    └── icon.svg
```

## Data architecture

Structured entities (`tasks`, `notes`, settings) live in LocalStorage under `focusnest-state-v1`.

Images and audio are stored as Blob records in an IndexedDB database named `focusnest-db`, store `blobs`. App entities keep only lightweight attachment references such as `{ id, type, name, mimeType, size }`.

The separation means refreshing or reopening the app keeps metadata and binary files without bloating LocalStorage with Base64 payloads.

## Audio recording

The recorder requests `navigator.mediaDevices.getUserMedia({ audio: true })`, chooses a browser-supported `MediaRecorder` MIME type, collects chunks, creates a Blob, and stores the resulting file in IndexedDB. The editor shows a recording timer and allows the recording to be stopped and saved.

Microphone errors, unsupported browsers, and recording failures are converted to friendly UI messages.

## Mobile image capture/upload

The UI uses two separate file pickers:

- `accept="image/*" multiple` for photo/gallery/file selection
- `accept="image/*" capture="environment"` for camera-capable devices

Images are resized/compressed in-browser before being stored in IndexedDB.

## Run locally

Because ES modules and PWA features should run from an HTTP(S) origin, use a small local server instead of opening `index.html` directly.

### Python

```bash
cd todo-notebook-app
python -m http.server 8080
```

Then open `http://localhost:8080`.

### Node

```bash
npx serve .
```

## Browser notes

- Camera and microphone access normally require a secure context (`https://`) or localhost.
- IndexedDB and LocalStorage are browser-local. They are not synchronized between devices.
- PWA installation availability varies by browser/platform.

## Implemented

- Dashboard with dynamic stats
- Task create/edit/delete/complete/favorite/important
- Task priority, due date, tags, description
- Task filters and sorting
- Notebook create/edit/delete/pin/favorite/tags/checklists
- Global search and notebook filtering
- Mobile image upload/camera capture
- Multiple image attachments
- Fullscreen image preview
- Audio file upload
- Microphone recording with timer
- Audio playback
- Attachment deletion
- Local persistence
- Empty/error states
- Responsive mobile/tablet/desktop layout
- Keyboard focus states and semantic controls
- Optional demo data without overwriting user data
- PWA manifest and service worker

## Future improvements

- Drag-and-drop task ordering
- Rich text / Markdown editor
- Offline conflict-free sync with a backend
- Account/authentication and cloud backup
- Attachment quotas and storage dashboard
- Folder/notebook collections
- Recurring tasks and reminders
- Push notifications
- Export/import as JSON or ZIP
- Cross-device encrypted sync
- Better audio waveform UI


## V7 — Scrapbook Notebook Edition
- Kawaii stationery visual system
- Note cover themes
- Click-to-open note cards
- Rich note editor with cover picker
- Autosave includes cover selection
- Softer attachment gallery and audio styling
- Dreamy blush theme direction
