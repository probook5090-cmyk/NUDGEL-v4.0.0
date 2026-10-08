#!/usr/bin/env python3
"""
Generates additional Apple-level floating 3D glass widgets, pop-out KPI badges,
and kinetic typography headers for the 19-shot (3s/shot) Supahub 4K Commercial.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT_DIR = "/tmp/supahub_assets"
os.makedirs(OUT_DIR, exist_ok=True)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG  = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def fnt(path, size):
    return ImageFont.truetype(path, size)

def save_raw_rgba(im: Image.Image, name: str):
    im = im.convert("RGBA")
    w, h = im.size
    raw_path = os.path.join(OUT_DIR, f"{name}.raw")
    meta_path = os.path.join(OUT_DIR, f"{name}.meta")
    with open(raw_path, "wb") as f:
        f.write(im.tobytes())
    with open(meta_path, "w") as f:
        f.write(f"{w} {h}\n")
    im.save(os.path.join(OUT_DIR, f"{name}.png"))

def make_text_sprite(name, segments, font_size=92):
    font = fnt(FONT_BOLD, font_size)
    dummy = Image.new("RGBA", (10, 10))
    dd = ImageDraw.Draw(dummy)
    total_w = 0
    seg_widths = []
    for txt, _ in segments:
        bbox = dd.textbbox((0, 0), txt, font=font)
        w = bbox[2] - bbox[0]
        seg_widths.append(w)
        total_w += w
    pad_x, pad_y = 80, 50
    W = total_w + pad_x * 2
    H = font_size + pad_y * 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    x_cursor = pad_x
    for (txt, mode), sw in zip(segments, seg_widths):
        tmask = Image.new("L", (W, H), 0)
        td = ImageDraw.Draw(tmask)
        td.text((x_cursor, pad_y), txt, font=font, fill=255)
        if mode == "white":
            layer = Image.new("RGBA", (W, H), (255, 255, 255, 255))
        elif mode == "dark":
            layer = Image.new("RGBA", (W, H), (18, 12, 36, 255))
        elif mode == "grad_pink_purple":
            arr = np.zeros((H, W, 4), dtype=np.uint8)
            xs = np.clip((np.arange(W) - x_cursor) / max(1.0, float(sw)), 0.0, 1.0)
            r = (237 * (1.0 - xs) + 185 * xs).astype(np.uint8)
            g = ( 63 * (1.0 - xs) + 132 * xs).astype(np.uint8)
            b = (178 * (1.0 - xs) + 255 * xs).astype(np.uint8)
            arr[:, :, 0] = r[None, :]
            arr[:, :, 1] = g[None, :]
            arr[:, :, 2] = b[None, :]
            arr[:, :, 3] = 255
            layer = Image.fromarray(arr, "RGBA")
            glow_mask = tmask.filter(ImageFilter.GaussianBlur(18))
            glow_arr = arr.copy()
            glow_arr[:, :, 3] = (np.array(glow_mask, dtype=np.float32) * 0.55).astype(np.uint8)
            im.alpha_composite(Image.fromarray(glow_arr, "RGBA"))
        elif mode == "grad_gold_pink":
            arr = np.zeros((H, W, 4), dtype=np.uint8)
            xs = np.clip((np.arange(W) - x_cursor) / max(1.0, float(sw)), 0.0, 1.0)
            r = (235 * (1.0 - xs) + 237 * xs).astype(np.uint8)
            g = (176 * (1.0 - xs) +  63 * xs).astype(np.uint8)
            b = ( 46 * (1.0 - xs) + 178 * xs).astype(np.uint8)
            arr[:, :, 0] = r[None, :]
            arr[:, :, 1] = g[None, :]
            arr[:, :, 2] = b[None, :]
            arr[:, :, 3] = 255
            layer = Image.fromarray(arr, "RGBA")
            glow_mask = tmask.filter(ImageFilter.GaussianBlur(18))
            glow_arr = arr.copy()
            glow_arr[:, :, 3] = (np.array(glow_mask, dtype=np.float32) * 0.55).astype(np.uint8)
            im.alpha_composite(Image.fromarray(glow_arr, "RGBA"))
        else:
            layer = Image.new("RGBA", (W, H), mode)
        layer.putalpha(tmask)
        im.alpha_composite(layer)
        x_cursor += sw

    save_raw_rgba(im, name)

# Extra kinetic typography plates for the 19-shot cut
make_text_sprite("txt_custom_statuses", [("Customize ", "grad_pink_purple"), ("statuses & workflows", "white")], font_size=82)
make_text_sprite("txt_value_effort", [("Score impact ", "grad_gold_pink"), ("vs. effort instantly", "white")], font_size=82)
make_text_sprite("txt_drag_drop", [("Drag & drop ", (124, 46, 210, 255)), ("live progress", "dark")], font_size=84)
make_text_sprite("txt_all_in_one", [("All-in-one ", "grad_pink_purple"), ("feedback OS", "white")], font_size=90)
make_text_sprite("txt_upvote_live", [("Capture every ", "white"), ("customer vote", "grad_gold_pink")], font_size=86)
make_text_sprite("txt_vote_behalf_hdr", [("Vote on behalf ", (124, 46, 210, 255)), ("of VIP users", "dark")], font_size=84)

# 1. Floating Foreground Glass Widget: New Post / Feedback Composer (Shot 04)
def build_widget_new_post():
    w, h = 580, 250
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, w-7, h-7], radius=28, fill=(28, 16, 52, 245), outline=(185, 132, 255, 220), width=3)
    d.rounded_rectangle([26, 24, 195, 60], radius=16, fill=(124, 46, 210, 255))
    d.text((44, 32), "✦ NEW IDEA", font=fnt(FONT_BOLD, 18), fill=(255, 255, 255, 255))
    d.text((215, 32), "Dark mode for public boards", font=fnt(FONT_BOLD, 21), fill=(255, 255, 255, 255))
    d.text((28, 82), "Allow users to toggle between SolarBall light", font=fnt(FONT_REG, 18), fill=(205, 192, 235, 255))
    d.text((28, 110), "and GoPlay dark themes automatically.", font=fnt(FONT_REG, 18), fill=(205, 192, 235, 255))
    d.rounded_rectangle([28, 164, 210, 216], radius=18, fill=(45, 28, 78, 255), outline=(140, 95, 220, 180), width=2)
    d.text((50, 180), "🍀 Feature Request", font=fnt(FONT_BOLD, 16), fill=(235, 176, 46, 255))
    d.rounded_rectangle([370, 162, 548, 218], radius=20, fill=(237, 63, 178, 255))
    d.text((402, 178), "Submit Idea →", font=fnt(FONT_BOLD, 19), fill=(255, 255, 255, 255))
    save_raw_rgba(im, "widget_new_post")

# 2. Floating Foreground Glass Widget: Live Upvote Counter Burst (Shot 05)
def build_widget_upvote_burst():
    w, h = 460, 170
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, w-7, h-7], radius=26, fill=(255, 255, 255, 248), outline=(124, 46, 210, 230), width=3)
    d.rounded_rectangle([24, 24, 134, 146], radius=22, fill=(124, 46, 210, 255))
    d.polygon([(79, 44), (58, 74), (100, 74)], fill=(255, 255, 255, 255))
    d.text((46, 86), "787", font=fnt(FONT_BOLD, 32), fill=(255, 255, 255, 255))
    d.text((156, 34), "Collect feedback from Slack", font=fnt(FONT_BOLD, 20), fill=(22, 14, 42, 255))
    d.text((156, 68), "+142 votes this week • Trending 🔥", font=fnt(FONT_BOLD, 16), fill=(237, 63, 178, 255))
    d.rounded_rectangle([156, 102, 325, 140], radius=14, fill=(235, 248, 244, 255), outline=(13, 188, 165, 220), width=2)
    d.text((174, 112), "● Synced to Slack", font=fnt(FONT_BOLD, 16), fill=(13, 188, 165, 255))
    save_raw_rgba(im, "widget_upvote_burst")

# 3. Floating Foreground Glass Widget: R.I.C.E. Priority Score Pill (Shot 10)
def build_widget_rice_score():
    w, h = 480, 176
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, w-7, h-7], radius=26, fill=(24, 14, 46, 248), outline=(235, 176, 46, 240), width=3)
    d.text((28, 26), "R.I.C.E. PRIORITY ENGINE", font=fnt(FONT_BOLD, 16), fill=(235, 176, 46, 255))
    d.text((28, 58), "★ ★ ★ ★ ★", font=fnt(FONT_BOLD, 30), fill=(235, 176, 46, 255))
    d.text((28, 112), "High Impact • Low Effort • Q2 Top Pick", font=fnt(FONT_REG, 17), fill=(215, 202, 242, 255))
    d.rounded_rectangle([332, 32, 452, 144], radius=22, fill=(124, 46, 210, 255), outline=(185, 132, 255, 255), width=2)
    d.text((360, 48), "SCORE", font=fnt(FONT_BOLD, 15), fill=(235, 215, 255, 255))
    d.text((352, 74), "750", font=fnt(FONT_BOLD, 38), fill=(255, 255, 255, 255))
    save_raw_rgba(im, "widget_rice_score")

# 4. Floating Foreground Glass Widget: Changelog Release Toast (Shot 16)
def build_widget_changelog_toast():
    w, h = 520, 170
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, w-7, h-7], radius=26, fill=(26, 15, 48, 246), outline=(13, 188, 165, 235), width=3)
    d.rounded_rectangle([26, 26, 178, 62], radius=16, fill=(13, 188, 165, 255))
    d.text((44, 34), "🚀 NEW RELEASE", font=fnt(FONT_BOLD, 16), fill=(255, 255, 255, 255))
    d.text((196, 32), "v2.4 • Intercom Integration", font=fnt(FONT_BOLD, 20), fill=(255, 255, 255, 255))
    d.text((28, 82), "786 voters automatically notified via email & Slack", font=fnt(FONT_REG, 17), fill=(210, 198, 240, 255))
    d.rounded_rectangle([28, 118, 260, 150], radius=12, fill=(46, 28, 82, 255))
    d.text((44, 125), "✓ Feedback Loop Closed", font=fnt(FONT_BOLD, 15), fill=(185, 132, 255, 255))
    save_raw_rgba(im, "widget_changelog_toast")

# 5. Finale CTA Pill (Shot 19)
def build_widget_cta_pill():
    w, h = 520, 96
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, w-7, h-7], radius=44, fill=(124, 46, 210, 255), outline=(237, 63, 178, 255), width=3)
    d.text((64, 28), "Start free at supahub.com  →", font=fnt(FONT_BOLD, 28), fill=(255, 255, 255, 255))
    save_raw_rgba(im, "widget_cta_pill")

build_widget_new_post()
build_widget_upvote_burst()
build_widget_rice_score()
build_widget_changelog_toast()
build_widget_cta_pill()
print("Extra Apple-level 3D widgets and kinetic headers generated!")
