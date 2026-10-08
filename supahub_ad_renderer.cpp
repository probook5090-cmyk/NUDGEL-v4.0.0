// ============================================================================
// supahub_ad_renderer.cpp
// Apple-Level 3D Perspective UI & Kinetic Motion-Graphics Renderer
// 19 Dynamic 3-Second Shots (57.0s @ 24fps) with 3D Whip/Zoom Transitions,
// Real-Time Glass Specular Light Sweeps, Multi-Plane Z-Parallax & Anamorphic Flares
// ============================================================================

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <omp.h>

static constexpr float PI = 3.14159265358979323846f;

struct Vec3 {
    float x, y, z;
    Vec3(float _x=0, float _y=0, float _z=0) : x(_x), y(_y), z(_z) {}
    Vec3 operator+(const Vec3& b) const { return Vec3(x+b.x, y+b.y, z+b.z); }
    Vec3 operator-(const Vec3& b) const { return Vec3(x-b.x, y-b.y, z-b.z); }
    Vec3 operator*(float s) const { return Vec3(x*s, y*s, z*s); }
};
inline float dot(const Vec3& a, const Vec3& b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
inline Vec3 normalize(const Vec3& v) {
    float len = std::sqrt(dot(v, v));
    return (len > 1e-7f) ? v * (1.0f / len) : Vec3(0,0,1);
}

inline float clampf(float x, float a, float b) { return x < a ? a : (x > b ? b : x); }
inline float smoothstep(float e0, float e1, float x) {
    float t = clampf((x - e0) / (e1 - e0), 0.0f, 1.0f);
    return t * t * (3.0f - 2.0f * t);
}
inline float ease_in_cubic(float t) {
    t = clampf(t, 0.0f, 1.0f);
    return t * t * t;
}
inline float ease_out_cubic(float t) {
    t = clampf(t, 0.0f, 1.0f);
    float u = 1.0f - t;
    return 1.0f - u * u * u;
}
inline float ease_in_out_cubic(float t) {
    t = clampf(t, 0.0f, 1.0f);
    return t < 0.5f ? 4.0f * t * t * t : 1.0f - std::pow(-2.0f * t + 2.0f, 3.0f) * 0.5f;
}
// Under-damped spring response from 0 -> 1 for kinetic typography & UI pop-ins
inline float spring_pop(float t, float t0, float dur=0.48f, float freq=9.2f, float damping=4.8f) {
    if (t <= t0) return 0.0f;
    float dt = (t - t0) / dur;
    if (dt >= 3.0f) return 1.0f;
    return 1.0f - std::exp(-damping * dt) * std::cos(freq * dt);
}

struct RGBA {
    float r, g, b, a;
    RGBA(float _r=0, float _g=0, float _b=0, float _a=1) : r(_r), g(_g), b(_b), a(_a) {}
};

inline RGBA hex_rgb(uint32_t hex, float a=1.0f) {
    return RGBA(
        ((hex >> 16) & 0xFF) / 255.0f,
        ((hex >> 8)  & 0xFF) / 255.0f,
        ( hex        & 0xFF) / 255.0f,
        a
    );
}

inline void blend_over(float& dst_r, float& dst_g, float& dst_b, const RGBA& src) {
    float a = clampf(src.a, 0.0f, 1.0f);
    if (a <= 1e-4f) return;
    dst_r = src.r * a + dst_r * (1.0f - a);
    dst_g = src.g * a + dst_g * (1.0f - a);
    dst_b = src.b * a + dst_b * (1.0f - a);
}

inline void blend_add(float& dst_r, float& dst_g, float& dst_b, const RGBA& src) {
    float a = clampf(src.a, 0.0f, 1.0f);
    if (a <= 1e-4f) return;
    dst_r = clampf(dst_r + src.r * a, 0.0f, 1.0f);
    dst_g = clampf(dst_g + src.g * a, 0.0f, 1.0f);
    dst_b = clampf(dst_b + src.b * a, 0.0f, 1.0f);
}

struct Sprite {
    int w = 0, h = 0;
    std::vector<uint8_t> rgba;

    RGBA sample(float u, float v) const {
        if (w <= 0 || h <= 0 || u < 0.0f || u > 1.0f || v < 0.0f || v > 1.0f)
            return RGBA(0, 0, 0, 0);
        float fx = u * (w - 1);
        float fy = v * (h - 1);
        int x0 = (int)fx, y0 = (int)fy;
        int x1 = std::min(x0 + 1, w - 1);
        int y1 = std::min(y0 + 1, h - 1);
        float tx = fx - x0, ty = fy - y0;

        auto get_px = [&](int x, int y) {
            const uint8_t* p = &rgba[(y * w + x) * 4];
            return RGBA(p[0]/255.0f, p[1]/255.0f, p[2]/255.0f, p[3]/255.0f);
        };
        RGBA c00 = get_px(x0, y0), c10 = get_px(x1, y0);
        RGBA c01 = get_px(x0, y1), c11 = get_px(x1, y1);
        auto lerp_c = [](const RGBA& a, const RGBA& b, float t) {
            return RGBA(
                a.r + (b.r - a.r)*t,
                a.g + (b.g - a.g)*t,
                a.b + (b.b - a.b)*t,
                a.a + (b.a - a.a)*t
            );
        };
        RGBA top = lerp_c(c00, c10, tx);
        RGBA bot = lerp_c(c01, c11, tx);
        return lerp_c(top, bot, ty);
    }
};

static std::unordered_map<std::string, Sprite> g_sprites;

static void load_all_sprites() {
    const char* names[] = {
        "av_brunette_wink", "av_blonde_wink", "av_adidas_cap", "av_pink_glasses",
        "av_curly_boy", "av_glasses_thumb", "supahub_icon_3d",
        "pill_discord", "pill_slack_warm", "pill_slack_teal", "pill_gmail_pink",
        "ui_portal_main", "ui_card_feature_requests", "ui_card_roadmap_public",
        "ui_card_merge_posts", "ui_card_vote_behalf", "ui_card_priority_table",
        "ui_card_value_effort", "ui_theme_light", "ui_theme_dark",
        "ui_privacy_shield", "ui_custom_statuses", "ui_changelog_main",
        "ui_related_posts", "ui_three_modules", "ui_kanban_board",
        "ui_kanban_movable_card",
        "txt_feature", "txt_requests", "txt_give_users", "txt_share_ideas",
        "txt_collect_feedback", "txt_merge_duplicates", "txt_prioritize",
        "txt_public_roadmap", "txt_personalize_1", "txt_personalize_2",
        "txt_announce_updates", "txt_close_loop", "logo_supahub_finale",
        // New Apple-level extra widgets & kinetic headers
        "txt_custom_statuses", "txt_value_effort", "txt_drag_drop",
        "txt_all_in_one", "txt_upvote_live", "txt_vote_behalf_hdr",
        "widget_new_post", "widget_upvote_burst", "widget_rice_score",
        "widget_changelog_toast", "widget_cta_pill"
    };
    for (const char* name : names) {
        std::string meta_path = std::string("/tmp/supahub_assets/") + name + ".meta";
        std::string raw_path  = std::string("/tmp/supahub_assets/") + name + ".raw";
        FILE* fm = std::fopen(meta_path.c_str(), "r");
        if (!fm) {
            std::fprintf(stderr, "Missing meta: %s\n", meta_path.c_str());
            std::exit(1);
        }
        Sprite sp;
        if (std::fscanf(fm, "%d %d", &sp.w, &sp.h) != 2) {
            std::fclose(fm);
            std::exit(1);
        }
        std::fclose(fm);
        sp.rgba.resize((size_t)sp.w * sp.h * 4);
        FILE* fr = std::fopen(raw_path.c_str(), "rb");
        if (!fr) {
            std::fprintf(stderr, "Missing raw: %s\n", raw_path.c_str());
            std::exit(1);
        }
        size_t rd = std::fread(sp.rgba.data(), 1, sp.rgba.size(), fr);
        std::fclose(fr);
        if (rd != sp.rgba.size()) {
            std::fprintf(stderr, "Short read on %s\n", raw_path.c_str());
            std::exit(1);
        }
        g_sprites[name] = std::move(sp);
    }
}

struct FrameBuffer {
    int W, H;
    std::vector<float> rgb; // 3 floats per pixel [0..1]
    FrameBuffer(int w, int h) : W(w), H(h), rgb((size_t)w * h * 3, 0.0f) {}
};

// ============================================================================
// Apple Dark-Field & Pearl Studio Background + 3D Perspective Grid & Bokeh
// ============================================================================
static void fill_background(FrameBuffer& fb, float dark_mix, float t) {
    int W = fb.W, H = fb.H;
    float gx1 = 0.50f + 0.22f * std::sin(t * 0.95f);
    float gy1 = 0.40f + 0.14f * std::cos(t * 0.75f);
    float gx2 = 0.72f - 0.20f * std::cos(t * 0.85f);
    float gy2 = 0.66f + 0.12f * std::sin(t * 1.05f);

    std::vector<float> ex1(W), ex2(W), ey1(H), ey2(H);
    for (int x = 0; x < W; ++x) {
        float nx = (float)x / (float)W;
        float dx1 = (nx - gx1) * 1.55f;
        float dx2 = (nx - gx2) * 1.45f;
        ex1[x] = std::exp(-dx1 * dx1 * 2.6f);
        ex2[x] = std::exp(-dx2 * dx2 * 3.2f);
    }
    for (int y = 0; y < H; ++y) {
        float ny = (float)y / (float)H;
        float dy1 = ny - gy1;
        float dy2 = ny - gy2;
        ey1[y] = std::exp(-dy1 * dy1 * 2.6f);
        ey2[y] = std::exp(-dy2 * dy2 * 3.2f);
    }

    // Precompute subtle architectural grid X lines (shifted by camera drift t)
    float drift_x = t * 0.045f;
    std::vector<float> grid_x(W);
    for (int x = 0; x < W; ++x) {
        float nx = (float)x / (float)W + drift_x;
        float gx = std::fabs(std::fmod(nx * 16.0f, 1.0f) - 0.5f);
        grid_x[x] = smoothstep(0.018f, 0.0f, gx);
    }

    float inv_dark = 1.0f - dark_mix;
    #pragma omp parallel for schedule(static)
    for (int y = 0; y < H; ++y) {
        float ny = (float)y / (float)H;
        float y_g1 = ey1[y], y_g2 = ey2[y];
        float gy_mod = std::fabs(std::fmod((ny + t * 0.02f) * 9.0f, 1.0f) - 0.5f);
        float gy_line = smoothstep(0.020f, 0.0f, gy_mod);
        // Vignette for grid so it fades softly toward edges
        float vig = std::sin(ny * PI);

        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = 0; x < W; ++x) {
            float g1 = ex1[x] * y_g1;
            float g2 = ex2[x] * y_g2;
            float gr = std::max(grid_x[x], gy_line) * vig * 0.045f;

            // Deep Apple Obsidian-Violet Dark Field + Volumetric Dual Nebulae
            float dr = 0.052f + 0.135f * g1 + 0.110f * g2 + gr * 0.65f;
            float dg = 0.024f + 0.036f * g1 + 0.028f * g2 + gr * 0.35f;
            float db = 0.115f + 0.235f * g1 + 0.175f * g2 + gr * 1.00f;

            // Crisp Apple Pearl-Lavender Studio Light Mode
            float lr = 0.985f - 0.032f * g1 - 0.014f * ny - gr * 0.35f;
            float lg = 0.964f - 0.050f * g1 - 0.026f * g2 - gr * 0.45f;
            float lb = 0.996f - 0.005f * g1 - gr * 0.15f;

            row[x*3 + 0] = dr * dark_mix + lr * inv_dark;
            row[x*3 + 1] = dg * dark_mix + lg * inv_dark;
            row[x*3 + 2] = db * dark_mix + lb * inv_dark;
        }
    }
}

// Floating 3D Parallax Bokeh Orbs for Continuous Depth Motion
static void draw_ambient_bokeh(FrameBuffer& fb, float t, float dark_mix) {
    int W = fb.W, H = fb.H;
    struct Orb { float bx, by, rad, spd_x, spd_y, col_r, col_g, col_b; };
    static const Orb orbs[6] = {
        {0.15f, 0.22f, 0.065f,  0.035f, -0.022f, 0.72f, 0.42f, 1.00f},
        {0.84f, 0.28f, 0.080f, -0.030f,  0.025f, 0.93f, 0.25f, 0.70f},
        {0.22f, 0.78f, 0.072f,  0.028f,  0.030f, 0.05f, 0.74f, 0.65f},
        {0.78f, 0.75f, 0.060f, -0.038f, -0.026f, 0.92f, 0.69f, 0.18f},
        {0.48f, 0.16f, 0.052f,  0.042f,  0.018f, 0.47f, 0.49f, 0.99f},
        {0.54f, 0.86f, 0.068f, -0.032f, -0.020f, 0.82f, 0.35f, 0.98f}
    };
    for (int i = 0; i < 6; ++i) {
        float cx_n = std::fmod(orbs[i].bx + t * orbs[i].spd_x + 10.0f, 1.0f);
        float cy_n = std::fmod(orbs[i].by + t * orbs[i].spd_y + 10.0f, 1.0f);
        float cx = cx_n * W, cy = cy_n * H;
        float r_px = orbs[i].rad * H;
        int x0 = std::max(0, (int)(cx - r_px));
        int x1 = std::min(W - 1, (int)(cx + r_px));
        int y0 = std::max(0, (int)(cy - r_px));
        int y1 = std::min(H - 1, (int)(cy + r_px));
        float inv_r = 1.0f / r_px;
        float base_a = dark_mix > 0.5f ? 0.11f : 0.075f;
        #pragma omp parallel for schedule(static)
        for (int y = y0; y <= y1; ++y) {
            float dy = (y - cy) * inv_r;
            float* row = &fb.rgb[(size_t)y * W * 3];
            for (int x = x0; x <= x1; ++x) {
                float dx = (x - cx) * inv_r;
                float r2 = dx*dx + dy*dy;
                if (r2 >= 1.0f) continue;
                float falloff = (1.0f - r2) * (1.0f - r2);
                // Soft bokeh ring edge + inner glow
                float ring = std::exp(-std::pow((std::sqrt(r2) - 0.72f) * 5.0f, 2.0f)) * 0.5f;
                float a = (falloff * 0.65f + ring) * base_a;
                if (dark_mix > 0.5f) {
                    blend_add(row[x*3+0], row[x*3+1], row[x*3+2],
                              RGBA(orbs[i].col_r, orbs[i].col_g, orbs[i].col_b, a));
                } else {
                    blend_over(row[x*3+0], row[x*3+1], row[x*3+2],
                               RGBA(orbs[i].col_r, orbs[i].col_g, orbs[i].col_b, a));
                }
            }
        }
    }
}

// Apple-Style Anamorphic Horizontal Lens Flare Sweep on Shot Transitions
static void draw_anamorphic_transition(FrameBuffer& fb, float t) {
    // 18 cut points separating our 19 3-second shots
    static const float cuts[18] = {
        2.8f,  5.8f,  8.8f, 11.8f, 14.8f, 17.8f,
       20.8f, 23.8f, 26.8f, 29.8f, 32.8f, 35.8f,
       38.8f, 41.8f, 44.8f, 47.8f, 50.8f, 53.8f
    };
    float best_dt = 999.0f;
    int cut_idx = 0;
    for (int i = 0; i < 18; ++i) {
        float dt = t - cuts[i];
        if (std::fabs(dt) < std::fabs(best_dt)) {
            best_dt = dt;
            cut_idx = i;
        }
    }
    const float half_win = 0.24f;
    if (std::fabs(best_dt) >= half_win) return;

    float u = (best_dt + half_win) / (2.0f * half_win); // 0..1 across cut
    float env = std::sin(u * PI); // peaks at 1.0 right on the cut
    int W = fb.W, H = fb.H;
    float streak_x = ((cut_idx % 2 == 0) ? u : (1.0f - u)) * W;
    float streak_y = (0.42f + 0.16f * std::sin(cut_idx * 1.7f)) * H;
    float rx = 0.55f * W;
    float ry = 0.085f * H;

    int y0 = std::max(0, (int)(streak_y - ry * 2.5f));
    int y1 = std::min(H - 1, (int)(streak_y + ry * 2.5f));

    #pragma omp parallel for schedule(static)
    for (int y = y0; y <= y1; ++y) {
        float dy = (y - streak_y) / ry;
        float ey_core = std::exp(-dy * dy * 6.0f);
        float ey_halo = std::exp(-dy * dy * 0.45f) * 0.35f;
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = 0; x < W; ++x) {
            float dx = (x - streak_x) / rx;
            float ex = std::exp(-dx * dx * 2.2f);
            float intensity = (ey_core + ey_halo) * ex * env * 0.65f;
            if (intensity <= 1e-3f) continue;
            blend_add(row[x*3+0], row[x*3+1], row[x*3+2],
                      RGBA(0.95f, 0.62f + 0.35f * ey_core, 1.0f, intensity));
        }
    }
}

// Precomputed LUT for pow(u, 0.56f) for u in [0, 4.0]
static float g_pow056_lut[4097];
static bool g_lut_init = false;
static void init_luts() {
    if (g_lut_init) return;
    for (int i = 0; i <= 4096; ++i) {
        float u = (float)i / 1024.0f;
        g_pow056_lut[i] = std::pow(u + 1e-6f, 0.56f);
    }
    g_lut_init = true;
}
inline float fast_pow056(float u) {
    int idx = (int)(u * 1024.0f);
    if (idx <= 0) return g_pow056_lut[0];
    if (idx >= 4096) return g_pow056_lut[4096];
    return g_pow056_lut[idx];
}

// ============================================================================
// Analytical 4-Point Sparkle Star (✦) — Solid Glowing or Blurred 3D Outline
// ============================================================================
static void draw_star_4pt(
    FrameBuffer& fb,
    float cx_norm, float cy_norm,
    float rx_norm, float ry_norm,
    float rot_deg,
    const RGBA& core_col,
    const RGBA& glow_col,
    bool outline_only = false,
    float outline_thickness = 0.09f,
    float opacity = 1.0f
) {
    if (opacity <= 1e-3f || rx_norm <= 1e-4f || ry_norm <= 1e-4f) return;
    int W = fb.W, H = fb.H;
    float cx = cx_norm * W;
    float cy = cy_norm * H;
    float rx = rx_norm * H;
    float ry = ry_norm * H;
    float max_r = std::max(rx, ry) * 2.2f;

    int x0 = std::max(0, (int)(cx - max_r));
    int x1 = std::min(W - 1, (int)(cx + max_r));
    int y0 = std::max(0, (int)(cy - max_r));
    int y1 = std::min(H - 1, (int)(cy + max_r));

    float rad = rot_deg * (PI / 180.0f);
    float cs = std::cos(rad), sn = std::sin(rad);

    #pragma omp parallel for schedule(static)
    for (int y = y0; y <= y1; ++y) {
        float dy = y - cy;
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = x0; x <= x1; ++x) {
            float dx = x - cx;
            float ux = ( dx * cs + dy * sn) / rx;
            float uy = (-dx * sn + dy * cs) / ry;
            float ax = std::fabs(ux);
            float ay = std::fabs(uy);
            if (ax > 3.8f || ay > 3.8f) continue;
            float m = fast_pow056(ax) + fast_pow056(ay);
            if (m > 2.2f) continue;

            if (!outline_only) {
                float core = smoothstep(1.02f, 0.82f, m);
                float halo = std::exp(-3.8f * std::max(0.0f, m - 0.80f) * std::max(0.0f, m - 0.80f));
                float a = clampf((core + halo * 0.65f) * opacity, 0.0f, 1.0f);
                float r = core_col.r * core + glow_col.r * (1.0f - core);
                float g = core_col.g * core + glow_col.g * (1.0f - core);
                float b = core_col.b * core + glow_col.b * (1.0f - core);
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(r, g, b, a));
            } else {
                float inner_fill = smoothstep(0.95f, 0.72f, m) * 0.88f;
                float ring_dist = (m - 0.94f) / outline_thickness;
                float ring = std::exp(-ring_dist * ring_dist * 1.8f);
                float a = clampf((inner_fill * core_col.a + ring * glow_col.a) * opacity, 0.0f, 1.0f);
                float r = (core_col.r * inner_fill + glow_col.r * ring) / std::max(1e-4f, inner_fill + ring);
                float g = (core_col.g * inner_fill + glow_col.g * ring) / std::max(1e-4f, inner_fill + ring);
                float b = (core_col.b * inner_fill + glow_col.b * ring) / std::max(1e-4f, inner_fill + ring);
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(r, g, b, a));
            }
        }
    }
}

static void draw_orbital_arc(
    FrameBuffer& fb,
    float cx_n, float cy_n, float rx_n, float ry_n,
    float progress, float opacity
) {
    if (opacity <= 1e-3f) return;
    int W = fb.W, H = fb.H;
    float cx = cx_n * W, cy = cy_n * H;
    float rx = rx_n * W, ry = ry_n * H;
    #pragma omp parallel for schedule(static)
    for (int y = 0; y < H; ++y) {
        float dy = (y - cy) / ry;
        if (dy > 0.25f || dy < -1.25f) continue;
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = 0; x < W; ++x) {
            float dx = (x - cx) / rx;
            float r2 = dx * dx + dy * dy;
            if (r2 < 0.75f || r2 > 1.30f) continue;
            float r = std::sqrt(r2);
            float dist_px = std::fabs(r - 1.0f) * std::min(rx, ry) * (1080.0f / H);
            if (dist_px > 42.0f) continue;
            float ang = std::atan2(dy, dx);
            float norm_ang = (ang + PI) / PI;
            if (norm_ang > progress) continue;
            float head_glow = std::exp(-std::pow((norm_ang - progress) * 10.0f, 2.0f));
            float core = std::exp(-dist_px * dist_px * 0.18f);
            float bloom = std::exp(-dist_px * dist_px * 0.0045f) * 0.45f;
            float a = clampf((core + bloom + head_glow * core * 0.8f) * opacity, 0.0f, 1.0f);
            RGBA col(0.88f + 0.12f*core, 0.66f + 0.30f*core, 1.0f, a);
            blend_over(row[x*3+0], row[x*3+1], row[x*3+2], col);
        }
    }
}

static void draw_rounded_circuit(
    FrameBuffer& fb,
    float cx_n, float cy_n, float hw_n, float hh_n, float rad_n,
    float pulse_t, float opacity
) {
    if (opacity <= 1e-3f) return;
    int W = fb.W, H = fb.H;
    float sc = (float)H / 1080.0f;
    float cx = cx_n * W, cy = cy_n * H;
    float hw = hw_n * H, hh = hh_n * H, rad = rad_n * H;
    #pragma omp parallel for schedule(static)
    for (int y = 0; y < H; ++y) {
        float dy = std::fabs(y - cy) - (hh - rad);
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = 0; x < W; ++x) {
            float dx = std::fabs(x - cx) - (hw - rad);
            float d = (std::hypot(std::max(dx, 0.0f), std::max(dy, 0.0f))
                    + std::min(std::max(dx, dy), 0.0f) - rad) / sc;
            if (std::fabs(d) < 18.0f) {
                float line = std::exp(-d * d * 0.25f);
                float halo = std::exp(-d * d * 0.015f) * 0.38f;
                // Traveling energy pulse around the circuit
                float ang = std::atan2(y - cy, x - cx);
                float travel = 0.5f + 0.5f * std::sin(ang * 2.0f - pulse_t * 5.0f);
                float a = clampf((line + halo * (0.7f + 0.6f * travel)) * opacity, 0.0f, 1.0f);
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2],
                           RGBA(0.88f + 0.10f * travel, 0.52f + 0.25f * travel, 0.98f, a));
            }
            float d_in1 = (std::hypot(std::max(std::fabs(x - cx) - 110.0f*sc, 0.0f),
                                      std::max(std::fabs(y - cy) - 110.0f*sc, 0.0f)) - 95.0f*sc) / sc;
            if (d_in1 < 2.0f) {
                float a = smoothstep(2.0f, -2.0f, d_in1) * 0.45f * opacity;
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.92f, 0.87f, 0.99f, a));
            }
        }
    }
}

// ============================================================================
// 3D Perspective Card Renderer with Apple Specular Glass Sheen & Extruded Bevel
// ============================================================================
struct CardEffect {
    bool highlight_pulse = false;
    float pulse_u = 0.5f, pulse_v = 0.5f, pulse_r = 0.0f, pulse_alpha = 0.0f;
    bool theme_wipe = false;
    const Sprite* wipe_sprite = nullptr;
    float wipe_progress = 0.0f;
    float right_shadow_fade = 0.0f;
    float bottom_shadow_fade = 0.0f;
    float glass_sheen_pos = -1.0f; // >0 enables diagonal Apple glass light sweep
    float glass_sheen_strength = 0.22f;
};

static void draw_card_3d(
    FrameBuffer& fb,
    const Sprite& sp,
    float cx_n, float cy_n, float cz,
    float scale,
    float pitch_deg, float yaw_deg, float roll_deg,
    float opacity = 1.0f,
    bool draw_shadow = true,
    bool draw_3d_rim = true,
    const CardEffect* fx = nullptr
) {
    if (opacity <= 1e-3f || scale <= 1e-3f) return;
    int W = fb.W, H = fb.H;
    float aspect = (float)W / (float)H;
    float cam_dist = 2.4f;

    float hh = scale;
    float hw = scale * ((float)sp.w / (float)sp.h);

    Vec3 C((cx_n - 0.5f) * 2.0f * aspect, (cy_n - 0.5f) * 2.0f, cz);

    float rx = pitch_deg * (PI / 180.0f);
    float ry = yaw_deg   * (PI / 180.0f);
    float rz = roll_deg  * (PI / 180.0f);
    float cx = std::cos(rx), sx = std::sin(rx);
    float cy = std::cos(ry), sy = std::sin(ry);
    float cz_r = std::cos(rz), sz_r = std::sin(rz);

    auto rot_vec = [&](Vec3 v) {
        Vec3 v1(v.x, v.y * cx - v.z * sx, v.y * sx + v.z * cx);
        Vec3 v2(v1.x * cy + v1.z * sy, v1.y, -v1.x * sy + v1.z * cy);
        return Vec3(v2.x * cz_r - v2.y * sz_r, v2.x * sz_r + v2.y * cz_r, v2.z);
    };

    Vec3 U = rot_vec(Vec3(1, 0, 0));
    Vec3 V = rot_vec(Vec3(0, 1, 0));
    Vec3 N = rot_vec(Vec3(0, 0, 1));
    Vec3 O(0, 0, -cam_dist);

    float margin = 1.18f;
    int min_px = W - 1, max_px = 0, min_py = H - 1, max_py = 0;
    for (int sy_i = -1; sy_i <= 1; sy_i += 2) {
        for (int sx_i = -1; sx_i <= 1; sx_i += 2) {
            Vec3 P = C + U * (sx_i * hw * margin) + V * (sy_i * hh * margin);
            float dz = P.z - O.z;
            if (dz <= 0.1f) dz = 0.1f;
            float ndc_x = (P.x / dz) * cam_dist;
            float ndc_y = (P.y / dz) * cam_dist;
            int px = (int)((ndc_x / (2.0f * aspect) + 0.5f) * W);
            int py = (int)((ndc_y / 2.0f + 0.5f) * H);
            min_px = std::min(min_px, px);
            max_px = std::max(max_px, px);
            min_py = std::min(min_py, py);
            max_py = std::max(max_py, py);
        }
    }
    min_px = std::max(0, min_px - 30);
    max_px = std::min(W - 1, max_px + 30);
    min_py = std::max(0, min_py - 30);
    max_py = std::min(H - 1, max_py + 30);
    if (min_px > max_px || min_py > max_py) return;

    Vec3 CO = C - O;
    float num = dot(CO, N);

    // Automatic dynamic specular sweep derived from 3D tilt if not overridden
    float auto_sheen = 0.50f + 0.018f * yaw_deg - 0.014f * pitch_deg;
    float sheen_pos = (fx && fx->glass_sheen_pos >= 0.0f) ? fx->glass_sheen_pos : auto_sheen;
    float sheen_str = (fx) ? fx->glass_sheen_strength : (draw_3d_rim ? 0.18f : 0.0f);

    #pragma omp parallel for schedule(static)
    for (int y = min_py; y <= max_py; ++y) {
        float dir_y = ((float)y / (float)H - 0.5f) * 2.0f;
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = min_px; x <= max_px; ++x) {
            float dir_x = ((float)x / (float)W - 0.5f) * 2.0f * aspect;
            Vec3 dir(dir_x, dir_y, cam_dist);
            float den = dot(dir, N);
            if (std::fabs(den) < 1e-6f) continue;
            float t_hit = num / den;
            if (t_hit <= 0.0f) continue;

            Vec3 P = O + dir * t_hit;
            Vec3 dP = P - C;
            float lx = dot(dP, U) / hw;
            float ly = dot(dP, V) / hh;

            float u = lx * 0.5f + 0.5f;
            float v = ly * 0.5f + 0.5f;
            RGBA tex(0, 0, 0, 0);
            if (u >= 0.0f && u <= 1.0f && v >= 0.0f && v <= 1.0f) {
                tex = sp.sample(u, v);
            }

            bool opaque_interior = (tex.a * opacity >= 0.995f);

            // 1. Soft Alpha-Silhouette 3D Drop Shadow
            if (draw_shadow && !opaque_interior) {
                float u_sh = (lx - 0.024f) * 0.5f + 0.5f;
                float v_sh = (ly - 0.052f) * 0.5f + 0.5f;
                if (u_sh >= -0.04f && u_sh <= 1.04f && v_sh >= -0.04f && v_sh <= 1.04f) {
                    float a_sum = 0.0f;
                    const float offs[5][2] = {{0,0}, {-0.012f,0}, {0.012f,0}, {0,-0.012f}, {0,0.012f}};
                    for (int k = 0; k < 5; ++k) {
                        a_sum += sp.sample(u_sh + offs[k][0], v_sh + offs[k][1]).a;
                    }
                    float sh_a = (a_sum * 0.2f) * 0.34f * opacity;
                    if (sh_a > 1e-3f) {
                        blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.04f, 0.015f, 0.10f, sh_a));
                    }
                }
            }

            // 2. 3D Extruded Anodized Glass Rim
            if (draw_3d_rim && !opaque_interior && (std::fabs(yaw_deg) > 1.5f || std::fabs(pitch_deg) > 1.5f)) {
                float rim_dx = (yaw_deg > 0.0f) ? 0.017f : -0.017f;
                float rim_dy = (pitch_deg > 0.0f) ? 0.015f : -0.015f;
                float r_u = (lx - rim_dx) * 0.5f + 0.5f;
                float r_v = (ly - rim_dy) * 0.5f + 0.5f;
                if (r_u >= 0.0f && r_u <= 1.0f && r_v >= 0.0f && r_v <= 1.0f) {
                    RGBA rim_s = sp.sample(r_u, r_v);
                    if (rim_s.a > 0.2f) {
                        float spec = 0.65f + 0.35f * std::sin((r_u + r_v) * 6.28f);
                        blend_over(row[x*3+0], row[x*3+1], row[x*3+2],
                                   RGBA(0.58f * spec + 0.25f, 0.36f * spec + 0.15f, 0.96f, rim_s.a * opacity * 0.94f));
                    }
                }
            }

            // 3. Main Card Surface + Apple Specular Glass Reflection
            if (tex.a > 1e-4f) {
                if (fx && fx->theme_wipe && fx->wipe_sprite) {
                    float diag = u * 0.75f + v * 0.25f;
                    RGBA tex2 = fx->wipe_sprite->sample(u, v);
                    float w_edge = smoothstep(fx->wipe_progress - 0.02f, fx->wipe_progress + 0.02f, diag);
                    tex.r = tex2.r * (1.0f - w_edge) + tex.r * w_edge;
                    tex.g = tex2.g * (1.0f - w_edge) + tex.g * w_edge;
                    tex.b = tex2.b * (1.0f - w_edge) + tex.b * w_edge;
                    float seam = std::exp(-std::pow((diag - fx->wipe_progress) * 42.0f, 2.0f));
                    if (fx->wipe_progress > 0.02f && fx->wipe_progress < 0.98f) {
                        tex.r = clampf(tex.r + seam * 0.92f, 0.0f, 1.0f);
                        tex.g = clampf(tex.g + seam * 0.40f, 0.0f, 1.0f);
                        tex.b = clampf(tex.b + seam * 1.00f, 0.0f, 1.0f);
                    }
                }

                if (fx && fx->highlight_pulse && fx->pulse_alpha > 1e-3f) {
                    float du = (u - fx->pulse_u) * ((float)sp.w / (float)sp.h);
                    float dv = (v - fx->pulse_v);
                    float d_p = std::hypot(du, dv);
                    float ring = std::exp(-std::pow((d_p - fx->pulse_r) * 28.0f, 2.0f));
                    float fill = smoothstep(fx->pulse_r, 0.0f, d_p) * 0.38f;
                    float pa = (ring + fill) * fx->pulse_alpha;
                    tex.r = tex.r * (1.0f - pa) + 0.72f * pa;
                    tex.g = tex.g * (1.0f - pa) + 0.26f * pa;
                    tex.b = tex.b * (1.0f - pa) + 1.00f * pa;
                }

                // Real-Time Diagonal Apple Glass Specular Light Sweep
                if (sheen_str > 1e-3f) {
                    float diag_uv = u * 0.68f + v * 0.32f;
                    float ds = diag_uv - sheen_pos;
                    float band1 = std::exp(-ds * ds * 38.0f);
                    float band2 = std::exp(-std::pow(ds - 0.07f, 2.0f) * 140.0f) * 0.45f;
                    float s_val = (band1 + band2) * sheen_str;
                    tex.r = clampf(tex.r + s_val * 0.95f, 0.0f, 1.0f);
                    tex.g = clampf(tex.g + s_val * 0.90f, 0.0f, 1.0f);
                    tex.b = clampf(tex.b + s_val * 1.00f, 0.0f, 1.0f);
                }

                if (fx && fx->right_shadow_fade > 1e-3f) {
                    float fade = smoothstep(0.48f, 0.98f, u) * fx->right_shadow_fade;
                    tex.r = tex.r * (1.0f - fade) + 0.055f * fade;
                    tex.g = tex.g * (1.0f - fade) + 0.025f * fade;
                    tex.b = tex.b * (1.0f - fade) + 0.120f * fade;
                }
                if (fx && fx->bottom_shadow_fade > 1e-3f) {
                    float fade = smoothstep(0.58f, 0.98f, v) * fx->bottom_shadow_fade;
                    tex.r = tex.r * (1.0f - fade) + 0.055f * fade;
                    tex.g = tex.g * (1.0f - fade) + 0.025f * fade;
                    tex.b = tex.b * (1.0f - fade) + 0.120f * fade;
                }

                tex.a *= opacity;
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], tex);
            }
        }
    }
}

static void draw_cursor_and_click(
    FrameBuffer& fb,
    float cx_n, float cy_n,
    float click_burst_t,
    float opacity = 1.0f
) {
    if (opacity <= 1e-3f) return;
    int W = fb.W, H = fb.H;
    float sc = (float)H / 1080.0f;
    float cx = cx_n * W, cy = cy_n * H;
    int rad = (int)(84.0f * sc);
    int x0 = std::max(0, (int)cx - rad);
    int x1 = std::min(W - 1, (int)cx + rad);
    int y0 = std::max(0, (int)cy - rad);
    int y1 = std::min(H - 1, (int)cy + rad);

    for (int y = y0; y <= y1; ++y) {
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = x0; x <= x1; ++x) {
            float dx = (x - cx) / sc, dy = (y - cy) / sc;
            if (click_burst_t > 0.0f && click_burst_t < 1.0f) {
                float r = std::hypot(dx, dy);
                // Expanding shockwave ring + radial rays
                float ring_r = 10.0f + click_burst_t * 48.0f;
                float ring_a = std::exp(-std::pow((r - ring_r) * 0.35f, 2.0f)) * (1.0f - click_burst_t) * opacity;
                if (ring_a > 1e-3f) {
                    blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.93f, 0.25f, 0.70f, ring_a));
                }
                float r_in = 14.0f + click_burst_t * 18.0f;
                float r_out = 28.0f + click_burst_t * 26.0f;
                if (r >= r_in && r <= r_out) {
                    float ang = std::atan2(dy, dx);
                    for (int k = 0; k < 4; ++k) {
                        float target_a = -2.35f + k * 0.52f;
                        float da = std::fabs(ang - target_a) * r;
                        if (da < 2.6f) {
                            float ba = (1.0f - click_burst_t) * opacity;
                            blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.58f, 0.24f, 0.95f, ba));
                        }
                    }
                }
            }
            if (dx >= -2.0f && dy >= -2.0f && dy <= 34.0f && dx <= dy * 0.72f + 2.0f) {
                bool in_arrow = (dy <= 24.0f && dx >= 0.0f && dx <= dy * 0.68f)
                             || (dy > 20.0f && dy <= 32.0f && std::fabs(dx - (dy - 12.0f)*0.42f) <= 3.2f);
                bool in_border = (dy <= 26.0f && dx >= -1.8f && dx <= dy * 0.68f + 1.8f);
                if (in_arrow) {
                    blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.08f, 0.06f, 0.14f, opacity));
                } else if (in_border) {
                    blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(1.0f, 1.0f, 1.0f, opacity * 0.92f));
                }
            }
        }
    }
}

static void draw_color_palette_swatches(FrameBuffer& fb, float cy_n, float t_local, float opacity) {
    if (opacity <= 1e-3f) return;
    static const uint32_t hex_cols[10] = {
        0xEBB02E, 0xFFD1EF, 0xED3FB2, 0xD11846, 0xB984FF,
        0xBD8FF0, 0x7C2ED2, 0xBFDBFE, 0x787DFC, 0x0DBCA5
    };
    int W = fb.W, H = fb.H;
    for (int i = 0; i < 10; ++i) {
        float pop = spring_pop(t_local, i * 0.045f, 0.40f, 9.0f, 4.5f);
        if (pop <= 1e-3f) continue;
        float cx_n = 0.14f + i * 0.08f;
        float wave_y = cy_n - 0.015f * std::sin(t_local * 5.0f - i * 0.60f);
        float r_px = 36.0f * pop * (H / 1080.0f);
        float cx = cx_n * W, cy = wave_y * H;
        RGBA c = hex_rgb(hex_cols[i], opacity);

        int x0 = std::max(0, (int)(cx - r_px * 2.0f));
        int x1 = std::min(W - 1, (int)(cx + r_px * 2.0f));
        int y0 = std::max(0, (int)(cy - r_px * 2.0f));
        int y1 = std::min(H - 1, (int)(cy + r_px * 2.0f));

        for (int y = y0; y <= y1; ++y) {
            float* row = &fb.rgb[(size_t)y * W * 3];
            for (int x = x0; x <= x1; ++x) {
                float d = std::hypot(x - cx, y - cy);
                if (d > r_px * 1.9f) continue;
                float disc = smoothstep(r_px + 1.2f, r_px - 1.2f, d);
                float glow = std::exp(-std::pow(std::max(0.0f, d - r_px * 0.8f) / (r_px * 0.45f), 2.0f)) * 0.38f;
                // Specular highlight dot on top-left of each 3D color sphere
                float spec_d = std::hypot(x - (cx - r_px*0.32f), y - (cy - r_px*0.32f));
                float spec = smoothstep(r_px * 0.45f, 0.0f, spec_d) * 0.42f * disc;
                float a = clampf((disc + glow) * opacity, 0.0f, 1.0f);
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2],
                           RGBA(clampf(c.r + spec, 0.0f, 1.0f),
                                clampf(c.g + spec, 0.0f, 1.0f),
                                clampf(c.b + spec, 0.0f, 1.0f), a));
            }
        }
    }
}

// Helper for 3-second shot envelope + whip/zoom exit progression
struct ShotTiming {
    bool active;
    float tl;       // local time from shot start
    float env;      // opacity envelope
    float enter_u;  // 0->1 spring entrance
    float exit_u;   // 0->1 cubic whip/zoom exit in last 0.38s
    float sheen;    // 0->1 sweeping specular glass highlight position
};

static ShotTiming eval_shot(float t, float t0, float t1) {
    ShotTiming s{false, 0, 0, 0, 0, 0};
    const float pad = 0.22f;
    if (t < t0 - pad || t > t1 + pad) return s;
    s.active = true;
    s.tl = std::max(0.0f, t - t0);
    float dur = t1 - t0;
    s.env = smoothstep(t0 - pad, t0 + 0.14f, t) * (1.0f - smoothstep(t1 - 0.16f, t1 + pad, t));
    s.enter_u = spring_pop(t, t0 - 0.08f, 0.46f, 9.2f, 4.8f);
    s.exit_u  = ease_in_cubic((t - (t1 - 0.36f)) / 0.52f);
    s.sheen   = clampf((s.tl / std::max(0.5f, dur)) * 1.15f - 0.05f, 0.0f, 1.1f);
    return s;
}

// ============================================================================
// Master 19-Shot Apple-Level Timeline (Changes Every ~3.0 Seconds!)
// ============================================================================
static void render_frame(FrameBuffer& fb, float t) {
    const RGBA white(1, 1, 1, 1);
    const RGBA purple_glow = hex_rgb(0xB984FF, 1.0f);
    const RGBA pink_glow   = hex_rgb(0xED3FB2, 1.0f);
    const RGBA gold_col    = hex_rgb(0xEBB02E, 1.0f);
    const RGBA teal_col    = hex_rgb(0x0DBCA5, 1.0f);
    const RGBA crimson_col = hex_rgb(0xD11846, 1.0f);
    const RGBA violet_col  = hex_rgb(0x7C2ED2, 1.0f);

    // Dynamic Dark vs Light Studio Transitions across the 19 3-second shots:
    // Light Studio Shots: Shot 02 (2.8..5.8), Shot 07 & 08 (17.8..23.8),
    //                     Shot 12 & 13 (32.8..38.8), Shot 17 (47.8..50.8), Shot 19 (53.8..57.0)
    float dark_mix = 1.0f;
    auto light_window = [&](float a, float b) {
        if (t >= a - 0.25f && t < b + 0.25f) {
            float m = 1.0f - smoothstep(a - 0.22f, a + 0.18f, t) + smoothstep(b - 0.18f, b + 0.22f, t);
            dark_mix = std::min(dark_mix, clampf(m, 0.0f, 1.0f));
        }
    };
    light_window(2.8f, 5.8f);
    light_window(17.8f, 23.8f);
    light_window(32.8f, 38.8f);
    light_window(47.8f, 50.8f);
    if (t >= 53.6f) {
        dark_mix = std::min(dark_mix, 1.0f - smoothstep(53.6f, 54.0f, t));
    }

    fill_background(fb, dark_mix, t);
    draw_ambient_bokeh(fb, t, dark_mix);

    // ========================================================================
    // SHOT 01 (0.0s - 2.8s): Kinetic Hero Ignition — "feature ✦ requests"
    // ========================================================================
    if (auto s = eval_shot(t, 0.0f, 2.8f); s.active) {
        float p_star  = spring_pop(s.tl, 0.04f, 0.42f, 10.0f, 4.5f);
        float p_left  = spring_pop(s.tl, 0.14f, 0.48f,  9.5f, 4.8f);
        float p_right = spring_pop(s.tl, 0.22f, 0.48f,  9.5f, 4.8f);
        float zoom_out = 1.0f + 0.45f * s.exit_u;

        // Floating 3D Supahub icon materializing behind star at t=1.1s
        if (s.tl > 0.9f) {
            float p_ic = spring_pop(s.tl, 0.95f, 0.45f);
            draw_card_3d(fb, g_sprites["supahub_icon_3d"],
                         0.50f, 0.26f - 0.12f * s.exit_u, -0.08f,
                         0.095f * p_ic * zoom_out,
                         12.0f * std::sin(s.tl * 3.0f), 18.0f * std::cos(s.tl * 2.5f), 0.0f,
                         s.env, true, false);
        }

        draw_card_3d(fb, g_sprites["txt_feature"],
                     0.50f - (0.195f * p_left) * zoom_out, 0.52f, 0.0f,
                     0.142f * p_left * zoom_out, 0.0f, 10.0f * s.exit_u, 0.0f, s.env, false, false);
        draw_card_3d(fb, g_sprites["txt_requests"],
                     0.50f + (0.215f * p_right) * zoom_out, 0.52f, 0.0f,
                     0.142f * p_right * zoom_out, 0.0f, -10.0f * s.exit_u, 0.0f, s.env, false, false);

        float star_scale = (0.090f + 0.016f * std::sin(s.tl * 9.0f)) * p_star + 0.38f * s.exit_u;
        draw_star_4pt(fb, 0.50f, 0.52f, star_scale, star_scale,
                      (1.0f - ease_out_cubic(s.tl / 1.1f)) * 90.0f + s.exit_u * 60.0f,
                      white, purple_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 02 (2.8s - 5.8s): Multi-Channel 3D Feedback Orbit (Light Studio)
    // ========================================================================
    if (auto s = eval_shot(t, 2.8f, 5.8f); s.active) {
        draw_rounded_circuit(fb, 0.50f, 0.50f, 0.42f, 0.42f, 0.15f, s.tl, s.env);

        float p_hub = spring_pop(s.tl, 0.04f, 0.45f);
        float pulse = 1.0f + 0.05f * std::sin(s.tl * 7.0f) + 0.30f * s.exit_u;
        draw_card_3d(fb, g_sprites["supahub_icon_3d"],
                     0.50f, 0.50f, 0.0f, 0.132f * p_hub * pulse,
                     8.0f * std::sin(s.tl * 3.0f), 10.0f * std::cos(s.tl * 3.0f), 0.0f,
                     s.env, true, false);

        float p1 = spring_pop(s.tl, 0.12f, 0.45f);
        float p2 = spring_pop(s.tl, 0.22f, 0.45f);
        float p3 = spring_pop(s.tl, 0.32f, 0.45f);
        float p4 = spring_pop(s.tl, 0.42f, 0.45f);
        float bob1 = 0.010f * std::sin(s.tl * 4.2f);
        float bob2 = 0.010f * std::cos(s.tl * 4.5f);
        float wx = -0.30f * s.exit_u;

        draw_card_3d(fb, g_sprites["pill_discord"],
                     0.235f + wx, 0.33f + bob1, 0.0f, 0.078f * p1, 0, 10.0f, 0, s.env, true, false);
        draw_card_3d(fb, g_sprites["av_brunette_wink"],
                     0.240f + wx*1.2f, 0.16f + bob1 * 0.7f, -0.08f, 0.130f * p1,
                     0, 0, -5.0f * std::sin(s.tl * 3.2f), s.env, true, false);

        draw_card_3d(fb, g_sprites["pill_slack_warm"],
                     0.705f - wx, 0.32f - bob2, 0.0f, 0.078f * p2, 0, -10.0f, 0, s.env, true, false);
        draw_card_3d(fb, g_sprites["av_blonde_wink"],
                     0.710f - wx*1.2f, 0.15f - bob2 * 0.7f, -0.08f, 0.150f * p2,
                     0, 0, 5.0f * std::cos(s.tl * 3.2f), s.env, true, false);

        draw_card_3d(fb, g_sprites["pill_slack_teal"],
                     0.350f + wx, 0.85f + bob2, 0.0f, 0.078f * p3, 0, 10.0f, 0, s.env, true, false);
        draw_card_3d(fb, g_sprites["av_adidas_cap"],
                     0.268f + wx*1.2f, 0.65f + bob2 * 0.7f, -0.08f, 0.150f * p3,
                     0, 0, 4.0f * std::sin(s.tl * 3.0f), s.env, true, false);

        draw_card_3d(fb, g_sprites["pill_gmail_pink"],
                     0.735f - wx, 0.73f - bob1, 0.0f, 0.078f * p4, 0, -10.0f, 0, s.env, true, false);
        draw_card_3d(fb, g_sprites["av_pink_glasses"],
                     0.785f - wx*1.2f, 0.55f - bob1 * 0.7f, -0.08f, 0.135f * p4,
                     0, 0, -4.0f * std::cos(s.tl * 3.4f), s.env, true, false);

        draw_star_4pt(fb, 0.308f, 0.21f, 0.028f*p1, 0.028f*p1, s.tl*55.0f, violet_col, violet_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.615f, 0.17f, 0.040f*p2, 0.040f*p2, -s.tl*45.0f, gold_col, gold_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.462f, 0.81f, 0.032f*p3, 0.032f*p3, s.tl*60.0f, teal_col, teal_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.825f, 0.79f, 0.040f*p4, 0.040f*p4, -s.tl*50.0f, crimson_col, crimson_col, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 03 (5.8s - 8.8s): Planetary Horizon Arc — "✦ Give your users a place"
    // ========================================================================
    if (auto s = eval_shot(t, 5.8f, 8.8f); s.active) {
        float arc_prog = clampf(s.tl / 1.25f, 0.0f, 1.0f);
        draw_orbital_arc(fb, 0.54f, 0.74f - 0.10f * s.exit_u, 0.54f, 0.46f, arc_prog, s.env * 0.92f);

        // Floating glass channel pills drifting in 3D depth parallax behind headline
        float p_pl = spring_pop(s.tl, 0.20f, 0.50f);
        draw_card_3d(fb, g_sprites["pill_discord"],
                     0.22f - 0.12f * s.exit_u, 0.25f + 0.01f*std::sin(s.tl*3.5f), 0.12f,
                     0.064f * p_pl, 8.0f, 16.0f, -4.0f, s.env * 0.80f, true, false);
        draw_card_3d(fb, g_sprites["pill_slack_teal"],
                     0.80f + 0.12f * s.exit_u, 0.28f + 0.01f*std::cos(s.tl*3.5f), 0.10f,
                     0.064f * p_pl, 8.0f, -16.0f, 4.0f, s.env * 0.80f, true, false);

        float p_txt = spring_pop(s.tl, 0.10f, 0.48f);
        draw_card_3d(fb, g_sprites["txt_give_users"],
                     0.53f, 0.48f - (1.0f - p_txt)*0.10f - 0.22f * s.exit_u, 0.0f,
                     0.142f * p_txt * (1.0f + 0.18f * s.exit_u), 0.0f, 0.0f, 0.0f, s.env, false, false);

        float p_st = spring_pop(s.tl, 0.04f, 0.45f);
        draw_star_4pt(fb, 0.175f, 0.48f - 0.22f * s.exit_u, 0.066f * p_st, 0.066f * p_st,
                      (1.0f - p_st) * 120.0f + s.tl * 25.0f, white, purple_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 04 (8.8s - 11.8s): Isometric 3D Feedback Portal + Foreground New Idea Modal
    // ========================================================================
    if (auto s = eval_shot(t, 8.8f, 11.8f); s.active) {
        draw_orbital_arc(fb, 0.50f, 0.66f, 0.56f, 0.45f, 1.0f, s.env * 0.90f);

        float p_head = spring_pop(s.tl, 0.06f, 0.46f);
        draw_card_3d(fb, g_sprites["txt_share_ideas"],
                     0.50f - 0.30f * s.exit_u, 0.16f, 0.0f,
                     0.145f * p_head, 0.0f, 0.0f, 0.0f, s.env, false, false);

        float p_scr = spring_pop(s.tl, 0.12f, 0.58f, 8.0f, 4.8f);
        float pitch = -30.0f + 8.0f * ease_in_out_cubic(s.tl / 2.8f) + 14.0f * s.exit_u;
        float yaw   = 14.0f - 8.0f * (s.tl / 2.8f) - 22.0f * s.exit_u;
        float scr_y = 0.72f + (1.0f - p_scr) * 0.28f;

        CardEffect fx;
        fx.highlight_pulse = true;
        fx.bottom_shadow_fade = 0.65f;
        fx.glass_sheen_pos = s.sheen;
        fx.glass_sheen_strength = 0.24f;
        fx.pulse_u = 0.85f; fx.pulse_v = 0.56f;
        float sub_t = std::fmod(s.tl * 1.2f, 1.0f);
        fx.pulse_r = sub_t * 0.16f;
        fx.pulse_alpha = (1.0f - sub_t) * 0.88f;

        draw_card_3d(fb, g_sprites["ui_portal_main"],
                     0.46f - 0.25f * s.exit_u, scr_y, 0.05f,
                     0.60f * p_scr, pitch, yaw, -1.5f, s.env, true, true, &fx);

        // Foreground Floating 3D Glass Composer Widget ("✦ NEW IDEA: Dark mode for public boards")
        if (s.tl > 0.45f) {
            float p_w = spring_pop(s.tl, 0.48f, 0.50f);
            CardEffect fx_w;
            fx_w.glass_sheen_pos = s.sheen * 1.1f;
            fx_w.glass_sheen_strength = 0.28f;
            draw_card_3d(fb, g_sprites["widget_new_post"],
                         0.74f + 0.25f * s.exit_u, 0.66f - 0.02f * std::sin(s.tl * 3.0f), -0.14f,
                         0.23f * p_w, 6.0f, -16.0f, 1.5f, s.env, true, true, &fx_w);
        }

        draw_star_4pt(fb, 0.91f, 0.82f, 0.22f * p_scr, 0.22f * p_scr, -10.0f + s.tl * 8.0f,
                      white, purple_glow, true, 0.10f, s.env * 0.92f);
    }

    // ========================================================================
    // SHOT 05 (11.8s - 14.8s): 3D Macro Close-Up — Live Upvote Shockwave ("Capture every customer vote")
    // ========================================================================
    if (auto s = eval_shot(t, 11.8f, 14.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.05f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_upvote_live"],
                     0.50f, 0.15f - 0.15f * s.exit_u, 0.0f,
                     0.135f * p_txt, 0.0f, 0.0f, 0.0f, s.env, false, false);

        // Hero Macro 3D Feature Requests Card tilted dramatically
        float p_card = spring_pop(s.tl, 0.10f, 0.52f);
        float yaw = -18.0f + 6.0f * (s.tl / 2.8f) + 25.0f * s.exit_u;
        float pitch = 10.0f - 4.0f * (s.tl / 2.8f);
        CardEffect fx_c;
        fx_c.highlight_pulse = true;
        fx_c.glass_sheen_pos = s.sheen;
        fx_c.glass_sheen_strength = 0.25f;
        fx_c.pulse_u = 0.115f; fx_c.pulse_v = 0.285f;
        float up_t = clampf((s.tl - 0.75f) / 0.85f, 0.0f, 1.0f);
        fx_c.pulse_r = up_t * 0.22f;
        fx_c.pulse_alpha = (1.0f - up_t) * 0.95f;

        draw_card_3d(fb, g_sprites["ui_card_feature_requests"],
                     0.38f - 0.25f * s.exit_u, 0.66f, 0.02f,
                     0.52f * p_card, pitch, yaw, -2.5f, s.env, true, true, &fx_c);

        // Pop-out Foreground 3D Upvote Burst Widget ("▲ 787 • +142 votes this week 🔥")
        if (s.tl > 0.65f) {
            float p_ub = spring_pop(s.tl, 0.68f, 0.45f, 10.0f, 4.4f);
            CardEffect fx_ub;
            fx_ub.glass_sheen_pos = s.sheen;
            fx_ub.glass_sheen_strength = 0.26f;
            draw_card_3d(fb, g_sprites["widget_upvote_burst"],
                         0.72f + 0.25f * s.exit_u, 0.54f, -0.15f,
                         0.21f * p_ub, 4.0f, -15.0f, 1.5f, s.env, true, true, &fx_ub);
        }

        // Floating Slack & Gmail pills in foreground parallax
        float p_pl = spring_pop(s.tl, 0.35f, 0.45f);
        draw_card_3d(fb, g_sprites["pill_slack_warm"],
                     0.75f + 0.20f * s.exit_u, 0.80f, -0.10f,
                     0.076f * p_pl, 0.0f, -12.0f, 2.0f, s.env, true, false);

        // Cursor clicking the upvote box at tl = 0.75s
        float cur_u = ease_out_cubic(s.tl / 0.75f);
        float cx_c = 0.16f + 0.11f * cur_u;
        float cy_c = 0.78f - 0.22f * cur_u;
        float burst = (s.tl > 0.72f && s.tl < 1.45f) ? (s.tl - 0.72f) / 0.73f : -1.0f;
        draw_cursor_and_click(fb, cx_c, cy_c, burst, s.env);

        draw_star_4pt(fb, 0.10f, 0.30f, 0.040f*p_card, 0.040f*p_card, s.tl*40.0f, gold_col, gold_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.89f, 0.26f, 0.045f*p_card, 0.045f*p_card, -s.tl*35.0f, pink_glow, purple_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 06 (14.8s - 17.8s): 3D Stage-Manager Fan-Out — "Collect feedback"
    // ========================================================================
    if (auto s = eval_shot(t, 14.8f, 17.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_collect_feedback"],
                     0.50f, 0.19f - 0.16f * s.exit_u, 0.0f,
                     0.155f * p_txt, 0.0f, 0.0f, 0.0f, s.env, false, false);

        float p_left  = spring_pop(s.tl, 0.12f, 0.55f);
        float p_right = spring_pop(s.tl, 0.22f, 0.55f);

        CardEffect fx_l;
        fx_l.bottom_shadow_fade = 0.50f;
        fx_l.glass_sheen_pos = s.sheen;
        fx_l.glass_sheen_strength = 0.22f;
        draw_card_3d(fb, g_sprites["ui_card_feature_requests"],
                     0.30f - 0.28f * s.exit_u, 0.76f, 0.04f,
                     0.49f * p_left, 6.0f, 23.0f + 12.0f * s.exit_u, -4.0f, s.env, true, true, &fx_l);

        CardEffect fx_r;
        fx_r.right_shadow_fade = 0.88f;
        fx_r.bottom_shadow_fade = 0.42f;
        fx_r.glass_sheen_pos = s.sheen;
        fx_r.glass_sheen_strength = 0.22f;
        draw_card_3d(fb, g_sprites["ui_card_roadmap_public"],
                     0.68f + 0.28f * s.exit_u, 0.75f, 0.02f,
                     0.51f * p_right, 5.0f, -19.0f - 12.0f * s.exit_u, 2.5f, s.env, true, true, &fx_r);

        draw_star_4pt(fb, 0.11f, 0.25f, 0.036f*p_left, 0.036f*p_left, s.tl*40.0f, teal_col, teal_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.88f, 0.24f, 0.042f*p_right, 0.042f*p_right, -s.tl*40.0f, gold_col, gold_col, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 07 (17.8s - 20.8s): Pearl-White Studio — "Merge duplicates" 3D Card Fusion
    // ========================================================================
    if (auto s = eval_shot(t, 17.8f, 20.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_merge_duplicates"],
                     0.50f, 0.14f, 0.0f,
                     0.128f * p_txt, 0, 0, 0, s.env, false, false);

        float p_c1 = spring_pop(s.tl, 0.12f, 0.55f);
        CardEffect fx_m;
        fx_m.highlight_pulse = (s.tl > 0.8f);
        fx_m.glass_sheen_pos = s.sheen;
        fx_m.glass_sheen_strength = 0.22f;
        fx_m.pulse_u = 0.885f; fx_m.pulse_v = 0.585f;
        fx_m.pulse_r = clampf((s.tl - 0.8f) * 0.20f, 0.0f, 0.24f);
        fx_m.pulse_alpha = clampf(1.0f - (s.tl - 0.8f)*0.65f, 0.0f, 1.0f);

        // Main Merge Post 3D card in dynamic perspective
        draw_card_3d(fb, g_sprites["ui_card_merge_posts"],
                     0.46f - 0.22f * s.exit_u, 0.59f, 0.0f,
                     0.47f * p_c1,
                     5.0f, 14.0f - 8.0f * (s.tl / 2.8f), -1.0f, s.env, true, true, &fx_m);

        // Secondary duplicate card sliding into the main card to visualize merging!
        float merge_u = ease_in_out_cubic(s.tl / 1.4f);
        float dup_op = s.env * (1.0f - smoothstep(1.0f, 1.5f, s.tl));
        if (dup_op > 1e-3f) {
            draw_card_3d(fb, g_sprites["widget_upvote_burst"],
                         0.82f - 0.24f * merge_u, 0.58f, -0.10f,
                         0.20f * (1.0f - 0.25f * merge_u),
                         4.0f, -18.0f, 3.0f, dup_op, true, true);
        }

        // Cursor clicking "+ Merge" at tl = 0.9s
        float cur_u = ease_out_cubic(s.tl / 0.85f);
        float cx_c = 0.44f + 0.24f * cur_u;
        float cy_c = 0.78f - 0.16f * cur_u;
        float burst = (s.tl > 0.85f && s.tl < 1.55f) ? (s.tl - 0.85f) / 0.7f : -1.0f;
        draw_cursor_and_click(fb, cx_c, cy_c, burst, s.env);

        draw_star_4pt(fb, 0.09f, 0.26f, 0.038f*p_c1, 0.038f*p_c1, s.tl*40.0f, violet_col, purple_glow, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.90f, 0.24f, 0.034f*p_c1, 0.034f*p_c1, -s.tl*45.0f, pink_glow, pink_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 08 (20.8s - 23.8s): 3D Elevated Modal — "Vote on behalf of VIP users"
    // ========================================================================
    if (auto s = eval_shot(t, 20.8f, 23.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_vote_behalf_hdr"],
                     0.50f, 0.14f, 0.0f,
                     0.132f * p_txt, 0, 0, 0, s.env, false, false);

        // Background blurred/angled Merge Posts card for multi-layer depth
        float p_bg = spring_pop(s.tl, 0.08f, 0.50f);
        draw_card_3d(fb, g_sprites["ui_card_merge_posts"],
                     0.26f - 0.20f * s.exit_u, 0.58f, 0.08f,
                     0.38f * p_bg, 5.0f, 18.0f, -2.0f, s.env * 0.85f, true, true);

        // Hero Foreground 3D Card: Add Vote on Behalf
        float p_fg = spring_pop(s.tl, 0.14f, 0.52f);
        CardEffect fx_v;
        fx_v.highlight_pulse = (s.tl > 0.9f);
        fx_v.glass_sheen_pos = s.sheen;
        fx_v.glass_sheen_strength = 0.25f;
        fx_v.pulse_u = 0.605f; fx_v.pulse_v = 0.91f;
        fx_v.pulse_r = clampf((s.tl - 0.9f) * 0.20f, 0.0f, 0.24f);
        fx_v.pulse_alpha = clampf(1.0f - (s.tl - 0.9f)*0.65f, 0.0f, 1.0f);

        draw_card_3d(fb, g_sprites["ui_card_vote_behalf"],
                     0.64f + 0.22f * s.exit_u, 0.60f, -0.08f,
                     0.46f * p_fg, 4.0f, -15.0f + 5.0f * (s.tl / 2.8f), 1.0f, s.env, true, true, &fx_v);

        float cur_u = ease_out_cubic(s.tl / 0.85f);
        float cx_c = 0.52f + 0.15f * cur_u;
        float cy_c = 0.64f + 0.23f * cur_u;
        float burst = (s.tl > 0.88f && s.tl < 1.58f) ? (s.tl - 0.88f) / 0.7f : -1.0f;
        draw_cursor_and_click(fb, cx_c, cy_c, burst, s.env);

        draw_star_4pt(fb, 0.88f, 0.22f, 0.042f*p_fg, 0.042f*p_fg, s.tl*40.0f, gold_col, gold_col, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 09 (23.8s - 26.8s): Dark-Field Custom Statuses & Workflows
    // ========================================================================
    if (auto s = eval_shot(t, 23.8f, 26.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_custom_statuses"],
                     0.50f, 0.15f, 0.0f,
                     0.132f * p_txt, 0, 0, 0, s.env, false, false);

        float p_cs = spring_pop(s.tl, 0.12f, 0.55f);
        CardEffect fx_cs;
        fx_cs.glass_sheen_pos = s.sheen;
        fx_cs.glass_sheen_strength = 0.26f;
        draw_card_3d(fb, g_sprites["ui_custom_statuses"],
                     0.48f - 0.22f * s.exit_u, 0.60f, 0.0f,
                     0.47f * p_cs,
                     6.0f - 3.0f * (s.tl / 2.8f), 14.0f - 10.0f * (s.tl / 2.8f), -1.0f,
                     s.env, true, true, &fx_cs);

        // Floating multi-channel pills & avatar in foreground Z-parallax
        float p_w = spring_pop(s.tl, 0.30f, 0.48f);
        draw_card_3d(fb, g_sprites["pill_slack_teal"],
                     0.78f + 0.20f * s.exit_u, 0.46f, -0.12f,
                     0.076f * p_w, 0, -14.0f, 2.0f, s.env, true, false);
        draw_card_3d(fb, g_sprites["pill_gmail_pink"],
                     0.76f + 0.20f * s.exit_u, 0.68f, -0.14f,
                     0.076f * p_w, 0, -14.0f, -2.0f, s.env, true, false);

        draw_star_4pt(fb, 0.10f, 0.36f, 0.040f*p_cs, 0.040f*p_cs, s.tl*45.0f, teal_col, teal_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.90f, 0.26f, 0.044f*p_cs, 0.044f*p_cs, -s.tl*35.0f, pink_glow, purple_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 10 (26.8s - 29.8s): Prioritize Matrix — Q2 Roadmap 5-Star Table + R.I.C.E. Widget
    // ========================================================================
    if (auto s = eval_shot(t, 26.8f, 29.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_prioritize"],
                     0.50f, 0.15f, 0.0f,
                     0.135f * p_txt, 0, 0, 0, s.env, false, false);

        float p_tbl = spring_pop(s.tl, 0.12f, 0.55f);
        CardEffect fx_t;
        fx_t.glass_sheen_pos = s.sheen;
        fx_t.glass_sheen_strength = 0.25f;
        draw_card_3d(fb, g_sprites["ui_card_priority_table"],
                     0.43f - 0.20f * s.exit_u, 0.61f, 0.04f,
                     0.47f * p_tbl,
                     6.0f, 14.0f - 6.0f * (s.tl / 2.8f), -1.0f, s.env, true, true, &fx_t);

        // Foreground R.I.C.E. Score 750 Pop-out Widget
        if (s.tl > 0.35f) {
            float p_rc = spring_pop(s.tl, 0.38f, 0.48f);
            CardEffect fx_rc;
            fx_rc.glass_sheen_pos = s.sheen;
            fx_rc.glass_sheen_strength = 0.28f;
            draw_card_3d(fb, g_sprites["widget_rice_score"],
                         0.75f + 0.22f * s.exit_u, 0.58f, -0.14f,
                         0.21f * p_rc, 4.0f, -16.0f, 2.0f, s.env, true, true, &fx_rc);
        }

        draw_star_4pt(fb, 0.09f, 0.42f, 0.042f*p_tbl, 0.042f*p_tbl, s.tl*40.0f, gold_col, gold_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.91f, 0.26f, 0.046f*p_tbl, 0.046f*p_tbl, -s.tl*35.0f, white, pink_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 11 (29.8s - 32.8s): Interactive 3D Value vs. Effort Calculator ("Score impact vs. effort")
    // ========================================================================
    if (auto s = eval_shot(t, 29.8f, 32.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_value_effort"],
                     0.50f, 0.15f, 0.0f,
                     0.132f * p_txt, 0, 0, 0, s.env, false, false);

        // Background tilted Priority Table
        float p_bg = spring_pop(s.tl, 0.08f, 0.50f);
        draw_card_3d(fb, g_sprites["ui_card_priority_table"],
                     0.31f - 0.22f * s.exit_u, 0.61f, 0.08f,
                     0.42f * p_bg, 5.0f, 16.0f, -1.5f, s.env * 0.85f, true, true);

        // Foreground Hero 3D Card: Value vs Effort with Score 600 pulse
        float p_mod = spring_pop(s.tl, 0.14f, 0.52f);
        CardEffect fx_ve;
        fx_ve.highlight_pulse = (s.tl > 0.7f);
        fx_ve.glass_sheen_pos = s.sheen;
        fx_ve.glass_sheen_strength = 0.26f;
        fx_ve.pulse_u = 0.46f; fx_ve.pulse_v = 0.90f;
        fx_ve.pulse_r = clampf((s.tl - 0.7f) * 0.20f, 0.0f, 0.24f);
        fx_ve.pulse_alpha = clampf(1.0f - (s.tl - 0.7f)*0.6f, 0.0f, 1.0f);

        draw_card_3d(fb, g_sprites["ui_card_value_effort"],
                     0.67f + 0.22f * s.exit_u, 0.61f, -0.12f,
                     0.43f * p_mod, 4.0f, -15.0f + 5.0f * (s.tl / 2.8f), 1.5f, s.env, true, true, &fx_ve);

        float cur_u = ease_out_cubic(s.tl / 0.8f);
        float cx_c = 0.55f + 0.10f * cur_u;
        float cy_c = 0.55f + 0.28f * cur_u;
        float burst = (s.tl > 0.78f && s.tl < 1.48f) ? (s.tl - 0.78f) / 0.7f : -1.0f;
        draw_cursor_and_click(fb, cx_c, cy_c, burst, s.env);

        draw_star_4pt(fb, 0.08f, 0.34f, 0.042f*p_mod, 0.042f*p_mod, s.tl*45.0f, gold_col, gold_col, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 12 (32.8s - 35.8s): Public Roadmap 3D Kanban Overview + 4 Customer Avatars
    // ========================================================================
    if (auto s = eval_shot(t, 32.8f, 35.8f); s.active) {
        draw_star_4pt(fb, 0.82f, 0.20f, 0.22f, 0.22f, 16.0f + s.tl*6.0f,
                      white, purple_glow, true, 0.085f, s.env * 0.88f);
        draw_star_4pt(fb, 0.27f, 0.16f, 0.028f, 0.028f, -s.tl*30.0f,
                      purple_glow, purple_glow, false, 0.08f, s.env * 0.70f);

        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_public_roadmap"],
                     0.46f, 0.14f, 0.0f,
                     0.130f * p_txt, 0, 0, 0, s.env, false, false);

        float p_kb = spring_pop(s.tl, 0.10f, 0.55f);
        CardEffect fx_kb;
        fx_kb.glass_sheen_pos = s.sheen;
        fx_kb.glass_sheen_strength = 0.18f;
        draw_card_3d(fb, g_sprites["ui_kanban_board"],
                     0.51f, 0.67f, 0.04f,
                     0.52f * p_kb * (1.0f + 0.14f * s.exit_u),
                     4.0f - 8.0f * s.exit_u, 4.0f * std::sin(s.tl * 1.2f), 0.0f, s.env, true, true, &fx_kb);

        draw_card_3d(fb, g_sprites["ui_kanban_movable_card"],
                     0.51f, 0.73f, 0.01f, 0.082f * p_kb, 0, 0, 0, s.env, true, false);

        float pa1 = spring_pop(s.tl, 0.22f, 0.48f);
        float pa2 = spring_pop(s.tl, 0.32f, 0.48f);
        float pa3 = spring_pop(s.tl, 0.42f, 0.48f);
        float pa4 = spring_pop(s.tl, 0.52f, 0.48f);
        float b1 = 0.008f * std::sin(s.tl * 4.0f);
        draw_card_3d(fb, g_sprites["av_adidas_cap"],
                     0.135f, 0.44f + b1, -0.06f, 0.128f * pa1, 0, 0, -4.0f, s.env, true, false);
        draw_card_3d(fb, g_sprites["av_curly_boy"],
                     0.210f, 0.80f - b1, -0.06f, 0.108f * pa2, 0, 0, 3.0f, s.env, true, false);
        draw_card_3d(fb, g_sprites["av_glasses_thumb"],
                     0.805f, 0.56f + b1, -0.08f, 0.112f * pa3, 0, 0, -3.0f, s.env, true, false);
        draw_card_3d(fb, g_sprites["av_brunette_wink"],
                     0.900f, 0.72f - b1, -0.08f, 0.122f * pa4, 0, 0, 5.0f, s.env, true, false);
    }

    // ========================================================================
    // SHOT 13 (35.8s - 38.8s): 3D Macro Kanban Card Drag & Drop ("Drag & drop live progress")
    // ========================================================================
    if (auto s = eval_shot(t, 35.8f, 38.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_drag_drop"],
                     0.50f, 0.14f, 0.0f,
                     0.132f * p_txt, 0, 0, 0, s.env, false, false);

        // Tilted 3D Close-Up of Kanban Board
        CardEffect fx_kb;
        fx_kb.glass_sheen_pos = s.sheen;
        fx_kb.glass_sheen_strength = 0.22f;
        draw_card_3d(fb, g_sprites["ui_kanban_board"],
                     0.48f - 0.22f * s.exit_u, 0.68f, 0.04f,
                     0.58f, -14.0f, 12.0f - 8.0f * (s.tl / 2.8f), -1.5f, s.env, true, true, &fx_kb);

        // Movable Card lifting high in 3D Z-space and arcing into "Completed"!
        float drag_u = ease_in_out_cubic(clampf((s.tl - 0.25f) / 1.55f, 0.0f, 1.0f));
        float lift = std::sin(drag_u * PI);
        float card_x = 0.48f + 0.27f * drag_u - 0.22f * s.exit_u;
        float card_y = 0.72f - 0.08f * lift;
        float card_z = -0.04f - 0.20f * lift;
        float card_roll = -9.0f * std::sin(drag_u * PI * 2.0f);
        draw_card_3d(fb, g_sprites["ui_kanban_movable_card"],
                     card_x, card_y, card_z,
                     0.098f + 0.016f * lift,
                     -10.0f, 10.0f, card_roll, s.env, true, true);

        // Cursor dragging the card and releasing with a burst
        float burst = (s.tl > 1.80f && s.tl < 2.50f) ? (s.tl - 1.80f) / 0.70f : -1.0f;
        draw_cursor_and_click(fb, card_x + 0.03f, card_y + 0.02f, burst, s.env);

        // Celebratory gold star burst on lock-in
        if (s.tl > 1.75f) {
            float p_st = spring_pop(s.tl, 1.75f, 0.40f);
            draw_star_4pt(fb, 0.82f, 0.64f, 0.052f*p_st, 0.052f*p_st, s.tl*60.0f, gold_col, gold_col, false, 0.08f, s.env);
        }
    }

    // ========================================================================
    // SHOT 14 (38.8s - 41.8s): Personalize — Diagonal Laser Theme Wipe (Light ↔ Dark)
    // ========================================================================
    if (auto s = eval_shot(t, 38.8f, 41.8f); s.active) {
        float p1 = spring_pop(s.tl, 0.06f, 0.45f);
        float p2 = spring_pop(s.tl, 0.16f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_personalize_1"],
                     0.24f - 0.18f * s.exit_u, 0.38f, 0.0f, 0.128f * p1, 0, 0, 0, s.env, false, false);
        draw_card_3d(fb, g_sprites["txt_personalize_2"],
                     0.24f - 0.18f * s.exit_u, 0.52f, 0.0f, 0.128f * p2, 0, 0, 0, s.env, false, false);

        draw_star_4pt(fb, 0.465f, 0.44f, 0.032f*p2, 0.032f*p2, s.tl*40.0f, pink_glow, pink_glow, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.495f, 0.39f, 0.018f*p2, 0.018f*p2, -s.tl*50.0f, white, pink_glow, true, 0.12f, s.env);

        float p_br = spring_pop(s.tl, 0.14f, 0.55f);
        CardEffect fx_theme;
        fx_theme.theme_wipe = true;
        fx_theme.wipe_sprite = &g_sprites["ui_theme_dark"];
        fx_theme.wipe_progress = ease_in_out_cubic(clampf((s.tl - 0.35f) / 1.85f, 0.0f, 1.0f));
        fx_theme.glass_sheen_pos = s.sheen;
        fx_theme.glass_sheen_strength = 0.24f;

        draw_card_3d(fb, g_sprites["ui_theme_light"],
                     0.69f + 0.22f * s.exit_u, 0.52f, 0.02f,
                     0.44f * p_br,
                     6.0f, -16.0f + 5.0f * (s.tl / 2.8f), 1.5f, s.env, true, true, &fx_theme);
    }

    // ========================================================================
    // SHOT 15 (41.8s - 44.8s): OpenGraph, Custom Domain Privacy Shield & 10-Color Palette
    // ========================================================================
    if (auto s = eval_shot(t, 41.8f, 44.8f); s.active) {
        draw_card_3d(fb, g_sprites["txt_personalize_1"],
                     0.23f - 0.20f * s.exit_u, 0.32f, 0.0f, 0.122f, 0, 0, 0, s.env, false, false);
        draw_card_3d(fb, g_sprites["txt_personalize_2"],
                     0.23f - 0.20f * s.exit_u, 0.45f, 0.0f, 0.122f, 0, 0, 0, s.env, false, false);

        // Background Dark Theme Portal
        draw_card_3d(fb, g_sprites["ui_theme_dark"],
                     0.73f + 0.22f * s.exit_u, 0.40f, 0.06f,
                     0.39f, 5.0f, -15.0f, 1.5f, s.env * 0.90f, true, true);

        // Foreground Hero 3D Privacy Shield Card ("feedback.yourdomain.io")
        float p_sh = spring_pop(s.tl, 0.10f, 0.50f);
        CardEffect fx_sh;
        fx_sh.glass_sheen_pos = s.sheen;
        fx_sh.glass_sheen_strength = 0.28f;
        draw_card_3d(fb, g_sprites["ui_privacy_shield"],
                     0.55f - 0.15f * s.exit_u, 0.55f, -0.12f,
                     0.34f * p_sh,
                     5.0f, 12.0f - 6.0f * (s.tl / 2.8f), -1.5f, s.env, true, true, &fx_sh);

        // Official 10 Brand Color Swatches rippling along bottom
        draw_color_palette_swatches(fb, 0.87f, s.tl + 0.3f, s.env);
    }

    // ========================================================================
    // SHOT 16 (44.8s - 47.8s): Module 3 — "Announce product updates" (3D Changelog)
    // ========================================================================
    if (auto s = eval_shot(t, 44.8f, 47.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_announce_updates"],
                     0.50f, 0.15f, 0.0f, 0.135f * p_txt, 0, 0, 0, s.env, false, false);

        float p_ch = spring_pop(s.tl, 0.12f, 0.55f);
        CardEffect fx_ch;
        fx_ch.highlight_pulse = (s.tl > 0.7f);
        fx_ch.glass_sheen_pos = s.sheen;
        fx_ch.glass_sheen_strength = 0.25f;
        fx_ch.pulse_u = 0.70f; fx_ch.pulse_v = 0.52f;
        fx_ch.pulse_r = clampf((s.tl - 0.7f) * 0.20f, 0.0f, 0.25f);
        fx_ch.pulse_alpha = clampf(1.0f - (s.tl - 0.7f)*0.65f, 0.0f, 1.0f);

        draw_card_3d(fb, g_sprites["ui_changelog_main"],
                     0.43f - 0.22f * s.exit_u, 0.61f, 0.04f,
                     0.47f * p_ch,
                     6.0f, 14.0f - 6.0f * (s.tl / 2.8f), -1.0f, s.env, true, true, &fx_ch);

        // Foreground Release Notification Toast ("🚀 NEW RELEASE v2.4 • 786 voters notified")
        if (s.tl > 0.38f) {
            float p_tw = spring_pop(s.tl, 0.40f, 0.48f);
            CardEffect fx_tw;
            fx_tw.glass_sheen_pos = s.sheen;
            fx_tw.glass_sheen_strength = 0.28f;
            draw_card_3d(fb, g_sprites["widget_changelog_toast"],
                         0.75f + 0.22f * s.exit_u, 0.58f, -0.14f,
                         0.21f * p_tw, 4.0f, -15.0f, 1.5f, s.env, true, true, &fx_tw);
        }

        draw_star_4pt(fb, 0.08f, 0.34f, 0.038f*p_ch, 0.038f*p_ch, s.tl*40.0f, teal_col, teal_col, false, 0.08f, s.env);
        draw_star_4pt(fb, 0.91f, 0.26f, 0.042f*p_ch, 0.042f*p_ch, -s.tl*35.0f, pink_glow, purple_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 17 (47.8s - 50.8s): Pearl-White Studio — "Close the feedback loop"
    // ========================================================================
    if (auto s = eval_shot(t, 47.8f, 50.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_close_loop"],
                     0.50f, 0.15f, 0.0f, 0.135f * p_txt, 0, 0, 0, s.env, false, false);

        // Left 3D Card: Changelog
        float p_ch = spring_pop(s.tl, 0.10f, 0.52f);
        draw_card_3d(fb, g_sprites["ui_changelog_main"],
                     0.34f - 0.22f * s.exit_u, 0.61f, 0.06f,
                     0.42f * p_ch, 6.0f, 15.0f, -1.0f, s.env, true, true);

        // Right Foreground 3D Card: Link Related Posts ("Filter public roadmap by board")
        float p_rel = spring_pop(s.tl, 0.18f, 0.52f);
        CardEffect fx_rel;
        fx_rel.highlight_pulse = (s.tl > 0.8f);
        fx_rel.glass_sheen_pos = s.sheen;
        fx_rel.glass_sheen_strength = 0.25f;
        fx_rel.pulse_u = 0.85f; fx_rel.pulse_v = 0.46f;
        fx_rel.pulse_r = clampf((s.tl - 0.8f) * 0.20f, 0.0f, 0.24f);
        fx_rel.pulse_alpha = clampf(1.0f - (s.tl - 0.8f)*0.65f, 0.0f, 1.0f);

        draw_card_3d(fb, g_sprites["ui_related_posts"],
                     0.69f + 0.22f * s.exit_u, 0.62f, -0.10f,
                     0.40f * p_rel, 4.0f, -15.0f + 5.0f * (s.tl / 2.8f), 1.0f, s.env, true, true, &fx_rel);

        float cur_u = ease_out_cubic(s.tl / 0.85f);
        float cx_c = 0.60f + 0.18f * cur_u;
        float cy_c = 0.72f - 0.16f * cur_u;
        float burst = (s.tl > 0.85f && s.tl < 1.55f) ? (s.tl - 0.85f) / 0.7f : -1.0f;
        draw_cursor_and_click(fb, cx_c, cy_c, burst, s.env);

        draw_star_4pt(fb, 0.10f, 0.24f, 0.038f*p_ch, 0.038f*p_ch, s.tl*40.0f, violet_col, purple_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 18 (50.8s - 53.8s): Unified 3-Module 3D Glass Monument ("All-in-one feedback OS")
    // ========================================================================
    if (auto s = eval_shot(t, 50.8f, 53.8f); s.active) {
        float p_txt = spring_pop(s.tl, 0.04f, 0.45f);
        draw_card_3d(fb, g_sprites["txt_all_in_one"],
                     0.50f, 0.15f - 0.15f * s.exit_u, 0.0f,
                     0.138f * p_txt, 0, 0, 0, s.env, false, false);

        float p_m = spring_pop(s.tl, 0.12f, 0.55f);
        CardEffect fx_m;
        fx_m.glass_sheen_pos = s.sheen;
        fx_m.glass_sheen_strength = 0.28f;
        draw_card_3d(fb, g_sprites["ui_three_modules"],
                     0.50f, 0.58f, 0.0f,
                     0.50f * p_m * (1.0f + 0.22f * s.exit_u),
                     8.0f * (1.0f - s.tl * 0.35f), 8.0f * std::sin(s.tl * 1.4f), 0.0f,
                     s.env, true, true, &fx_m);

        draw_star_4pt(fb, 0.09f, 0.66f, 0.044f*p_m, 0.044f*p_m, s.tl*45.0f, hex_rgb(0x787DFC), hex_rgb(0x787DFC), false, 0.08f, s.env);
        draw_star_4pt(fb, 0.90f, 0.26f, 0.046f*p_m, 0.046f*p_m, -s.tl*40.0f, pink_glow, pink_glow, false, 0.08f, s.env);
    }

    // ========================================================================
    // SHOT 19 (53.8s - 57.0s): Apple-Level Finale Brand Lockup ("⚡ Supahub")
    // ========================================================================
    if (t >= 53.6f) {
        float tb = std::max(0.0f, t - 53.8f);
        float env_b = smoothstep(53.6f, 54.05f, t);
        float p_logo = spring_pop(tb, 0.06f, 0.55f, 8.8f, 4.8f);

        draw_star_4pt(fb, 0.17f, 0.44f, 0.18f * p_logo, 0.18f * p_logo,
                      -18.0f + tb * 6.0f, white, purple_glow, true, 0.085f, env_b * 0.92f);
        draw_star_4pt(fb, 0.125f, 0.21f, 0.034f * p_logo, 0.034f * p_logo,
                      tb * 30.0f, pink_glow, pink_glow, false, 0.08f, env_b * 0.75f);
        draw_star_4pt(fb, 0.665f, 0.36f, 0.032f * p_logo, 0.032f * p_logo,
                      15.0f - tb * 25.0f, violet_col, purple_glow, false, 0.08f, env_b * 0.80f);
        draw_star_4pt(fb, 0.84f, 0.70f, 0.040f * p_logo, 0.040f * p_logo,
                      tb * 28.0f, gold_col, gold_col, false, 0.08f, env_b * 0.80f);

        CardEffect fx_lg;
        fx_lg.glass_sheen_pos = clampf((tb / 2.6f) * 1.2f, 0.0f, 1.1f);
        fx_lg.glass_sheen_strength = 0.24f;
        draw_card_3d(fb, g_sprites["logo_supahub_finale"],
                     0.50f, 0.50f, 0.0f,
                     0.225f * p_logo,
                     0.0f, 0.0f, 0.0f, env_b, false, false, &fx_lg);

        // Glowing CTA Pill ("Start free at supahub.com →")
        if (tb > 0.35f) {
            float p_cta = spring_pop(tb, 0.38f, 0.50f);
            CardEffect fx_cta;
            fx_cta.glass_sheen_pos = clampf(((tb - 0.35f) / 2.0f) * 1.2f, 0.0f, 1.1f);
            fx_cta.glass_sheen_strength = 0.30f;
            draw_card_3d(fb, g_sprites["widget_cta_pill"],
                         0.50f, 0.77f, -0.05f,
                         0.076f * p_cta,
                         0.0f, 0.0f, 0.0f, env_b, true, false, &fx_cta);
        }
    }

    // Apple-style Anamorphic Horizontal Lens Flare across all 18 3-second shot cuts!
    draw_anamorphic_transition(fb, t);
}

static void write_rgb24(FILE* out, const FrameBuffer& fb) {
    int n = fb.W * fb.H * 3;
    std::vector<uint8_t> buf(n);
    #pragma omp parallel for schedule(static)
    for (int i = 0; i < n; ++i) {
        buf[i] = (uint8_t)(clampf(fb.rgb[i], 0.0f, 1.0f) * 255.0f + 0.5f);
    }
    std::fwrite(buf.data(), 1, buf.size(), out);
}

int main(int argc, char** argv) {
    int W = 1920, H = 1080;
    int fps = 24;
    int start_frame = 0;
    int end_frame = 1368; // 57.0s @ 24fps
    if (argc >= 3) {
        W = std::atoi(argv[1]);
        H = std::atoi(argv[2]);
    }
    if (argc >= 4) fps = std::atoi(argv[3]);
    if (argc >= 6) {
        start_frame = std::atoi(argv[4]);
        end_frame   = std::atoi(argv[5]);
    }

    init_luts();
    load_all_sprites();
    FrameBuffer fb(W, H);

    for (int f = start_frame; f < end_frame; ++f) {
        float t = (float)f / (float)fps;
        render_frame(fb, t);
        write_rgb24(stdout, fb);
        if ((f - start_frame) % 48 == 0 || f == end_frame - 1) {
            std::fprintf(stderr, "Rendered frame %4d / %4d (t = %5.2fs)\n", f, end_frame, t);
        }
    }
    return 0;
}
