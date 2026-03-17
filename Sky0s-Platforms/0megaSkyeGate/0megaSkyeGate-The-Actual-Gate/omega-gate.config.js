// Runtime gate URL injection for frontend pages.
// Include as a <script src="/omega-gate.config.js"></script> in any HTML page.
// Override by setting window.OMEGA_GATE_URL before this script, or via localStorage.
window.OMEGA_GATE_URL =
  window.OMEGA_GATE_URL ||
  localStorage.getItem('OMEGA_GATE_URL') ||
  'https://0megaskyegate.skyesoverlondon.workers.dev';
