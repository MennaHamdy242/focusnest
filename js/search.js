function haystack(item) {
  return [item.title,item.description,item.content,(item.tags||[]).join(' ')].filter(Boolean).join(' ').toLowerCase();
}

export function searchAll(data, query) {
  const q=query.trim().toLowerCase();
  if (!q) return {tasks:[],notes:[]};
  return {
    tasks:data.tasks.filter(t=>haystack(t).includes(q)),
    notes:data.notes.filter(n=>haystack(n).includes(q))
  };
}
