# QA Board — evening-before push

Sends a lock-screen notification at **20:00 Vietnam** with that PIC’s jobs for **tomorrow**.

GitHub Pages cannot send this. This Node process must stay running (Philip’s PC, or a small host).

## Run on this PC

```
cd notify-server
npm install
node server.mjs
```

Leave the window open. Phones only get lock-screen push while this process is up **and** reachable over HTTPS.

iPhone: board must be **Add to Home Screen**. Safari tab alone will not show lock-screen Web Push.

## Files

`data/vapid.json` — keys. Public key goes on the board. Private key stays here, never GitHub.
`data/subs.json` — phone subscriptions (PIC + endpoint).
`data/sent.json` — one evening send per date.
