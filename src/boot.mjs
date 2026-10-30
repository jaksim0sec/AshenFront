// Original AshenFront engine is still available through ?legacy=1.
const old=new URLSearchParams(location.search).get('legacy')==='1';
document.body.dataset.engine=old?'legacy':'flower';
await import(old?'./main.mjs':'./fw-entry.mjs');