# If something goes wrong: recovery

Keep calm: data is very hard to lose here.

- **Nothing is ever really deleted.** Deleted customers, orders, bills and payments go to **सब सुविधाएँ → रीसायकल बिन**, where you can bring them back.
- **Every change is recorded.** Open **सब सुविधाएँ → बदलावों का इतिहास** to see who changed what and when, with old and new values.
- **Phone lost or broken?** Install the app on a new phone, sign in with the same Google account, and everything downloads again. Then use **सेटिंग → सभी फ़ोन/डिवाइस से लॉग आउट** so the old phone can no longer open the shop.
- **Wrong data restored or a big mistake?** Restore from a backup. Restore always shows a dry run first and never overwrites newer records.

The full playbook covers the nightly backups, restoring from a JSON file, and rebuilding the Firebase project from scratch: **[docs/BACKUP.md](docs/BACKUP.md)**.
