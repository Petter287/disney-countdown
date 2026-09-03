if (window.self !== window.top) {
  document.documentElement.style.display = 'none';
  window.stop();
  throw new Error('Framing is not allowed.');
}
