/*
 * Bill → image / PDF → WhatsApp.
 *
 * The bill is real HTML, so the browser shapes Hindi conjuncts correctly; we
 * capture it with html-to-image at 3× for a crisp PNG, and embed that PNG in
 * a jsPDF page for the PDF (no PDF text engine touches the Devanagari, so the
 * matras can't break). Libraries load on demand to keep the app light.
 */

export type PdfSize = 'a4' | 'fit'

async function ready() {
  await document.fonts?.ready
}

export async function nodeToPng(node: HTMLElement, pixelRatio = 3): Promise<string> {
  await ready()
  const { toPng } = await import('html-to-image')
  // Render twice: the first pass warms the font/image cache inside html-to-image (known Safari/Chrome quirk).
  await toPng(node, { pixelRatio: 1, cacheBust: true })
  return toPng(node, { pixelRatio, cacheBust: true, backgroundColor: '#fffdf7' })
}

export async function pngToPdf(dataUrl: string, node: HTMLElement, size: PdfSize): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const w = node.offsetWidth
  const h = node.offsetHeight
  if (size === 'a4') {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const scale = Math.min(pageW / w, pageH / h)
    pdf.addImage(dataUrl, 'PNG', (pageW - w * scale) / 2, 0, w * scale, h * scale, undefined, 'FAST')
    return pdf.output('blob')
  }
  // Page exactly the size of the bill: reads best on a phone screen.
  const pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation: h >= w ? 'portrait' : 'landscape' })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST')
  return pdf.output('blob')
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'application/octet-stream'
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

/** File-system-safe name: GD/26-27/A001 → GD-26-27-A001 */
export function safeFileName(name: string): string {
  return name.replace(/[^\wऀ-ॿ-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Share a file straight into WhatsApp (Web Share Level 2, works on Android
 * Chrome). Returns false when the browser can't share files, so the caller can
 * fall back to download + wa.me text link.
 */
export async function shareFile(blob: Blob, fileName: string, text: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([blob], fileName, { type: blob.type })
  const data: ShareData = { files: [file], text, title: fileName }
  if (!navigator.canShare?.(data)) return 'unsupported'
  try {
    await navigator.share(data)
    return 'shared'
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}
