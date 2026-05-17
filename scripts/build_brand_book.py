"""Build the iPrime Brand Book (.docx).

Generates docs/iPrime-Brand-Book.docx — a full ~25-page brand book using the
customer-app color tokens, Roboto Extra Bold for the wordmark, positioned as
"Lagos' fastest logistics + bills rail", and tuned for external partners and
agencies (clearspace, misuse, file formats, co-branding).
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Emu, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsmap
from docx.oxml import OxmlElement
from pathlib import Path

# ─── Brand tokens (mirrored from mobile/customer-app/src/theme/tokens.js) ─────
INK = "09090b"
CANVAS = "FAFAFA"
SURFACE = "FFFFFF"
SURFACE_MUTED = "F3F4F6"
SURFACE_STRONG = "E5E7EB"
MUTED = "6B7280"
PLACEHOLDER = "9CA3AF"

BRAND = "EA580C"
BRAND_STRONG = "C2410C"
BRAND_SOFT = "FFF7ED"
BRAND_SOFT_BORDER = "FED7AA"

ERROR = "EF4444"
ERROR_STRONG = "DC2626"
SUCCESS = "10B981"
SUCCESS_STRONG = "059669"
WARNING = "D97706"
WARNING_STRONG = "B45309"
INFO = "2563EB"
INFO_STRONG = "1D4ED8"

CAT_FOOD = "EA580C"
CAT_PACKAGE = "2563EB"
CAT_PHARMACY = "059669"
CAT_GROCERIES = "7C3AED"
CAT_AIRTIME = "EA580C"
CAT_DATA = "2563EB"
CAT_ELECTRICITY = "D97706"
CAT_TRANSFER = "059669"

DARK_CANVAS = "0B0B0F"
DARK_SURFACE = "16161C"
DARK_SURFACE_MUTED = "1F1F27"
DARK_TEXT = "F4F4F5"
DARK_MUTED = "A1A1AA"
DARK_BRAND = "FB923C"
DARK_BRAND_STRONG = "FDBA74"

PRIMARY_FONT = "Roboto"
FALLBACK_FONT = "Calibri"

OUT_PATH = Path("docs/iPrime-Brand-Book.docx")


# ─── helpers ──────────────────────────────────────────────────────────────────

def shade(elem, hex_color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    elem.append(shd)


def set_cell_shade(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shade(tc_pr, hex_color)


def set_cell_border(cell, color="FFFFFF", size="4"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), size)
        b.set(qn("w:color"), color)
        borders.append(b)
    tc_pr.append(borders)


def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = OxmlElement("w:tcMar")
    for side, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement(f"w:{side}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        tc_mar.append(node)
    tc_pr.append(tc_mar)


def set_cell_width(cell, cm):
    cell.width = Cm(cm)


def page_background(section, hex_color):
    """Apply a fill color across the whole page via a giant rectangle."""
    # Word doesn't truly support per-section page color; we approximate
    # with a section fill via <w:background>. Only one bg per doc.
    pass


def set_doc_background(doc, hex_color):
    bg = OxmlElement("w:background")
    bg.set(qn("w:color"), hex_color)
    doc.element.insert(0, bg)
    display_bg = OxmlElement("w:displayBackgroundShape")
    settings = doc.settings.element
    settings.append(display_bg)


def add_run(paragraph, text, *, font=PRIMARY_FONT, size=11, bold=False,
            color=INK, letter_spacing=None, italic=False):
    run = paragraph.add_run(text)
    run.font.name = font
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:ascii"), font)
    rFonts.set(qn("w:hAnsi"), font)
    rFonts.set(qn("w:cs"), font)
    rFonts.set(qn("w:eastAsia"), font)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)
    if letter_spacing is not None:
        spacing = OxmlElement("w:spacing")
        spacing.set(qn("w:val"), str(letter_spacing))
        rPr.append(spacing)
    return run


def add_para(doc_or_cell, text="", *, font=PRIMARY_FONT, size=11, bold=False,
             color=INK, align=WD_ALIGN_PARAGRAPH.LEFT, space_after=6,
             space_before=0, letter_spacing=None, italic=False,
             line_spacing=1.35):
    p = doc_or_cell.add_paragraph() if hasattr(doc_or_cell, "add_paragraph") else doc_or_cell.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = line_spacing
    if text:
        add_run(p, text, font=font, size=size, bold=bold, color=color,
                letter_spacing=letter_spacing, italic=italic)
    return p


def page_break(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def section_eyebrow(doc, text, color=BRAND):
    add_para(doc, text.upper(), font=PRIMARY_FONT, size=9, bold=True,
             color=color, letter_spacing=120, space_after=6, space_before=0)


def section_title(doc, text, size=34, color=INK, space_after=18):
    add_para(doc, text, font=PRIMARY_FONT, size=size, bold=True, color=color,
             space_after=space_after, space_before=0, line_spacing=1.05)


def section_kicker(doc, text, color=MUTED):
    add_para(doc, text, font=PRIMARY_FONT, size=11, color=color,
             space_after=18, line_spacing=1.55)


def divider(doc, color=SURFACE_STRONG):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.autofit = False
    cell = tbl.rows[0].cells[0]
    cell.width = Cm(17)
    set_cell_shade(cell, color)
    set_cell_border(cell, color=color, size="2")
    set_cell_margins(cell, top=0, bottom=0, left=0, right=0)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.space_before = Pt(0)
    add_run(p, "", size=1, color=color)
    add_para(doc, "", size=2, space_after=10)


def empty_line(doc, pt=10):
    add_para(doc, "", size=2, space_after=pt)


# ─── color chip table ─────────────────────────────────────────────────────────

def color_chip_row(doc, swatches, *, chip_height_cm=2.4, cols_per_row=None):
    """swatches: list of dicts with keys: hex, name, role, text_on (hex)."""
    cols = cols_per_row or len(swatches)
    tbl = doc.add_table(rows=1, cols=cols)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    for i, sw in enumerate(swatches[:cols]):
        cell = tbl.rows[0].cells[i]
        cell.vertical_alignment = WD_ALIGN_VERTICAL.BOTTOM
        set_cell_width(cell, 17.0 / cols)
        set_cell_shade(cell, sw["hex"])
        set_cell_border(cell, color="FFFFFF", size="12")
        set_cell_margins(cell, top=320, bottom=160, left=200, right=200)
        # name
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        add_run(p, sw["name"], font=PRIMARY_FONT, size=11, bold=True,
                color=sw.get("text_on", "FFFFFF"))
        # hex
        p2 = cell.add_paragraph()
        p2.paragraph_format.space_after = Pt(2)
        add_run(p2, "#" + sw["hex"], font=PRIMARY_FONT, size=9,
                color=sw.get("text_on", "FFFFFF"), letter_spacing=40)
        # role
        if sw.get("role"):
            p3 = cell.add_paragraph()
            p3.paragraph_format.space_after = Pt(0)
            add_run(p3, sw["role"], font=PRIMARY_FONT, size=8,
                    color=sw.get("text_on", "FFFFFF"))
        # spacer
        p4 = cell.add_paragraph()
        add_run(p4, "", size=1, color=sw["hex"])
    add_para(doc, "", size=2, space_after=6)


# ─── builders for individual pages ───────────────────────────────────────────

def add_cover(doc):
    """Cover page — large iPrime wordmark, eyebrow, positioning."""
    # vertical padding
    for _ in range(6):
        add_para(doc, "", size=10, space_after=0)

    # eyebrow
    add_para(doc, "iPrime  ·  Brand Book", font=PRIMARY_FONT, size=10, bold=True,
             color=BRAND, letter_spacing=200, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=40)

    # wordmark
    add_para(doc, "iPrime", font=PRIMARY_FONT, size=140, bold=True, color=INK,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_after=24,
             letter_spacing=-40, line_spacing=1.0)

    # rule
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    rule = tbl.rows[0].cells[0]
    rule.width = Cm(2.4)
    set_cell_shade(rule, BRAND)
    set_cell_border(rule, color=BRAND, size="4")
    set_cell_margins(rule, top=0, bottom=0, left=0, right=0)
    add_run(rule.paragraphs[0], "", size=2, color=BRAND)
    add_para(doc, "", size=2, space_after=18)

    # tagline
    add_para(doc, "Lagos' fastest logistics + bills rail.",
             font=PRIMARY_FONT, size=18, color=INK, bold=False,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_after=60,
             line_spacing=1.3)

    # footer block
    for _ in range(6):
        add_para(doc, "", size=10, space_after=0)

    add_para(doc, "VERSION 1.0   ·   PARTNER & AGENCY EDITION   ·   2026",
             font=PRIMARY_FONT, size=9, bold=True, color=MUTED,
             letter_spacing=160, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)

    page_break(doc)


def add_contents(doc):
    section_eyebrow(doc, "Contents")
    section_title(doc, "What's inside.", size=40)
    section_kicker(doc, "A working brand book for the teams, partners and agencies that build with us. "
                        "Skim it. Bookmark it. Bring it to every kickoff.")
    empty_line(doc, 16)

    sections = [
        ("01", "Brand", ["The story", "Positioning", "Mission, vision, principles"]),
        ("02", "Logo", ["The iPrime wordmark", "Clearspace & sizing", "Misuse"]),
        ("03", "Colour", ["Primary palette", "Neutrals", "Status colours", "Category colours", "Dark mode"]),
        ("04", "Type", ["Roboto, the iPrime way", "Hierarchy & usage"]),
        ("05", "UI", ["Product principles", "Iconography"]),
        ("06", "Voice", ["How iPrime speaks", "Examples"]),
        ("07", "Imagery", ["Photography direction", "Illustration"]),
        ("08", "Partners", ["Co-branding", "Do's and don'ts", "Asset formats"]),
        ("09", "Contact", ["Working with us"]),
    ]

    for num, name, items in sections:
        tbl = doc.add_table(rows=1, cols=3)
        tbl.autofit = False
        tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
        c_num, c_name, c_items = tbl.rows[0].cells
        set_cell_width(c_num, 2.0)
        set_cell_width(c_name, 5.0)
        set_cell_width(c_items, 10.0)
        for c in (c_num, c_name, c_items):
            set_cell_border(c, color="FFFFFF", size="4")
            set_cell_margins(c, top=160, bottom=160, left=0, right=120)
            c.vertical_alignment = WD_ALIGN_VERTICAL.TOP

        p = c_num.paragraphs[0]
        add_run(p, num, font=PRIMARY_FONT, size=22, bold=True, color=BRAND,
                letter_spacing=-20)

        p = c_name.paragraphs[0]
        add_run(p, name, font=PRIMARY_FONT, size=20, bold=True, color=INK,
                letter_spacing=-10)

        p = c_items.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        add_run(p, "  ".join(items).upper() if False else "  ·  ".join(items),
                font=PRIMARY_FONT, size=10, color=MUTED)

        empty_line(doc, 4)

    page_break(doc)


def add_brand_story(doc):
    section_eyebrow(doc, "01 — Brand")
    section_title(doc, "The story.", size=44)
    section_kicker(doc, "Lagos doesn't slow down. Neither do we.")

    add_para(doc,
             "iPrime started where most logistics companies stop — at the last mile, "
             "on the third call back, in the line at the agent shop. We saw a city that "
             "wanted everything faster: food at the door, packages across the lagoon, "
             "airtime in two taps, light bills cleared before sunset.",
             size=12, color=INK, line_spacing=1.7, space_after=12)

    add_para(doc,
             "So we built one rail. One app where a rider, a corner pharmacy, a "
             "thirteen-year-old buying data for school, and a finance team paying a "
             "fleet of agents all move through the same place — fast.",
             size=12, color=INK, line_spacing=1.7, space_after=12)

    add_para(doc,
             "This book is how we keep that promise visible — in every screen, every "
             "billboard, every receipt, every partner pitch deck. It's short, it's "
             "specific, and it's the truth about how iPrime looks and sounds.",
             size=12, color=INK, line_spacing=1.7, space_after=24)

    # pull quote
    tbl = doc.add_table(rows=1, cols=1)
    tbl.autofit = False
    cell = tbl.rows[0].cells[0]
    set_cell_width(cell, 17)
    set_cell_shade(cell, BRAND_SOFT)
    set_cell_border(cell, color=BRAND_SOFT_BORDER, size="6")
    set_cell_margins(cell, top=400, bottom=400, left=400, right=400)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_run(p, "“", font=PRIMARY_FONT, size=40, bold=True, color=BRAND)
    p2 = cell.add_paragraph()
    add_run(p2, "Lagos' fastest logistics and bills rail.",
            font=PRIMARY_FONT, size=22, bold=True, color=INK,
            letter_spacing=-15)
    p3 = cell.add_paragraph()
    p3.paragraph_format.space_before = Pt(8)
    add_run(p3, "One rail. Every errand. Built for the speed Lagos demands.",
            font=PRIMARY_FONT, size=11, color=MUTED)

    page_break(doc)


def add_positioning(doc):
    section_eyebrow(doc, "01 — Brand")
    section_title(doc, "Positioning.", size=44)
    section_kicker(doc, "Where iPrime sits in the market, and the words we use to say so.")

    # Two-column pillars
    pillars = [
        ("Category",
         "We are a rail, not an app feature. iPrime carries deliveries and digital "
         "payments on the same infrastructure — couriers, agents, merchants and "
         "customers all clear through one network."),
        ("For",
         "Lagosians who pay for time. Households, hustlers, busy parents, the "
         "always-on workforce — anyone who would rather tap once than queue twice."),
        ("Promise",
         "Fastest in the city, cleanest in the inbox. We don't out-discount the "
         "market; we out-deliver it. Speed, reliability, and a product that respects "
         "the user's attention."),
        ("Proof",
         "Real riders. Real bills paid on time. Real airtime credited in seconds. "
         "Every benchmark we publish is measured at the customer's end, not ours."),
    ]
    for label, body in pillars:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 4.5)
        set_cell_width(r, 12.5)
        for c in (l, r):
            set_cell_border(c, color="FFFFFF", size="4")
            set_cell_margins(c, top=200, bottom=200, left=0, right=200)
            c.vertical_alignment = WD_ALIGN_VERTICAL.TOP
        p = l.paragraphs[0]
        add_run(p, label.upper(), font=PRIMARY_FONT, size=10, bold=True,
                color=BRAND, letter_spacing=160)
        p = r.paragraphs[0]
        add_run(p, body, font=PRIMARY_FONT, size=12, color=INK)
        # rule
        empty_line(doc, 2)
        divider(doc, color=SURFACE_STRONG)

    page_break(doc)


def add_principles(doc):
    section_eyebrow(doc, "01 — Brand")
    section_title(doc, "Mission, vision, principles.", size=36)
    section_kicker(doc, "Short enough to remember in a meeting.")

    blocks = [
        ("Mission",
         "Move everything Lagos needs — parcels, payments, prescriptions, power bills "
         "— through one fast, trusted rail."),
        ("Vision",
         "A city where the wait is the rare exception, not the daily rule."),
    ]
    for label, body in blocks:
        section_eyebrow(doc, label, color=BRAND)
        add_para(doc, body, size=20, bold=True, color=INK, line_spacing=1.3,
                 letter_spacing=-10, space_after=18)
        divider(doc)

    section_eyebrow(doc, "Principles")
    add_para(doc, "Five rules that decide every call.", size=20, bold=True,
             color=INK, letter_spacing=-10, space_after=18)

    principles = [
        ("Speed is the product.",
         "If something is slower than the alternative, it's broken. Even when it works."),
        ("Respect the user's attention.",
         "Every screen earns its place. No dark patterns, no growth hacks that "
         "borrow against trust."),
        ("Operations is design.",
         "A failed delivery is a UX bug. A wrong receipt is a UX bug. We own the "
         "whole path."),
        ("Boring on the inside.",
         "Magic on the outside is built on dull, well-tested machinery. Predictable "
         "internals make delightful experiences."),
        ("Local first, then everywhere.",
         "Win Lagos with depth, not coverage. The book exports better than the speed."),
    ]
    for i, (title, body) in enumerate(principles, start=1):
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 1.4)
        set_cell_width(r, 15.6)
        set_cell_border(l, color="FFFFFF", size="4")
        set_cell_border(r, color="FFFFFF", size="4")
        set_cell_margins(l, top=160, bottom=160, left=0, right=120)
        set_cell_margins(r, top=160, bottom=160, left=0, right=120)
        p = l.paragraphs[0]
        add_run(p, f"0{i}", font=PRIMARY_FONT, size=16, bold=True, color=BRAND)
        p = r.paragraphs[0]
        add_run(p, title, font=PRIMARY_FONT, size=14, bold=True, color=INK,
                letter_spacing=-8)
        p2 = r.add_paragraph()
        p2.paragraph_format.space_before = Pt(2)
        add_run(p2, body, font=PRIMARY_FONT, size=11, color=MUTED)

    page_break(doc)


def add_logo_primary(doc):
    section_eyebrow(doc, "02 — Logo")
    section_title(doc, "The iPrime wordmark.", size=40)
    section_kicker(doc,
                   "One mark, set in Roboto Extra Bold, with the casing iPrime. "
                   "The lowercase i, capital P signature is fixed — it is the logo.")

    # Logo display block
    tbl = doc.add_table(rows=1, cols=1)
    tbl.autofit = False
    cell = tbl.rows[0].cells[0]
    set_cell_width(cell, 17)
    set_cell_shade(cell, CANVAS)
    set_cell_border(cell, color=SURFACE_STRONG, size="6")
    set_cell_margins(cell, top=900, bottom=900, left=400, right=400)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(p, "iPrime", font=PRIMARY_FONT, size=120, bold=True, color=INK,
            letter_spacing=-40)

    empty_line(doc, 12)

    # Spec table
    rows = [
        ("Typeface", "Roboto"),
        ("Weight", "Extra Bold (900)"),
        ("Casing", "iPrime — lowercase i, capital P, lowercase rime. Never iprime, IPRIME, or Iprime."),
        ("Tracking", "−40 (tight, optical)"),
        ("Colour", f"Ink #{INK} on light surfaces  ·  #{CANVAS} on dark surfaces  ·  Brand orange #{BRAND} reserved for special-edition use only."),
    ]
    for label, body in rows:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 4.0)
        set_cell_width(r, 13.0)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=180, bottom=180, left=180, right=180)
            c.vertical_alignment = WD_ALIGN_VERTICAL.TOP
        add_run(l.paragraphs[0], label.upper(), font=PRIMARY_FONT, size=9,
                bold=True, color=MUTED, letter_spacing=140)
        add_run(r.paragraphs[0], body, font=PRIMARY_FONT, size=11, color=INK)

    page_break(doc)


def add_logo_clearspace(doc):
    section_eyebrow(doc, "02 — Logo")
    section_title(doc, "Clearspace & sizing.", size=40)
    section_kicker(doc,
                   "Give the wordmark room to breathe. Clearspace is measured in 'P' — the cap "
                   "height of the capital P in the wordmark.")

    # Clearspace visual
    tbl = doc.add_table(rows=3, cols=3)
    tbl.autofit = False
    # outer shell light grid
    for r in range(3):
        for c in range(3):
            cell = tbl.rows[r].cells[c]
            set_cell_width(cell, 17 / 3)
            set_cell_border(cell, color=SURFACE_STRONG, size="4")
            set_cell_margins(cell, top=200, bottom=200, left=200, right=200)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    center = tbl.rows[1].cells[1]
    set_cell_shade(center, CANVAS)
    p = center.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(p, "iPrime", font=PRIMARY_FONT, size=44, bold=True, color=INK,
            letter_spacing=-20)
    # corner labels
    corners = [(0, 0, "1P"), (0, 2, "1P"), (2, 0, "1P"), (2, 2, "1P"),
               (0, 1, "1P"), (1, 0, "1P"), (1, 2, "1P"), (2, 1, "1P")]
    for r, c, txt in corners:
        cell = tbl.rows[r].cells[c]
        set_cell_shade(cell, SURFACE_MUTED)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_run(p, txt, font=PRIMARY_FONT, size=9, bold=True, color=MUTED,
                letter_spacing=120)

    empty_line(doc, 12)

    add_para(doc, "Minimum sizing", font=PRIMARY_FONT, size=14, bold=True,
             color=INK, space_after=8, letter_spacing=-6)

    rows = [
        ("Digital", "24 px tall — the smallest size the wordmark may appear on screen."),
        ("Print",   "10 mm tall — the smallest size for offset, screen-print or large-format."),
        ("Favicon / app icon", "Use a dedicated icon asset (separate file). The wordmark is not a favicon."),
    ]
    for label, body in rows:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 5.0); set_cell_width(r, 12.0)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=160, bottom=160, left=160, right=160)
        add_run(l.paragraphs[0], label, font=PRIMARY_FONT, size=11, bold=True, color=INK)
        add_run(r.paragraphs[0], body, font=PRIMARY_FONT, size=11, color=MUTED)

    page_break(doc)


def add_logo_misuse(doc):
    section_eyebrow(doc, "02 — Logo")
    section_title(doc, "Misuse.", size=44)
    section_kicker(doc, "Every modification weakens the mark. These are the lines we don't cross.")

    misuses = [
        ("Don't restretch", "Never scale the wordmark non-proportionally. The aspect ratio is fixed."),
        ("Don't recolour", "The wordmark is Ink #09090b on light surfaces and #FAFAFA on dark. No other colours, ever — except the approved brand-orange special edition."),
        ("Don't recase", "It is iPrime. Not iprime, not IPRIME, not Iprime, not i-Prime."),
        ("Don't outline", "The wordmark is solid. No strokes, no outlines, no double-strokes."),
        ("Don't reset", "Do not retype the wordmark in another font, even another weight of Roboto. Use the supplied artwork."),
        ("Don't add effects", "No shadows, no glows, no gradients, no bevels, no embossing."),
        ("Don't crowd", "Respect the 1P clearspace on all sides. No copy, no graphic, no edge."),
        ("Don't background", "Avoid busy photos, gradients, or near-Ink backgrounds. If you must, place the wordmark inside an Ink or Canvas tile first."),
    ]

    for i in range(0, len(misuses), 2):
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        for j in range(2):
            if i + j >= len(misuses):
                continue
            title, body = misuses[i + j]
            cell = tbl.rows[0].cells[j]
            set_cell_width(cell, 8.4)
            set_cell_border(cell, color=SURFACE_STRONG, size="4")
            set_cell_margins(cell, top=220, bottom=220, left=240, right=240)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
            p = cell.paragraphs[0]
            add_run(p, "✕  ", font=PRIMARY_FONT, size=13, bold=True, color=ERROR_STRONG)
            add_run(p, title, font=PRIMARY_FONT, size=13, bold=True, color=INK)
            p2 = cell.add_paragraph()
            p2.paragraph_format.space_before = Pt(4)
            add_run(p2, body, font=PRIMARY_FONT, size=10.5, color=MUTED)
        empty_line(doc, 4)

    page_break(doc)


def add_color_primary(doc):
    section_eyebrow(doc, "03 — Colour")
    section_title(doc, "Primary palette.", size=44)
    section_kicker(doc, "Two anchors: brand orange and Ink. Everything else supports them.")

    color_chip_row(doc, [
        {"hex": BRAND, "name": "Brand Orange", "role": "Primary actions, brand accents", "text_on": "FFFFFF"},
        {"hex": INK, "name": "Ink", "role": "Headlines, body text, dark surfaces", "text_on": "FAFAFA"},
    ])

    empty_line(doc, 14)
    add_para(doc, "Supporting brand tones", font=PRIMARY_FONT, size=14, bold=True,
             color=INK, space_after=8, letter_spacing=-6)
    color_chip_row(doc, [
        {"hex": BRAND_STRONG, "name": "Brand Strong", "role": "Body links, inline accents (AA on canvas)", "text_on": "FFFFFF"},
        {"hex": BRAND_SOFT, "name": "Brand Soft", "role": "Tinted banners, selected states", "text_on": INK},
        {"hex": BRAND_SOFT_BORDER, "name": "Brand Soft Edge", "role": "Borders for soft-brand fills", "text_on": INK},
    ])

    empty_line(doc, 14)
    add_para(doc, "Usage ratio", font=PRIMARY_FONT, size=14, bold=True,
             color=INK, space_after=8, letter_spacing=-6)

    # ratio bar
    tbl = doc.add_table(rows=1, cols=3)
    tbl.autofit = False
    parts = [(CANVAS, "70  ·  Canvas", INK),
             (INK, "20  ·  Ink", "FAFAFA"),
             (BRAND, "10  ·  Brand", "FFFFFF")]
    widths = [12.0, 3.5, 1.5]
    for i, (hex_c, label, text_c) in enumerate(parts):
        c = tbl.rows[0].cells[i]
        set_cell_width(c, widths[i])
        set_cell_shade(c, hex_c)
        set_cell_border(c, color="FFFFFF", size="6")
        set_cell_margins(c, top=240, bottom=240, left=160, right=160)
        p = c.paragraphs[0]
        add_run(p, label, font=PRIMARY_FONT, size=10, bold=True, color=text_c,
                letter_spacing=80)
    add_para(doc, "Roughly 70% canvas, 20% ink, 10% brand orange. Restraint with the orange is what makes the brand feel premium — every pop earns its placement.",
             size=11, color=MUTED, space_before=14, line_spacing=1.6)

    page_break(doc)


def add_color_neutrals(doc):
    section_eyebrow(doc, "03 — Colour")
    section_title(doc, "Neutrals.", size=44)
    section_kicker(doc, "The quiet workhorses. They never compete with brand orange.")

    color_chip_row(doc, [
        {"hex": CANVAS, "name": "Canvas", "role": "App background", "text_on": INK},
        {"hex": SURFACE, "name": "Surface", "role": "Cards, modals, sheets", "text_on": INK},
        {"hex": SURFACE_MUTED, "name": "Surface Muted", "role": "Inputs, chips, secondary buttons", "text_on": INK},
        {"hex": SURFACE_STRONG, "name": "Surface Strong", "role": "Dividers used as fills", "text_on": INK},
    ])
    empty_line(doc, 12)
    color_chip_row(doc, [
        {"hex": INK, "name": "Ink", "role": "Primary text, premium tile", "text_on": "FAFAFA"},
        {"hex": MUTED, "name": "Muted", "role": "Secondary text, captions", "text_on": "FFFFFF"},
        {"hex": PLACEHOLDER, "name": "Placeholder", "role": "Placeholder text only — never body", "text_on": "FFFFFF"},
    ])

    empty_line(doc, 14)
    add_para(doc,
             "Accessibility note: Placeholder #9CA3AF is reserved for empty-field "
             "guidance only. It does not pass AA for body copy on Canvas. For real "
             "content always use Ink or Muted.",
             size=10.5, color=MUTED, italic=True, line_spacing=1.6)

    page_break(doc)


def add_color_status(doc):
    section_eyebrow(doc, "03 — Colour")
    section_title(doc, "Status colours.", size=44)
    section_kicker(doc, "Same four meanings everywhere — error, success, warning, info.")

    swatches = [
        {"hex": ERROR_STRONG, "name": "Error Strong", "role": "Inline error copy (AA)", "text_on": "FFFFFF"},
        {"hex": ERROR, "name": "Error", "role": "Icon fills, danger tints", "text_on": "FFFFFF"},
        {"hex": SUCCESS_STRONG, "name": "Success Strong", "role": "Confirmed actions, totals", "text_on": "FFFFFF"},
        {"hex": SUCCESS, "name": "Success", "role": "Icons, soft fills", "text_on": "FFFFFF"},
    ]
    color_chip_row(doc, swatches)
    empty_line(doc, 12)
    swatches = [
        {"hex": WARNING_STRONG, "name": "Warning Strong", "role": "Inline warning copy", "text_on": "FFFFFF"},
        {"hex": WARNING, "name": "Warning", "role": "Caution badges", "text_on": "FFFFFF"},
        {"hex": INFO_STRONG, "name": "Info Strong", "role": "Inline info copy", "text_on": "FFFFFF"},
        {"hex": INFO, "name": "Info", "role": "Tips, neutral notices", "text_on": "FFFFFF"},
    ]
    color_chip_row(doc, swatches)

    empty_line(doc, 14)
    add_para(doc, "Rule of thumb",
             size=14, bold=True, color=INK, space_after=6, letter_spacing=-6)
    add_para(doc,
             "Use the Strong variant whenever the status is communicated as inline "
             "text. Use the base variant for icons, fills, and soft backgrounds. "
             "Pair status fills with their matching Soft tint (see component "
             "library) for badges and banners.",
             size=11, color=MUTED, line_spacing=1.6)
    page_break(doc)


def add_color_category(doc):
    section_eyebrow(doc, "03 — Colour")
    section_title(doc, "Category colours.", size=44)
    section_kicker(doc, "Eight verticals, eight cues. These are not brand colours — they are wayfinding.")

    swatches = [
        {"hex": CAT_FOOD, "name": "Food", "role": "Restaurants, errands", "text_on": "FFFFFF"},
        {"hex": CAT_PACKAGE, "name": "Package", "role": "Parcels, courier", "text_on": "FFFFFF"},
        {"hex": CAT_PHARMACY, "name": "Pharmacy", "role": "Health, prescriptions", "text_on": "FFFFFF"},
        {"hex": CAT_GROCERIES, "name": "Groceries", "role": "Markets, supermarkets", "text_on": "FFFFFF"},
    ]
    color_chip_row(doc, swatches)
    empty_line(doc, 12)
    swatches = [
        {"hex": CAT_AIRTIME, "name": "Airtime", "role": "Mobile top-up", "text_on": "FFFFFF"},
        {"hex": CAT_DATA, "name": "Data", "role": "Mobile data bundles", "text_on": "FFFFFF"},
        {"hex": CAT_ELECTRICITY, "name": "Electricity", "role": "Power bill payments", "text_on": "FFFFFF"},
        {"hex": CAT_TRANSFER, "name": "Transfer", "role": "Wallet movements", "text_on": "FFFFFF"},
    ]
    color_chip_row(doc, swatches)

    empty_line(doc, 14)
    add_para(doc,
             "Category colours are restricted to category-specific UI: tile icons, "
             "tab markers, transaction-row glyphs. They never appear in brand "
             "communications, ads, or page chrome.",
             size=11, color=MUTED, line_spacing=1.6)

    page_break(doc)


def add_color_dark(doc):
    section_eyebrow(doc, "03 — Colour")
    section_title(doc, "Dark mode.", size=44)
    section_kicker(doc, "Tuned variants, same meanings. The wordmark inverts; the system breathes deeper.")

    # dark stage demonstration
    tbl = doc.add_table(rows=1, cols=1)
    tbl.autofit = False
    cell = tbl.rows[0].cells[0]
    set_cell_width(cell, 17)
    set_cell_shade(cell, DARK_CANVAS)
    set_cell_border(cell, color=DARK_CANVAS, size="4")
    set_cell_margins(cell, top=700, bottom=700, left=600, right=600)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(p, "iPrime", font=PRIMARY_FONT, size=80, bold=True, color=DARK_TEXT,
            letter_spacing=-30)
    p2 = cell.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_before = Pt(12)
    add_run(p2, "Lagos' fastest logistics + bills rail.",
            font=PRIMARY_FONT, size=11, color=DARK_MUTED, letter_spacing=60)

    empty_line(doc, 14)
    color_chip_row(doc, [
        {"hex": DARK_CANVAS, "name": "Canvas (dark)", "role": "Screen background", "text_on": DARK_TEXT},
        {"hex": DARK_SURFACE, "name": "Surface (dark)", "role": "Cards, modals", "text_on": DARK_TEXT},
        {"hex": DARK_SURFACE_MUTED, "name": "Muted (dark)", "role": "Inputs, chips", "text_on": DARK_TEXT},
        {"hex": DARK_BRAND, "name": "Brand (dark)", "role": "Tuned orange — AA on dark", "text_on": "0B0B0F"},
    ])
    empty_line(doc, 8)

    add_para(doc,
             "In dark mode the brand orange is lifted to #FB923C and primary buttons "
             "run dark text on tuned orange. This is encoded in the design tokens; "
             "consumers reference token paths and never branch on mode.",
             size=11, color=MUTED, line_spacing=1.6)

    page_break(doc)


def add_typography(doc):
    section_eyebrow(doc, "04 — Type")
    section_title(doc, "Roboto, the iPrime way.", size=40)
    section_kicker(doc, "One family, four weights, one rule: clarity over decoration.")

    # type specimen
    tbl = doc.add_table(rows=1, cols=1)
    tbl.autofit = False
    cell = tbl.rows[0].cells[0]
    set_cell_width(cell, 17)
    set_cell_shade(cell, SURFACE_MUTED)
    set_cell_border(cell, color=SURFACE_MUTED, size="2")
    set_cell_margins(cell, top=500, bottom=500, left=500, right=500)

    p = cell.paragraphs[0]
    add_run(p, "Aa", font=PRIMARY_FONT, size=110, bold=True, color=INK,
            letter_spacing=-40)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_before = Pt(10)
    add_run(p2, "Roboto", font=PRIMARY_FONT, size=22, bold=True, color=INK,
            letter_spacing=-10)
    p3 = cell.add_paragraph()
    add_run(p3, "Regular  ·  Medium  ·  Bold  ·  Extra Bold",
            font=PRIMARY_FONT, size=11, color=MUTED, letter_spacing=120)

    empty_line(doc, 12)

    rows = [
        ("Wordmark", "Roboto Extra Bold, tracking −40"),
        ("Display headings", "Roboto Extra Bold, 36–60pt, tracking −10 to −20"),
        ("Body", "Roboto Regular, 11–13pt, tracking 0, line-height 1.6"),
        ("UI labels", "Roboto Medium, 10–14pt, tracking +20 to +60"),
        ("Eyebrow / micro", "Roboto Bold, 9–10pt, all caps, tracking +120 to +200"),
        ("Numerals", "Tabular figures everywhere money or counts are shown"),
    ]
    for label, body in rows:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 5.0); set_cell_width(r, 12.0)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=160, bottom=160, left=160, right=160)
        add_run(l.paragraphs[0], label, font=PRIMARY_FONT, size=11, bold=True, color=INK)
        add_run(r.paragraphs[0], body, font=PRIMARY_FONT, size=11, color=MUTED)

    page_break(doc)


def add_type_hierarchy(doc):
    section_eyebrow(doc, "04 — Type")
    section_title(doc, "Hierarchy.", size=44)
    section_kicker(doc, "A worked example, top to bottom.")

    add_para(doc, "DISPLAY · 60 / EXTRA BOLD",
             font=PRIMARY_FONT, size=8, bold=True, color=BRAND,
             letter_spacing=160, space_after=6)
    add_para(doc, "Lagos' fastest rail.",
             font=PRIMARY_FONT, size=44, bold=True, color=INK,
             letter_spacing=-20, line_spacing=1.05, space_after=18)

    add_para(doc, "HEADING · 24 / BOLD",
             font=PRIMARY_FONT, size=8, bold=True, color=BRAND,
             letter_spacing=160, space_after=6)
    add_para(doc, "Built for the city that doesn't slow down.",
             font=PRIMARY_FONT, size=22, bold=True, color=INK,
             letter_spacing=-10, line_spacing=1.15, space_after=18)

    add_para(doc, "SUBHEAD · 16 / MEDIUM",
             font=PRIMARY_FONT, size=8, bold=True, color=BRAND,
             letter_spacing=160, space_after=6)
    add_para(doc, "One rail. Every errand. From package drops to power bills.",
             font=PRIMARY_FONT, size=15, bold=False, color=INK,
             line_spacing=1.4, space_after=18)

    add_para(doc, "BODY · 12 / REGULAR",
             font=PRIMARY_FONT, size=8, bold=True, color=BRAND,
             letter_spacing=160, space_after=6)
    add_para(doc,
             "iPrime is the rail beneath the everyday — the rider on the bridge, "
             "the agent at the corner, the tap that turns into a refill. We pick "
             "type that gets out of the way, and we let the spacing do the "
             "talking. Generous line-height, restrained colour, tabular numerals.",
             font=PRIMARY_FONT, size=12, color=INK,
             line_spacing=1.7, space_after=18)

    add_para(doc, "CAPTION · 10 / REGULAR",
             font=PRIMARY_FONT, size=8, bold=True, color=BRAND,
             letter_spacing=160, space_after=6)
    add_para(doc,
             "Figures are tabular. Currency is ₦, never \"NGN\" inside copy. Times "
             "use 24-hour for operational dashboards, 12-hour for customer surfaces.",
             font=PRIMARY_FONT, size=10, color=MUTED,
             line_spacing=1.6, space_after=0)

    page_break(doc)


def add_ui_principles(doc):
    section_eyebrow(doc, "05 — UI")
    section_title(doc, "Product principles.", size=44)
    section_kicker(doc, "The decisions that shape how iPrime feels in the hand.")

    principles = [
        ("One tap closer.", "Every screen should bring the user one tap closer to done. If a step doesn't move the goal, it doesn't ship."),
        ("Always know where you are.", "The user should be able to answer 'what's happening with my order right now?' from the home screen, without tapping anything."),
        ("Surface, not noise.", "Defaults are quiet. The interface speaks up only when something needs attention — and then says exactly what."),
        ("Hands-friendly first.", "Built thumb-first. Tap targets are 44pt minimum. Primary actions live within reach of the thumb on a one-handed grip."),
        ("Money is sacred.", "Every screen showing balance, payment or transaction uses tabular numerals, exact strings, and the strongest contrast tokens."),
        ("The brand colour is rare.", "Brand orange marks the next step. If everything is brand orange, nothing is."),
    ]
    for title, body in principles:
        tbl = doc.add_table(rows=1, cols=1)
        tbl.autofit = False
        cell = tbl.rows[0].cells[0]
        set_cell_width(cell, 17)
        set_cell_shade(cell, SURFACE_MUTED)
        set_cell_border(cell, color=SURFACE_MUTED, size="4")
        set_cell_margins(cell, top=220, bottom=220, left=300, right=300)
        p = cell.paragraphs[0]
        add_run(p, title, font=PRIMARY_FONT, size=14, bold=True, color=INK,
                letter_spacing=-6)
        p2 = cell.add_paragraph()
        p2.paragraph_format.space_before = Pt(4)
        add_run(p2, body, font=PRIMARY_FONT, size=11, color=MUTED, letter_spacing=10)
        empty_line(doc, 4)

    page_break(doc)


def add_iconography(doc):
    section_eyebrow(doc, "05 — UI")
    section_title(doc, "Iconography.", size=44)
    section_kicker(doc, "A single stroke family. Geometric, friendly, never literal.")

    rows = [
        ("Family", "Lucide / Feather, 1.8px stroke, rounded joins. No filled variants in primary UI."),
        ("Sizing", "16, 20, 24, 32 — pick the size from the scale, don't free-set."),
        ("Colour", "Ink on Canvas. Brand orange only when paired with a primary action. Category colours only inside category contexts."),
        ("Pairing", "Always pair an icon with a text label unless the icon is universally understood (close, back, search)."),
        ("Custom marks", "Bespoke marks (logistics rail, rider helmet, receipt) follow the same stroke and corner radius as the icon set."),
    ]
    for label, body in rows:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 4.0); set_cell_width(r, 13.0)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=160, bottom=160, left=160, right=160)
        add_run(l.paragraphs[0], label.upper(), font=PRIMARY_FONT, size=9, bold=True,
                color=MUTED, letter_spacing=140)
        add_run(r.paragraphs[0], body, font=PRIMARY_FONT, size=11, color=INK)
    page_break(doc)


def add_voice(doc):
    section_eyebrow(doc, "06 — Voice")
    section_title(doc, "How iPrime speaks.", size=40)
    section_kicker(doc, "Direct. Local. Warm without being chatty.")

    pillars = [
        ("Direct",
         "Lead with the verb. Tell the user what's happening, what to do next, "
         "and how long it will take. Cut the throat-clearing."),
        ("Local",
         "We're written in Lagos, for Lagos. Use ₦, use the street name, use the "
         "neighbourhood. We don't translate the city; we name it."),
        ("Warm",
         "We respect time, but we're not cold. A 'Sorry' when we fail, a 'Thanks' "
         "when we close. Never sycophantic, never over-apologising."),
        ("Specific",
         "'In 12 minutes' not 'soon'. '₦1,200 saved' not 'big savings'. "
         "Specificity is the cheapest form of trust."),
    ]
    for label, body in pillars:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 4.5); set_cell_width(r, 12.5)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=200, bottom=200, left=160, right=200)
        add_run(l.paragraphs[0], label.upper(), font=PRIMARY_FONT, size=11, bold=True,
                color=BRAND, letter_spacing=140)
        add_run(r.paragraphs[0], body, font=PRIMARY_FONT, size=11, color=INK,
                letter_spacing=10)
        empty_line(doc, 2)

    page_break(doc)


def add_voice_examples(doc):
    section_eyebrow(doc, "06 — Voice")
    section_title(doc, "Voice examples.", size=44)
    section_kicker(doc, "Side-by-side, what we'd say and what we wouldn't.")

    examples = [
        ("Order confirmed",
         "Rider Tunde is on the way. ETA 14 minutes.",
         "Thank you so much for choosing iPrime! Your order has been successfully placed and we will get back to you shortly."),
        ("Payment failed",
         "That didn't go through. Your card was declined. Try another card or pay with transfer.",
         "Oops! Something went wrong. Please try again later or contact support if the problem persists."),
        ("Top-up complete",
         "₦1,000 airtime credited to 0803 222 4411. Done in 6 seconds.",
         "Your transaction has been completed successfully. Thank you for using iPrime."),
        ("Outage",
         "MTN data is down right now. We're queuing your order — you'll get the bundle the moment they're back.",
         "We are currently experiencing technical difficulties. Please bear with us."),
        ("Empty state",
         "No orders yet. Pick a category to get started.",
         "It looks like you don't have any orders at this time. Why not place one now?"),
    ]

    for scenario, good, bad in examples:
        add_para(doc, scenario.upper(),
                 font=PRIMARY_FONT, size=10, bold=True, color=MUTED,
                 letter_spacing=140, space_after=8, space_before=10)

        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 8.4); set_cell_width(r, 8.4)
        # good
        set_cell_shade(l, BRAND_SOFT)
        set_cell_border(l, color=BRAND_SOFT_BORDER, size="4")
        set_cell_margins(l, top=220, bottom=220, left=240, right=240)
        p = l.paragraphs[0]
        add_run(p, "✓  iPrime", font=PRIMARY_FONT, size=10, bold=True, color=BRAND_STRONG,
                letter_spacing=80)
        p2 = l.add_paragraph()
        p2.paragraph_format.space_before = Pt(6)
        p2.paragraph_format.line_spacing = 1.5
        add_run(p2, good, font=PRIMARY_FONT, size=12, color=INK)
        # bad
        set_cell_shade(r, "FEE2E2")
        set_cell_border(r, color="FECACA", size="4")
        set_cell_margins(r, top=220, bottom=220, left=240, right=240)
        p = r.paragraphs[0]
        add_run(p, "✕  Not iPrime", font=PRIMARY_FONT, size=10, bold=True, color=ERROR_STRONG,
                letter_spacing=80)
        p2 = r.add_paragraph()
        p2.paragraph_format.space_before = Pt(6)
        p2.paragraph_format.line_spacing = 1.5
        add_run(p2, bad, font=PRIMARY_FONT, size=12, color=INK)
        empty_line(doc, 4)

    page_break(doc)


def add_imagery(doc):
    section_eyebrow(doc, "07 — Imagery")
    section_title(doc, "Photography & illustration.", size=36)
    section_kicker(doc, "We shoot Lagos as Lagos. Real riders, real streets, real time.")

    rows = [
        ("Subject", "People, not props. Riders, customers, agents in their actual environment. Faces lit, hands visible."),
        ("Light", "Natural where possible. Golden hour and early-morning haze are the iPrime hours."),
        ("Composition", "Wide frames with breathing room above the subject — leaves space for headlines. Centred for portraits, rule-of-thirds for streets."),
        ("Colour grade", "Warm shadows, neutral midtones, slightly cool highlights. Never crushed blacks, never blown highlights."),
        ("Avoid", "Stock-photo handshakes, generic call-centre headsets, fake smiles, perfectly white backgrounds, AI-generated cityscapes."),
        ("Illustration", "Used sparingly for empty states and onboarding. Simple geometric forms, 2-colour, brand orange + ink. No 3D, no isometric clichés."),
    ]
    for label, body in rows:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 4.0); set_cell_width(r, 13.0)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=180, bottom=180, left=160, right=160)
        add_run(l.paragraphs[0], label.upper(), font=PRIMARY_FONT, size=9, bold=True,
                color=MUTED, letter_spacing=140)
        add_run(r.paragraphs[0], body, font=PRIMARY_FONT, size=11, color=INK,
                letter_spacing=10)
    page_break(doc)


def add_co_branding(doc):
    section_eyebrow(doc, "08 — Partners")
    section_title(doc, "Co-branding.", size=44)
    section_kicker(doc, "How the iPrime wordmark sits next to a partner mark.")

    rows = [
        ("Lockup", "Partner logo on the left, iPrime wordmark on the right, separated by a 1-point ink rule at full height of the smaller mark."),
        ("Clearspace", "Treat the rule as the clearspace boundary. No copy or graphic may cross it."),
        ("Sizing", "Optical balance — match the visual weight, not the literal height. The iPrime wordmark is generally 80–90% of the partner mark's cap-height equivalent."),
        ("Colour", "Both marks render in Ink on Canvas, or both in Canvas on Ink. Never one in colour and the other in mono. Never brand orange in a co-brand."),
        ("Approval", "Every co-brand layout is reviewed by iPrime brand before publication. Submit to brand@iprime.com.ng for sign-off — turnaround 2 business days."),
    ]
    for label, body in rows:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 4.0); set_cell_width(r, 13.0)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=180, bottom=180, left=160, right=160)
        add_run(l.paragraphs[0], label.upper(), font=PRIMARY_FONT, size=9, bold=True,
                color=MUTED, letter_spacing=140)
        add_run(r.paragraphs[0], body, font=PRIMARY_FONT, size=11, color=INK,
                letter_spacing=10)

    empty_line(doc, 14)

    # demo lockup
    tbl = doc.add_table(rows=1, cols=3)
    tbl.autofit = False
    l, mid, r = tbl.rows[0].cells
    set_cell_width(l, 8.0); set_cell_width(mid, 0.2); set_cell_width(r, 8.8)
    for c in (l, mid, r):
        set_cell_shade(c, CANVAS)
        set_cell_border(c, color=CANVAS, size="2")
        set_cell_margins(c, top=600, bottom=600, left=200, right=200)
        c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    set_cell_shade(mid, INK)
    p = l.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_run(p, "Partner Mark", font=PRIMARY_FONT, size=22, bold=True, color=MUTED,
            italic=True, letter_spacing=-6)
    p = r.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_run(p, "iPrime", font=PRIMARY_FONT, size=42, bold=True, color=INK,
            letter_spacing=-20)

    page_break(doc)


def add_partner_dos_donts(doc):
    section_eyebrow(doc, "08 — Partners")
    section_title(doc, "Do's & don'ts.", size=44)
    section_kicker(doc, "For agencies, vendors, integration partners, and media buyers.")

    add_para(doc, "Do", font=PRIMARY_FONT, size=14, bold=True, color=SUCCESS_STRONG,
             letter_spacing=-6, space_after=8)

    dos = [
        "Use the supplied wordmark artwork (.svg / .png) — never retype the logo.",
        "Pair iPrime communications with the Brand Orange / Ink / Canvas system.",
        "Submit any layout featuring the wordmark to brand@iprime.com.ng before going live.",
        "Use Roboto across all iPrime-co-branded creative. Where Roboto is unavailable, fall back to Inter, then system sans.",
        "Respect the 1P clearspace rule on every placement.",
        "Default to dark text on light backgrounds — it carries the premium read.",
    ]
    for d in dos:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 0.8); set_cell_width(r, 16.2)
        for c in (l, r):
            set_cell_border(c, color="FFFFFF", size="4")
            set_cell_margins(c, top=80, bottom=80, left=0, right=80)
        add_run(l.paragraphs[0], "✓", font=PRIMARY_FONT, size=14, bold=True, color=SUCCESS_STRONG)
        add_run(r.paragraphs[0], d, font=PRIMARY_FONT, size=11, color=INK)

    empty_line(doc, 12)
    add_para(doc, "Don't", font=PRIMARY_FONT, size=14, bold=True, color=ERROR_STRONG,
             letter_spacing=-6, space_after=8)

    donts = [
        "Don't translate, redraw, or re-render the wordmark in another tool.",
        "Don't apply effects (shadows, gradients, outlines, glows) to the wordmark.",
        "Don't use the wordmark to imply endorsement of a product or campaign without written approval.",
        "Don't use brand orange as a background fill behind body copy — it's an accent, not a canvas.",
        "Don't lift category colours into general branding. They belong inside the product.",
        "Don't repurpose iPrime assets for unrelated services without an active partnership agreement.",
    ]
    for d in donts:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 0.8); set_cell_width(r, 16.2)
        for c in (l, r):
            set_cell_border(c, color="FFFFFF", size="4")
            set_cell_margins(c, top=80, bottom=80, left=0, right=80)
        add_run(l.paragraphs[0], "✕", font=PRIMARY_FONT, size=14, bold=True, color=ERROR_STRONG)
        add_run(r.paragraphs[0], d, font=PRIMARY_FONT, size=11, color=INK)

    page_break(doc)


def add_assets(doc):
    section_eyebrow(doc, "08 — Partners")
    section_title(doc, "Asset formats & file naming.", size=32)
    section_kicker(doc, "What we ship, what to use, what to name files.")

    rows = [
        ("Wordmark · Vector", "iprime-wordmark.svg  ·  iprime-wordmark.pdf  ·  iprime-wordmark.eps"),
        ("Wordmark · Raster", "iprime-wordmark@1x.png  ·  @2x.png  ·  @3x.png  (transparent)"),
        ("Wordmark · Dark surfaces", "iprime-wordmark-inverse.svg  /  .png"),
        ("App icon", "iprime-appicon-1024.png  ·  iprime-favicon-32.png  ·  iprime-favicon.ico"),
        ("Social avatars", "iprime-avatar-square.png  (1080×1080, Ink ground, Canvas wordmark)"),
        ("Colour values", "iprime-colors.json  ·  iprime-colors.ase  ·  iprime-colors.css"),
        ("Roboto fonts", "Bundled with the partner kit — licensed under Apache 2.0, free for commercial use."),
    ]
    for label, body in rows:
        tbl = doc.add_table(rows=1, cols=2)
        tbl.autofit = False
        l, r = tbl.rows[0].cells
        set_cell_width(l, 5.5); set_cell_width(r, 11.5)
        for c in (l, r):
            set_cell_border(c, color=SURFACE_STRONG, size="4")
            set_cell_margins(c, top=180, bottom=180, left=160, right=160)
        add_run(l.paragraphs[0], label, font=PRIMARY_FONT, size=11, bold=True, color=INK)
        add_run(r.paragraphs[0], body, font="Consolas", size=10, color=MUTED)

    empty_line(doc, 14)
    add_para(doc,
             "Partner kits are issued on request and refreshed quarterly. Always work from the latest kit — versions older than the current quarter may contain superseded marks.",
             size=11, color=MUTED, line_spacing=1.6, italic=True)

    page_break(doc)


def add_contact(doc):
    # Inked closing page
    for _ in range(4):
        add_para(doc, "", size=10, space_after=0)

    tbl = doc.add_table(rows=1, cols=1)
    tbl.autofit = False
    cell = tbl.rows[0].cells[0]
    set_cell_width(cell, 17)
    set_cell_shade(cell, INK)
    set_cell_border(cell, color=INK, size="2")
    set_cell_margins(cell, top=900, bottom=900, left=700, right=700)

    p = cell.paragraphs[0]
    add_run(p, "09 — CONTACT", font=PRIMARY_FONT, size=10, bold=True,
            color=BRAND, letter_spacing=200)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_before = Pt(16)
    add_run(p2, "Working with us.", font=PRIMARY_FONT, size=40, bold=True,
            color=DARK_TEXT, letter_spacing=-15)
    p3 = cell.add_paragraph()
    p3.paragraph_format.space_before = Pt(16)
    add_run(p3, "Brand approvals, asset requests, co-branding sign-off:",
            font=PRIMARY_FONT, size=12, color=DARK_MUTED)
    p4 = cell.add_paragraph()
    p4.paragraph_format.space_before = Pt(6)
    add_run(p4, "brand@iprime.com.ng",
            font=PRIMARY_FONT, size=20, bold=True, color=DARK_BRAND, letter_spacing=-6)
    p5 = cell.add_paragraph()
    p5.paragraph_format.space_before = Pt(24)
    add_run(p5, "Partnerships and integrations:", font=PRIMARY_FONT, size=12, color=DARK_MUTED)
    p6 = cell.add_paragraph()
    p6.paragraph_format.space_before = Pt(6)
    add_run(p6, "partners@iprime.com.ng",
            font=PRIMARY_FONT, size=20, bold=True, color=DARK_BRAND, letter_spacing=-6)

    p7 = cell.add_paragraph()
    p7.paragraph_format.space_before = Pt(36)
    add_run(p7, "iPrime  ·  Lagos, Nigeria",
            font=PRIMARY_FONT, size=10, color=DARK_MUTED, letter_spacing=160)

    # Final small wordmark
    empty_line(doc, 60)
    add_para(doc, "iPrime", font=PRIMARY_FONT, size=44, bold=True, color=INK,
             letter_spacing=-15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    add_para(doc, "Brand Book  ·  Version 1.0  ·  2026",
             font=PRIMARY_FONT, size=9, bold=True, color=MUTED,
             letter_spacing=160, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)


# ─── document setup ──────────────────────────────────────────────────────────

def setup_document(doc):
    section = doc.sections[0]
    section.page_width = Cm(21.0)   # A4 portrait
    section.page_height = Cm(29.7)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)

    # Default style
    style = doc.styles["Normal"]
    style.font.name = PRIMARY_FONT
    style.font.size = Pt(11)
    style.font.color.rgb = RGBColor.from_string(INK)
    rPr = style.element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:ascii"), PRIMARY_FONT)
    rFonts.set(qn("w:hAnsi"), PRIMARY_FONT)
    rFonts.set(qn("w:cs"), PRIMARY_FONT)
    rFonts.set(qn("w:eastAsia"), PRIMARY_FONT)


def build():
    doc = Document()
    setup_document(doc)

    add_cover(doc)
    add_contents(doc)
    add_brand_story(doc)
    add_positioning(doc)
    add_principles(doc)

    add_logo_primary(doc)
    add_logo_clearspace(doc)
    add_logo_misuse(doc)

    add_color_primary(doc)
    add_color_neutrals(doc)
    add_color_status(doc)
    add_color_category(doc)
    add_color_dark(doc)

    add_typography(doc)
    add_type_hierarchy(doc)

    add_ui_principles(doc)
    add_iconography(doc)

    add_voice(doc)
    add_voice_examples(doc)

    add_imagery(doc)

    add_co_branding(doc)
    add_partner_dos_donts(doc)
    add_assets(doc)

    add_contact(doc)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT_PATH))
    print(f"Wrote {OUT_PATH}  ({OUT_PATH.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    build()
