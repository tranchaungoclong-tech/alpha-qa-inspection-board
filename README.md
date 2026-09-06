# Alpha QA — Inspection Board

Staff calendar: who inspects, 1 or ½ day, factory, customer, inline vs final.

**Live board:** https://tranchaungoclong-tech.github.io/alpha-qa-inspection-board/

## How the team uses it

1. PIC fills the **Google Form** on the phone (travel).
2. Wait 1–2 minutes.
3. Open / refresh this Pages URL.

Do **not** edit this GitHub repo to add inspections. GitHub only hosts the page. Live rows come from the published Form Responses CSV.

## Files

| File | Role |
| --- | --- |
| `index.html` | Board (v33 — PIC/alerts bar hidden; 20:10 VN push in background) |
| `sheet-config.js` | Published CSV URL + `PUSH_URL` |
| `sw.js` / `manifest.json` | Offline PWA + lock-screen push click |
| `notify-server/` | Node web-push (must keep running for lock-screen) |
| `SHEET.md` | Form → CSV → Pages |

Anyone with the CSV URL can read the log. Keep secrets out of the Sheet.
