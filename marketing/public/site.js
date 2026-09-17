// Pages currently ignores HTTP Range requests. Loading this small clip as a
// local blob gives the native player a complete, seekable file without a server.
// Without JavaScript, the original video controls and download link remain.
const demo = document.querySelector('#product-demo');
const playButton = document.querySelector('#play-demo');
const label = document.querySelector('#play-demo-label');
const status = document.querySelector('#video-status');

if (demo && playButton && label && status) {
  demo.controls = false;
  playButton.hidden = false;

  playButton.addEventListener('click', async () => {
    playButton.disabled = true;
    label.textContent = 'Loading demo…';
    try {
      const response = await fetch('/assets/halite-demo.mp4', {
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error('Demo download failed');
      const url = URL.createObjectURL(await response.blob());
      demo.src = url;
      demo.controls = true;
      demo.load();
      await demo.play();
      playButton.hidden = true;
      // The browser releases the object URL when this document is unloaded.
    } catch {
      demo.controls = true;
      playButton.hidden = true;
      status.hidden = false;
      status.textContent = 'Use the video controls to play, or download the MP4 with the link beside the demo.';
    }
  });
}
