import { loadState, saveState } from './storage.js';

const state = {
  data: loadState(),
  view: 'home',
  taskFilter: 'all',
  taskSort: 'date',
  notesPinnedOnly: false,
  favoriteTab: 'all',
  searchQuery: ''
};

export function getState() { return state; }

export function updateData(mutator) {
  mutator(state.data);
  saveState(state.data);
  window.dispatchEvent(new CustomEvent('state:change'));
}

export function setView(view) {
  state.view = view;
  window.dispatchEvent(new CustomEvent('view:change', { detail: { view } }));
}

export function patchUi(partial) {
  Object.assign(state, partial);
  window.dispatchEvent(new CustomEvent('ui:change'));
}
