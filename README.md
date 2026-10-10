# mzollercreations

Website von **mzollercreations** – ein Team aus Entwicklern, das Marketing programmiert.

Live: https://mzollercreations.github.io/ (Deutsch) · https://mzollercreations.github.io/en/ (English)

## Aufbau

- `src/index.html` – Vorlage der Seite
- `src/i18n/de.json`, `src/i18n/en.json` – alle Texte
- `site.json` – URL, GitHub-Link und (optional) Kontakt-E-Mail
- `assets/` – CSS, JavaScript, Schriften (lokal, kein Google-CDN), Bilder
- `docs/` – erzeugte Seite, wird von GitHub Pages ausgeliefert

Nach jeder Änderung neu bauen:

```bash
python3 tools/build.py
```

Keine Abhängigkeiten, keine Bibliotheken: Scroll-Effekte mit `position: sticky` und einer
einzigen `requestAnimationFrame`-Schleife (`assets/js/main.js`), Partikel-Hintergrund auf
Canvas (`assets/js/field.js`).
