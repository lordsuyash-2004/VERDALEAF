"""Verdaleaf diagnosis PDF report generator (reportlab)."""
import base64
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import uharfbuzz as hb
from pathlib import Path
import logging

# ---- Indic script fonts (Hindi / Kannada) ----
# Noto script fonts have no Latin glyphs, so text is split into runs: Indic
# characters use the Noto font (with HarfBuzz shaping for conjuncts/matras),
# everything else falls back to Helvetica.
_FONT_DIR = Path(__file__).parent / "fonts"
_SCRIPT_FONTS = {
    "hi": ("NotoDeva", "NotoSansDevanagari-Regular.ttf", "NotoDeva-Bold", "NotoSansDevanagari-Bold.ttf"),
    "kn": ("NotoKnda", "NotoSansKannada-Regular.ttf", "NotoKnda-Bold", "NotoSansKannada-Bold.ttf"),
}
_REGISTERED = {}
for _lang, (_rn, _rf, _bn, _bf) in _SCRIPT_FONTS.items():
    try:
        for _n, _f in ((_rn, _rf), (_bn, _bf)):
            pdfmetrics.registerFont(TTFont(_n, str(_FONT_DIR / _f)))
        _REGISTERED[_lang] = (_rn, _bn)
    except Exception:  # pragma: no cover - font files missing
        logging.exception("Could not register %s fonts", _lang)

_SHAPE_CACHE = {}


def _shape(s, fname):
    """Shape an Indic run with HarfBuzz -> [(pdf_char, advance, x_off, y_off)] in em units.

    ReportLab's own shaping silently skips scripts like Kannada, so we shape here and
    place every glyph ourselves. Glyphs with no Unicode mapping (conjuncts, half forms)
    are mapped to private-use code points via ReportLab's hbAddPrivate so the subset
    embeds them correctly.
    """
    key = (s, fname)
    if key in _SHAPE_CACHE:
        return _SHAPE_CACHE[key]
    ttf = pdfmetrics.getFont(fname)
    hbf = ttf.hbFont(1000)  # also installs ttf.hbAddPrivate
    upem = ttf.hbFace.upem
    buf = hb.Buffer()
    buf.add_str(s)
    buf.guess_segment_properties()
    hb.shape(hbf, buf, {})
    out = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gid = info.codepoint
        chars = ttf.face.glyphToChar.get(gid)
        uc = chars[0] if chars else ttf.hbAddPrivate(hbf.glyph_to_string(gid), gid, ttf.pdfScale(pos.x_advance))
        out.append((chr(uc), pos.x_advance / upem, pos.x_offset / upem, pos.y_offset / upem))
    _SHAPE_CACHE[key] = out
    if len(_SHAPE_CACHE) > 4000:
        _SHAPE_CACHE.clear()
    return out


class _Typo:
    """Language-aware text measuring / drawing for user-facing diagnosis text."""

    def __init__(self, lang):
        self.fonts = _REGISTERED.get(lang)

    def _runs(self, text, font):
        text = str(text)
        if not self.fonts or not font.startswith("Helvetica"):
            return [(text, font)]
        script = self.fonts[1] if "Bold" in font else self.fonts[0]
        cmap = pdfmetrics.getFont(script).face.charToGlyph
        runs, cur, cur_font = [], "", None
        for ch in text:
            # Indic code points use Noto; spaces/digits/punctuation/Latin use Helvetica.
            f = script if (ord(ch) > 127 and ord(ch) in cmap) else font
            if f != cur_font and cur:
                runs.append((cur, cur_font))
                cur = ""
            cur_font = f
            cur += ch
        if cur:
            runs.append((cur, cur_font))
        return runs

    @staticmethod
    def _is_script(f):
        return f.startswith("Noto")

    def width(self, text, font, size):
        w = 0.0
        for s, f in self._runs(text, font):
            if self._is_script(f):
                w += sum(g[1] for g in _shape(s, f)) * size
            else:
                w += stringWidth(s, f, size)
        return w

    def draw(self, c, x, y, text, font, size):
        for s, f in self._runs(text, font):
            c.setFont(f, size)
            if self._is_script(f):
                for ch, adv, xo, yo in _shape(s, f):
                    c.drawString(x + xo * size, y + yo * size, ch)
                    x += adv * size
            else:
                c.drawString(x, y, s)
                x += stringWidth(s, f, size)

    def wrap(self, text, font, size, max_w):
        words = str(text).split()
        lines, cur = [], ""
        for w in words:
            trial = f"{cur} {w}".strip()
            if self.width(trial, font, size) <= max_w:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines or [""]


# Palette (botanical)
FOREST = HexColor("#1E3F20")
MOSS = HexColor("#4A6741")
SAGE = HexColor("#C9D8C5")
INK = HexColor("#1C2419")
MUTED = HexColor("#6B7A64")
AMBER = HexColor("#DDA76A")
RUST = HexColor("#D97757")
BG2 = HexColor("#EDF1EA")

PAGE_W, PAGE_H = A4
MARGIN = 48

SEV_COLORS = {"low": MOSS, "moderate": AMBER, "severe": RUST}

DISCLAIMER = ("AI-generated diagnosis - verify with a local agronomist "
              "before large-scale treatment.")


class _Doc:
    def __init__(self, buf, footer_id, typo):
        self.typo = typo
        self.c = canvas.Canvas(buf, pagesize=A4)
        self.y = PAGE_H - MARGIN
        self.footer_id = footer_id

    def ensure(self, needed):
        if self.y - needed < MARGIN + 40:
            self._footer()
            self.c.showPage()
            self.y = PAGE_H - MARGIN

    def _footer(self):
        c = self.c
        c.setStrokeColor(SAGE)
        c.setLineWidth(0.75)
        c.line(MARGIN, MARGIN + 18, PAGE_W - MARGIN, MARGIN + 18)
        c.setFont("Helvetica-Oblique", 7.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN, MARGIN + 6, DISCLAIMER)
        c.setFont("Helvetica", 7.5)
        c.drawRightString(PAGE_W - MARGIN, MARGIN + 6, f"Report {self.footer_id}")

    def section(self, title):
        self.ensure(48)
        c = self.c
        self.y -= 26
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(MOSS)
        c.drawString(MARGIN, self.y, title.upper())
        tw = stringWidth(title.upper(), "Helvetica-Bold", 9)
        c.setStrokeColor(SAGE)
        c.setLineWidth(0.75)
        c.line(MARGIN + tw + 10, self.y + 3, PAGE_W - MARGIN, self.y + 3)
        self.y -= 14

    def numbered_list(self, items):
        c = self.c
        for i, item in enumerate(items):
            lines = self.typo.wrap(item, "Helvetica", 10, PAGE_W - 2 * MARGIN - 26)
            self.ensure(len(lines) * 14 + 8)
            cy = self.y - 4
            c.setFillColor(SAGE)
            c.circle(MARGIN + 7, cy - 1, 7.5, stroke=0, fill=1)
            c.setFillColor(FOREST)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawCentredString(MARGIN + 7, cy - 4, str(i + 1))
            c.setFillColor(INK)
            for line in lines:
                self.typo.draw(c, MARGIN + 24, self.y - 8, line, "Helvetica", 10)
                self.y -= 14
            self.y -= 6

    def bullet_list(self, items):
        c = self.c
        for item in items:
            lines = self.typo.wrap(item, "Helvetica", 10, PAGE_W - 2 * MARGIN - 18)
            self.ensure(len(lines) * 14 + 4)
            c.setFillColor(MOSS)
            c.circle(MARGIN + 4, self.y - 5, 1.8, stroke=0, fill=1)
            c.setFillColor(INK)
            for line in lines:
                self.typo.draw(c, MARGIN + 14, self.y - 8, line, "Helvetica", 10)
                self.y -= 14
            self.y -= 3


def build_report_pdf(det: dict) -> bytes:
    buf = io.BytesIO()
    report_id = det.get("id") or "unsaved"
    typo = _Typo(det.get("language") or "en")
    doc = _Doc(buf, report_id, typo)
    c = doc.c

    # ---- Header band ----
    band_h = 84
    c.setFillColor(FOREST)
    c.rect(0, PAGE_H - band_h, PAGE_W, band_h, stroke=0, fill=1)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(MARGIN, PAGE_H - 40, "Verdaleaf")
    c.setFont("Helvetica", 10)
    c.setFillColor(SAGE)
    c.drawString(MARGIN, PAGE_H - 58, "Plant Disease Diagnosis Report")
    created = det.get("created_at") or datetime.now().isoformat()
    try:
        date_str = datetime.fromisoformat(str(created).replace("Z", "+00:00")).strftime("%B %d, %Y - %H:%M UTC")
    except ValueError:
        date_str = str(created)
    c.setFont("Helvetica", 9)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 40, date_str)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 56, f"Report ID: {report_id}")

    doc.y = PAGE_H - band_h - 32

    # ---- Photo + summary block ----
    img_size = 168
    img_x, img_top = MARGIN, doc.y
    drew_image = False
    data_url = det.get("image_data_url") or ""
    if "," in data_url:
        try:
            img_bytes = base64.b64decode(data_url.split(",", 1)[1])
            img = ImageReader(io.BytesIO(img_bytes))
            c.drawImage(img, img_x, img_top - img_size, img_size, img_size,
                        preserveAspectRatio=True, anchor='c', mask='auto')
            c.setStrokeColor(SAGE)
            c.setLineWidth(1)
            c.rect(img_x, img_top - img_size, img_size, img_size, stroke=1, fill=0)
            drew_image = True
        except Exception:
            pass

    tx = MARGIN + (img_size + 24 if drew_image else 0)
    ty = img_top - 6
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(MOSS)
    c.drawString(tx, ty, "DIAGNOSIS")
    ty -= 24
    c.setFillColor(INK)
    for line in typo.wrap(det.get("disease_name", "Unknown"), "Helvetica-Bold", 22, PAGE_W - MARGIN - tx):
        typo.draw(c, tx, ty, line, "Helvetica-Bold", 22)
        ty -= 26
    ty -= 2
    c.setFont("Helvetica", 11)
    c.setFillColor(MUTED)
    typo.draw(c, tx, ty, f"Plant: {det.get('plant', 'Unknown')}", "Helvetica", 11)
    ty -= 22

    is_healthy = bool(det.get("is_healthy"))
    severity = "healthy" if is_healthy else str(det.get("severity", "low"))
    sev_color = MOSS if is_healthy else SEV_COLORS.get(severity, MOSS)
    # severity pill
    pill_text = severity.capitalize()
    pw = stringWidth(pill_text, "Helvetica-Bold", 9) + 20
    c.setFillColor(sev_color)
    c.roundRect(tx, ty - 5, pw, 17, 8.5, stroke=0, fill=1)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(tx + pw / 2, ty, pill_text)
    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    c.drawString(tx + pw + 12, ty, f"{det.get('confidence', 0)}% confidence")
    ty -= 30

    # severity meter
    score = max(0, min(100, int(det.get("severity_score", 0))))
    bar_w = PAGE_W - MARGIN - tx
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(MOSS)
    c.drawString(tx, ty, f"SEVERITY  {score} / 100")
    ty -= 12
    c.setFillColor(BG2)
    c.roundRect(tx, ty - 4, bar_w, 8, 4, stroke=0, fill=1)
    if score > 0:
        c.setFillColor(sev_color)
        c.roundRect(tx, ty - 4, bar_w * score / 100, 8, 4, stroke=0, fill=1)

    doc.y = min(ty - 20, img_top - img_size - 12) if drew_image else ty - 20

    # ---- Sections ----
    symptoms = det.get("symptoms") or []
    if symptoms:
        doc.section("Symptoms observed")
        doc.bullet_list(symptoms)

    treatments = det.get("treatments") or []
    if treatments:
        doc.section("Recommended treatment")
        doc.numbered_list(treatments)

    prevention = det.get("prevention") or []
    if prevention:
        doc.section("Prevention")
        doc.numbered_list(prevention)

    doc._footer()
    c.showPage()
    c.save()
    return buf.getvalue()
