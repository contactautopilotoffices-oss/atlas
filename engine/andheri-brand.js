// The Autopilot × Flipkart co-brand lockup, on transparency (no plaque).
// Files and their sources: /media/flipkart-andheri/brand/SOURCES.md
const BRAND = '/media/flipkart-andheri/brand/';
export const LOGOS = {
  dark: { autopilot: BRAND + 'autopilot-white.svg', flipkart: BRAND + 'flipkart-logo-reverse.svg' },   // on dark or photographic surfaces
  light: { autopilot: BRAND + 'autopilot-dark.svg', flipkart: BRAND + 'flipkart-logo.svg' },           // on white or light surfaces
};
/* The Flipkart mark belongs to the Flipkart atlases only. Any other client is set in type beside Autopilot's mark
   (document.body.dataset.apClient, written by applyAndheriTheme), until that client's own logo file is supplied. */
export function brandLockup(tone = 'dark') {
  const L = LOGOS[tone] || LOGOS.dark;
  const client = document.body.dataset.apClient;
  const node = document.createElement('div');
  node.className = 'ap-lockup'; node.dataset.tone = tone;
  node.setAttribute('role', 'img'); node.setAttribute('aria-label', client ? `Autopilot × ${client}` : 'Autopilot × Flipkart');
  if (client) {
    node.innerHTML = `<img class="ap-logo" src="${L.autopilot}" alt="" width="349" height="41" draggable="false"><span class="ap-x" aria-hidden="true">×</span><span class="ap-client"></span>`;
    node.querySelector('.ap-client').textContent = client;
    return node;
  }
  node.innerHTML = `<img class="ap-logo" src="${L.autopilot}" alt="" width="349" height="41" draggable="false"><span class="ap-x" aria-hidden="true">×</span><img class="fk-logo" src="${L.flipkart}" alt="" width="299" height="101" draggable="false">`;
  return node;
}
