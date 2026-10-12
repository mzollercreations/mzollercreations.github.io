# Sapphire Creators

Website von **Sapphire Creators** – ein Team aus Entwicklern, das Marketing programmiert.
Weiß, Schwarz und ein Stein: ein live gerenderter Brillant (57 Facetten) statt Farbe.

Live: https://mzollercreations.github.io/ (Deutsch) · https://mzollercreations.github.io/en/ (English)

## Aufbau

- `src/index.html` – Vorlage der Startseite
- `src/projects.html` – Projektseite (`/projekte/`, `/en/projects/`): Fallstudie Melanie’s Massage
  mit Scroll-Video, Vorher/Nachher-Regler, Screenshots und Handy-Ansichten
- `src/partials/` – gemeinsame Teile (Kopf, Navigation, Fußzeile), eingebunden mit `{{> name}}`
- `src/i18n/de.json`, `src/i18n/en.json` – alle Texte
- `site.json` – Markenname, URL, GitHub-Link und (optional) Kontakt-E-Mail
- `assets/` – CSS, JavaScript, Schriften (lokal, kein Google-CDN), Bilder
- `assets/img/work/`, `assets/video/` – Screenshots (WebP) und Scroll-Videos (H.264) der Kundenprojekte
- `docs/` – erzeugte Seite, wird von GitHub Pages ausgeliefert

Nach jeder Änderung neu bauen:

```bash
python3 tools/build.py
```

Keine Abhängigkeiten, keine Bibliotheken: Scroll-Effekte mit `position: sticky` und einer
einzigen `requestAnimationFrame`-Schleife (`assets/js/main.js`), der Stein wird auf Canvas
aus seiner Geometrie gezeichnet (`assets/js/gem.js`). Schriften: Geist, Geist Mono,
Instrument Serif (kursiv).
