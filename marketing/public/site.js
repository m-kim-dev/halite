// Keep native controls and a direct MP4 link available if playback fails.
const demo = document.querySelector('#product-demo');
document.querySelectorAll('a[href="#demo"]').forEach(link => {
  link.addEventListener('click', () => {
    // Loading metadata on intent keeps the initial page light without autoplay.
    if (demo && demo.preload === 'none') {
      demo.preload = 'metadata';
      demo.load();
    }
  });
});
