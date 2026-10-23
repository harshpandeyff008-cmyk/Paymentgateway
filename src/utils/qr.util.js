import QRCode from 'qrcode';

/**
 * Construct standard NPCI UPI Intent URI
 */
export function buildUpiUri({ vpa, merchantName, amount, orderCode, note, provider }) {
  // IMPORTANT: VPA (pa=) must NOT be encodeURIComponent'd
  // The @ symbol MUST remain as @ — Paytm, GPay, PhonePe etc. all reject %40
  // Only pn= (name) and tn= (note) should be percent-encoded per NPCI spec
  const cleanVpa = (vpa || 'ffdealsbyjena@fam').trim();
  const cleanName = encodeURIComponent((merchantName || 'Merchant').trim());
  const cleanAmount = Number(amount || 0).toFixed(2);
  // PAYTM guarantee: for Paytm orders the note (tn=) - like the
  // transaction reference (tr=) below - is ALWAYS the gateway order
  // code, so a Paytm payment can be matched deterministically from the
  // note whenever the alert email carries it. A custom note must never
  // override the order code for Paytm.
  const isPaytm = String(provider || '').toUpperCase().includes('PAYTM');
  const effectiveNote = (isPaytm && orderCode) ? orderCode : (note || orderCode || 'UPI Payment');
  const cleanNote = encodeURIComponent(effectiveNote);
  // tr= transaction reference helps UPI apps track + reconcile payments
  const txnRef = encodeURIComponent(orderCode || `TXN${Date.now()}`);

  // mode=00 = default pay mode (required by some strict UPI apps like Paytm)
  return `upi://pay?pa=${cleanVpa}&pn=${cleanName}&am=${cleanAmount}&tr=${txnRef}&tn=${cleanNote}&cu=INR&mode=00`;
}

/**
 * Stream QR Code as PNG to an HTTP response
 */
export function streamQrPng(text, res) {
  res.setHeader('Content-Type', 'image/png');
  return QRCode.toFileStream(res, text, {
    margin: 1,
    width: 280,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
}

/**
 * Generate QR code as DataURL (base64 string)
 */
export async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0a0f1d',
      light: '#ffffff'
    }
  });
}

export default { buildUpiUri, streamQrPng, generateQrDataUrl };
