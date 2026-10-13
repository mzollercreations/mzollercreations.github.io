"""Generated SVG for the site: the drawing sheet and the light path through the stone.

The sheet is an ILLUSTRATION for the anonymised case study »Projekt Stapel«: a generic
electro-pneumatic circuit (ISO 1219 / IEC 60617 style) drawn from scratch – it is not
taken from the confidential original plans. Every stroke gets pathLength="1" so CSS can
draw it in; --k staggers the groups.
"""
import html
import math


def _p(d, k, cls="ink", extra=""):
    return f'<path class="{cls}" style="--k:{k}" pathLength="1" d="{d}"{extra}/>'


def _t(x, y, s, cls="", anchor="start", k=0):
    a = "" if anchor == "start" else f' text-anchor="{anchor}"'
    c = f' class="{cls}"' if cls else ""
    return f'<text x="{x}" y="{y}"{a}{c} style="--k:{k}">{html.escape(s)}</text>'


def _arrow(x0, y0, x1, y1, k, size=7, half=2.6):
    """Flow arrow inside a valve box: line + filled head at (x1, y1)."""
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    bx, by = x1 - ux * size, y1 - uy * size
    px, py = -uy * half, ux * half
    line = _p(f"M{x0} {y0}L{bx:.1f} {by:.1f}", k)
    head = (f'<path class="head" style="--k:{k}" d="M{x1} {y1}L{bx + px:.1f} {by + py:.1f}'
            f'L{bx - px:.1f} {by - py:.1f}Z"/>')
    return line + head


def sheet(t):
    """t: i18n dict (dwg_* keys)."""
    W, H = 840, 594
    o = []
    # ---- frame with zone markers ----
    o.append('<g class="dwg-frame">')
    o.append(f'<rect class="paper" x="0" y="0" width="{W}" height="{H}" rx="4"/>')
    o.append(_p("M8 8H832V586H8Z", 0, "thin"))
    o.append(_p("M22 22H818V572H22Z", 0))
    zw = (818 - 22) / 8
    for i in range(1, 8):
        x = 22 + zw * i
        o.append(_p(f"M{x:.1f} 8V22M{x:.1f} 572V586", 0, "thin"))
    for i in range(8):
        x = 22 + zw * (i + 0.5)
        o.append(_t(f"{x:.1f}", 18, str(i + 1), "zone", "middle"))
    zh = (572 - 22) / 6
    for i in range(1, 6):
        y = 22 + zh * i
        o.append(_p(f"M8 {y:.1f}H22M818 {y:.1f}H832", 0, "thin"))
    for i in range(6):
        y = 22 + zh * (i + 0.5) + 3
        o.append(_t(15, f"{y:.1f}", "ABCDEF"[i], "zone", "middle"))
    o.append("</g>")

    # ---- title block ----
    o.append('<g class="dwg-tb">')
    o.append(_p("M540 520H818M540 538H818M540 555H818M540 520V572M730 520V555M640 538V555", 1, "thin"))
    o.append(_t(546, 532, t["dwg_title"], "tb-b", k=1))
    o.append(_t(736, 532, t["dwg_sheet"], "tb", k=1))
    o.append(_t(546, 549, t["dwg_scope"], "tb", k=1))
    o.append(_t(646, 549, "IEC 60617", "tb", k=1))
    o.append(_t(736, 549, "Rev. 02", "tb", k=1))
    o.append(_t(546, 566, t["dwg_note"], "tb", k=1))
    o.append("</g>")

    # ---- pneumatics: double-acting cylinder + 5/2 solenoid valve, spring return ----
    o.append('<g class="dwg-ink">')
    o.append(_p("M110 110H330V160H110Z", 2))                              # barrel
    o.append('<path class="fill" style="--k:3" d="M166 110h10v50h-10z"/>')  # piston
    o.append(_p("M176 130H392M176 140H392M392 130V140", 3))               # rod
    o.append(_p("M150 98V110M300 98V110", 3, "thin"))                     # end positions
    o.append(_p("M235 290V230H126V160", 5))                               # 4 → cap end
    o.append(_p("M265 290V250H314V160", 5))                               # 2 → rod end
    o.append(_p("M160 290H280V350H160ZM220 290V350", 4))                  # two boxes
    o.append(_arrow(250, 350, 265, 290, 6))                               # rest: 1 → 2
    o.append(_arrow(235, 290, 230, 350, 6))                               #       4 → 5
    o.append(_p("M270 350V341M264 341H276", 6))                           #       3 closed
    o.append(_arrow(190, 350, 175, 290, 6))                               # switched: 1 → 4
    o.append(_arrow(205, 290, 210, 350, 6))                               #           2 → 3
    o.append(_p("M170 350V341M164 341H176", 6))                           #           5 closed
    o.append(_p("M128 305H160V335H128ZM128 335L160 305", 7))              # solenoid
    o.append(_p("M280 320L286 308L294 332L302 308L310 332L318 308L322 320", 7))  # spring
    o.append(_p("M250 350V420H152", 8))                                   # supply
    o.append(_p("M152 420a3 3 0 1 0 -6 0a3 3 0 1 0 6 0", 8, "thin"))
    o.append(_p("M230 350V362M224 362H236L230 372Z", 8))                  # exhaust 5
    o.append(_p("M270 350V362M264 362H276L270 372Z", 8))                  # exhaust 3
    o.append("</g>")
    o.append('<g class="dwg-txt">')
    for s in (
        _t(102, 139, "-MM1", "lbl", "end", 3),
        _t(150, 92, "-BG1", "sm", "middle", 3),
        _t(300, 92, "-BG2", "sm", "middle", 3),
        _t(229, 284, "4", "sm", "end", 6),
        _t(271, 284, "2", "sm", "start", 6),
        _t(226, 360, "5", "sm", "end", 8),
        _t(246, 364, "1", "sm", "end", 8),
        _t(276, 360, "3", "sm", "start", 8),
        _t(144, 352, "-MB1", "sm", "middle", 7),
        _t(330, 324, "-QM1", "lbl", "start", 7),
        _t(140, 424, "6 bar", "sm", "end", 8),
    ):
        o.append(s)
    o.append("</g>")

    # ---- electrics: three current paths between +24 V and 0 V ----
    o.append('<g class="dwg-ink">')
    o.append(_p("M470 100H790", 9))
    o.append(_p("M470 470H790", 9))
    for x in (540, 640):                                                  # NO contacts
        o.append(_p(f"M{x} 100V175", 10))
        o.append(_p(f"M{x} 215L{x - 13} 178", 11))
        o.append(_p(f"M{x} 215V300", 12))
        o.append(_p(f"M{x - 15} 300h30v24h-30z", 12))                     # coils
        o.append(_p(f"M{x} 324V470", 13))
    o.append(_p("M740 100V175M740 175h12", 10))                           # NC contact
    o.append(_p("M740 215L753 172", 11))
    o.append(_p("M740 215V301", 12))
    o.append(_p("M727 314a13 13 0 1 0 26 0a13 13 0 1 0 -26 0", 12))       # lamp
    o.append(_p("M730.8 304.8L749.2 323.2M749.2 304.8L730.8 323.2", 12))
    o.append(_p("M740 327V470", 13))
    for x in (540, 640, 740):
        o.append(f'<circle class="dot" style="--k:13" cx="{x}" cy="100" r="2.6"/>')
        o.append(f'<circle class="dot" style="--k:13" cx="{x}" cy="470" r="2.6"/>')
    o.append("</g>")
    o.append('<g class="dwg-txt">')
    for s in (
        _t(464, 104, "+24V", "lbl", "end", 9),
        _t(464, 474, "0V", "lbl", "end", 9),
        _t(522, 200, "-KF2", "lbl", "end", 11),
        _t(546, 181, "13", "sm", "start", 11), _t(546, 214, "14", "sm", "start", 11),
        _t(520, 316, "-KF1", "lbl", "end", 12),
        _t(560, 307, "A1", "sm", "start", 12), _t(560, 325, "A2", "sm", "start", 12),
        _t(622, 200, "-KF1", "lbl", "end", 11),
        _t(646, 181, "13", "sm", "start", 11), _t(646, 214, "14", "sm", "start", 11),
        _t(620, 316, "-MB1", "lbl", "end", 12),
        _t(660, 307, "A1", "sm", "start", 12), _t(660, 325, "A2", "sm", "start", 12),
        _t(722, 200, "-KF1", "lbl", "end", 11),
        _t(758, 181, "21", "sm", "start", 11), _t(758, 214, "22", "sm", "start", 11),
        _t(720, 318, "-PF1", "lbl", "end", 12),
        _t(760, 307, "X1", "sm", "start", 12), _t(760, 325, "X2", "sm", "start", 12),
        _t(540, 90, "1", "sm", "middle", 9), _t(640, 90, "2", "sm", "middle", 9), _t(740, 90, "3", "sm", "middle", 9),
        # contact mirror of -KF1: where its contacts are used (current path)
        _t(548, 352, "13-14 › 2", "sm", "start", 13), _t(548, 365, "21-22 › 3", "sm", "start", 13),
    ):
        o.append(s)
    o.append("</g>")

    return (f'<svg class="dwg" viewBox="0 0 {W} {H}" role="img" aria-label="{html.escape(t["dwg_alt"])}">'
            + "".join(o) + "</svg>")


def light_rays():
    """Light falling straight down through the table, traced through the stone's outline
    (the blueprint's real angles: crown 34.5°, pavilion 40.8°). Inside, every facet hit
    beyond the critical angle reflects totally; the first one below it refracts the ray
    out again (sapphire n = 1.77). Two mirrored rays."""
    n = 1.77
    poly = [(148, 82), (372, 82), (460, 142), (460, 148), (260, 320), (60, 148), (60, 142), (148, 82)]
    segs = list(zip(poly, poly[1:]))

    def hit(px, py, dx, dy):
        best = None
        for (ax, ay), (bx, by) in segs:
            ex, ey = bx - ax, by - ay
            den = dx * ey - dy * ex
            if abs(den) < 1e-9:
                continue
            s = ((ax - px) * ey - (ay - py) * ex) / den        # along the ray
            u = ((ax - px) * dy - (ay - py) * dx) / den        # along the segment
            if s > 1e-6 and -1e-9 <= u <= 1 + 1e-9 and (best is None or s < best[0]):
                L = math.hypot(ex, ey)
                nx, ny = ey / L, -ex / L                       # outward for this winding
                best = (s, nx, ny)
        return best

    out = []
    for x0 in (196, 324):
        px, py, dx, dy = x0, 82.0, 0.0, 1.0
        pts = [(x0, -24), (px, py)]
        for _ in range(8):
            s, nx, ny = hit(px, py, dx, dy)
            px, py = px + dx * s, py + dy * s
            pts.append((px, py))
            c = dx * nx + dy * ny                              # cos of incidence (> 0: leaving)
            if n * math.sqrt(max(0.0, 1 - c * c)) < 1:          # below critical angle → out
                tx, ty = dx - c * nx, dy - c * ny               # tangential part
                tx, ty = tx * n, ty * n
                k = math.sqrt(max(0.0, 1 - (tx * tx + ty * ty)))
                dx, dy = tx + k * nx, ty + k * ny
                L = 118
                pts.append((px + dx * L, py + dy * L))
                break
            dx, dy = dx - 2 * c * nx, dy - 2 * c * ny          # total internal reflection
        d = "M" + "L".join(f"{qx:.1f} {qy:.1f}" for qx, qy in pts)
        out.append(f'<path class="ray-glow" pathLength="1" d="{d}"/><path class="ray" pathLength="1" d="{d}"/>')
        ex, ey = pts[-2]                                       # exit point on the crown
        out.append(f'<path class="ray-spark" d="M{ex:.1f} {ey - 9:.1f}l1.6 7.4 7.4 1.6-7.4 1.6-1.6 7.4'
                   f'-1.6-7.4-7.4-1.6 7.4-1.6z"/>')
    return "".join(out)


if __name__ == "__main__":
    print(light_rays())
