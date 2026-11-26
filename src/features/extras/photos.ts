/*
 * Photos (design references, diary pages). Firebase Storage needs the paid
 * plan, so images go to a free Cloudinary account via an unsigned upload
 * preset; only the URL is stored in Firestore. Behind a tiny provider
 * interface so the host can be swapped later.
 */

export interface ImageProvider {
  upload(image: Blob, folder: string): Promise<string>
}

export function cloudinaryProvider(cloudName: string, uploadPreset: string): ImageProvider {
  return {
    async upload(image, folder) {
      const form = new FormData()
      form.append('file', image)
      form.append('upload_preset', uploadPreset)
      form.append('folder', folder)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`upload failed (${res.status})`)
      const json = (await res.json()) as { secure_url?: string }
      if (!json.secure_url) throw new Error('upload failed (no url)')
      return json.secure_url
    },
  }
}

/** Downscale + JPEG-compress on the phone until the photo is ≤ maxBytes (default 300 KB). */
export async function compressImage(file: Blob, maxBytes = 300_000, maxDim = 1600): Promise<Blob> {
  if (file.size <= maxBytes && file.type === 'image/jpeg') return file
  const bitmap = await createImageBitmap(file)
  let scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.82, 0.7, 0.58]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
      if (blob && blob.size <= maxBytes) return blob
    }
    scale *= 0.75
  }
  throw new Error('image too large')
}

/** Small thumbnail URL from a Cloudinary URL (other hosts unchanged). */
export function thumb(url: string, width = 320): string {
  return url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/c_limit,w_${width},q_auto,f_auto/`) : url
}
