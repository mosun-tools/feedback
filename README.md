# MOSUN — Song Feedback

A 60-second listener feedback form. Static front-end on GitHub Pages, backed by a
Google Apps Script web app that appends each response to a Google Sheet.

- **Live:** https://mosun-tools.github.io/feedback
- **Front-end:** `index.html` — plain HTML/CSS/JS, no build step
- **Back-end:** Google Apps Script web app (see `SCRIPT_URL` near the bottom of `index.html`)

## How it works

The form collects answers, packs them into URL query parameters, and sends a **GET**
request to the Apps Script `/exec` URL. Apps Script reads them in `doGet(e)` via
`e.parameter` and writes a row to the Sheet.

## Edit → publish (front-end)

```bash
cd ~/Desktop/Cowork/dev/feedback
code .                       # open the folder in VS Code
# ...edit index.html...
git add -A
git commit -m "what you changed"
git push
```

GitHub Pages redeploys automatically (~1 minute) at the live URL above.

## ⚠️ Apps Script gotchas (learned the hard way)

1. **Use `doGet(e)` + `e.parameter` — never `doPost`.**
   The front-end sends data as URL params with `fetch(..., { mode: 'no-cors' })`.
   Under `no-cors`, a `POST` body is silently dropped and rows arrive blank.
   Keep the request a **GET** and read it in **`doGet`**.

2. **Every script change needs a fresh deployment.**
   Apps Script serves the *deployed* version, not your latest saved code. After editing:
   **Deploy → Manage deployments → ✏️ (edit) → Version: _New version_ → Deploy.**
   Editing the existing deployment this way **keeps the same `/exec` URL**.
   If you create a *brand-new* deployment instead, the URL changes — then you must paste
   the new `/exec` URL into `SCRIPT_URL` in `index.html` and push.

## Back-end source (recommended)

The Apps Script code lives in Google's editor, not in this repo. Consider pasting it into
`apps-script/Code.gs` here so it's version-controlled and backed up alongside the front-end.
