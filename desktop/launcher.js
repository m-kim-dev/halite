const error = document.querySelector('#error');
async function run(action) {
  error.textContent = '';
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await action(); } catch (failure) { error.textContent = failure.message || 'Something went wrong. Please try again.'; }
  finally { document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}

async function refresh() {
  const state = await window.halite.welcome();
  document.querySelector('#version').textContent = state.version;
  document.querySelector('#empty').hidden = state.recents.length > 0;
  document.querySelector('#clear-recents').hidden = state.recents.length === 0;
  const list = document.querySelector('#recents');
  list.replaceChildren();
  for (const project of state.recents) {
    const button = document.createElement('button');
    button.className = 'recent';
    const name = document.createElement('strong'); name.textContent = project.name;
    const detail = document.createElement('small'); detail.textContent = project.path; button.title = project.path;
    button.append(name, detail);
    button.addEventListener('click', () => run(() => window.halite.openRecent(project.path)));
    list.append(button);
  }
}

document.querySelector('#open-folder').addEventListener('click', () => run(() => window.halite.openFolder()));
document.querySelector('#open-file').addEventListener('click', () => run(() => window.halite.openFile()));
document.querySelector('#open-example').addEventListener('click', () => run(() => window.halite.openExample()));
document.querySelector('#clear-recents').addEventListener('click', () => run(async () => { await window.halite.clearRecents(); await refresh(); }));
void run(refresh);
