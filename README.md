# Church Announcements

Simple. Open a file, add announcements, click one to show it.

## Setup

1. Unzip this folder anywhere.
2. Double-click **index.html** — that's your control panel.
3. In OBS: Sources → Add → Browser Source → check "Local file" →
   select **display.html**. Leave "Shutdown source when not visible"
   unchecked.

That's it — no server, no install.

## Using it

- Fill in the form on the left and click **+ Add Announcement**. It
  appears in the list on the right, stacked one below another.
- **Click any announcement in the list to show it on screen right
  away.** The one currently live is highlighted in amber.
- **Hide / Clear Screen** blanks the display.
- Use the ▲ / ▼ buttons on a card to reorder the list.
- **Edit** / **Delete** on a card to change or remove it.
- **Export** / **Import** save and load your list as a `.json` file
  for backup or moving to another computer.
- **Open Display Window** pops open `display.html` in a normal window
  so you can preview it before pointing OBS at it.

Everything is saved automatically to this browser as you go.

## Preflight check

Before copying the folder to a production OBS machine, run this from the
folder containing `app.js`:

```powershell
node tests/obs-preflight-check.js
```

It verifies the controller and OBS display scripts still parse and retain the
key hand-off, style fallback, text-safety, and image-size protections.
