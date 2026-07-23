# Warwick QC Test Reports — iPad Prototype

An installable web app (PWA) for jobsite quality-control test reports. A foreman
fills out a test report, marks up the drawing showing what was tested (highlight,
text boxes, arrows), signs with a finger, and exports **one combined PDF** (report
+ marked-up drawing) that can be saved locally and sent to OneDrive — the single
source of truth for job closeout.

The first form is the **Pressure Test Record**; custom form templates can be built
in-app.

## Features

- **Pressure Test Record** — a clean digital recreation of the Warwick paper form.
- **Project admin autofill** — Job Number, PM, contractors, and drawing # are saved
  per project and autofilled into new reports (you're prompted: “Save admin data to
  autofill later?”).
- **Auto date/time** — Date defaults to today, Start Time to the current time.
- **Drawing markup** — load any PDF or image drawing, then use a finger to:
  - **Highlight** tested areas (semi-transparent highlighter)
  - add **Text boxes** (size, bold, color)
  - draw **Arrows**
  - pan and pinch-to-zoom on large sheets; select/move/delete; undo
- **Finger signatures** — no certificates, just a drawn signature.
- **Single-page report** — the report and signatures fit on one page; the marked-up
  drawing follows as page 2.
- **Export / OneDrive** — share the combined PDF to OneDrive via the iOS share
  sheet, **append it to an existing PDF test log**, or save to Files.
- **Custom templates** — build new forms with your own fields (text, long text,
  date, time, two-checkbox, signature); mark fields as project-level (autofilled)
  or per-test.
- **Offline** — installs to the home screen and launches without a connection;
  reports are stored on-device (IndexedDB).

## Run locally

```bash
npm install
npm run dev      # dev server (also exposed on your LAN with --host)
# or
npm run build && npm run preview
```

## Testing on your iPad

You do **not** need a Mac, Xcode, or the App Store.

**Option A — quick, over local Wi-Fi (development):**
1. On your computer run `npm run dev`. Vite prints a `Network:` URL
   (e.g. `http://192.168.1.20:5173`).
2. Make sure the iPad is on the same Wi-Fi, open that URL in **Safari**.

**Option B — a real shareable link (recommended):**
1. Deploy the built app to a static host (Vercel, Netlify, Cloudflare Pages, or any
   HTTPS static server). Build output is the `dist/` folder.
2. Open the deployed `https://…` URL on the iPad in **Safari**.

**Install as an app:** in Safari tap **Share → Add to Home Screen**. Launch it from
the new icon — it runs full-screen like a native app and works offline.

> HTTPS (Option B) is required for full PWA/offline install and for the OneDrive
> share sheet. Over plain-HTTP LAN (Option A) the core features work for trying it
> out, but install/offline may be limited.

## Works on any device, not just iPad

This is a responsive web app, so the same link works on:
- **iPad** — the primary target (finger/Apple Pencil markup, Add to Home Screen).
- **iPhone / Android phones** — fully functional; the layout stacks to one column
  and the drawing canvas is smaller. Android Chrome can also “Install app”.
- **Desktop / laptop browsers** — works with a mouse/trackpad (drawing and
  signature use the pointer).

Data is stored **locally per device/browser** (IndexedDB), so reports created on the
iPad live on the iPad. Exporting to OneDrive is how reports are shared/centralized.
A future enhancement (below) can sync automatically.

## How it's built

- **React + TypeScript + Vite**, PWA via `vite-plugin-pwa`
- **fabric.js** — drawing/markup canvas
- **pdf.js** — render PDF drawings to the canvas
- **pdf-lib** — generate the combined report PDF and append to existing logs
- **idb** — IndexedDB storage

Templates are schema-driven (`src/templates/`). A new built-in form is one schema
file; custom forms are created in-app and stored in IndexedDB. The same generic form
renderer and PDF generator handle both.

## Prototype scope / next steps

- **Automatic OneDrive sync** via the Microsoft Graph API (hands-off upload to a
  specific job folder). The prototype uses the iOS share sheet and append-to-log.
- Multi-user cloud backend for a shared, server-side source of truth.
- More built-in templates.
