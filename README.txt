Earworm Log · บันทึกเพลงติดหู

A phone web app for the song stuck in your head. Eight short questions per log (which song, which part plays, where you are, what you were thinking, feelings and loudness 0 to 10, what the words seem to say, another way to read it, what helped, loudness after), or a quick log of song and loudness. Each song has a page with a 30-second preview, links out to the whole song, YouTube and the words, its stats, every log, and dated thoughts. Charts: earworms per day, hour by weekday, most frequent songs, what helped by how much the song faded, feelings. Export to CSV or a JSON backup. English and Thai.

Live: https://nanobotco.github.io/earworm/
Install: open that link on the phone, Chrome menu, Add to home screen (Safari: Share, Add to Home Screen). It works offline after the first visit; song search needs a connection.

Storage: localStorage in the browser (keys earworm-log-v1, earworm-draft-v1, earworm-lang). No sync.
Song search: Apple's iTunes Search API, called from the browser. Titles and artists only; lyrics are linked out, not shown.

Files: docs/index.html, style.css, app.js (the app), logic.js (data logic, no DOM), i18n.js (EN and TH strings), sw.js (offline shell), manifest.webmanifest, icons, card.jpg, fonts/ (Atkinson Hyperlegible, Sarabun; SIL OFL).
Tests: npm test (Node 20 or later, no dependencies).
Local preview: npm run serve, then http://localhost:8962/
Art: python3 tools/make_art.py redraws the icons and share card (Pillow).

Code: MIT.
