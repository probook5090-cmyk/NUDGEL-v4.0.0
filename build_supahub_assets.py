#!/usr/bin/env python3
"""
Generates high-resolution RGBA UI component layers, extracted 3D Memoji avatars,
icons, badges, and kinetic typography sprites for the 57-second Supahub SaaS
Promotional Brand Video (Zelios style, https://youtu.be/aAvDI1qae-U).
"""
import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.ndimage import label, gaussian_filter, binary_erosion

OUT_DIR = "/tmp/supahub_assets"
os.makedirs(OUT_DIR, exist_ok=True)

FONT_REG = "/tmp/fonts/regular.otf"
FONT_MED = "/tmp/fonts/medium.otf"
FONT_SEMI = "/tmp/fonts/semibold.otf"
FONT_BOLD = "/tmp/fonts/bold.otf"
FONT_HEAVY = "/tmp/fonts/heavy.otf"

def fnt(path, size):
    return ImageFont.truetype(path, size)

def save_raw_rgba(im, name):
    im = im.convert("RGBA")
    w, h = im.size
    raw_path = os.path.join(OUT_DIR, f"{name}.raw")
    meta_path = os.path.join(OUT_DIR, f"{name}.meta")
    with open(raw_path, "wb") as f:
        f.write(im.tobytes())
    with open(meta_path, "w") as f:
        f.write(f"{w} {h}\n")
    im.save(os.path.join(OUT_DIR, f"{name}.png"))
    print(f"Saved {name:32s} ({w:4d}x{h:4d})")

# 1. Cleanly extract the 6 3D Memoji Customer Avatars + 3D Supahub Icon
im1 = np.array(Image.open("image-search/explainer-video-saas-marketing-video-dem-5.webp").convert("RGB"))
im2 = np.array(Image.open("image-search/208856573-66f5684e-or-f4c391208856573-or-4.webp").convert("RGB"))

def extract_clean_avatar(crop):
    r = crop[:,:,0].astype(np.float32)
    g = crop[:,:,1].astype(np.float32)
    b = crop[:,:,2].astype(np.float32)
    lum = 0.299*r + 0.587*g + 0.114*b
    is_bg_color = (lum > 202) & ((r - b) < 15) & ((g - b) < 12)
    is_purple_star = (b > 170) & (r > 110) & (g < 145) & ((b - g) > 50)
    cand_bg = is_bg_color | is_purple_star
    labeled_bg, _ = label(cand_bg)
    border_labels = (
        set(np.unique(labeled_bg[0,:])) |
        set(np.unique(labeled_bg[-1,:])) |
        set(np.unique(labeled_bg[:,0])) |
        set(np.unique(labeled_bg[:,-1]))
    )
    border_labels.discard(0)
    bg_mask = np.isin(labeled_bg, list(border_labels))
    fg_mask = ~bg_mask
    # Keep ONLY the largest foreground connected component
    labeled_fg, num_fg = label(fg_mask)
    if num_fg > 0:
        counts = np.bincount(labeled_fg.ravel())
        counts[0] = 0
        largest = np.argmax(counts)
        fg_mask = (labeled_fg == largest)
    # Erode 1px to remove any bright halo, then smooth alpha
    fg_eroded = binary_erosion(fg_mask, iterations=1)
    alpha = np.clip(gaussian_filter(fg_eroded.astype(np.float32), sigma=0.9) * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([crop, alpha]), "RGBA")

avatars = [
    ("av_brunette_wink", im1[55:205, 275:405]),
    ("av_blonde_wink",   im1[30:210, 910:1055]),
    ("av_adidas_cap",    im1[440:610, 305:445]),
    ("av_pink_glasses",  im1[370:520, 1025:1165]),
    ("av_curly_boy",     im2[600:725, 250:345]),
    ("av_glasses_thumb", im2[410:535, 1065:1175]),
]
for name, arr in avatars:
    save_raw_rgba(extract_clean_avatar(arr), name)

# Extract 3D Supahub Purple Icon with rounded squircle mask
supa_crop = im1[335:463, 632:760]
sh, sw, _ = supa_crop.shape
mask_im = Image.new("L", (sw, sh), 0)
mdraw = ImageDraw.Draw(mask_im)
mdraw.rounded_rectangle([2, 2, sw-3, sh-3], radius=34, fill=255)
mask_im = mask_im.filter(ImageFilter.GaussianBlur(0.8))
supa_rgba = Image.fromarray(supa_crop, "RGB").convert("RGBA")
supa_rgba.putalpha(mask_im)
save_raw_rgba(supa_rgba, "supahub_icon_3d")

# 2. Helper to draw high-res Slack, Discord, Gmail, and Supahub Vector Icons
def draw_gmail_icon(draw, cx, cy, r):
    # White circle + official 4-color M
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(255, 244, 232, 255))
    w = int(r * 1.1)
    h = int(r * 0.82)
    x0, y0 = cx - w//2, cy - h//2
    x1, y1 = cx + w//2, cy + h//2
    lw = max(3, int(r * 0.22))
    # Left blue/red vertical bar
    draw.line([(x0+lw//2, y0+lw//2), (x0+lw//2, y1)], fill=(66, 133, 244, 255), width=lw)
    # Right green vertical bar
    draw.line([(x1-lw//2, y0+lw//2), (x1-lw//2, y1)], fill=(52, 168, 83, 255), width=lw)
    # Red V-shape
    draw.line([(x0+lw//2, y0+lw//2), (cx, cy+int(h*0.18))], fill=(234, 67, 53, 255), width=lw)
    draw.line([(cx, cy+int(h*0.18)), (x1-lw//2, y0+lw//2)], fill=(251, 188, 5, 255), width=lw)

def draw_discord_icon(draw, cx, cy, r, bg=(232, 234, 254, 255), fg=(88, 101, 242, 255)):
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=bg)
    w = int(r * 1.15)
    h = int(r * 0.85)
    draw.rounded_rectangle([cx-w//2, cy-h//2, cx+w//2, cy+h//2], radius=int(h*0.4), fill=fg)
    er = max(2, int(r * 0.16))
    eye_col = bg if bg[3] > 0 else (255, 255, 255, 255)
    draw.ellipse([cx-int(w*0.22)-er, cy-er, cx-int(w*0.22)+er, cy+er], fill=eye_col)
    draw.ellipse([cx+int(w*0.22)-er, cy-er, cx+int(w*0.22)+er, cy+er], fill=eye_col)

def draw_slack_icon(draw, cx, cy, r):
    # 4-color pinwheel
    s = int(r * 0.26)
    d = int(r * 0.34)
    # Blue top-left, Green top-right, Red bottom-left, Yellow bottom-right
    draw.rounded_rectangle([cx-d-s, cy-d, cx-d+s, cy], radius=s//2, fill=(54, 197, 240, 255))
    draw.ellipse([cx-d-s*2, cy-d-s, cx-d-s, cy-d], fill=(54, 197, 240, 255))
    draw.rounded_rectangle([cx, cy-d-s, cx+d, cy-d+s], radius=s//2, fill=(46, 182, 125, 255))
    draw.ellipse([cx+d, cy-d-s*2, cx+d+s, cy-d-s], fill=(46, 182, 125, 255))
    draw.rounded_rectangle([cx-d, cy+d-s, cx, cy+d+s], radius=s//2, fill=(224, 30, 90, 255))
    draw.ellipse([cx-d-s, cy+d+s, cx-d, cy+d+s*2], fill=(224, 30, 90, 255))
    draw.rounded_rectangle([cx+d-s, cy, cx+d+s, cy+d], radius=s//2, fill=(236, 178, 46, 255))
    draw.ellipse([cx+d+s, cy+d, cx+d+s*2, cy+d+s], fill=(236, 178, 46, 255))

def draw_supahub_bolt(draw, cx, cy, scale=1.0, col=(124, 46, 210, 255)):
    # Official Supahub lightning-S geometric mark
    pts1 = [
        (cx - 4*scale, cy - 28*scale),
        (cx + 12*scale, cy - 28*scale),
        (cx + 4*scale, cy - 4*scale),
        (cx + 22*scale, cy - 4*scale),
        (cx + 18*scale, cy + 8*scale),
        (cx - 18*scale, cy + 8*scale),
        (cx - 14*scale, cy - 4*scale),
    ]
    pts2 = [
        (cx - 2*scale, cy + 8*scale),
        (cx + 14*scale, cy + 8*scale),
        (cx + 4*scale, cy + 28*scale),
        (cx - 12*scale, cy + 28*scale),
    ]
    draw.polygon(pts1, fill=col)
    draw.polygon(pts2, fill=col)

# 3. Build the 4 Floating Chat Pills for Scene 1 (Discord, Slack Warm, Slack Teal, Gmail)
def make_chat_pill(name, bg_col, bar_col, icon_type, icon_left=True):
    w, h = 420, 124
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Speech bubble pointer triangle + rounded pill
    d.rounded_rectangle([8, 16, w-8, h-8], radius=50, fill=bg_col)
    if icon_left:
        icx, icy = 72, 68
        bx0, bx1 = 132, w - 48
    else:
        icx, icy = w - 72, 68
        bx0, bx1 = 48, w - 132
    if icon_type == "discord":
        draw_discord_icon(d, icx, icy, 34, bg=(255,255,255,255), fg=bg_col)
    elif icon_type == "slack":
        draw_slack_icon(d, icx, icy, 34)
    elif icon_type == "gmail":
        draw_gmail_icon(d, icx, icy, 34)
    d.rounded_rectangle([bx0, 54, bx1, 82], radius=14, fill=bar_col)
    save_raw_rgba(im, name)

make_chat_pill("pill_discord",    (185, 132, 255, 255), (148,  82, 245, 255), "discord", True)
make_chat_pill("pill_slack_warm", (255, 236, 209, 255), (253, 206, 152, 255), "slack",   True)
make_chat_pill("pill_slack_teal", (209, 250, 240, 255), ( 78, 224, 198, 255), "slack",   True)
make_chat_pill("pill_gmail_pink", (255, 209, 232, 255), (237,  63, 142, 255), "gmail",   True)

# 4. Prepare High-Resolution UI Screen & Card Textures (cleaned & formatted for 3D projection)
def load_and_round_card(src_path, out_name, target_w, target_h, radius=32, border_col=(185, 132, 255, 220), bg_fill=(255, 255, 255, 255)):
    raw_im = Image.open(src_path).convert("RGBA")
    flat = Image.new("RGBA", raw_im.size, bg_fill)
    flat.alpha_composite(raw_im)
    src = flat.resize((target_w, target_h), Image.Resampling.LANCZOS)
    mask = Image.new("L", (target_w, target_h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, target_w-1, target_h-1], radius=radius, fill=255)
    out = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    od = ImageDraw.Draw(out)
    od.rounded_rectangle([1, 1, target_w-2, target_h-2], radius=radius, outline=border_col, width=4)
    save_raw_rgba(out, out_name)

# Scene 3: Full Supahub "Share your feedback!" Portal Screen
load_and_round_card("image-search/site-supahub-com-tab-widgets-or-tab-feed-1.jpg", "ui_portal_main", 1600, 960, radius=36)
# Scene 4: Left Card (Feature Requests / Bug Fixes) & Right Card (Roadmap Public/Q1/Q2)
load_and_round_card("image-search/site-supahub-com-priority-table-or-custo-5.png", "ui_card_feature_requests", 900, 900, radius=36)
load_and_round_card("image-search/site-supahub-com-tab-widgets-or-tab-feed-2.jpg", "ui_card_roadmap_public", 1080, 900, radius=36)
# Scene 5: Merge Duplicate Posts & Add Vote on Behalf
load_and_round_card("image-search/site-supahub-com-merge-duplicate-posts-o-1.png", "ui_card_merge_posts", 1200, 800, radius=32)
load_and_round_card("image-search/site-supahub-com-merge-duplicate-posts-o-5.jpg", "ui_card_vote_behalf", 1200, 800, radius=32)
# Scene 6: Q2 Roadmap Priority Table & Value vs Effort Modal
load_and_round_card("image-search/site-supahub-com-priority-table-or-custo-1.jpg", "ui_card_priority_table", 1350, 900, radius=34)
load_and_round_card("image-search/site-supahub-com-priority-table-or-custo-4.jpg", "ui_card_value_effort", 1200, 800, radius=34)
# Scene 8: Custom Domain, Dark/Light Theme & Privacy Shield
load_and_round_card("image-search/supahub-screenshot-or-supahub-promo-vide-3.jpg", "ui_theme_light", 1440, 864, radius=32)
load_and_round_card("image-search/supahub-screenshot-or-supahub-promo-vide-1.jpg", "ui_theme_dark", 1440, 864, radius=32)
load_and_round_card("image-search/supahub-screenshot-or-supahub-promo-vide-5.png", "ui_privacy_shield", 1200, 800, radius=32)
load_and_round_card("image-search/site-supahub-com-merge-duplicate-posts-o-3.jpg", "ui_custom_statuses", 1200, 800, radius=32)
# Scene 9: Product Changelog & Link Related Posts
load_and_round_card("image-search/site-supahub-com-roadmap-or-changelog-or-2.jpg", "ui_changelog_main", 1600, 960, radius=36)
load_and_round_card("image-search/site-supahub-com-merge-duplicate-posts-o-4.png", "ui_related_posts", 1200, 800, radius=32)
# Scene 10: 3-Module Hero Lockup
load_and_round_card("image-search/site-supahub-com-tab-widgets-or-tab-feed-5.png", "ui_three_modules", 1600, 720, radius=36)

# 5. Build Custom Kanban Board Base + Movable Kanban Card for Scene 7 (so a card physically animates across columns!)
def build_kanban_assets():
    w, h = 1400, 820
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Outer white card with purple top accent border
    d.rounded_rectangle([0, 0, w-1, h-1], radius=40, fill=(255, 255, 255, 255), outline=(185, 132, 255, 255), width=4)
    f_col = fnt(FONT_SEMI, 32)
    # Column headers: Planned, In Progress, Completed
    cols = [
        (100, "Planned",     (235, 176, 46, 255),  "circle"),
        (530, "In Progress", (124, 46, 210, 255),  "half"),
        (960, "Completed",   (13, 188, 165, 255),  "check"),
    ]
    for cx, title, col, icon_kind in cols:
        ir = 15
        icx, icy = cx + 18, 78
        d.ellipse([icx-ir, icy-ir, icx+ir, icy+ir], outline=col, width=4)
        if icon_kind == "half":
            d.pieslice([icx-ir+4, icy-ir+4, icx+ir-4, icy+ir-4], start=-90, end=90, fill=col)
        elif icon_kind == "check":
            d.line([(icx-7, icy), (icx-2, icy+6), (icx+8, icy-6)], fill=col, width=3)
        d.text((cx + 46, 58), title, font=f_col, fill=(20, 16, 35, 255))

    def draw_kcard(draw_obj, x0, y0, pill_col, voted=False):
        cw, ch = 360, 110
        draw_obj.rounded_rectangle([x0, y0, x0+cw, y0+ch], radius=20, fill=(255, 255, 255, 255), outline=(232, 234, 242, 255), width=2)
        # Upvote box
        vb_bg = (243, 232, 255, 255) if voted else (244, 246, 250, 255)
        vb_fg = (124, 46, 210, 255) if voted else (148, 163, 184, 255)
        draw_obj.rounded_rectangle([x0+16, y0+16, x0+72, y0+ch-16], radius=14, fill=vb_bg)
        # Triangle
        tx, ty = x0+44, y0+38
        draw_obj.polygon([(tx, ty-8), (tx-9, ty+5), (tx+9, ty+5)], fill=vb_fg)
        draw_obj.rounded_rectangle([x0+28, y0+64, x0+60, y0+76], radius=6, fill=vb_fg)
        # Text bar & category pill
        draw_obj.rounded_rectangle([x0+92, y0+26, x0+cw-28, y0+46], radius=10, fill=(226, 232, 240, 255))
        draw_obj.rounded_rectangle([x0+92, y0+62, x0+168, y0+84], radius=11, fill=pill_col)

    # Planned column (5 cards)
    planned_pills = [(191,219,254,255), (255,209,239,255), (167,243,208,255), (253,230,138,255), (191,219,254,255)]
    for i, pcol in enumerate(planned_pills):
        draw_kcard(d, 90, 130 + i*130, pcol, voted=(i==0))

    # In Progress column (2 static cards; the 3rd card is a separate movable sprite!)
    inprog_pills = [(255,209,239,255), (253,230,138,255)]
    for i, pcol in enumerate(inprog_pills):
        draw_kcard(d, 520, 130 + i*130, pcol, voted=False)

    # Completed column (2 static cards; the movable card lands at slot 2!)
    comp_pills = [(253,230,138,255), (167,243,208,255)]
    for i, pcol in enumerate(comp_pills):
        draw_kcard(d, 950, 130 + i*130, pcol, voted=(i==1))

    save_raw_rgba(im, "ui_kanban_board")

    # Movable Kanban card sprite
    mc = Image.new("RGBA", (380, 130), (0, 0, 0, 0))
    md = ImageDraw.Draw(mc)
    draw_kcard(md, 10, 10, (191, 219, 254, 255), voted=True)
    save_raw_rgba(mc, "ui_kanban_movable_card")

build_kanban_assets()

# 6. Build Kinetic Typography Plates with Crisp SF Pro Bold/SemiBold & Gradient Shaders
def make_text_sprite(name, segments, font_size=92, subtext=None, sub_size=40):
    """
    segments: list of (text_str, color_mode)
      where color_mode is 'white', 'dark', 'grad_pink_purple', or an RGBA tuple.
    """
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
    H = font_size + pad_y * 2 + (sub_size + 30 if subtext else 0)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    x_cursor = pad_x
    for (txt, mode), sw in zip(segments, seg_widths):
        # Render text mask
        tmask = Image.new("L", (W, H), 0)
        td = ImageDraw.Draw(tmask)
        td.text((x_cursor, pad_y), txt, font=font, fill=255)
        if mode == "white":
            layer = Image.new("RGBA", (W, H), (255, 255, 255, 255))
        elif mode == "dark":
            layer = Image.new("RGBA", (W, H), (18, 12, 36, 255))
        elif mode == "grad_pink_purple":
            # Horizontal gradient from #ED3FB2 (237, 63, 178) to #B984FF (185, 132, 255)
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
            # Add soft neon bloom behind gradient text
            glow_mask = tmask.filter(ImageFilter.GaussianBlur(18))
            glow_arr = arr.copy()
            glow_arr[:, :, 3] = (np.array(glow_mask, dtype=np.float32) * 0.55).astype(np.uint8)
            im.alpha_composite(Image.fromarray(glow_arr, "RGBA"))
        else:
            layer = Image.new("RGBA", (W, H), mode)
        layer.putalpha(tmask)
        im.alpha_composite(layer)
        x_cursor += sw

    if subtext:
        sfont = fnt(FONT_MED, sub_size)
        sbbox = dd.textbbox((0, 0), subtext, font=sfont)
        sw = sbbox[2] - sbbox[0]
        sd = ImageDraw.Draw(im)
        scol = (100, 90, 125, 255) if segments[0][1] == "dark" else (210, 195, 240, 255)
        sd.text(((W - sw)//2, pad_y + font_size + 24), subtext, font=sfont, fill=scol)

    save_raw_rgba(im, name)

make_text_sprite("txt_feature", [("feature", "grad_pink_purple")], font_size=96)
make_text_sprite("txt_requests", [("requests", "white")], font_size=96)
make_text_sprite("txt_give_users", [("Give your users ", "grad_pink_purple"), ("a place", "white")], font_size=88)
make_text_sprite("txt_share_ideas", [("and share ideas", "grad_pink_purple")], font_size=92)
make_text_sprite("txt_collect_feedback", [("Collect ", "white"), ("feedback", "grad_pink_purple")], font_size=96)
make_text_sprite("txt_merge_duplicates", [("Merge duplicates ", "grad_pink_purple"), ("& vote on behalf", "dark")], font_size=76)
make_text_sprite("txt_prioritize", [("Prioritize ", "grad_pink_purple"), ("what to build next", "white")], font_size=84)
make_text_sprite("txt_public_roadmap", [("Public ", (124, 46, 210, 255)), ("Roadmap", "dark")], font_size=86)
make_text_sprite("txt_personalize_1", [("Personalize", "white")], font_size=88)
make_text_sprite("txt_personalize_2", [("with OpenGraph", "grad_pink_purple")], font_size=88)
make_text_sprite("txt_announce_updates", [("Announce ", "grad_pink_purple"), ("product updates", "white")], font_size=86)
make_text_sprite("txt_close_loop", [("Close the ", "dark"), ("feedback loop", (124, 46, 210, 255))], font_size=84)

# Build Supahub Finale Logo Lockup Sprite
def build_supahub_logo():
    w, h = 900, 260
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_supahub_bolt(d, 210, 105, scale=1.9, col=(124, 46, 210, 255))
    font = fnt(FONT_BOLD, 118)
    d.text((275, 42), "Supahub", font=font, fill=(15, 18, 38, 255))
    sfont = fnt(FONT_MED, 32)
    sub = "Central hub to collect feedback & announce product updates"
    sbbox = d.textbbox((0, 0), sub, font=sfont)
    sw = sbbox[2] - sbbox[0]
    d.text(((w - sw)//2, 195), sub, font=sfont, fill=(90, 82, 118, 255))
    save_raw_rgba(im, "logo_supahub_finale")

build_supahub_logo()
print("All Supahub assets generated successfully!")
