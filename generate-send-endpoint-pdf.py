"""
Generate a client-facing PDF documenting the new POST /v1/whatsapp/send endpoint.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER

# ── Register Arabic font ─────────────────────────────────────────────────────
FONT_SEARCH = [
    r"C:\Windows\Fonts\Arial.ttf",
    r"C:\Windows\Fonts\Tahoma.ttf",
    r"C:\Windows\Fonts\times.ttf",
]
AR_FONT = "ArBody"
for fp in FONT_SEARCH:
    if os.path.exists(fp):
        pdfmetrics.registerFont(TTFont(AR_FONT, fp))
        break

def ar(text):
    """Wrap Arabic text so it renders RTL via bidi algorithm workaround."""
    try:
        from bidi.algorithm import get_display
        import arabic_reshaper
        return get_display(arabic_reshaper.reshape(text))
    except Exception:
        return text

# ── Colours ──────────────────────────────────────────────────────────────────
TEAL_DARK   = colors.HexColor("#134e4a")
TEAL_MID    = colors.HexColor("#0f766e")
TEAL_LIGHT  = colors.HexColor("#ccfbf1")
SLATE_900   = colors.HexColor("#0f172a")
SLATE_600   = colors.HexColor("#475569")
SLATE_200   = colors.HexColor("#e2e8f0")
WHITE       = colors.white
CODE_BG     = colors.HexColor("#0f172a")
CODE_FG     = colors.HexColor("#e2e8f0")
SUCCESS_BG  = colors.HexColor("#f0fdf4")
SUCCESS_BD  = colors.HexColor("#86efac")
ERROR_BG    = colors.HexColor("#fff7ed")
ERROR_BD    = colors.HexColor("#fdba74")

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

# ── Styles ───────────────────────────────────────────────────────────────────
def style(name, **kw):
    defaults = dict(fontName=AR_FONT, fontSize=12, leading=18,
                    alignment=TA_RIGHT, textColor=SLATE_900)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

S_TITLE    = style("title",   fontSize=22, leading=30, textColor=WHITE, alignment=TA_RIGHT)
S_EYEBROW  = style("eyebrow", fontSize=10, textColor=colors.HexColor("#99f6e4"))
S_HERO_SUB = style("herosub", fontSize=13, textColor=colors.HexColor("#d1fae5"), leading=22)
S_SECTION  = style("sec",     fontSize=16, fontName=AR_FONT, textColor=SLATE_900)
S_BODY     = style("body",    fontSize=12, leading=22, textColor=SLATE_600)
S_CODE     = style("code",    fontSize=10, leading=17, fontName=AR_FONT,
                   textColor=CODE_FG, alignment=TA_LEFT, backColor=CODE_BG)
S_LABEL    = style("label",   fontSize=10, textColor=SLATE_600)
S_VALUE    = style("value",   fontSize=12, textColor=SLATE_900)
S_STEP     = style("step",    fontSize=12, leading=22, textColor=colors.HexColor("#1e293b"))
S_WARN     = style("warn",    fontSize=12, leading=22, textColor=colors.HexColor("#1e293b"))

# ── Helpers ──────────────────────────────────────────────────────────────────
def hero_block(story):
    hero_data = [
        [Paragraph(ar("WaOTP Messaging API"), S_EYEBROW)],
        [Paragraph(ar("إضافة إرسال رسائل واتساب النصية"), S_TITLE)],
        [Spacer(1, 4)],
        [Paragraph(ar(
            "تم إضافة مسار جديد يتيح لكم إرسال رسائل واتساب نصية عامة "
            "عبر الجلسة المتصلة حالياً، بدون الحاجة لأي تغيير في التكامل القائم."
        ), S_HERO_SUB)],
    ]
    t = Table([[cell] for row in hero_data for cell in [row]], colWidths=[PAGE_W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), TEAL_DARK),
        ("ROUNDEDCORNERS", [12]),
        ("LEFTPADDING",  (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("TOPPADDING",   (0, 0), (-1, -1),  6),
        ("BOTTOMPADDING",(0, 0), (-1, -1),  6),
        ("TOPPADDING",   (0, 0), (0, 0), 20),
        ("BOTTOMPADDING",(0, -1),(0, -1), 20),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

def section_header(story, text):
    story.append(Spacer(1, 6))
    story.append(Paragraph(ar(text), S_SECTION))
    story.append(HRFlowable(width="100%", thickness=1, color=SLATE_200, spaceAfter=10))

def info_table(story, rows):
    """Two-column label/value table."""
    data = []
    for label, value in rows:
        data.append([
            Paragraph(ar(label), S_LABEL),
            Paragraph(value, S_VALUE),
        ])
    t = Table(data, colWidths=[55*mm, PAGE_W - 2*MARGIN - 55*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX",          (0, 0), (-1, -1), 0.5, SLATE_200),
        ("INNERGRID",    (0, 0), (-1, -1), 0.5, SLATE_200),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1),  8),
        ("BOTTOMPADDING",(0, 0), (-1, -1),  8),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("ROUNDEDCORNERS", [8]),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

def code_block(story, label, code_text):
    story.append(Paragraph(ar(label), S_LABEL))
    story.append(Spacer(1, 4))
    t = Table([[Paragraph(code_text, S_CODE)]], colWidths=[PAGE_W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING",  (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING",   (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 12),
        ("ROUNDEDCORNERS", [10]),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

def response_block(story, label, code_text, bg, bd):
    story.append(Paragraph(ar(label), S_LABEL))
    story.append(Spacer(1, 4))
    t = Table([[Paragraph(code_text, S_CODE)]], colWidths=[PAGE_W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING",  (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING",   (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 12),
        ("ROUNDEDCORNERS", [10]),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

def steps_block(story, steps):
    for i, text in enumerate(steps, 1):
        full = f"{i}.  {text}"
        t = Table([[Paragraph(ar(full), S_STEP)]], colWidths=[PAGE_W - 2*MARGIN])
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX",          (0, 0), (-1, -1), 0.5, SLATE_200),
            ("LEFTPADDING",  (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING",   (0, 0), (-1, -1),  8),
            ("BOTTOMPADDING",(0, 0), (-1, -1),  8),
            ("ROUNDEDCORNERS", [8]),
        ]))
        story.append(t)
        story.append(Spacer(1, 6))

def notes_block(story, notes):
    for text in notes:
        t = Table([[Paragraph(ar(text), S_WARN)]], colWidths=[PAGE_W - 2*MARGIN])
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX",          (0, 0), (-1, -1), 0.5, SLATE_200),
            ("LEFTPADDING",  (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING",   (0, 0), (-1, -1),  8),
            ("BOTTOMPADDING",(0, 0), (-1, -1),  8),
            ("ROUNDEDCORNERS", [8]),
        ]))
        story.append(t)
        story.append(Spacer(1, 6))

# ── Build document ───────────────────────────────────────────────────────────
OUT = r"E:\StudioProjects\whatsapp-otp\whatsapp-send-endpoint.pdf"

doc = SimpleDocTemplate(
    OUT,
    pagesize=A4,
    rightMargin=MARGIN, leftMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
    title="WaOTP - Send WhatsApp Message Endpoint",
)

story = []

# Hero
hero_block(story)

# Section 1 - Connection info
section_header(story, "1. بيانات الربط")
info_table(story, [
    ("Base URL",      "https://api.prootech-cloud.com"),
    ("Endpoint",      "POST  /v1/whatsapp/send"),
    ("Header",        "x-api-key: <YOUR_API_KEY>"),
    ("Content-Type",  "application/json"),
])

# Section 2 - Request
section_header(story, "2. طلب الإرسال")
code_block(story, "Method & URL", "POST  https://api.prootech-cloud.com/v1/whatsapp/send")
code_block(story, "Headers",
    'Content-Type: application/json\n'
    'x-api-key: <YOUR_API_KEY>'
)
code_block(story, "Request Body",
    '{\n'
    '  "phoneNumber": "+963XXXXXXXXX",\n'
    '  "message":     "نص الرسالة"\n'
    '}'
)

# Section 3 - Response
section_header(story, "3. الاستجابة")
code_block(story, "استجابة النجاح  (HTTP 200)",
    '{\n'
    '  "success": true\n'
    '}'
)
code_block(story, "استجابة الخطأ  (HTTP 200)",
    '{\n'
    '  "success": false,\n'
    '  "message": "وصف الخطأ"\n'
    '}'
)

# Section 4 - Steps
section_header(story, "4. خطوات الاستخدام")
steps_block(story, [
    "تأكد أن جلسة واتساب الخاصة بحسابكم في حالة متصل (ready) — يمكنكم التحقق من الحالة عبر GET /v1/whatsapp/session/status",
    "أرسل طلب POST إلى المسار /v1/whatsapp/send مع الـ API Key في الهيدر.",
    "مرر رقم الهاتف بالصيغة الدولية مع مفتاح البلد (مثال: +963911111111).",
    "مرر نص الرسالة في حقل message — يدعم النصوص العربية والإنجليزية.",
    "تحقق من قيمة success في الاستجابة — إذا كانت false تحقق من حقل message لمعرفة السبب.",
])

# Section 5 - Notes
section_header(story, "5. ملاحظات مهمة")
notes_block(story, [
    "هذا الـ endpoint يستخدم نفس API Key الخاص بـ OTP، لا حاجة لأي مفتاح جديد.",
    "الرسائل تُرسل عبر نفس رقم واتساب المتصل بحسابكم.",
    "تأكد أن رقم المستقبل مسجل على واتساب، وإلا ستحصل على success: false.",
    "هذا الـ endpoint مستقل تماماً عن نظام OTP — لا يؤثر على كوتا الـ OTP الشهرية.",
    "الـ Swagger الكامل متاح على: https://api.prootech-cloud.com/docs",
])

doc.build(story)
print(f"PDF saved to: {OUT}")
