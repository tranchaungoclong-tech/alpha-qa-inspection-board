# Form → CSV → GitHub Pages

Three layers. GitHub does **not** read a Sheet tab.

| Layer | What it does |
| --- | --- |
| Google Form | Staff fill on the phone. |
| Publish to web (Form Responses, CSV) | Public feed the board fetches on every refresh. |
| GitHub Pages | Hosts `index.html`. Staff **see** the calendar here. |

Paste the Sheet **edit** link into GitHub and nothing happens.

## Live feed

CSV URL lives in `sheet-config.js`:

```js
window.SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv";
```

Staff change a Form row → wait ~1–2 min → refresh Pages → board updates.

`file://` cannot fetch Google CSV. Live board needs http(s).

## Columns the board reads

`date | pic | days | factory | customer | type | category | country | visit | result`

- **type**: inline / final / sourcing / audit / leave
- **country**: VN KH TH MY CN IN ID (CAM→KH, IND→IN)
- **result**: pass / fail / pending (PIC stamps on the Form)
- `style` / `job_id` optional (not shown on the calendar)
- `Resut` is accepted as result
