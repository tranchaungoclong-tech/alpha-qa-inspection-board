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

From **v38**, the board **+** opens the Form. Stamping Pass / Fail / Pending on a visit posts a **new Form row** (does not edit the old one). Other devices see the latest stamp after CSV refresh (~1–2 min). Duplicate rows for the same visit are coalesced — latest result wins.

From **v39**, the iPhone Home Screen app pulls the live Sheet when you reopen it. Tap **↻** if the phone still shows an old stamp. Local overlay does not hide a newer GitHub / other-phone stamp.

From **v42**, ↻ appends a unique query so Google’s published-CSV cache is less likely to serve a 5-minute-old file. Form → publish can still take ~1 min. Desktop day popup is centered; phone stays a bottom sheet.

`file://` cannot fetch Google CSV. Live board needs http(s).

## Columns the board reads

`date | pic | days | factory | customer | type | category | country | visit | result`

- **type**: inline / final / sourcing / audit / leave
- **country**: VN KH TH MY CN IN ID (CAM→KH, IND→IN)
- **result**: pass / fail / pending (PIC stamps on the Form)
- `style` / `job_id` optional (not shown on the calendar)
- `Resut` is accepted as result
