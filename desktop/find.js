const query = document.querySelector('#query');
const matchCase = document.querySelector('#match-case');
const result = document.querySelector('#result');
let timer;

const report = error => { result.textContent = error.message || 'Unable to search'; result.dataset.error = 'true'; };
const search = (findNext = false, forward = true) => {
  clearTimeout(timer);
  result.dataset.error = 'false';
  void window.haliteFind.search(query.value, { findNext, forward, matchCase: matchCase.checked }).catch(report);
};
query.addEventListener('input', () => {
  clearTimeout(timer);
  result.textContent = query.value ? 'Searching…' : 'Type to search';
  timer = setTimeout(() => search(), 120);
});
matchCase.addEventListener('change', () => search());
document.querySelector('#next').addEventListener('click', () => search(true));
document.querySelector('#previous').addEventListener('click', () => search(true, false));
const close = () => { clearTimeout(timer); void window.haliteFind.close().catch(report); };
document.querySelector('#close').addEventListener('click', close);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); close(); }
  if (event.key === 'Enter' || event.key === 'F3') { event.preventDefault(); search(true, !event.shiftKey); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); query.focus(); query.select(); }
});
window.haliteFind.onResult(({ matches, activeMatchOrdinal, empty }) => {
  result.textContent = empty ? 'Type to search' : matches ? `${activeMatchOrdinal} of ${matches}` : 'No matches';
  result.dataset.error = String(!empty && !matches);
});
window.haliteFind.onFocus(() => { query.focus(); query.select(); });
query.focus();
