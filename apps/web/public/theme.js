// Apply the saved theme before first paint to avoid a flash (external file so CSP can stay strict).
try {
  var saved = localStorage.getItem('gutech-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {
  /* storage unavailable */
}
