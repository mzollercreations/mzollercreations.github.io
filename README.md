# Sapphire Creators

Website von **Sapphire Creators** – ein Team aus Entwicklern: nach außen Marketing und Webdesign,
nach innen KI, die Firmen effizienter macht. Weiß, Schwarz und ein Stein: ein live gerenderter
Brillant (57 Facetten) statt Farbe – Krone = Marketing, Pavillon = KI-Effizienz.

Live: https://mzollercreations.github.io/ (Deutsch) · https://mzollercreations.github.io/en/ (English)

## Aufbau

- `src/index.html` – Vorlage der Startseite (Hero, »Zwei Seiten« Krone/Pavillon, Marketing-Karten,
  KI-Maschine `#ki`, zwei Projekte, Team, Prozess, Kontakt)
- `src/ai.html` – KI-Effizienz (`/ki-effizienz/`, `/en/ai-efficiency/`): Zeitfresser-Rechner, Bereiche,
  Kurzfassung Projekt Stapel, Arbeitsweise, FAQ
- `src/projects.html` – Projektseite (`/projekte/`, `/en/projects/`): Fallstudien Melanie’s Massage
  und **Projekt Stapel** (anonymisiert, siehe unten)
- `tools/drawing.py` – erzeugt die Zeichnungs-Illustration (`{{dwg}}`) und den Lichtweg im Stein (`{{bp_rays}}`)
- `src/partials/` – gemeinsame Teile (Kopf, Navigation, Fußzeile), eingebunden mit `{{> name}}`
- `src/i18n/de.json`, `src/i18n/en.json` – alle Texte
- `site.json` – Markenname, URL, GitHub-Link und (optional) Kontakt-E-Mail
- `assets/` – CSS, JavaScript, Schriften (lokal, kein Google-CDN), Bilder
- `assets/img/work/`, `assets/video/` – Screenshots (WebP) und Scroll-Videos (H.264) der Kundenprojekte
- `docs/` – erzeugte Seite, wird von GitHub Pages ausgeliefert

## Projekt Stapel – vertraulich

Die Fallstudie beruht auf einem echten, vertraulichen Kundenprojekt (Steuerungstechnik eines
Palettenstaplers). Auf der Seite stehen deshalb **nie**: Kunden- oder Produktname, Teilenummern,
Herstellernamen von Komponenten oder Originalpläne. Die Zeichnung ist eine eigene Illustration
(`tools/drawing.py`); alle Zahlen (84 Min., 27 Blatt, 13/13, 40 → 0 …) stammen aus dem echten Projekt.

Nach jeder Änderung neu bauen:

```bash
python3 tools/build.py
```

`build.py` schreibt auch `sitemap.xml` und `robots.txt`. OG-Bilder: `assets/img/og-{de,en}.png`,
`og-ai-*.png`, `og-projects-*.png`.

Keine Abhängigkeiten, keine Bibliotheken: Scroll-Effekte mit `position: sticky` und einer
einzigen `requestAnimationFrame`-Schleife (`assets/js/main.js`), der Stein wird auf Canvas
aus seiner Geometrie gezeichnet (`assets/js/gem.js`). Schriften: Geist, Geist Mono,
Instrument Serif (kursiv).
