# Design photos (Cloudinary, free)

Order photos (design references and finished work) are stored on Cloudinary's free plan. The app only saves each photo's web address in Firestore. Photos are compressed on the phone to at most 300 KB before uploading, so the free 25 credits a month go a long way.

Photos are optional. Until this is set up, the photo buttons say so ("फ़ोटो के लिए सेटिंग में Cloudinary की जानकारी डालें"), and everything else works normally.

## Setup (about 5 minutes, once)

1. Sign up at <https://cloudinary.com/users/register_free>. Use the free plan; no card is needed.
2. On the dashboard, copy your **Cloud name** (for example `dxyz123`).
3. Go to **Settings (⚙) → Upload → Upload presets → Add upload preset**:
   - **Signing mode:** `Unsigned`. This is required: the app has no server to sign uploads.
   - **Preset name:** for example `gota_dhaaga`.
   - **Folder:** `gota-dhaaga` (optional; the app also sets a folder per shop).
   - Optional hardening under **Upload control**:
     - Allowed formats: `jpg,png,webp`
     - Max file size: `2000000`
   - Save.
4. In the app (owner/admin), go to **सब सुविधाएँ → सेटिंग → फ़ोटो सेवा**, enter the Cloud name and the preset name, and tap **सेव करें**. All devices pick it up through sync.

## Notes

- An unsigned preset means anyone who learns the cloud name and preset name could upload images to your account. They **cannot** read, change or delete existing photos. Keep the preset limited to images and small files, as above.
- Photos are not included in the Firestore JSON backups, which hold only their links. To keep a copy, use Cloudinary's **Media Library → select all → Download** now and then.
- To switch providers later, implement a new `ImageProvider` in `src/features/extras/photos.ts`. Existing links keep working.
