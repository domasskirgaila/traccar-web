// VITE_NEW_UI=1 switches to the new UI (src/v2); anything else keeps the old one.
if (import.meta.env.VITE_NEW_UI === '1') {
  import('./v2/main');
} else {
  import('./legacyIndex');
}
