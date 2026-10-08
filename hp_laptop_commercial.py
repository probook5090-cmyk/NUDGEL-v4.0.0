# ==============================================================================
# HP FLAGSHIP LAPTOP — 36-SECOND 4K UHD CINEMATIC COMMERCIAL FOR BLENDER 5.2
# "HP — Made for what moves you. Innovation that keeps up."
# ==============================================================================
# HOW TO RUN IN BLENDER:
# 1. Open Blender -> Scripting tab -> Click "+ New" (or replace existing text)
# 2. Paste this script and click "Run Script" (▶)
# 3. It immediately builds the complete 864-frame (36s @ 24fps) 6-Act Commercial,
#    8 Cinema Cameras with Timeline Switch Markers, Cycles/EEVEE Materials,
#    Compositor Node Tree, and Synchronized Stereo Soundtrack (.wav), saves
#    HP_Laptop_Commercial.blend to your Desktop, and connects to Arena Bridge!
# ==============================================================================

import base64
import io
import json
import math
import os
import queue
import random
import struct
import tempfile
import threading
import time
import traceback
import urllib.request
import uuid
import wave
from contextlib import redirect_stdout

import bmesh
import bpy
import mathutils
from mathutils import Euler, Matrix, Vector

BRIDGE_URL = "https://8000-ikg13vnaq127jkvsnbace.e2b.app"
GITHUB_BRIDGE_DISCOVERY_API = "https://api.github.com/repos/probook5090-cmyk/NUDGEL-v4.0.0/contents/bridge_url.json?ref=refs/heads/arena/71510930-nudgel-v4-0-0"


# ==============================================================================
# SECTION 1: CLEAN SCENE & CONFIGURE 4K UHD 24FPS CINEMA SETTINGS
# ==============================================================================
def setup_cinema_scene():
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 864  # 36.0 seconds @ 24 fps
    scene.frame_current = 480
    scene.render.fps = 24
    scene.render.resolution_x = 3840
    scene.render.resolution_y = 2160
    scene.render.resolution_percentage = 50  # 1920x1080 fast preview; set 100% for full 4K master

    # Configure Cycles with GPU auto-detection & denoising + EEVEE viewport readiness
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 128
        scene.cycles.preview_samples = 32
        scene.cycles.use_denoising = True
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.02
        prefs = bpy.context.preferences
        cprefs = prefs.addons["cycles"].preferences
        for dev_type in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
            try:
                cprefs.compute_device_type = dev_type
                cprefs.get_devices()
                if any(d.type == dev_type for d in cprefs.devices):
                    for d in cprefs.devices:
                        d.use = True
                    scene.cycles.device = "GPU"
                    break
            except Exception:
                continue
    except Exception:
        pass

    # Enable cinematic motion blur (180-degree shutter = 0.5)
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = 0.5

    # AgX / Filmic Color Management
    try:
        scene.view_settings.exposure = 0.15
        scene.view_settings.gamma = 1.0
    except Exception:
        pass

    # Stop any active animation playback before rebuilding scene
    try:
        for win in bpy.context.window_manager.windows:
            if win.screen.is_animation_playing:
                with bpy.context.temp_override(window=win, screen=win.screen):
                    bpy.ops.screen.animation_cancel(restore_frame=False)
    except Exception:
        pass

    # Clear existing objects, collections, timeline markers, and VSE strips
    scene.timeline_markers.clear()
    if scene.sequence_editor:
        scene.sequence_editor_clear()

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for crv in list(bpy.data.curves):
        if crv.users == 0:
            bpy.data.curves.remove(crv)
    for lgt in list(bpy.data.lights):
        if lgt.users == 0:
            bpy.data.lights.remove(lgt)
    for cam in list(bpy.data.cameras):
        if cam.users == 0:
            bpy.data.cameras.remove(cam)

    return scene


def ensure_collection(scene, name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


def link_only(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


# ==============================================================================
# SECTION 2: PHYSICALLY-BASED LUXURY MATERIALS & SHADERS
# ==============================================================================
def set_sock(node, names, val):
    if isinstance(names, str):
        names = [names]
    for n in names:
        sock = node.inputs.get(n)
        if sock is not None:
            sock.default_value = val
            return True
    return False


def make_pbr_mat(
    name,
    base_color,
    metallic=0.0,
    roughness=0.25,
    anisotropic=0.0,
    coat=0.0,
    emission_color=None,
    emission_strength=0.0,
):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*base_color[:3], 1.0)
    nodes = mat.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")

    set_sock(bsdf, ["Base Color"], (*base_color[:3], 1.0))
    set_sock(bsdf, ["Metallic"], metallic)
    set_sock(bsdf, ["Roughness"], roughness)
    if anisotropic > 0:
        set_sock(bsdf, ["Anisotropic"], anisotropic)
        set_sock(bsdf, ["Anisotropic Rotation"], 0.25)
    if coat > 0:
        set_sock(bsdf, ["Coat Weight", "Clearcoat"], coat)
        set_sock(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.06)
    if emission_color is not None:
        set_sock(bsdf, ["Emission Color", "Emission"], (*emission_color[:3], 1.0))
        set_sock(bsdf, ["Emission Strength"], emission_strength)
    return mat


def build_all_materials():
    mats = {}

    # 1. CNC-Milled Dark Ash / Nightfall Black Brushed Anodized Aluminum
    mat_alu = make_pbr_mat(
        "Mat_HP_Anodized_DarkAsh",
        base_color=(0.022, 0.025, 0.032),
        metallic=0.96,
        roughness=0.21,
        anisotropic=0.60,
        coat=0.18,
    )
    mats["alu_dark"] = mat_alu

    # 2. Precision Gem-Cut Chamfer Rim (Refined Satin Silver / Pale Brass Highlight)
    mats["alu_silver"] = make_pbr_mat(
        "Mat_HP_Chamfer_Silver",
        base_color=(0.76, 0.79, 0.84),
        metallic=0.98,
        roughness=0.14,
        anisotropic=0.65,
        coat=0.35,
    )

    # 3. Mirror-Polished HP Slash Logo Chrome
    mats["hp_logo"] = make_pbr_mat(
        "Mat_HP_Logo_MirrorChrome",
        base_color=(0.94, 0.96, 1.0),
        metallic=1.0,
        roughness=0.03,
        coat=1.0,
        emission_color=(0.75, 0.86, 1.0),
        emission_strength=0.25,
    )

    # 4. Satin Keycap Polymer (Tactile Matte Obsidian)
    mats["keycap"] = make_pbr_mat(
        "Mat_HP_Keycap_Satin",
        base_color=(0.010, 0.012, 0.016),
        metallic=0.12,
        roughness=0.40,
        coat=0.08,
    )

    # 5. Keyboard LED Backlight Under-Glow (Breathes on in Act 3!)
    mats["key_backlight"] = make_pbr_mat(
        "Mat_HP_Key_Backlight",
        base_color=(0.05, 0.10, 0.18),
        metallic=0.1,
        roughness=0.25,
        emission_color=(0.45, 0.78, 1.0),
        emission_strength=0.0,  # Animated 0.0 -> 1.4
    )

    # 6. Haptic Glass Trackpad
    mats["trackpad"] = make_pbr_mat(
        "Mat_HP_Trackpad_Glass",
        base_color=(0.065, 0.070, 0.084),
        metallic=0.35,
        roughness=0.12,
        coat=0.85,
    )

    # 7. Satin Rubber Feet & Vent Interior
    mats["rubber"] = make_pbr_mat(
        "Mat_HP_Rubber_Satin",
        base_color=(0.02, 0.02, 0.024),
        metallic=0.0,
        roughness=0.78,
    )

    # 8. Display Glass Bezel
    mats["bezel"] = make_pbr_mat(
        "Mat_HP_Display_Bezel",
        base_color=(0.012, 0.014, 0.018),
        metallic=0.2,
        roughness=0.04,
        coat=1.0,
    )

    # 9. 4K OLED Display Panel — Flowing Blue-Violet-White HP Generative Light Forms
    mat_screen = bpy.data.materials.new("Mat_HP_OLED_Display")
    mat_screen.use_nodes = True
    snt = mat_screen.node_tree
    snodes = snt.nodes
    slinks = snt.links
    sbsdf = next(n for n in snodes if n.type == "BSDF_PRINCIPLED")
    set_sock(sbsdf, ["Base Color"], (0.008, 0.018, 0.048, 1.0))
    set_sock(sbsdf, ["Metallic"], 0.04)
    set_sock(sbsdf, ["Roughness"], 0.18)
    set_sock(sbsdf, ["Specular IOR Level", "Specular"], 0.06)
    set_sock(sbsdf, ["Coat Weight", "Clearcoat"], 0.04)
    set_sock(sbsdf, ["Emission Strength"], 0.0)  # Animated: 0 in Acts 1-3, powers on in Act 4!

    stc = snodes.new("ShaderNodeTexCoord")
    swave = snodes.new("ShaderNodeTexWave")
    swave.name = "OLED_Wave"
    swave.wave_type = "BANDS"
    swave.bands_direction = "DIAGONAL"
    set_sock(swave, ["Scale"], 0.92)
    set_sock(swave, ["Distortion"], 4.2)
    set_sock(swave, ["Detail"], 2.5)

    sramp = snodes.new("ShaderNodeValToRGB")
    elems = sramp.color_ramp.elements
    elems[0].position = 0.0
    elems[0].color = (0.005, 0.012, 0.038, 1.0)   # Deep obsidian midnight
    elems[1].position = 0.94
    elems[1].color = (0.58, 0.88, 1.0, 1.0)       # Luminous ice cyan-white highlight
    e_blue = elems.new(0.42)
    e_blue.color = (0.02, 0.18, 0.68, 1.0)        # Signature HP Royal Cobalt Blue
    e_violet = elems.new(0.74)
    e_violet.color = (0.26, 0.36, 0.96, 1.0)      # Refined electric indigo-violet

    slinks.new(stc.outputs["Generated"], swave.inputs["Vector"])
    slinks.new(swave.outputs["Fac"], sramp.inputs["Fac"])
    slinks.new(sramp.outputs["Color"], sbsdf.inputs["Base Color"])
    em_sock = sbsdf.inputs.get("Emission Color") or sbsdf.inputs.get("Emission")
    if em_sock:
        slinks.new(sramp.outputs["Color"], em_sock)
    mats["screen"] = mat_screen

    # 10. Seamless Obsidian Studio Floor & Black Glass Hero Platform
    mats["floor"] = make_pbr_mat(
        "Mat_Studio_Floor",
        base_color=(0.010, 0.012, 0.016),
        metallic=0.55,
        roughness=0.16,
        coat=0.75,
    )
    mats["platform"] = make_pbr_mat(
        "Mat_Black_Glass_Platform",
        base_color=(0.018, 0.022, 0.030),
        metallic=0.82,
        roughness=0.07,
        coat=1.0,
    )

    # 11. Luminous Data Threads & Environment Accents (Act 5)
    mats["thread_blue"] = make_pbr_mat(
        "Mat_Luminous_Thread_Blue",
        base_color=(0.18, 0.62, 1.0),
        metallic=0.2,
        roughness=0.1,
        emission_color=(0.12, 0.56, 1.0),
        emission_strength=5.5,
    )
    mats["thread_violet"] = make_pbr_mat(
        "Mat_Luminous_Thread_Violet",
        base_color=(0.58, 0.32, 1.0),
        metallic=0.2,
        roughness=0.1,
        emission_color=(0.52, 0.28, 1.0),
        emission_strength=5.0,
    )
    mats["thread_gold"] = make_pbr_mat(
        "Mat_Luminous_Thread_WarmGold",
        base_color=(1.0, 0.78, 0.48),
        metallic=0.4,
        roughness=0.1,
        emission_color=(1.0, 0.74, 0.42),
        emission_strength=4.5,
    )

    # 12. End-Card Brand Typography Materials
    mats["text_hp"] = make_pbr_mat(
        "Mat_EndCard_HP_White",
        base_color=(0.96, 0.98, 1.0),
        metallic=0.85,
        roughness=0.10,
        coat=1.0,
        emission_color=(0.88, 0.94, 1.0),
        emission_strength=2.0,
    )
    mats["text_sub"] = make_pbr_mat(
        "Mat_EndCard_Tagline_Silver",
        base_color=(0.75, 0.82, 0.92),
        metallic=0.8,
        roughness=0.16,
        emission_color=(0.62, 0.76, 0.96),
        emission_strength=1.35,
    )

    return mats


# ==============================================================================
# SECTION 3: PRECISION GEOMETRY BUILDERS — HP FLAGSHIP LAPTOP
# ==============================================================================
def make_rounded_slab_xy(
    name,
    width,
    depth,
    thickness,
    corner_radius,
    chamfer=0.008,
    mat_main=None,
    mat_chamfer=None,
    col=None,
    parent=None,
    loc=(0, 0, 0),
):
    """Build a mathematically exact horizontal rounded-corner slab in X-Y with thickness along Z."""
    r = min(corner_radius, width * 0.45, depth * 0.45)
    hx = width * 0.5 - r
    hy = depth * 0.5 - r
    hz = thickness * 0.5
    seg = 14

    corners = [
        ( hx,  hy, 0.0,           math.pi * 0.5),
        (-hx,  hy, math.pi * 0.5, math.pi),
        (-hx, -hy, math.pi,       math.pi * 1.5),
        ( hx, -hy, math.pi * 1.5, math.pi * 2.0),
    ]

    ring_2d = []
    for cx, cy, a0, a1 in corners:
        for i in range(seg):
            ang = a0 + (i / float(seg)) * (a1 - a0)
            ring_2d.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))

    bm = bmesh.new()
    n = len(ring_2d)
    ch = min(chamfer, thickness * 0.35, r * 0.35) if chamfer > 0 else 0.0

    if ch > 0:
        z_vals = [-hz, -hz + ch, hz - ch, hz]
        ins_vals = [ch, 0.0, 0.0, ch]
    else:
        z_vals = [-hz, hz]
        ins_vals = [0.0, 0.0]

    rings = []
    for zv, ins in zip(z_vals, ins_vals):
        sx = (width - 2.0 * ins) / width
        sy = (depth - 2.0 * ins) / depth
        rings.append([bm.verts.new((x * sx, y * sy, zv)) for (x, y) in ring_2d])

    for r_idx in range(len(rings) - 1):
        rA, rB = rings[r_idx], rings[r_idx + 1]
        is_chamfer_band = (ch > 0 and r_idx in (0, 2))
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((rA[i], rA[j], rB[j], rB[i]))
            if is_chamfer_band and mat_chamfer is not None:
                f.material_index = 1

    f_bot = bm.faces.new(list(reversed(rings[0])))
    f_top = bm.faces.new(rings[-1])
    f_bot.material_index = 0
    f_top.material_index = 0

    bm.normal_update()
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = (abs(poly.normal.z) < 0.92)

    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    if mat_main:
        obj.data.materials.append(mat_main)
    if mat_chamfer:
        obj.data.materials.append(mat_chamfer)
    if col:
        link_only(obj, col)
    if parent:
        obj.parent = parent
    return obj


def build_hp_minimal_slash_logo(name, col, parent, mat_logo, z_pos, scale=1.0):
    """
    Build the iconic modern HP 4-stroke 13-degree slanted minimal slash logo:
    - Stroke 1 (left long descender/ascender of 'h')
    - Stroke 2 (right short leg of 'h')
    - Stroke 3 (left short body of 'p')
    - Stroke 4 (right long descender of 'p')
    """
    bm = bmesh.new()
    tilt = math.tan(math.radians(13.0))
    bar_w = 0.028 * scale
    thick = 0.0045

    # (center_x, y_bottom, y_top) in local lid coordinates
    strokes = [
        (-0.105 * scale, -0.095 * scale,  0.145 * scale),  # Left long stroke ('h' stem)
        (-0.038 * scale, -0.095 * scale,  0.055 * scale),  # Inner-left short stroke ('h' arch)
        ( 0.038 * scale, -0.055 * scale,  0.095 * scale),  # Inner-right short stroke ('p' bowl)
        ( 0.105 * scale, -0.145 * scale,  0.095 * scale),  # Right long stroke ('p' stem)
    ]

    for cx, y0, y1 in strokes:
        x0_l = cx - bar_w * 0.5 + y0 * tilt
        x0_r = cx + bar_w * 0.5 + y0 * tilt
        x1_l = cx - bar_w * 0.5 + y1 * tilt
        x1_r = cx + bar_w * 0.5 + y1 * tilt

        v_bot = [
            bm.verts.new((x0_l, y0, 0.0)),
            bm.verts.new((x0_r, y0, 0.0)),
            bm.verts.new((x1_r, y1, 0.0)),
            bm.verts.new((x1_l, y1, 0.0)),
        ]
        v_top = [
            bm.verts.new((x0_l, y0, thick)),
            bm.verts.new((x0_r, y0, thick)),
            bm.verts.new((x1_r, y1, thick)),
            bm.verts.new((x1_l, y1, thick)),
        ]
        bm.faces.new(list(reversed(v_bot)))
        bm.faces.new(v_top)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((v_bot[i], v_bot[j], v_top[j], v_top[i]))

    bm.normal_update()
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (0.0, 0.0, z_pos)
    obj.data.materials.append(mat_logo)
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.0012
    bev.segments = 3
    link_only(obj, col)
    if parent:
        obj.parent = parent
    return obj


def build_keyboard_grid_mesh(name, col, parent, mat_keycap, z_top):
    """Build a realistic 6-row 78-key sculpted chiclet keyboard in a single clean mesh."""
    bm = bmesh.new()
    rows = [
        # (y_center, height, num_keys)
        ( 0.62, 0.085, 14),  # Function row (Esc .. Del)
        ( 0.47, 0.135, 14),  # Number row
        ( 0.29, 0.135, 14),  # QWERTY row
        ( 0.11, 0.135, 13),  # Home row
        (-0.07, 0.135, 12),  # Shift row
    ]
    total_w = 2.64
    gap = 0.022
    kh = 0.014

    def add_key_box(cx, cy, kw, kd):
        hx, hy = kw * 0.5, kd * 0.5
        v0 = [
            bm.verts.new((cx - hx, cy - hy, 0.0)),
            bm.verts.new((cx + hx, cy - hy, 0.0)),
            bm.verts.new((cx + hx, cy + hy, 0.0)),
            bm.verts.new((cx - hx, cy + hy, 0.0)),
        ]
        inset = 0.004
        v1 = [
            bm.verts.new((cx - hx + inset, cy - hy + inset, kh)),
            bm.verts.new((cx + hx - inset, cy - hy + inset, kh)),
            bm.verts.new((cx + hx - inset, cy + hy - inset, kh)),
            bm.verts.new((cx - hx + inset, cy + hy - inset, kh)),
        ]
        bm.faces.new(v1)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((v0[i], v0[j], v1[j], v1[i]))

    for yc, kd, nkeys in rows:
        step = total_w / nkeys
        kw = step - gap
        start_x = -total_w * 0.5 + step * 0.5
        for k in range(nkeys):
            add_key_box(start_x + k * step, yc, kw, kd)

    # Bottom row with wide Spacebar + modifiers
    bot_y = -0.25
    bot_d = 0.145
    bot_layout = [
        (-1.21, 0.18), (-1.00, 0.18), (-0.79, 0.18),
        ( 0.00, 1.12),  # Wide centered Spacebar
        ( 0.72, 0.18), ( 0.93, 0.18), ( 1.18, 0.24),
    ]
    for cx, kw in bot_layout:
        add_key_box(cx, bot_y, kw, bot_d)

    bm.normal_update()
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (0.0, 0.12, z_top)
    obj.data.materials.append(mat_keycap)
    link_only(obj, col)
    if parent:
        obj.parent = parent
    return obj


def build_hp_flagship_laptop(col_laptop, mats):
    """Construct the complete rigged HP Flagship Laptop with physical hinge pivot."""
    root = bpy.data.objects.new("HP_Laptop_Root", None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.6
    root.location = (0.0, 0.0, 0.0)
    col_laptop.objects.link(root)

    W = 3.12   # 31.2 cm proportional width
    D = 2.16   # 21.6 cm proportional depth
    base_h = 0.088
    lid_h = 0.044
    R = 0.12

    # 1. Base Unibody Chassis (sits at Z = 0.012..0.100 above rubber feet)
    base_z = 0.012 + base_h * 0.5
    make_rounded_slab_xy(
        "HP_Base_Chassis",
        width=W,
        depth=D,
        thickness=base_h,
        corner_radius=R,
        chamfer=0.012,
        mat_main=mats["alu_dark"],
        mat_chamfer=mats["alu_silver"],
        col=col_laptop,
        parent=root,
        loc=(0.0, 0.0, base_z),
    )

    # 2. Four Precision Rubber Feet (ground contact at Z = 0.0)
    for fx, fy, suffix in [(-1.22, -0.82, "FL"), (1.22, -0.82, "FR"), (-1.22, 0.82, "RL"), (1.22, 0.82, "RR")]:
        make_rounded_slab_xy(
            f"HP_Rubber_Foot_{suffix}",
            width=0.32,
            depth=0.07,
            thickness=0.014,
            corner_radius=0.03,
            chamfer=0.002,
            mat_main=mats["rubber"],
            col=col_laptop,
            parent=root,
            loc=(fx, fy, 0.007),
        )

    # 3. Side Precision-Milled USB-C / Thunderbolt Ports & Vents (for Act 3 Macro Shot!)
    port_specs = [
        ("HP_Port_Thunderbolt_1", -W * 0.5 - 0.001,  0.62, 0.012, 0.095, 0.032),
        ("HP_Port_Thunderbolt_2", -W * 0.5 - 0.001,  0.38, 0.012, 0.095, 0.032),
        ("HP_Port_Audio_Jack",    -W * 0.5 - 0.001, -0.45, 0.012, 0.042, 0.042),
        ("HP_Port_USB_C_Right",    W * 0.5 + 0.001,  0.55, 0.012, 0.095, 0.032),
    ]
    for pname, px, py, pw, pd, ph in port_specs:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(px, py, base_z))
        pobj = bpy.context.active_object
        pobj.name = pname
        pobj.scale = (pw, pd, ph)
        bpy.ops.object.transform_apply(scale=True)
        pobj.data.materials.append(mats["alu_silver"])
        link_only(pobj, col_laptop)
        pobj.parent = root

    # 4. Keyboard LED Backlight Under-Glow Plane & 78 Chiclet Keys
    top_deck_z = 0.012 + base_h
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, 0.12, top_deck_z + 0.001))
    bl_plane = bpy.context.active_object
    bl_plane.name = "HP_Keyboard_Backlight"
    bl_plane.scale = (2.68, 1.06, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    bl_plane.data.materials.append(mats["key_backlight"])
    link_only(bl_plane, col_laptop)
    bl_plane.parent = root

    build_keyboard_grid_mesh("HP_Keyboard_Keys", col_laptop, root, mats["keycap"], top_deck_z + 0.002)

    # 5. Precision Glass Haptic Trackpad + Silver Chamfer Border
    make_rounded_slab_xy(
        "HP_Trackpad_Border",
        width=1.18,
        depth=0.68,
        thickness=0.003,
        corner_radius=0.045,
        chamfer=0.0,
        mat_main=mats["alu_silver"],
        col=col_laptop,
        parent=root,
        loc=(0.0, -0.62, top_deck_z + 0.001),
    )
    make_rounded_slab_xy(
        "HP_Glass_Trackpad",
        width=1.16,
        depth=0.66,
        thickness=0.004,
        corner_radius=0.042,
        chamfer=0.0,
        mat_main=mats["trackpad"],
        col=col_laptop,
        parent=root,
        loc=(0.0, -0.62, top_deck_z + 0.002),
    )

    # 6. Dual Precision Geared Hinges at Rear Axis (Y = +1.02, Z = 0.100)
    hinge_y = D * 0.5 - 0.06
    hinge_z = top_deck_z
    for hx, hname in [(-0.92, "HP_Hinge_Left"), (0.92, "HP_Hinge_Right")]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=48,
            radius=0.028,
            depth=0.34,
            location=(hx, hinge_y, hinge_z),
            rotation=(0.0, math.radians(90), 0.0),
        )
        hobj = bpy.context.active_object
        hobj.name = hname
        for p in hobj.data.polygons:
            p.use_smooth = True
        hobj.data.materials.append(mats["alu_silver"])
        link_only(hobj, col_laptop)
        hobj.parent = root

    # 7. Display Lid Pivot Empty at the EXACT Physical Hinge Axis (0, hinge_y, hinge_z)
    #    Rotation X = 0 deg -> Lid is closed flat over the base!
    #    Rotation X = +112 deg (or -112 deg depending on lid center) -> Lid opens upward!
    #    Since the lid extends from Y = hinge_y toward Y = -D/2 (negative Y),
    #    rotating around +X by NEGATIVE angle (-112 deg) lifts the front edge (Y < hinge_y) UP (+Z)!
    lid_pivot = bpy.data.objects.new("HP_Lid_Pivot", None)
    lid_pivot.empty_display_type = "ARROWS"
    lid_pivot.empty_display_size = 0.35
    lid_pivot.location = (0.0, hinge_y, hinge_z)
    col_laptop.objects.link(lid_pivot)
    lid_pivot.parent = root

    # Center of lid relative to hinge_pivot: offset in Y by (-D*0.5 + 0.06) = -1.02, and Z by +lid_h*0.5
    lid_rel_y = -hinge_y
    lid_rel_z = lid_h * 0.5 + 0.004

    make_rounded_slab_xy(
        "HP_Lid_Shell",
        width=W,
        depth=D,
        thickness=lid_h,
        corner_radius=R,
        chamfer=0.009,
        mat_main=mats["alu_dark"],
        mat_chamfer=mats["alu_silver"],
        col=col_laptop,
        parent=lid_pivot,
        loc=(0.0, lid_rel_y, lid_rel_z),
    )

    # 8. Iconic 4-Stroke Slanted HP Minimalist Logo on Top Outer Lid Surface
    build_hp_minimal_slash_logo(
        "HP_Logo_Crest",
        col=col_laptop,
        parent=lid_pivot,
        mat_logo=mats["hp_logo"],
        z_pos=lid_rel_z + lid_h * 0.5 + 0.0005,
        scale=1.25,
    )
    bpy.data.objects["HP_Logo_Crest"].location.y = lid_rel_y

    # 9. Inner Display Glass Bezel & 4K OLED Display Panel (on the bottom face of the closed lid,
    #    which becomes the front-facing screen when HP_Lid_Pivot rotates X to -110 deg!)
    make_rounded_slab_xy(
        "HP_Display_Bezel",
        width=W - 0.04,
        depth=D - 0.04,
        thickness=0.004,
        corner_radius=R - 0.02,
        chamfer=0.0,
        mat_main=mats["bezel"],
        col=col_laptop,
        parent=lid_pivot,
        loc=(0.0, lid_rel_y, lid_rel_z - lid_h * 0.5 - 0.001),
    )

    make_rounded_slab_xy(
        "HP_OLED_Screen",
        width=W - 0.16,
        depth=D - 0.20,
        thickness=0.003,
        corner_radius=R - 0.05,
        chamfer=0.0,
        mat_main=mats["screen"],
        col=col_laptop,
        parent=lid_pivot,
        loc=(0.0, lid_rel_y + 0.02, lid_rel_z - lid_h * 0.5 - 0.003),
    )

    return root, lid_pivot


# ==============================================================================
# SECTION 4: STUDIO ENVIRONMENT, ACT 5 PERFORMANCE WORLDS & END CARD TYPOGRAPHY
# ==============================================================================
def build_environments_and_endcard(scene, mats, col_studio, col_env, col_brand):
    # 1. Dark Seamless Studio Floor + Black Glass Hero Platform
    bpy.ops.mesh.primitive_plane_add(size=80.0, location=(0.0, 0.0, -0.14))
    floor = bpy.context.active_object
    floor.name = "Studio_Seamless_Floor"
    floor.data.materials.append(mats["floor"])
    link_only(floor, col_studio)

    make_rounded_slab_xy(
        "Black_Glass_Platform",
        width=5.4,
        depth=3.8,
        thickness=0.14,
        corner_radius=0.35,
        chamfer=0.018,
        mat_main=mats["platform"],
        mat_chamfer=mats["alu_silver"],
        col=col_studio,
        loc=(0.0, 0.0, -0.07),
    )

    # 2. Act 5C: Sleek Low-Profile Floor Lightning Energy Strips (Replaces bulky air tubes)
    threads = []
    thread_configs = [
        ("Lightning_Streak_01", mats["thread_blue"],   [(-3.4, -1.55, 0.01), (-1.2, -1.45, 0.02), ( 1.2, -1.45, 0.02), ( 3.4, -1.55, 0.01)]),
        ("Lightning_Streak_02", mats["thread_violet"], [( 3.4,  1.55, 0.01), ( 1.2,  1.45, 0.02), (-1.2,  1.45, 0.02), (-3.4,  1.55, 0.01)]),
        ("Lightning_Streak_03", mats["thread_gold"],   [(-2.2, -2.20, -0.05),( 0.0, -1.95, 0.01), ( 2.2, -2.20, -0.05),( 3.2, -1.80, -0.05)]),
        ("Lightning_Streak_04", mats["thread_blue"],   [(-3.2,  1.90, 0.35), (-1.4,  1.55, 0.55), ( 1.4,  1.55, 0.55), ( 3.2,  1.90, 0.35)]),
    ]
    for tname, tmat, pts in thread_configs:
        crv = bpy.data.curves.new(tname, type="CURVE")
        crv.dimensions = "3D"
        crv.bevel_depth = 0.004
        crv.bevel_resolution = 4
        spl = crv.splines.new("BEZIER")
        spl.bezier_points.add(len(pts) - 1)
        for i, co in enumerate(pts):
            bp = spl.bezier_points[i]
            bp.co = co
            bp.handle_left_type = "AUTO"
            bp.handle_right_type = "AUTO"
        tobj = bpy.data.objects.new(tname, crv)
        tobj.data.materials.append(tmat)
        link_only(tobj, col_env)
        threads.append(tobj)

    # 3. Subtle Atmospheric Dust / Dawn Bokeh Particles
    random.seed(108)
    particles = []
    for i in range(22):
        angle = (i / 22.0) * math.pi * 2.0
        dist = 2.4 + (i % 4) * 0.65
        px = math.cos(angle) * dist
        py = math.sin(angle) * dist * 0.75 + 0.5
        pz = 0.25 + (i % 5) * 0.38
        rad = 0.004 + (i % 3) * 0.002
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=rad, location=(px, py, pz))
        pobj = bpy.context.active_object
        pobj.name = f"Atmosphere_Particle_{i+1:02d}"
        for poly in pobj.data.polygons:
            poly.use_smooth = True
        pobj.data.materials.append(mats["thread_blue"] if i % 3 != 0 else mats["thread_gold"])
        link_only(pobj, col_env)
        particles.append(pobj)

    # 4. Act 6 Hero End Card Typography ("HP" / "Made for what moves you." / "Innovation that keeps up.")
    def make_text(name, body, size, extrude, bevel, mat, loc, tracking=0.06):
        c = bpy.data.curves.new(f"{name}_Curve", type="FONT")
        c.body = body
        c.size = size
        c.extrude = extrude
        c.bevel_depth = bevel
        c.bevel_resolution = 4
        c.align_x = "CENTER"
        c.align_y = "CENTER"
        c.space_character = 1.0 + tracking
        o = bpy.data.objects.new(name, c)
        o.location = loc
        o.rotation_euler = (math.radians(90), 0.0, 0.0)
        o.data.materials.append(mat)
        link_only(o, col_brand)
        return o

    txt_hp = make_text(
        "EndCard_HP_Brand",
        body="HP",
        size=0.46,
        extrude=0.026,
        bevel=0.005,
        mat=mats["text_hp"],
        loc=(0.0, 0.65, 2.76),
        tracking=0.12,
    )
    txt_tagline1 = make_text(
        "EndCard_Tagline_Main",
        body="Made for what moves you.",
        size=0.24,
        extrude=0.014,
        bevel=0.003,
        mat=mats["text_hp"],
        loc=(0.0, 0.65, 2.38),
        tracking=0.06,
    )
    txt_tagline2 = make_text(
        "EndCard_Tagline_Sub",
        body="Innovation that keeps up.",
        size=0.17,
        extrude=0.010,
        bevel=0.002,
        mat=mats["text_sub"],
        loc=(0.0, 0.65, 2.12),
        tracking=0.09,
    )

    return threads, particles, (txt_hp, txt_tagline1, txt_tagline2)


# ==============================================================================
# SECTION 5: CINEMA LIGHTING RIG & WORLD SHADER
# ==============================================================================
def build_lighting_rig(scene, col_lights):
    # Dark Charcoal Studio World with restrained zenith specular reflection
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    wnodes = world.node_tree.nodes
    wlinks = world.node_tree.links
    wnodes.clear()
    w_out = wnodes.new("ShaderNodeOutputWorld")
    w_bg = wnodes.new("ShaderNodeBackground")
    w_bg.inputs["Color"].default_value = (0.007, 0.009, 0.015, 1.0)
    w_bg.inputs["Strength"].default_value = 0.85
    wlinks.new(w_bg.outputs["Background"], w_out.inputs["Surface"])

    def make_area(name, energy, color, sx, sy, loc, rot_deg):
        ld = bpy.data.lights.new(name, type="AREA")
        ld.energy = energy
        ld.color = color
        ld.shape = "RECTANGLE"
        ld.size = sx
        ld.size_y = sy
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        link_only(lo, col_lights)
        return lo

    lights = {
        # Thin cool-white silhouette rim light (Act 1 hero light)
        "rim_cool": make_area(
            "Light_Rim_CoolWhite",
            energy=450.0,
            color=(0.82, 0.91, 1.0),
            sx=5.2,
            sy=0.45,
            loc=(0.0, 2.8, 1.65),
            rot_deg=(-58, 0, 0),
        ),
        # Main large overhead softbox key light
        "key_softbox": make_area(
            "Light_Key_Softbox",
            energy=520.0,
            color=(0.96, 0.97, 1.0),
            sx=4.8,
            sy=3.2,
            loc=(-3.2, -3.6, 3.8),
            rot_deg=(48, 0, -38),
        ),
        # Moving specular sweep bar for HP logo & chamfer glints
        "specular_sweep": make_area(
            "Light_Specular_Sweep",
            energy=380.0,
            color=(0.90, 0.95, 1.0),
            sx=0.35,
            sy=3.6,
            loc=(-2.5, -1.2, 2.2),
            rot_deg=(35, 0, -25),
        ),
        # Act 5A Creative Studio Cobalt Blue + Violet Fill
        "env_blue": make_area(
            "Light_Env_StudioBlue",
            energy=0.0,
            color=(0.08, 0.45, 1.0),
            sx=4.5,
            sy=3.0,
            loc=(3.8, -2.5, 2.2),
            rot_deg=(60, 0, 48),
        ),
        # Act 5B Architectural Dawn Warm Gold Sunlight
        "env_dawn": make_area(
            "Light_Env_DawnGold",
            energy=0.0,
            color=(1.0, 0.72, 0.40),
            sx=4.0,
            sy=3.2,
            loc=(-4.2, 1.2, 2.4),
            rot_deg=(62, 0, -105),
        ),
    }
    return lights


# ==============================================================================
# SECTION 6: MULTI-CAMERA CINEMATOGRAPHY & TIMELINE MARKER SWITCHING (8 CAMERAS)
# ==============================================================================
def build_cinema_cameras_and_markers(scene, col_cams):
    """
    Create dedicated cinema cameras with 35mm, 50mm, 85mm, and 100mm macro lenses,
    Depth of Field, and Timeline Markers bound to each camera for automatic cuts.
    """
    cams = {}

    def make_cam(name, lens_mm, fstop, start_loc, end_loc, start_tgt, end_tgt, f_start, f_end, marker_label):
        tgt = bpy.data.objects.new(f"{name}_Target", None)
        tgt.empty_display_type = "SPHERE"
        tgt.empty_display_size = 0.15
        link_only(tgt, col_cams)

        cd = bpy.data.cameras.new(name)
        cd.lens = lens_mm
        cd.sensor_width = 36.0
        cd.dof.use_dof = True
        cd.dof.focus_object = tgt
        cd.dof.aperture_fstop = fstop

        co = bpy.data.objects.new(name, cd)
        link_only(co, col_cams)

        trk = co.constraints.new(type="TRACK_TO")
        trk.target = tgt
        trk.track_axis = "TRACK_NEGATIVE_Z"
        trk.up_axis = "UP_Y"

        co.location = start_loc
        co.keyframe_insert("location", frame=f_start)
        co.location = end_loc
        co.keyframe_insert("location", frame=f_end)

        tgt.location = start_tgt
        tgt.keyframe_insert("location", frame=f_start)
        tgt.location = end_tgt
        tgt.keyframe_insert("location", frame=f_end)

        # Bind camera to timeline marker so Blender switches cameras automatically!
        m = scene.timeline_markers.new(name=marker_label, frame=f_start)
        m.camera = co
        cams[name] = (co, tgt)
        return co

    # Shot 1 (0:00-0:04, Frames 1-96): OPENING — FROM DARKNESS (50mm)
    make_cam(
        "Cam_01_Opening_50mm",
        lens_mm=50.0,
        fstop=2.8,
        start_loc=(-2.4, -4.6, 0.85),
        end_loc=(-1.2, -4.3, 0.95),
        start_tgt=(0.0, 0.0, 0.08),
        end_tgt=(0.0, 0.0, 0.10),
        f_start=1,
        f_end=96,
        marker_label="01_OPENING_DARKNESS",
    )

    # Shot 2 (0:04-0:09, Frames 96-216): THE REVEAL (35mm graceful low-angle orbit)
    make_cam(
        "Cam_02_Reveal_35mm",
        lens_mm=38.0,
        fstop=4.0,
        start_loc=(2.8, -4.2, 0.55),
        end_loc=(-2.2, -4.5, 1.15),
        start_tgt=(0.0, 0.0, 0.08),
        end_tgt=(0.0, 0.0, 0.12),
        f_start=96,
        f_end=216,
        marker_label="02_THE_REVEAL",
    )

    # Shot 3A (0:09-0:10.75, Frames 216-258): MACRO HP LOGO (100mm Macro)
    make_cam(
        "Cam_03A_Macro_Logo_100mm",
        lens_mm=100.0,
        fstop=2.4,
        start_loc=(-0.55, -1.65, 1.15),
        end_loc=(0.55, -1.65, 1.18),
        start_tgt=(0.0, 0.0, 0.14),
        end_tgt=(0.0, 0.0, 0.14),
        f_start=216,
        f_end=258,
        marker_label="03A_MACRO_HP_LOGO",
    )

    # Shot 3B (0:10.75-0:12.5, Frames 258-300): MACRO MILLED EDGE & PORTS (100mm Macro)
    make_cam(
        "Cam_03B_Macro_Ports_100mm",
        lens_mm=100.0,
        fstop=2.8,
        start_loc=(-3.45, -1.25, 0.32),
        end_loc=(-3.35, 0.95, 0.28),
        start_tgt=(-1.56, -0.35, 0.06),
        end_tgt=(-1.56, 0.65, 0.06),
        f_start=258,
        f_end=300,
        marker_label="03B_MACRO_EDGE_PORTS",
    )

    # Shot 3C (0:12.5-0:14.25, Frames 300-342): MACRO BACKLIT KEYS (85mm Macro)
    make_cam(
        "Cam_03C_Macro_Keys_85mm",
        lens_mm=85.0,
        fstop=2.8,
        start_loc=(-1.85, -2.35, 0.78),
        end_loc=(1.45, -2.35, 0.88),
        start_tgt=(-0.35, 0.10, 0.12),
        end_tgt=(0.35, 0.10, 0.14),
        f_start=300,
        f_end=342,
        marker_label="03C_MACRO_KEYS_BACKLIGHT",
    )

    # Shot 3D (0:14.25-0:16.0, Frames 342-384): MACRO HINGE MECHANICS (100mm Macro)
    make_cam(
        "Cam_03D_Macro_Hinge_100mm",
        lens_mm=100.0,
        fstop=2.8,
        start_loc=(-2.35, -0.85, 0.65),
        end_loc=(-2.05, -1.45, 0.95),
        start_tgt=(-0.85, 0.85, 0.18),
        end_tgt=(-0.65, 0.75, 0.35),
        f_start=342,
        f_end=384,
        marker_label="03D_MACRO_HINGE_MOTION",
    )

    # Shot 4 (0:16-0:23, Frames 384-552): SCREEN COMES ALIVE (50mm low front -> heroic 3/4)
    make_cam(
        "Cam_04_ScreenAlive_50mm",
        lens_mm=50.0,
        fstop=4.0,
        start_loc=(0.0, -5.2, 0.42),
        end_loc=(-2.35, -5.4, 1.35),
        start_tgt=(0.0, 0.15, 0.65),
        end_tgt=(0.0, 0.15, 0.85),
        f_start=384,
        f_end=552,
        marker_label="04_SCREEN_COMES_ALIVE",
    )

    # Shot 5 (0:23-0:32, Frames 552-768): PERFORMANCE & POSSIBILITY (50mm 3-World Orbit)
    make_cam(
        "Cam_05_Performance_50mm",
        lens_mm=50.0,
        fstop=4.0,
        start_loc=(-2.35, -5.4, 1.35),
        end_loc=(2.45, -5.5, 1.42),
        start_tgt=(0.0, 0.15, 0.85),
        end_tgt=(0.0, 0.15, 0.88),
        f_start=552,
        f_end=768,
        marker_label="05_PERFORMANCE_WORLDS",
    )
    scene.timeline_markers.new(name="05B_DAWN_WORKSPACE", frame=624)
    scene.timeline_markers.new(name="05C_LUMINOUS_DATA_THREADS", frame=696)

    # Shot 6 (0:32-0:36, Frames 768-864): HERO END CARD (40mm Hero Settle + Brand Lockup)
    cam6 = make_cam(
        "Cam_06_HeroEndCard_85mm",
        lens_mm=38.0,
        fstop=5.6,
        start_loc=(1.65, -6.2, 1.35),
        end_loc=(0.0, -6.5, 1.42),
        start_tgt=(0.0, 0.10, 1.22),
        end_tgt=(0.0, 0.10, 1.38),
        f_start=768,
        f_end=864,
        marker_label="06_HERO_END_CARD",
    )

    # Set default active camera to Cam_06 or Cam_04 for immediate inspection
    scene.camera = cam6
    return cams


# ==============================================================================
# SECTION 7: CHOREOGRAPH PRODUCT, HINGE, LIGHTS, SCREEN & TYPOGRAPHY (1..864)
# ==============================================================================
def animate_entire_commercial(scene, laptop_root, lid_pivot, mats, lights, threads, particles, brand_texts):
    txt_hp, txt_tag1, txt_tag2 = brand_texts

    def key_val(id_block, data_path, frame, val):
        setattr(id_block, data_path, val)
        id_block.keyframe_insert(data_path=data_path, frame=frame)

    def key_loc_rot_scale(obj, frame, loc=None, rot_deg=None, scale=None):
        if loc is not None:
            obj.location = loc
            obj.keyframe_insert("location", frame=frame)
        if rot_deg is not None:
            obj.rotation_euler = tuple(math.radians(a) for a in rot_deg)
            obj.keyframe_insert("rotation_euler", frame=frame)
        if scale is not None:
            obj.scale = scale
            obj.keyframe_insert("scale", frame=frame)

    # 1. Laptop Root Emergence & Hero Poise
    key_loc_rot_scale(laptop_root, 1,   loc=(0.0, 0.0, -0.18), rot_deg=(0, 0, -8))
    key_loc_rot_scale(laptop_root, 96,  loc=(0.0, 0.0, -0.12), rot_deg=(0, 0, -5))
    key_loc_rot_scale(laptop_root, 185, loc=(0.0, 0.0,  0.00), rot_deg=(0, 0,  0))
    key_loc_rot_scale(laptop_root, 552, loc=(0.0, 0.0,  0.00), rot_deg=(0, 0,  0))
    key_loc_rot_scale(laptop_root, 768, loc=(0.0, 0.0,  0.00), rot_deg=(0, 0, 12))
    key_loc_rot_scale(laptop_root, 835, loc=(0.0, 0.0,  0.00), rot_deg=(0, 0, -14))
    key_loc_rot_scale(laptop_root, 864, loc=(0.0, 0.0,  0.00), rot_deg=(0, 0, -12))

    # 2. Lid Hinge Opening Choreography (Physically Accurate Rotation around Hinge Axis!)
    #    - Closed (0 deg) during Opening, Reveal, Macro Logo & Macro Ports (Frames 1..295)
    #    - Cracks open during Macro Keys & Hinge Shots (Frames 295..384: 0 deg -> 68 deg)
    #    - Opens in fluid slow motion during Act 4 Screen Comes Alive (Frames 384..495: 68 deg -> 110 deg)
    hinge_keys = [
        (1,     0.0),
        (295,   0.0),
        (340, -32.0),
        (384, -68.0),
        (485, -110.0),
        (864, -110.0),
    ]
    for f, angle_deg in hinge_keys:
        key_loc_rot_scale(lid_pivot, f, rot_deg=(angle_deg, 0.0, 0.0))

    # 3. Keyboard LED Backlight Breathing On (Act 3C, Frames 298..350)
    kb_bsdf = next(n for n in mats["key_backlight"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    kb_em = kb_bsdf.inputs.get("Emission Strength")
    if kb_em:
        for f, val in [(1, 0.0), (298, 0.0), (332, 1.45), (384, 1.05), (864, 0.95)]:
            kb_em.default_value = val
            kb_em.keyframe_insert("default_value", frame=f)

    # 4. 4K OLED Screen Power-On & Flowing Generative Ribbon Animation (Act 4..6)
    scr_nodes = mats["screen"].node_tree.nodes
    scr_bsdf = next(n for n in scr_nodes if n.type == "BSDF_PRINCIPLED")
    scr_wave = scr_nodes.get("OLED_Wave")
    scr_em = scr_bsdf.inputs.get("Emission Strength")
    if scr_em:
        for f, val in [(1, 0.0), (378, 0.0), (435, 1.95), (768, 1.95), (845, 1.85), (864, 1.75)]:
            scr_em.default_value = val
            scr_em.keyframe_insert("default_value", frame=f)
    if scr_wave:
        ph = scr_wave.inputs.get("Phase Offset")
        if ph:
            ph.default_value = 0.0
            ph.keyframe_insert("default_value", frame=380)
            ph.default_value = 14.0
            ph.keyframe_insert("default_value", frame=864)

    # 5. Studio & Environment Lighting Choreography (Acts 1..6)
    # Rim light wakes from darkness in Act 1
    for f, e in [(1, 25.0), (48, 380.0), (96, 520.0), (845, 520.0), (864, 220.0)]:
        lights["rim_cool"].data.energy = e
        lights["rim_cool"].data.keyframe_insert("energy", frame=f)

    # Softbox key wakes in Act 2 Reveal
    for f, e in [(1, 10.0), (88, 45.0), (145, 540.0), (845, 560.0), (864, 260.0)]:
        lights["key_softbox"].data.energy = e
        lights["key_softbox"].data.keyframe_insert("energy", frame=f)

    # Specular Sweep bar glides across the HP logo in Act 2, Act 3A, and Final Logo Glint (835..864)
    sweep = lights["specular_sweep"]
    sweep_keys = [
        (1,   (-2.8, -1.2, 2.1), (35, 0, -25)),
        (96,  ( 2.8, -1.2, 2.1), (35, 0,  25)),
        (216, (-1.8, -1.2, 1.8), (30, 0, -18)),
        (258, ( 1.8, -1.2, 1.8), (30, 0,  18)),
        (768, (-2.6, -1.6, 2.2), (35, 0, -22)),
        (864, ( 2.6, -1.6, 2.2), (35, 0,  22)),
    ]
    for f, loc, rot in sweep_keys:
        key_loc_rot_scale(sweep, f, loc=loc, rot_deg=rot)

    # Act 5 Environment Transitions:
    # 5A (552..624): Creative Studio Blue
    for f, e in [(1, 0.0), (545, 0.0), (575, 680.0), (620, 680.0), (650, 80.0), (768, 180.0), (864, 150.0)]:
        lights["env_blue"].data.energy = e
        lights["env_blue"].data.keyframe_insert("energy", frame=f)

    # 5B (624..696): Architectural Dawn Warm Gold
    for f, e in [(1, 0.0), (618, 0.0), (650, 720.0), (692, 720.0), (725, 140.0), (790, 260.0), (864, 200.0)]:
        lights["env_dawn"].data.energy = e
        lights["env_dawn"].data.keyframe_insert("energy", frame=f)

    # 5C (696..768): Luminous Data Threads (Animated via bevel_factor_start / bevel_factor_end!)
    for idx, tobj in enumerate(threads):
        crv = tobj.data
        offset = idx * 8
        for f, bs, be in [
            (1, 0.0, 0.0),
            (685 + offset, 0.0, 0.0),
            (725 + offset, 0.0, 1.0),
            (758 + offset, 0.25, 1.0),
            (782 + offset, 1.0, 1.0),
            (864, 1.0, 1.0),
        ]:
            crv.bevel_factor_start = bs
            crv.keyframe_insert("bevel_factor_start", frame=f)
            crv.bevel_factor_end = be
            crv.keyframe_insert("bevel_factor_end", frame=f)

    # 6. Atmospheric Particles Subtle Drift (Frames 1..864)
    for idx, pobj in enumerate(particles):
        p0 = pobj.location.copy()
        dz = 0.65 if idx % 2 == 0 else 0.85
        dx = 0.25 if idx % 3 == 0 else -0.25
        key_loc_rot_scale(pobj, 1,   loc=(p0.x, p0.y, p0.z - 0.20))
        key_loc_rot_scale(pobj, 432, loc=(p0.x + dx, p0.y, p0.z + dz * 0.5))
        key_loc_rot_scale(pobj, 864, loc=(p0.x, p0.y, p0.z + dz))

    # 7. Act 6 Hero End Card Brand Typography ("HP" / "Made for what moves you." / "Innovation that keeps up.")
    for tobj, f_in, z_target in [
        (txt_hp,   776, 2.76),
        (txt_tag1, 788, 2.38),
        (txt_tag2, 800, 2.12),
    ]:
        y_pos = tobj.location.y
        key_loc_rot_scale(tobj, 1,        loc=(0.0, y_pos, z_target + 0.22), scale=(0.001, 0.001, 0.001))
        key_loc_rot_scale(tobj, f_in,     loc=(0.0, y_pos, z_target + 0.22), scale=(0.001, 0.001, 0.001))
        key_loc_rot_scale(tobj, f_in + 18,loc=(0.0, y_pos, z_target),        scale=(1.0,   1.0,   1.0))
        key_loc_rot_scale(tobj, 864,      loc=(0.0, y_pos, z_target),        scale=(1.0,   1.0,   1.0))

    # Apply smooth Bezier auto-clamped easing across all animated objects (Blender 5.2 slotted-action safe)
    def smooth_fcurves(id_block):
        ad = getattr(id_block, "animation_data", None)
        if not ad or not ad.action:
            return
        fcurves = []
        if hasattr(ad, "action_slot") and ad.action_slot:
            try:
                from bpy_extras import anim_utils
                cb = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
                if cb:
                    fcurves = list(cb.fcurves)
            except Exception:
                pass
        elif hasattr(ad.action, "fcurves"):
            fcurves = list(ad.action.fcurves)
        for fc in fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.easing = "AUTO"
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"

    for obj in bpy.data.objects:
        smooth_fcurves(obj)
    for lgt in bpy.data.lights:
        smooth_fcurves(lgt)
    for crv in bpy.data.curves:
        smooth_fcurves(crv)


# ==============================================================================
# SECTION 8: TASTEFUL CINEMATIC COMPOSITING (BLOOM/GLARE, VIGNETTE, SUBTLE GRAIN)
# ==============================================================================
def setup_compositing(scene):
    try:
        scene.use_nodes = True
        tree = scene.node_tree
        if tree is None:
            return
        nodes = tree.nodes
        links = tree.links
        nodes.clear()

        rl = nodes.new("CompositorNodeRLayers")
        comp = nodes.new("CompositorNodeComposite")

        # Gentle Fog Glow Glare for controlled display/specular bloom
        try:
            glare = nodes.new("CompositorNodeGlare")
            if hasattr(glare, "glare_type"):
                glare.glare_type = "FOG_GLOW"
            if hasattr(glare, "quality"):
                glare.quality = "HIGH"
            if hasattr(glare, "threshold"):
                glare.threshold = 1.25
            if hasattr(glare, "mix"):
                glare.mix = -0.65
            links.new(rl.outputs["Image"], glare.inputs["Image"])
            links.new(glare.outputs["Image"], comp.inputs["Image"])
        except Exception:
            links.new(rl.outputs["Image"], comp.inputs["Image"])
    except Exception:
        pass


# ==============================================================================
# SECTION 9: SYNCHRONIZED 36-SECOND STEREO SOUNDTRACK GENERATOR & VSE ATTACHMENT
# ==============================================================================
def generate_and_attach_soundtrack(scene, wav_path):
    """
    Synthesize a 36-second 22.05kHz stereo WAV soundtrack matching all 6 acts:
    - 0:00-0:04: Deep sub-bass swell + airy electrical shimmer
    - 0:04-0:09: Refined metallic rise & harmonic whoosh
    - 0:09-0:16: Precision macro pulses + soft mechanical hinge click at 15.2s
    - 0:16-0:23: Warm confident Dmaj9/Asus4 musical lift as OLED powers on
    - 0:23-0:32: Sophisticated modern electronic orchestral pulse
    - 0:32-0:36: Resolved warm piano/synth fifth + high HP logo chime + clean silence
    """
    sr = 22050
    duration = 36.0
    n_samples = int(sr * duration)
    buf = bytearray(n_samples * 4)  # 16-bit stereo

    two_pi = 2.0 * math.pi
    for i in range(n_samples):
        t = i / float(sr)
        val_l = 0.0
        val_r = 0.0

        # Act 1 (0-4s): Sub-bass swell (55Hz) + airy high harmonic
        if t < 9.0:
            env = math.sin(min(t / 4.0, 1.0) * math.pi * 0.5) * (1.0 - max(0.0, (t - 7.5) / 1.5))
            sub = math.sin(two_pi * 55.0 * t) * 0.35
            shimmer = math.sin(two_pi * 440.0 * t + math.sin(two_pi * 0.5 * t)) * 0.06
            val_l += (sub + shimmer) * env
            val_r += (sub + shimmer * 0.9) * env

        # Act 2 (4-9s): Rising metallic tonal Fifth (110Hz + 165Hz + 330Hz)
        if 3.8 <= t < 9.5:
            u = (t - 3.8) / 5.7
            env = math.sin(u * math.pi)
            tone = (math.sin(two_pi * 110.0 * t) * 0.25 + math.sin(two_pi * 165.0 * t) * 0.18 + math.sin(two_pi * 330.0 * t) * 0.08)
            val_l += tone * env
            val_r += tone * env

        # Act 3 (9-16s): Macro precision pulse + tactile mechanical hinge click at t=15.2s
        if 9.0 <= t < 16.0:
            beat = (t - 9.0) * 2.0
            pulse_env = math.exp(-((beat % 1.0) * 4.5)) * 0.22
            pulse = math.sin(two_pi * 82.4 * t) * pulse_env
            val_l += pulse
            val_r += pulse
            if 15.15 <= t <= 15.22:
                click_env = math.exp(-(t - 15.15) * 140.0)
                click = math.sin(two_pi * 1800.0 * t) * click_env * 0.35
                val_l += click
                val_r += click

        # Act 4 (16-23s): Screen Comes Alive — Warm Dadd9 chord lift (146.8, 220, 293.7, 370, 440 Hz)
        if 15.8 <= t < 23.5:
            u = (t - 15.8) / 7.7
            env = math.sin(min(u * 2.5, 1.0) * math.pi * 0.5) * (1.0 - max(0.0, (u - 0.8) / 0.2))
            c_l = (math.sin(two_pi * 146.83 * t) * 0.20 + math.sin(two_pi * 220.0 * t) * 0.16 + math.sin(two_pi * 369.99 * t) * 0.12)
            c_r = (math.sin(two_pi * 146.83 * t) * 0.20 + math.sin(two_pi * 293.66 * t) * 0.16 + math.sin(two_pi * 440.0 * t) * 0.12)
            val_l += c_l * env
            val_r += c_r * env

        # Act 5 (23-32s): Performance & Possibility — Electronic orchestral pulse + arpeggio
        if 23.0 <= t < 32.2:
            u = (t - 23.0) / 9.2
            env = math.sin(min(u * 4.0, 1.0) * math.pi * 0.5) * (1.0 - max(0.0, (u - 0.88) / 0.12))
            step = int((t - 23.0) * 4.0) % 4
            arp_freqs = [293.66, 369.99, 440.0, 587.33]
            af = arp_freqs[step]
            arp_env = math.exp(-(((t - 23.0) * 4.0) % 1.0) * 3.2)
            bass = math.sin(two_pi * 73.42 * t) * 0.24
            arp = math.sin(two_pi * af * t) * arp_env * 0.16
            val_l += (bass + arp) * env
            val_r += (bass + arp * 0.85) * env

        # Act 6 (32-36s): Hero End Card — Resolved warm chord + Logo Chime at 33.8s + fade to silence
        if t >= 32.0:
            u = (t - 32.0) / 4.0
            env = math.exp(-u * 1.4) * min((t - 32.0) * 4.0, 1.0)
            pad = (math.sin(two_pi * 146.83 * t) * 0.22 + math.sin(two_pi * 220.0 * t) * 0.16 + math.sin(two_pi * 293.66 * t) * 0.14)
            val_l += pad * env
            val_r += pad * env
            if t >= 33.6:
                chime_env = math.exp(-(t - 33.6) * 2.8)
                chime = (math.sin(two_pi * 880.0 * t) * 0.16 + math.sin(two_pi * 1174.66 * t) * 0.12) * chime_env
                val_l += chime
                val_r += chime

        sl = max(-32767, min(32767, int(val_l * 28000)))
        sr_val = max(-32767, min(32767, int(val_r * 28000)))
        struct.pack_into("<hh", buf, i * 4, sl, sr_val)

    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(buf)

    # Attach to Blender Video Sequence Editor
    try:
        if not scene.sequence_editor:
            scene.sequence_editor_create()
        strips = getattr(scene.sequence_editor, "strips", None) or getattr(scene.sequence_editor, "sequences", None)
        if strips is not None:
            strips.new_sound(name="HP_Commercial_Soundtrack", filepath=wav_path, channel=1, frame_start=1)
    except Exception as e:
        print("VSE sound attach warning:", e)


# ==============================================================================
# SECTION 10: ARENA LIVE CLOUD BRIDGE (KEEPS BLENDER CONNECTED LIVE)
# ==============================================================================
class ArenaBlenderBridge:
    def __init__(self, bridge_url=BRIDGE_URL):
        self.bridge_url = bridge_url.rstrip("/")
        self.running = False
        self.connected = False
        self.session_id = str(uuid.uuid4())[:8]
        self.cmd_queue = queue.Queue()
        self.resp_queue = queue.Queue()
        self.thread = None
        self.meta = self._collect_meta()

    def _collect_meta(self):
        try:
            sc = getattr(bpy.context, "scene", None) or (bpy.data.scenes[0] if bpy.data.scenes else None)
            if sc is None:
                return {"blender_version": bpy.app.version_string, "scene_name": "Scene", "object_count": 0}
            return {
                "blender_version": bpy.app.version_string,
                "scene_name": sc.name,
                "object_count": len(sc.objects),
                "objects": [
                    {"name": o.name, "type": o.type, "location": [round(float(o.location.x), 2), round(float(o.location.y), 2), round(float(o.location.z), 2)]}
                    for o in list(sc.objects)[:35]
                ],
                "materials_count": len(bpy.data.materials),
                "frame_current": sc.frame_current,
                "frame_start": sc.frame_start,
                "frame_end": sc.frame_end,
                "fps": sc.render.fps,
            }
        except Exception:
            return {"blender_version": bpy.app.version_string, "scene_name": "Scene", "object_count": 0}

    def start(self):
        self.running = True
        self.meta = self._collect_meta()
        if not bpy.app.timers.is_registered(self._drain_main_thread):
            bpy.app.timers.register(self._drain_main_thread, first_interval=0.05, persistent=True)
        self.thread = threading.Thread(target=self._poll_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        try:
            if bpy.app.timers.is_registered(self._drain_main_thread):
                bpy.app.timers.unregister(self._drain_main_thread)
        except Exception:
            pass

    def _http_post(self, path, payload, timeout=18.0):
        req = urllib.request.Request(
            f"{self.bridge_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "BlenderMCP-HP/1.8"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _discover_live_bridge_url(self):
        try:
            req = urllib.request.Request(
                GITHUB_BRIDGE_DISCOVERY_API,
                headers={"Accept": "application/vnd.github.v3+json", "User-Agent": "BlenderMCP-HP/1.9"},
            )
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                info = json.loads(resp.read().decode("utf-8"))
                raw = base64.b64decode(info.get("content", "")).decode("utf-8")
                j = json.loads(raw)
                new_url = (j.get("bridge_url") or "").strip().rstrip("/")
                if new_url and new_url.startswith("https://"):
                    self.bridge_url = new_url
                    return new_url
        except Exception:
            pass
        return None

    def _poll_loop(self):
        self._discover_live_bridge_url()
        while self.running:
            while True:
                try:
                    cmd_id, response_obj, meta_obj = self.resp_queue.get_nowait()
                except queue.Empty:
                    break
                for _ in range(3):
                    try:
                        self._http_post("/api/bridge/respond", {"session_id": self.session_id, "command_id": cmd_id, "response": response_obj, "meta": meta_obj}, timeout=25.0)
                        break
                    except Exception:
                        time.sleep(0.5)
            try:
                data = self._http_post("/api/bridge/poll", {"session_id": self.session_id, "meta": self.meta}, timeout=16.0)
                if isinstance(data, dict) and data.get("status") in ("noop", "command"):
                    self.connected = True
                    if data.get("status") == "command" and data.get("command"):
                        self.cmd_queue.put((data.get("command_id"), data.get("command")))
                else:
                    self.connected = False
                    self._discover_live_bridge_url()
                    time.sleep(1.5)
            except Exception:
                self.connected = False
                self._discover_live_bridge_url()
                time.sleep(1.5)

    def _drain_main_thread(self):
        if not self.running:
            return None
        while True:
            try:
                cmd_id, command = self.cmd_queue.get_nowait()
            except queue.Empty:
                break
            try:
                resp = self.execute_command(command)
            except Exception as e:
                traceback.print_exc()
                resp = {"status": "error", "message": str(e)}
            self.meta = self._collect_meta()
            self.resp_queue.put((cmd_id, resp, self.meta))
        self.meta = self._collect_meta()
        return 0.04

    def execute_command(self, command):
        cmd_type = command.get("type")
        params = command.get("params") or {}
        if cmd_type == "ping":
            return {"status": "success", "result": {"pong": True}}
        if cmd_type == "get_scene_info":
            return {"status": "success", "result": self._collect_meta()}
        if cmd_type == "execute_code":
            namespace = {"bpy": bpy, "mathutils": mathutils}
            buf = io.StringIO()
            with redirect_stdout(buf):
                exec(params.get("code", ""), namespace)
            for area in getattr(bpy.context.screen, "areas", []):
                area.tag_redraw()
            return {"status": "success", "result": {"executed": True, "result": buf.getvalue()}}
        if cmd_type == "get_viewport_screenshot":
            return {"status": "success", "result": self._get_viewport_screenshot(params.get("max_size", 800), params.get("filepath"), params.get("format", "png"))}
        return {"status": "error", "message": f"Unknown command type: {cmd_type}"}

    def _get_viewport_screenshot(self, max_size=800, filepath=None, fmt="png"):
        fd, local_path = tempfile.mkstemp(prefix="arena_hp_vp_", suffix=f".{fmt.lower()}")
        os.close(fd)
        try:
            area = region = space = None
            for a in bpy.context.screen.areas:
                if a.type == "VIEW_3D":
                    area, space = a, a.spaces.active
                    region = next((r for r in a.regions if r.type == "WINDOW"), None)
                    break
            if not area or not region or not space:
                return {"error": "No 3D viewport found"}
            import gpu, numpy as np
            r3d = space.region_3d
            src_w, src_h = region.width, region.height
            s = min(1.0, max_size / max(src_w, src_h))
            width, height = max(1, int(src_w * s)), max(1, int(src_h * s))
            offscreen = gpu.types.GPUOffScreen(width, height)
            try:
                offscreen.draw_view3d(bpy.context.scene, bpy.context.view_layer, space, region, r3d.view_matrix, r3d.window_matrix, do_color_management=True)
                buf = offscreen.texture_color.read()
            finally:
                offscreen.free()
            buf.dimensions = width * height * 4
            pixels = np.asarray(buf, dtype=np.float32) / 255.0
            image = bpy.data.images.new("mcp_viewport", width, height, alpha=True)
            image.pixels.foreach_set(pixels.ravel())
            image.filepath_raw = local_path
            image.file_format = fmt.upper()
            image.save()
            bpy.data.images.remove(image)
            with open(local_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            return {"success": True, "width": width, "height": height, "filepath": filepath or local_path, "image_base64": b64, "scene": bpy.context.scene.name}
        except Exception as e:
            return {"error": str(e)}
        finally:
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception:
                    pass


# ==============================================================================
# MAIN BUILDER ENTRY POINT
# ==============================================================================
def build_complete_hp_commercial(start_bridge=True):
    scene = setup_cinema_scene()

    col_studio = ensure_collection(scene, "01_Studio_Environment")
    col_laptop = ensure_collection(scene, "02_HP_Laptop_Hero")
    col_brand  = ensure_collection(scene, "03_Brand_End_Card")
    col_lights = ensure_collection(scene, "04_Cinema_Lighting")
    col_cams   = ensure_collection(scene, "05_Cinema_Cameras")
    col_env    = ensure_collection(scene, "06_Performance_Worlds_FX")

    mats = build_all_materials()
    laptop_root, lid_pivot = build_hp_flagship_laptop(col_laptop, mats)
    threads, particles, brand_texts = build_environments_and_endcard(scene, mats, col_studio, col_env, col_brand)
    lights = build_lighting_rig(scene, col_lights)
    build_cinema_cameras_and_markers(scene, col_cams)
    animate_entire_commercial(scene, laptop_root, lid_pivot, mats, lights, threads, particles, brand_texts)
    setup_compositing(scene)

    # Configure Desktop Output & Save Audio + .blend Project
    home = os.path.expanduser("~")
    desktop = os.path.join(home, "Desktop")
    out_dir = desktop if os.path.isdir(desktop) else tempfile.gettempdir()

    wav_path = os.path.join(out_dir, "HP_Laptop_Commercial_Soundtrack.wav")
    generate_and_attach_soundtrack(scene, wav_path)

    img_settings = scene.render.image_settings
    if hasattr(img_settings, "media_type"):
        try:
            img_settings.media_type = "VIDEO"
        except Exception:
            pass
    try:
        img_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "HIGH"
        scene.render.ffmpeg.audio_codec = "AAC"
    except Exception:
        pass

    scene.render.filepath = os.path.join(out_dir, "HP_Laptop_Commercial_")
    blend_path = os.path.join(out_dir, "HP_Laptop_Commercial.blend")

    # Set Viewport to Camera View + Material/Rendered Preview at Hero Frame 825
    scene.frame_set(825)
    for win in bpy.context.window_manager.windows:
        if "Layout" in bpy.data.workspaces:
            try:
                win.workspace = bpy.data.workspaces["Layout"]
            except Exception:
                pass
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type == "VIEW_3D":
                    space = area.spaces.active
                    if space:
                        space.region_3d.view_perspective = "CAMERA"
                        space.shading.type = "MATERIAL"
                        space.overlay.show_overlays = False
                elif area.type == "PROPERTIES":
                    for space in area.spaces:
                        if space.type == "PROPERTIES":
                            space.context = "OUTPUT"
                area.tag_redraw()

    try:
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    except Exception:
        pass

    # Start / Reconnect Live Bridge if not already running via addon
    addon_srv = getattr(bpy.types, "blendermcp_server", None)
    if start_bridge and not getattr(addon_srv, "cloud_running", False):
        old_bridge = getattr(bpy.types, "arena_blender_bridge", None)
        if old_bridge:
            try:
                old_bridge.stop()
            except Exception:
                pass
        bridge = ArenaBlenderBridge(BRIDGE_URL)
        bpy.types.arena_blender_bridge = bridge
        bridge.start()

    print(f"HP Flagship Commercial Built! Saved to {blend_path} | Audio: {wav_path}")


if __name__ == "__main__":
    build_complete_hp_commercial(start_bridge=True)
