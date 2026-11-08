// הודעות קצרות עם aria-live (מוכרזות לקוראי מסך).
let region;
function getRegion() {
  if (region && document.body.contains(region)) return region;
  region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  return region;
}
export function showToast(message, type = 'success', ms = 3200) {
  const r = getRegion();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  r.append(el);
  setTimeout(() => { el.classList.add('toast--out'); setTimeout(() => el.remove(), 300); }, ms);
}

export async function copyText(text, successMsg = 'הועתק ✓') {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    showToast(successMsg);
    return true;
  } catch {
    showToast('ההעתקה נכשלה. סמנו את הטקסט והעתיקו ידנית.', 'error');
    return false;
  }
}
