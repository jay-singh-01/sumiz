/**
 * UPI deep link (NPCI "upi://pay"), understood by every UPI app (PhonePe,
 * GPay, Paytm, BHIM…). Encoded into the QR on the bill with the amount
 * pre-filled; the customer can still change it in their app.
 */
export function upiLink(opts: { vpa: string; payee: string; amount?: number; note?: string }): string {
  const params = new URLSearchParams({ pa: opts.vpa.trim(), pn: opts.payee.trim(), cu: 'INR' })
  if (opts.amount && opts.amount > 0) params.set('am', opts.amount.toFixed(2))
  if (opts.note) params.set('tn', opts.note.slice(0, 50))
  // URLSearchParams uses "+" for spaces; UPI apps expect %20.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`
}

/** QR image (data URL) for a UPI link. The QR library is loaded only when needed. */
export async function upiQrDataUrl(link: string): Promise<string> {
  const QR = await import('qrcode')
  return QR.toDataURL(link, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#2a1b12', light: '#ffffff' } })
}
