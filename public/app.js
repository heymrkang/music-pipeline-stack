const filesBody = document.querySelector('#files');
const summary = document.querySelector('#summary');
const message = document.querySelector('#message');
const refreshButton = document.querySelector('#refresh');
const publishButton = document.querySelector('#publish');
const selectAll = document.querySelector('#select-all');

let files = [];

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function render() {
  const ready = files.filter((file) => file.ready).length;
  summary.textContent = `${files.length} file(s), ${ready} ready`;
  filesBody.innerHTML = files.map((file) => `
    <tr>
      <td><input class="row-check" type="checkbox" value="${escapeHtml(file.path)}" ${file.ready ? '' : 'disabled'} /></td>
      <td class="file">
        ${escapeHtml(file.name)}
        <div class="muted">${formatSize(file.size)} · ${escapeHtml(file.path)}</div>
      </td>
      <td>${escapeHtml(file.title) || '<span class="muted">Missing</span>'}</td>
      <td>${escapeHtml(file.artist) || '<span class="muted">Missing</span>'}</td>
      <td>${escapeHtml(file.album) || '<span class="muted">Singles</span>'}</td>
      <td class="${file.ready ? 'ready' : 'blocked'}">${file.ready ? 'Ready' : 'Needs tags'}</td>
    </tr>
  `).join('');
}

async function loadFiles() {
  message.textContent = 'Loading...';
  const response = await fetch('/api/files');
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Load failed');
  files = payload.files;
  render();
  message.textContent = '';
}

function selectedFiles() {
  return Array.from(document.querySelectorAll('.row-check:checked')).map((item) => item.value);
}

async function publishSelected() {
  const selected = selectedFiles();
  if (!selected.length) {
    message.textContent = 'No ready files selected.';
    return;
  }
  publishButton.disabled = true;
  message.textContent = 'Publishing...';
  try {
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: selected })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Publish failed');
    message.textContent = `Published ${payload.published.length} file(s).`;
    await loadFiles();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    publishButton.disabled = false;
  }
}

refreshButton.addEventListener('click', () => loadFiles().catch((error) => { message.textContent = error.message; }));
publishButton.addEventListener('click', publishSelected);
selectAll.addEventListener('change', () => {
  document.querySelectorAll('.row-check:not(:disabled)').forEach((item) => {
    item.checked = selectAll.checked;
  });
});

loadFiles().catch((error) => { message.textContent = error.message; });
