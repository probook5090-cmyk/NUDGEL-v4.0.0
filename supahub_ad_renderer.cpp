// ============================================================================
// supahub_ad_renderer.cpp
// High-Precision C++17 OpenMP 3D Perspective UI & Kinetic Motion-Graphics
// Renderer for the 57-Second Zelios x Supahub SaaS Promotional Brand Video
// (Recreation of https://youtu.be/aAvDI1qae-U)
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
inline float spring_pop(float t, float t0, float dur=0.55f, float freq=9.5f, float damping=4.8f) {
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
        "txt_announce_updates", "txt_close_loop", "logo_supahub_finale"
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
// Background Shaders (Dark Midnight Violet & Luminous Pastel Lavender)
// ============================================================================
static void fill_background(FrameBuffer& fb, float dark_mix, float t) {
    int W = fb.W, H = fb.H;
    // Official Zelios dark canvas (#120924) & light lavender canvas (#FAF6FF)
    #pragma omp parallel for schedule(static)
    for (int y = 0; y < H; ++y) {
        float ny = (float)y / (float)H;
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = 0; x < W; ++x) {
            float nx = (float)x / (float)W;
            // Subtle animated radial nebula glow
            float gx1 = 0.5f + 0.18f * std::sin(t * 0.7f);
            float gy1 = 0.42f + 0.12f * std::cos(t * 0.5f);
            float d1 = std::hypot((nx - gx1)*1.6f, ny - gy1);
            float g1 = std::exp(-d1 * d1 * 2.8f);

            float gx2 = 0.75f - 0.15f * std::cos(t * 0.6f);
            float gy2 = 0.65f + 0.10f * std::sin(t * 0.8f);
            float d2 = std::hypot((nx - gx2)*1.5f, ny - gy2);
            float g2 = std::exp(-d2 * d2 * 3.5f);

            // Dark mode color
            float dr = 0.068f + 0.11f * g1 + 0.09f * g2;
            float dg = 0.032f + 0.03f * g1 + 0.02f * g2;
            float db = 0.138f + 0.20f * g1 + 0.14f * g2;

            // Light mode color (pastel pink-lavender gradient like Zelios styleframes)
            float lr = 0.985f - 0.035f * g1 - 0.015f * ny;
            float lg = 0.960f - 0.055f * g1 - 0.030f * g2;
            float lb = 0.995f - 0.005f * g1;

            row[x*3 + 0] = dr * dark_mix + lr * (1.0f - dark_mix);
            row[x*3 + 1] = dg * dark_mix + lg * (1.0f - dark_mix);
            row[x*3 + 2] = db * dark_mix + lb * (1.0f - dark_mix);
        }
    }
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
            // Astroid 4-point star metric
            float m = std::pow(ax + 1e-6f, 0.56f) + std::pow(ay + 1e-6f, 0.56f);
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
                // Blurred 3D outline star (like foreground bokeh star in Scenes 3, 7, 10)
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

// ============================================================================
// Sweeping Neon Orbital Light Arc (Scenes 2, 3, 4) & Rounded Hub Circuit (Scene 1)
// ============================================================================
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
            float r = std::hypot(dx, dy);
            float dist_px = std::fabs(r - 1.0f) * std::min(rx, ry);
            if (dist_px > 42.0f) continue;
            float ang = std::atan2(dy, dx); // [-pi, 0] is upper arc
            float norm_ang = (ang + PI) / PI; // 0 at left (-pi), 1 at right (0)
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
    float cx = cx_n * W, cy = cy_n * H;
    float hw = hw_n * H, hh = hh_n * H, rad = rad_n * H;
    #pragma omp parallel for schedule(static)
    for (int y = 0; y < H; ++y) {
        float dy = std::fabs(y - cy) - (hh - rad);
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = 0; x < W; ++x) {
            float dx = std::fabs(x - cx) - (hw - rad);
            float d = std::hypot(std::max(dx, 0.0f), std::max(dy, 0.0f))
                    + std::min(std::max(dx, dy), 0.0f) - rad;
            // Soft lavender nested squircles in center + outer pink circuit line
            if (std::fabs(d) < 18.0f) {
                float line = std::exp(-d * d * 0.25f);
                float halo = std::exp(-d * d * 0.015f) * 0.35f;
                float a = clampf((line + halo) * opacity, 0.0f, 1.0f);
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.90f, 0.58f, 0.96f, a));
            }
            // Inner soft lavender squircle pads around center
            float d_in1 = std::hypot(std::max(std::fabs(x - cx) - 110.0f, 0.0f),
                                     std::max(std::fabs(y - cy) - 110.0f, 0.0f)) - 95.0f;
            if (d_in1 < 2.0f) {
                float a = smoothstep(2.0f, -2.0f, d_in1) * 0.45f * opacity;
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.92f, 0.87f, 0.99f, a));
            }
        }
    }
}

// ============================================================================
// 3D Perspective Plane / Card Renderer with Extruded Bevel, Drop Shadow & Sub-Effects
// ============================================================================
struct CardEffect {
    bool highlight_pulse = false;
    float pulse_u = 0.5f, pulse_v = 0.5f, pulse_r = 0.0f, pulse_alpha = 0.0f;
    bool theme_wipe = false;
    const Sprite* wipe_sprite = nullptr;
    float wipe_progress = 0.0f; // 0..1 diagonal wipe
    float right_shadow_fade = 0.0f; // 0..1 dark vignette on right edge (like Scene 4 Roadmap card)
    float bottom_shadow_fade = 0.0f; // 0..1 dark vignette on bottom edge (like Scene 3 Portal screen)
};

static void draw_card_3d(
    FrameBuffer& fb,
    const Sprite& sp,
    float cx_n, float cy_n, float cz, // cz=0 is reference plane; cz>0 is farther, cz<0 is closer
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

    // Card half-sizes in normalized camera height units (H = 2.0 units at z=0)
    float hh = scale;
    float hw = scale * ((float)sp.w / (float)sp.h);

    // Center in 3D camera space
    Vec3 C((cx_n - 0.5f) * 2.0f * aspect, (cy_n - 0.5f) * 2.0f, cz);

    // Rotation matrix R = Rz(roll) * Ry(yaw) * Rx(pitch)
    float rx = pitch_deg * (PI / 180.0f);
    float ry = yaw_deg   * (PI / 180.0f);
    float rz = roll_deg  * (PI / 180.0f);
    float cx = std::cos(rx), sx = std::sin(rx);
    float cy = std::cos(ry), sy = std::sin(ry);
    float cz_r = std::cos(rz), sz_r = std::sin(rz);

    auto rot_vec = [&](Vec3 v) {
        // Rx
        Vec3 v1(v.x, v.y * cx - v.z * sx, v.y * sx + v.z * cx);
        // Ry
        Vec3 v2(v1.x * cy + v1.z * sy, v1.y, -v1.x * sy + v1.z * cy);
        // Rz
        return Vec3(v2.x * cz_r - v2.y * sz_r, v2.x * sz_r + v2.y * cz_r, v2.z);
    };

    Vec3 U = rot_vec(Vec3(1, 0, 0));
    Vec3 V = rot_vec(Vec3(0, 1, 0));
    Vec3 N = rot_vec(Vec3(0, 0, 1));
    Vec3 O(0, 0, -cam_dist);

    // Project the 4 corners (+ margin for shadow & 3D rim) to find screen-space bounding box
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
            float lx = dot(dP, U) / hw; // [-1, +1] inside card
            float ly = dot(dP, V) / hh; // [-1, +1] inside card

            // 1. Soft Alpha-Silhouette 3D Drop Shadow (offset down and back, zero rectangular box!)
            if (draw_shadow) {
                float u_sh = (lx - 0.022f) * 0.5f + 0.5f;
                float v_sh = (ly - 0.048f) * 0.5f + 0.5f;
                if (u_sh >= -0.04f && u_sh <= 1.04f && v_sh >= -0.04f && v_sh <= 1.04f) {
                    float a_sum = 0.0f;
                    const float offs[5][2] = {{0,0}, {-0.012f,0}, {0.012f,0}, {0,-0.012f}, {0,0.012f}};
                    for (int k = 0; k < 5; ++k) {
                        a_sum += sp.sample(u_sh + offs[k][0], v_sh + offs[k][1]).a;
                    }
                    float sh_a = (a_sum * 0.2f) * 0.28f * opacity;
                    if (sh_a > 1e-3f) {
                        blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.05f, 0.02f, 0.12f, sh_a));
                    }
                }
            }

            // 2. 3D Extruded Purple/Lavender Rim (visible when yaw/pitch tilts the card)
            if (draw_3d_rim && (std::fabs(yaw_deg) > 2.0f || std::fabs(pitch_deg) > 2.0f)) {
                float rim_dx = (yaw_deg > 0.0f) ? 0.016f : -0.016f;
                float rim_dy = (pitch_deg > 0.0f) ? 0.014f : -0.014f;
                float r_u = (lx - rim_dx) * 0.5f + 0.5f;
                float r_v = (ly - rim_dy) * 0.5f + 0.5f;
                if (r_u >= 0.0f && r_u <= 1.0f && r_v >= 0.0f && r_v <= 1.0f) {
                    RGBA rim_s = sp.sample(r_u, r_v);
                    if (rim_s.a > 0.2f) {
                        blend_over(row[x*3+0], row[x*3+1], row[x*3+2],
                                   RGBA(0.56f, 0.36f, 0.88f, rim_s.a * opacity * 0.92f));
                    }
                }
            }

            // 3. Main Card Surface Sample
            float u = lx * 0.5f + 0.5f;
            float v = ly * 0.5f + 0.5f;
            if (u >= 0.0f && u <= 1.0f && v >= 0.0f && v <= 1.0f) {
                RGBA tex = sp.sample(u, v);

                // Optional Theme Wipe (Light Mode -> Dark Mode with glowing neon laser line)
                if (fx && fx->theme_wipe && fx->wipe_sprite) {
                    float diag = u * 0.75f + v * 0.25f;
                    RGBA tex2 = fx->wipe_sprite->sample(u, v);
                    float w_edge = smoothstep(fx->wipe_progress - 0.02f, fx->wipe_progress + 0.02f, diag);
                    tex.r = tex2.r * (1.0f - w_edge) + tex.r * w_edge;
                    tex.g = tex2.g * (1.0f - w_edge) + tex.g * w_edge;
                    tex.b = tex2.b * (1.0f - w_edge) + tex.b * w_edge;
                    // Glowing purple-pink laser seam along wipe edge
                    float seam = std::exp(-std::pow((diag - fx->wipe_progress) * 45.0f, 2.0f));
                    if (fx->wipe_progress > 0.02f && fx->wipe_progress < 0.98f) {
                        tex.r = clampf(tex.r + seam * 0.85f, 0.0f, 1.0f);
                        tex.g = clampf(tex.g + seam * 0.35f, 0.0f, 1.0f);
                        tex.b = clampf(tex.b + seam * 1.00f, 0.0f, 1.0f);
                    }
                }

                // Optional Interactive Highlight / Upvote Pulse Ring on the 3D Card
                if (fx && fx->highlight_pulse && fx->pulse_alpha > 1e-3f) {
                    float du = (u - fx->pulse_u) * ((float)sp.w / (float)sp.h);
                    float dv = (v - fx->pulse_v);
                    float d_p = std::hypot(du, dv);
                    float ring = std::exp(-std::pow((d_p - fx->pulse_r) * 28.0f, 2.0f));
                    float fill = smoothstep(fx->pulse_r, 0.0f, d_p) * 0.35f;
                    float pa = (ring + fill) * fx->pulse_alpha;
                    tex.r = tex.r * (1.0f - pa) + 0.65f * pa;
                    tex.g = tex.g * (1.0f - pa) + 0.22f * pa;
                    tex.b = tex.b * (1.0f - pa) + 0.98f * pa;
                }

                // Optional Right-Side Shadow Vignette (matching Scene 4 "Collect feedback" Roadmap card)
                if (fx && fx->right_shadow_fade > 1e-3f) {
                    float fade = smoothstep(0.45f, 0.98f, u) * fx->right_shadow_fade;
                    tex.r = tex.r * (1.0f - fade) + 0.068f * fade;
                    tex.g = tex.g * (1.0f - fade) + 0.032f * fade;
                    tex.b = tex.b * (1.0f - fade) + 0.138f * fade;
                }
                // Optional Bottom-Side Shadow Vignette (matching Scene 3 "and share ideas" Portal screen)
                if (fx && fx->bottom_shadow_fade > 1e-3f) {
                    float fade = smoothstep(0.55f, 0.98f, v) * fx->bottom_shadow_fade;
                    tex.r = tex.r * (1.0f - fade) + 0.068f * fade;
                    tex.g = tex.g * (1.0f - fade) + 0.032f * fade;
                    tex.b = tex.b * (1.0f - fade) + 0.138f * fade;
                }

                tex.a *= opacity;
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], tex);
            }
        }
    }
}

// ============================================================================
// Animated Pointer Cursor + Click Burst Lines (\ | /)
// ============================================================================
static void draw_cursor_and_click(
    FrameBuffer& fb,
    float cx_n, float cy_n,
    float click_burst_t, // 0..1 if clicking, <0 otherwise
    float opacity = 1.0f
) {
    if (opacity <= 1e-3f) return;
    int W = fb.W, H = fb.H;
    float cx = cx_n * W, cy = cy_n * H;
    int x0 = std::max(0, (int)(cx - 70));
    int x1 = std::min(W - 1, (int)(cx + 70));
    int y0 = std::max(0, (int)(cy - 70));
    int y1 = std::min(H - 1, (int)(cy + 70));

    for (int y = y0; y <= y1; ++y) {
        float* row = &fb.rgb[(size_t)y * W * 3];
        for (int x = x0; x <= x1; ++x) {
            float dx = x - cx, dy = y - cy;
            // Click burst rays above-left of tip
            if (click_burst_t > 0.0f && click_burst_t < 1.0f) {
                float r = std::hypot(dx, dy);
                float r_in = 14.0f + click_burst_t * 18.0f;
                float r_out = 28.0f + click_burst_t * 24.0f;
                if (r >= r_in && r <= r_out) {
                    float ang = std::atan2(dy, dx);
                    for (int k = 0; k < 4; ++k) {
                        float target_a = -2.35f + k * 0.52f;
                        float da = std::fabs(ang - target_a) * r;
                        if (da < 2.4f) {
                            float ba = (1.0f - click_burst_t) * opacity;
                            blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.48f, 0.18f, 0.85f, ba));
                        }
                    }
                }
            }
            // Crisp black/white macOS pointer arrow
            if (dx >= -2.0f && dy >= -2.0f && dy <= 34.0f && dx <= dy * 0.72f + 2.0f) {
                bool in_arrow = (dy <= 24.0f && dx >= 0.0f && dx <= dy * 0.68f)
                             || (dy > 20.0f && dy <= 32.0f && std::fabs(dx - (dy - 12.0f)*0.42f) <= 3.2f);
                bool in_border = (dy <= 26.0f && dx >= -1.8f && dx <= dy * 0.68f + 1.8f);
                if (in_arrow) {
                    blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(0.08f, 0.06f, 0.14f, opacity));
                } else if (in_border) {
                    blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(1.0f, 1.0f, 1.0f, opacity * 0.9f));
                }
            }
        }
    }
}

// ============================================================================
// Official Zelios 10-Color Palette Swatch Wave (Scene 8 Customization)
// ============================================================================
static void draw_color_palette_swatches(FrameBuffer& fb, float cy_n, float t_local, float opacity) {
    if (opacity <= 1e-3f) return;
    static const uint32_t hex_cols[10] = {
        0xEBB02E, 0xFFD1EF, 0xED3FB2, 0xD11846, 0xB984FF,
        0xBD8FF0, 0x7C2ED2, 0xBFDBFE, 0x787DFC, 0x0DBCA5
    };
    int W = fb.W, H = fb.H;
    for (int i = 0; i < 10; ++i) {
        float pop = spring_pop(t_local, i * 0.055f, 0.45f, 9.0f, 4.5f);
        if (pop <= 1e-3f) continue;
        float cx_n = 0.14f + i * 0.08f;
        float wave_y = cy_n - 0.012f * std::sin(t_local * 4.0f - i * 0.55f);
        float r_px = 34.0f * pop * (H / 1080.0f);
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
                float glow = std::exp(-std::pow(std::max(0.0f, d - r_px * 0.8f) / (r_px * 0.45f), 2.0f)) * 0.35f;
                float a = clampf((disc + glow) * opacity, 0.0f, 1.0f);
                blend_over(row[x*3+0], row[x*3+1], row[x*3+2], RGBA(c.r, c.g, c.b, a));
            }
        }
    }
}

// ============================================================================
// Master Timeline Renderer — 57.0 Seconds (t in [0.0, 57.0])
// ============================================================================
static void render_frame(FrameBuffer& fb, float t) {
    const RGBA white(1, 1, 1, 1);
    const RGBA purple_glow = hex_rgb(0xB984FF, 1.0f);
    const RGBA pink_glow   = hex_rgb(0xED3FB2, 1.0f);
    const RGBA gold_col    = hex_rgb(0xEBB02E, 1.0f);
    const RGBA teal_col    = hex_rgb(0x0DBCA5, 1.0f);
    const RGBA crimson_col = hex_rgb(0xD11846, 1.0f);
    const RGBA violet_col  = hex_rgb(0x7C2ED2, 1.0f);

    // Determine Dark Mode vs Light Mode background mix smoothly across scenes:
    // Scene 1a (0.0 - 2.0s): Dark (#120924) -> "feature ✦ requests"
    // Scene 1b (2.0 - 5.2s): Light (#FAF6FF) -> 4 3D Avatars + Discord/Slack/Gmail Hub
    // Scene 2  (5.2 - 8.5s): Dark (#120924) -> "✦ Give your users a place"
    // Scene 3  (8.5 - 15.0s): Dark (#120924) -> "and share ideas" + 3D Tilted Portal
    // Scene 4  (15.0 - 22.0s): Dark (#120924) -> "Collect feedback" + Dual 3D Cards
    // Scene 5  (22.0 - 28.5s): Light (#FAF6FF) -> "Merge duplicates & vote on behalf"
    // Scene 6  (28.5 - 35.5s): Dark (#120924) -> "Prioritize what to build next" + Q2 Table & Value vs Effort
    // Scene 7  (35.5 - 42.0s): Light (#FAF6FF) -> "Public Roadmap" Kanban + 4 3D Avatars + Animated Card Drag
    // Scene 8  (42.0 - 48.5s): Dark (#120924) -> "Personalize with OpenGraph" + Theme Wipe + Privacy Shield + 10 Colors
    // Scene 9  (48.5 - 53.5s): Dark (#120924) -> "Announce product updates" + Changelog & Related Posts
    // Scene 10 (53.5 - 57.0s): Dark->Light -> 3-Module Lockup -> "⚡ Supahub" Finale

    float dark_mix = 1.0f;
    if (t >= 1.8f && t < 5.2f) {
        dark_mix = 1.0f - smoothstep(1.8f, 2.2f, t) + smoothstep(4.8f, 5.2f, t);
    } else if (t >= 21.7f && t < 28.5f) {
        dark_mix = 1.0f - smoothstep(21.7f, 22.2f, t) + smoothstep(28.1f, 28.5f, t);
    } else if (t >= 35.2f && t < 42.0f) {
        dark_mix = 1.0f - smoothstep(35.2f, 35.7f, t) + smoothstep(41.6f, 42.0f, t);
    } else if (t >= 54.6f) {
        dark_mix = 1.0f - smoothstep(54.6f, 55.1f, t);
    }
    dark_mix = clampf(dark_mix, 0.0f, 1.0f);
    fill_background(fb, dark_mix, t);

    // ========================================================================
    // SCENE 1A (0.0s - 2.1s): Kinetic Opener "feature ✦ requests"
    // ========================================================================
    if (t < 2.2f) {
        float fade_out = 1.0f - smoothstep(1.85f, 2.15f, t);
        float p_star = spring_pop(t, 0.05f, 0.45f, 10.0f, 4.5f);
        float p_left = spring_pop(t, 0.18f, 0.50f,  9.5f, 4.8f);
        float p_right= spring_pop(t, 0.28f, 0.50f,  9.5f, 4.8f);

        // Left word "feature" sliding out from center star
        draw_card_3d(fb, g_sprites["txt_feature"],
                     0.50f - 0.185f * p_left, 0.50f, 0.0f,
                     0.135f * p_left, 0.0f, 0.0f, 0.0f, fade_out, false, false);
        // Right word "requests" sliding out from center star
        draw_card_3d(fb, g_sprites["txt_requests"],
                     0.50f + 0.205f * p_right, 0.50f, 0.0f,
                     0.135f * p_right, 0.0f, 0.0f, 0.0f, fade_out, false, false);
        // Center spinning 4-point star ✦
        float star_scale = (0.085f + 0.014f * std::sin(t * 8.0f)) * p_star;
        // Zoom burst at t=1.8..2.1s
        float zoom_burst = smoothstep(1.75f, 2.15f, t) * 0.45f;
        draw_star_4pt(fb, 0.50f, 0.50f, star_scale + zoom_burst, star_scale + zoom_burst,
                      (1.0f - ease_out_cubic(t / 1.2f)) * 90.0f, white, purple_glow, false, 0.08f, fade_out);
    }

    // ========================================================================
    // SCENE 1B (1.9s - 5.2s): Central Supahub Hub + 4 3D Customer Avatars + Pills
    // ========================================================================
    if (t >= 1.9f && t < 5.3f) {
        float tl = t - 2.0f;
        float env = smoothstep(1.9f, 2.25f, t) * (1.0f - smoothstep(4.85f, 5.20f, t));

        // Rounded circuit & nested lavender squircles
        draw_rounded_circuit(fb, 0.50f, 0.50f, 0.42f, 0.42f, 0.15f, tl, env);

        // Central 3D Supahub Purple Icon with spring pop & gentle pulse
        float p_hub = spring_pop(tl, 0.05f, 0.5f, 9.0f, 4.5f);
        float pulse = 1.0f + 0.04f * std::sin(tl * 6.0f);
        draw_card_3d(fb, g_sprites["supahub_icon_3d"],
                     0.50f, 0.50f, 0.0f, 0.125f * p_hub * pulse,
                     6.0f * std::sin(tl * 2.5f), 8.0f * std::cos(tl * 2.5f), 0.0f,
                     env, true, false);

        // 4 Chat Pills orbiting slightly inward toward the hub
        float p1 = spring_pop(tl, 0.20f, 0.50f);
        float p2 = spring_pop(tl, 0.32f, 0.50f);
        float p3 = spring_pop(tl, 0.44f, 0.50f);
        float p4 = spring_pop(tl, 0.56f, 0.50f);
        float bob1 = 0.008f * std::sin(tl * 3.5f);
        float bob2 = 0.008f * std::cos(tl * 3.8f);

        // Top-left Discord pill + Winking Brunette Avatar
        draw_card_3d(fb, g_sprites["pill_discord"],
                     0.235f, 0.33f + bob1, 0.0f, 0.074f * p1, 0, 8.0f, 0, env, true, false);
        draw_card_3d(fb, g_sprites["av_brunette_wink"],
                     0.240f, 0.16f + bob1 * 0.7f, -0.08f, 0.125f * spring_pop(tl, 0.28f),
                     0, 0, -4.0f * std::sin(tl * 3.0f), env, true, false);

        // Top-right Slack Warm pill + Winking Blonde Avatar
        draw_card_3d(fb, g_sprites["pill_slack_warm"],
                     0.705f, 0.32f - bob2, 0.0f, 0.074f * p2, 0, -8.0f, 0, env, true, false);
        draw_card_3d(fb, g_sprites["av_blonde_wink"],
                     0.710f, 0.15f - bob2 * 0.7f, -0.08f, 0.145f * spring_pop(tl, 0.40f),
                     0, 0, 4.0f * std::cos(tl * 3.0f), env, true, false);

        // Bottom-left Slack Teal pill + Adidas Cap Avatar
        draw_card_3d(fb, g_sprites["pill_slack_teal"],
                     0.350f, 0.85f + bob2, 0.0f, 0.074f * p3, 0, 8.0f, 0, env, true, false);
        draw_card_3d(fb, g_sprites["av_adidas_cap"],
                     0.268f, 0.65f + bob2 * 0.7f, -0.08f, 0.145f * spring_pop(tl, 0.52f),
                     0, 0, 3.0f * std::sin(tl * 2.8f), env, true, false);

        // Bottom-right Gmail Pink pill + Pink Glasses Avatar
        draw_card_3d(fb, g_sprites["pill_gmail_pink"],
                     0.735f, 0.73f - bob1, 0.0f, 0.074f * p4, 0, -8.0f, 0, env, true, false);
        draw_card_3d(fb, g_sprites["av_pink_glasses"],
                     0.785f, 0.55f - bob1 * 0.7f, -0.08f, 0.130f * spring_pop(tl, 0.64f),
                     0, 0, -3.5f * std::cos(tl * 3.2f), env, true, false);

        // 4 Colorful Zelios 4-Point Stars spinning around the circuit
        draw_star_4pt(fb, 0.308f, 0.21f, 0.026f*p1, 0.026f*p1, tl*45.0f, violet_col, violet_col, false, 0.08f, env);
        draw_star_4pt(fb, 0.615f, 0.17f, 0.038f*p2, 0.038f*p2, -tl*35.0f, gold_col, gold_col, false, 0.08f, env);
        draw_star_4pt(fb, 0.462f, 0.81f, 0.030f*p3, 0.030f*p3, tl*50.0f, teal_col, teal_col, false, 0.08f, env);
        draw_star_4pt(fb, 0.825f, 0.79f, 0.038f*p4, 0.038f*p4, -tl*40.0f, crimson_col, crimson_col, false, 0.08f, env);
    }

    // ========================================================================
    // SCENE 2 (5.0s - 8.6s): Kinetic Transition "✦ Give your users a place"
    // ========================================================================
    if (t >= 5.0f && t < 8.7f) {
        float tl = t - 5.1f;
        float env = smoothstep(5.0f, 5.35f, t) * (1.0f - smoothstep(8.25f, 8.65f, t));
        float arc_prog = clampf(tl / 1.6f, 0.0f, 1.0f);
        draw_orbital_arc(fb, 0.55f, 0.72f, 0.52f, 0.44f, arc_prog, env * 0.85f);

        float p_txt = spring_pop(tl, 0.15f, 0.55f, 9.2f, 4.6f);
        draw_card_3d(fb, g_sprites["txt_give_users"],
                     0.53f, 0.50f - (1.0f - p_txt)*0.08f, 0.0f,
                     0.135f * p_txt, 0.0f, 0.0f, 0.0f, env, false, false);

        float p_st = spring_pop(tl, 0.05f, 0.50f, 10.0f, 4.2f);
        draw_star_4pt(fb, 0.175f, 0.50f, 0.062f * p_st, 0.062f * p_st,
                      (1.0f - p_st) * 120.0f, white, purple_glow, false, 0.08f, env);
    }

    // ========================================================================
    // SCENE 3 (8.3s - 15.1s): "and share ideas" + 3D Tilted Feedback Portal Screen
    // ========================================================================
    if (t >= 8.3f && t < 15.1f) {
        float tl = t - 8.4f;
        float env = smoothstep(8.3f, 8.7f, t) * (1.0f - smoothstep(14.65f, 15.05f, t));

        // Glowing purple orbital horizon arc above the 3D tilted screen
        draw_orbital_arc(fb, 0.50f, 0.68f, 0.55f, 0.44f, clampf(0.3f + tl * 0.4f, 0.0f, 1.0f), env * 0.95f);

        // Headline "and share ideas" at top (hero-sized matching Zelios frame!)
        float p_head = spring_pop(tl, 0.10f, 0.55f, 9.0f, 4.6f);
        draw_card_3d(fb, g_sprites["txt_share_ideas"],
                     0.50f, 0.175f, 0.0f,
                     0.145f * p_head, 0.0f, 0.0f, 0.0f, env, false, false);

        // 3D Tilted Tablet/Laptop Screen rising into perspective (pitch = -34 deg -> -26 deg)
        float p_scr = spring_pop(tl, 0.18f, 0.75f, 7.5f, 4.8f);
        float pitch = -35.0f + 9.0f * ease_in_out_cubic(tl / 6.5f);
        float yaw   = -2.5f + 5.0f * std::sin(tl * 0.7f);
        float scr_y = 0.77f + (1.0f - p_scr) * 0.35f;

        CardEffect fx;
        fx.highlight_pulse = true;
        fx.bottom_shadow_fade = 0.72f;
        // Upvote pulse travels down the posts on the 3D screen
        int post_idx = ((int)(tl * 0.9f)) % 3;
        fx.pulse_u = 0.85f;
        fx.pulse_v = 0.56f + post_idx * 0.14f;
        float sub_t = std::fmod(tl * 0.9f, 1.0f);
        fx.pulse_r = sub_t * 0.16f;
        fx.pulse_alpha = (1.0f - sub_t) * 0.85f;

        draw_card_3d(fb, g_sprites["ui_portal_main"],
                     0.50f, scr_y, 0.04f,
                     0.64f * p_scr, pitch, yaw, 0.0f, env, true, true, &fx);

        // Left mid-ground 4-point purple star ✦
        draw_star_4pt(fb, 0.085f, 0.65f + 0.02f*std::sin(tl*2.2f), 0.032f*p_scr, 0.032f*p_scr,
                      tl*20.0f, violet_col, purple_glow, false, 0.08f, env);

        // Large Foreground Depth-of-Field Blurred 3D 4-Point Star on Bottom-Right (signature Zelios shot!)
        draw_star_4pt(fb, 0.92f - 0.02f*std::sin(tl*1.5f), 0.83f + 0.02f*std::cos(tl*1.5f),
                      0.26f * p_scr, 0.26f * p_scr, -12.0f + tl * 4.0f,
                      white, purple_glow, true, 0.11f, env * 0.95f);
    }

    // ========================================================================
    // SCENE 4 (14.8s - 22.0s): "Collect feedback" + Dual 3D Tilted UI Cards
    // ========================================================================
    if (t >= 14.8f && t < 22.1f) {
        float tl = t - 15.0f;
        float env = smoothstep(14.8f, 15.2f, t) * (1.0f - smoothstep(21.6f, 22.0f, t));

        // Headline "Collect feedback" at top (hero-sized matching Zelios frame 1:1!)
        float p_txt = spring_pop(tl, 0.05f, 0.55f, 9.2f, 4.6f);
        draw_card_3d(fb, g_sprites["txt_collect_feedback"],
                     0.50f, 0.22f, 0.0f,
                     0.155f * p_txt, 0.0f, 0.0f, 0.0f, env, false, false);

        // Left 3D Card ("Feature Requests / Bug Fixes / Collect feedback from Slack ▲ 786")
        float p_left = spring_pop(tl, 0.18f, 0.70f, 8.0f, 4.8f);
        float left_yaw = 24.0f - 4.0f * std::sin(tl * 0.8f);
        float left_pitch = 6.0f + 2.0f * std::cos(tl * 0.7f);

        CardEffect fx_left;
        fx_left.highlight_pulse = true;
        fx_left.bottom_shadow_fade = 0.55f;
        fx_left.pulse_u = 0.115f;
        fx_left.pulse_v = 0.285f; // Upvote box ▲ 786
        float up_t = std::fmod(std::max(0.0f, tl - 0.8f) * 0.85f, 1.0f);
        fx_left.pulse_r = up_t * 0.18f;
        fx_left.pulse_alpha = (1.0f - up_t) * 0.9f;

        draw_card_3d(fb, g_sprites["ui_card_feature_requests"],
                     0.31f - (1.0f - p_left)*0.15f, 0.79f + (1.0f - p_left)*0.20f, 0.04f,
                     0.50f * p_left, left_pitch, left_yaw, -4.5f, env, true, true, &fx_left);

        // Right 3D Card ("Roadmap: Public | Q1 Roadmap | Q2 Roadmap")
        float p_right = spring_pop(tl, 0.30f, 0.70f, 8.0f, 4.8f);
        float right_yaw = -19.0f + 4.0f * std::cos(tl * 0.8f);
        float right_pitch = 5.0f - 2.0f * std::sin(tl * 0.7f);

        CardEffect fx_right;
        fx_right.right_shadow_fade = 0.92f; // Signature right-side atmospheric shadow fade from Zelios frame!
        fx_right.bottom_shadow_fade = 0.45f;
        draw_card_3d(fb, g_sprites["ui_card_roadmap_public"],
                     0.67f + (1.0f - p_right)*0.15f, 0.78f + (1.0f - p_right)*0.20f, 0.02f,
                     0.52f * p_right, right_pitch, right_yaw, 2.5f, env, true, true, &fx_right);

        // Animated Cursor clicking the ▲ 786 Upvote button on the Left 3D Card
        if (tl > 0.6f && tl < 4.5f) {
            float ct = clampf((tl - 0.6f) / 1.1f, 0.0f, 1.0f);
            float cx_c = 0.10f + 0.095f * ease_out_cubic(ct);
            float cy_c = 0.88f - 0.21f  * ease_out_cubic(ct);
            float burst = (tl > 1.7f && tl < 2.4f) ? (tl - 1.7f) / 0.7f : -1.0f;
            draw_cursor_and_click(fb, cx_c, cy_c, burst, env);
        }
    }

    // ========================================================================
    // SCENE 5 (21.8s - 28.5s): "Merge duplicates & vote on behalf" (Light Canvas)
    // ========================================================================
    if (t >= 21.8f && t < 28.6f) {
        float tl = t - 22.0f;
        float env = smoothstep(21.8f, 22.25f, t) * (1.0f - smoothstep(28.1f, 28.5f, t));

        float p_txt = spring_pop(tl, 0.05f, 0.55f);
        draw_card_3d(fb, g_sprites["txt_merge_duplicates"],
                     0.50f, 0.15f, 0.0f,
                     0.125f * p_txt, 0, 0, 0, env, false, false);

        // Card 1: Merge duplicate posts (slides from center to left as Card 2 enters)
        float split = ease_in_out_cubic((tl - 2.2f) / 1.2f);
        float p_c1 = spring_pop(tl, 0.15f, 0.65f);
        CardEffect fx_m;
        fx_m.highlight_pulse = (tl > 1.2f && tl < 2.8f);
        fx_m.pulse_u = 0.885f; fx_m.pulse_v = 0.585f; // "+ Merge" button
        fx_m.pulse_r = clampf((tl - 1.2f) * 0.18f, 0.0f, 0.22f);
        fx_m.pulse_alpha = clampf(1.0f - (tl - 1.2f)*0.7f, 0.0f, 1.0f);

        draw_card_3d(fb, g_sprites["ui_card_merge_posts"],
                     0.50f - 0.20f * split, 0.58f, 0.04f * split,
                     (0.46f - 0.06f * split) * p_c1,
                     4.0f, 14.0f * split, 0.0f, env, true, true, &fx_m);

        // Card 2: Add Vote on Behalf (pops in on the right in 3D perspective)
        if (tl > 2.0f) {
            float p_c2 = spring_pop(tl, 2.1f, 0.65f);
            CardEffect fx_v;
            fx_v.highlight_pulse = (tl > 3.6f);
            fx_v.pulse_u = 0.605f; fx_v.pulse_v = 0.91f; // "Add Vote" button
            fx_v.pulse_r = clampf((tl - 3.6f) * 0.18f, 0.0f, 0.22f);
            fx_v.pulse_alpha = clampf(1.0f - (tl - 3.6f)*0.7f, 0.0f, 1.0f);

            draw_card_3d(fb, g_sprites["ui_card_vote_behalf"],
                         0.71f, 0.60f, -0.06f,
                         0.41f * p_c2,
                         3.0f, -15.0f, 0.0f, env, true, true, &fx_v);
        }

        // Animated Cursor clicking "+ Merge" then moving to "Add Vote"
        float cur_x = 0.68f, cur_y = 0.62f, burst = -1.0f;
        if (tl < 2.2f) {
            float u = ease_out_cubic(tl / 1.1f);
            cur_x = 0.45f + 0.28f * u;
            cur_y = 0.80f - 0.18f * u;
            if (tl > 1.15f && tl < 1.85f) burst = (tl - 1.15f) / 0.7f;
        } else {
            float u = ease_in_out_cubic((tl - 2.2f) / 1.3f);
            cur_x = 0.73f + 0.02f * u;
            cur_y = 0.62f + 0.25f * u;
            if (tl > 3.55f && tl < 4.25f) burst = (tl - 3.55f) / 0.7f;
        }
        draw_cursor_and_click(fb, cur_x, cur_y, burst, env);

        draw_star_4pt(fb, 0.09f, 0.24f, 0.036f*p_txt, 0.036f*p_txt, tl*35.0f, violet_col, purple_glow, false, 0.08f, env);
        draw_star_4pt(fb, 0.91f, 0.22f, 0.030f*p_txt, 0.030f*p_txt, -tl*40.0f, pink_glow, pink_glow, false, 0.08f, env);
    }

    // ========================================================================
    // SCENE 6 (28.3s - 35.5s): "Prioritize what to build next" (Q2 Table + Value vs Effort)
    // ========================================================================
    if (t >= 28.3f && t < 35.6f) {
        float tl = t - 28.5f;
        float env = smoothstep(28.3f, 28.7f, t) * (1.0f - smoothstep(35.1f, 35.5f, t));

        float p_txt = spring_pop(tl, 0.05f, 0.55f);
        draw_card_3d(fb, g_sprites["txt_prioritize"],
                     0.50f, 0.15f, 0.0f,
                     0.130f * p_txt, 0, 0, 0, env, false, false);

        // Background 3D Card: Q2 Roadmap Prioritization Table (POST, ASSIGNEE, IMPACT, DEV EFFORT, SCORE 750)
        float p_tbl = spring_pop(tl, 0.15f, 0.70f);
        float tbl_shift = ease_in_out_cubic((tl - 2.0f) / 1.4f);
        draw_card_3d(fb, g_sprites["ui_card_priority_table"],
                     0.50f - 0.12f * tbl_shift, 0.60f, 0.06f * tbl_shift,
                     0.46f * p_tbl,
                     6.0f - 2.0f * tbl_shift, 10.0f * tbl_shift, 0.0f, env, true, true);

        // Foreground 3D Pop-Over Card: "Value vs Effort" (Impact 4★, Design Effort 2★, Dev Effort 4★, Score 600)
        if (tl > 1.8f) {
            float p_mod = spring_pop(tl, 1.85f, 0.65f, 9.0f, 4.5f);
            CardEffect fx_ve;
            fx_ve.highlight_pulse = (tl > 3.2f);
            fx_ve.pulse_u = 0.46f; fx_ve.pulse_v = 0.90f; // Score 600 pill
            fx_ve.pulse_r = clampf((tl - 3.2f) * 0.18f, 0.0f, 0.22f);
            fx_ve.pulse_alpha = clampf(1.0f - (tl - 3.2f)*0.6f, 0.0f, 1.0f);

            draw_card_3d(fb, g_sprites["ui_card_value_effort"],
                         0.71f, 0.62f, -0.14f,
                         0.38f * p_mod,
                         4.0f, -14.0f, 1.5f, env, true, true, &fx_ve);
        }

        draw_star_4pt(fb, 0.09f, 0.42f, 0.040f*p_tbl, 0.040f*p_tbl, tl*30.0f, gold_col, gold_col, false, 0.08f, env);
        draw_star_4pt(fb, 0.91f, 0.26f, 0.046f*p_tbl, 0.046f*p_tbl, -tl*25.0f, white, pink_glow, false, 0.08f, env);
    }

    // ========================================================================
    // SCENE 7 (35.3s - 42.0s): "Public Roadmap" Kanban Board + Animated Card Drag + 4 Avatars
    // ========================================================================
    if (t >= 35.3f && t < 42.1f) {
        float tl = t - 35.5f;
        float env = smoothstep(35.3f, 35.7f, t) * (1.0f - smoothstep(41.6f, 42.0f, t));

        // Large background 3D outline 4-point star on top-right (matching Zelios styleframe 1:1!)
        draw_star_4pt(fb, 0.82f, 0.20f, 0.22f, 0.22f, 16.0f + tl*3.0f,
                      white, purple_glow, true, 0.085f, env * 0.85f);
        draw_star_4pt(fb, 0.27f, 0.16f, 0.028f, 0.028f, -tl*20.0f,
                      purple_glow, purple_glow, false, 0.08f, env * 0.65f);

        // Headline "Public Roadmap" at top
        float p_txt = spring_pop(tl, 0.05f, 0.55f);
        draw_card_3d(fb, g_sprites["txt_public_roadmap"],
                     0.46f, 0.14f, 0.0f,
                     0.125f * p_txt, 0, 0, 0, env, false, false);

        // Kanban Board Base ("Planned | In Progress | Completed") — hero-sized matching Zelios styleframe!
        float p_kb = spring_pop(tl, 0.12f, 0.65f, 8.5f, 4.8f);
        draw_card_3d(fb, g_sprites["ui_kanban_board"],
                     0.51f, 0.68f, 0.04f,
                     0.52f * p_kb, 2.0f, 0.0f, 0.0f, env, true, false);

        // Movable Kanban Card: starts in "In Progress" (slot 3), lifts up in 3D, arcs over to "Completed" (slot 3)!
        float drag_u = ease_in_out_cubic((tl - 1.2f) / 1.8f);
        float lift = std::sin(drag_u * PI);
        float card_x = 0.51f + 0.265f * drag_u;
        float card_y = 0.74f - 0.06f * lift;
        float card_z = 0.02f - 0.18f * lift;
        float card_roll = -8.0f * std::sin(drag_u * PI * 2.0f);
        draw_card_3d(fb, g_sprites["ui_kanban_movable_card"],
                     card_x, card_y, card_z,
                     (0.082f + 0.010f * lift) * p_kb,
                     0.0f, 0.0f, card_roll, env, true, false);

        // 4 3D Customer Avatars popping in around the Kanban board (matching Zelios styleframe 1:1!)
        float pa1 = spring_pop(tl, 0.35f, 0.55f);
        float pa2 = spring_pop(tl, 0.50f, 0.55f);
        float pa3 = spring_pop(tl, 0.65f, 0.55f);
        float pa4 = spring_pop(tl, 0.80f, 0.55f);
        float b1 = 0.007f * std::sin(tl * 3.5f);
        // Top-left Adidas cap avatar overlapping board corner
        draw_card_3d(fb, g_sprites["av_adidas_cap"],
                     0.135f, 0.44f + b1, -0.06f, 0.125f * pa1, 0, 0, -4.0f, env, true, false);
        // Bottom-left Curly boy avatar + 2 small purple stars ✦✦
        draw_card_3d(fb, g_sprites["av_curly_boy"],
                     0.210f, 0.80f - b1, -0.06f, 0.105f * pa2, 0, 0, 3.0f, env, true, false);
        draw_star_4pt(fb, 0.182f, 0.71f, 0.016f*pa2, 0.016f*pa2, 0, violet_col, violet_col, false, 0.08f, env);
        draw_star_4pt(fb, 0.168f, 0.73f, 0.011f*pa2, 0.011f*pa2, 0, violet_col, violet_col, false, 0.08f, env);
        // Mid-right Glasses + Thumbs-Up avatar
        draw_card_3d(fb, g_sprites["av_glasses_thumb"],
                     0.805f, 0.56f + b1, -0.08f, 0.110f * pa3, 0, 0, -3.0f, env, true, false);
        // Bottom-right Winking Brunette avatar
        draw_card_3d(fb, g_sprites["av_brunette_wink"],
                     0.900f, 0.72f - b1, -0.08f, 0.120f * pa4, 0, 0, 5.0f, env, true, false);
    }

    // ========================================================================
    // SCENE 8 (41.8s - 48.5s): "Personalize with OpenGraph" + Theme Wipe + Privacy + 10 Colors
    // ========================================================================
    if (t >= 41.8f && t < 48.6f) {
        float tl = t - 42.0f;
        float env = smoothstep(41.8f, 42.2f, t) * (1.0f - smoothstep(48.1f, 48.5f, t));

        // Left Kinetic Typography: "Personalize / with OpenGraph" + 3 Pink 4-Point Stars ✦
        float p1 = spring_pop(tl, 0.08f, 0.55f);
        float p2 = spring_pop(tl, 0.20f, 0.55f);
        draw_card_3d(fb, g_sprites["txt_personalize_1"],
                     0.24f, 0.36f, 0.0f, 0.120f * p1, 0, 0, 0, env, false, false);
        draw_card_3d(fb, g_sprites["txt_personalize_2"],
                     0.24f, 0.49f, 0.0f, 0.120f * p2, 0, 0, 0, env, false, false);
        draw_star_4pt(fb, 0.465f, 0.42f, 0.028f*p2, 0.028f*p2, tl*30.0f, pink_glow, pink_glow, false, 0.08f, env);
        draw_star_4pt(fb, 0.495f, 0.38f, 0.016f*p2, 0.016f*p2, -tl*40.0f, white, pink_glow, true, 0.12f, env);
        draw_star_4pt(fb, 0.490f, 0.47f, 0.015f*p2, 0.015f*p2, tl*25.0f, pink_glow, pink_glow, false, 0.08f, env);

        // Right 3D Browser Card: Live Diagonal Neon Wipe from Light Theme to Dark Theme ("GoPlay")
        float p_br = spring_pop(tl, 0.25f, 0.65f);
        CardEffect fx_theme;
        fx_theme.theme_wipe = true;
        fx_theme.wipe_sprite = &g_sprites["ui_theme_dark"];
        fx_theme.wipe_progress = ease_in_out_cubic((tl - 0.9f) / 2.0f);

        draw_card_3d(fb, g_sprites["ui_theme_light"],
                     0.72f, 0.42f, 0.04f,
                     0.38f * p_br,
                     5.0f, -15.0f + 3.0f*std::sin(tl*0.9f), 1.5f, env, true, true, &fx_theme);

        // Pop-Over 3D Card: Board Privacy Shield ("feedback.yourdomain.io")
        if (tl > 2.4f) {
            float p_sh = spring_pop(tl, 2.45f, 0.60f);
            draw_card_3d(fb, g_sprites["ui_privacy_shield"],
                         0.56f, 0.56f, -0.12f,
                         0.29f * p_sh,
                         4.0f, 10.0f, -1.5f, env, true, true);
        }

        // Bottom Bar: Official 10 Zelios Brand Color Swatches rippling in a wave
        draw_color_palette_swatches(fb, 0.87f, std::max(0.0f, tl - 0.5f), env);
    }

    // ========================================================================
    // SCENE 9 (48.3s - 53.5s): "Announce product updates" — Product Changelog & Close Loop
    // ========================================================================
    if (t >= 48.3f && t < 53.6f) {
        float tl = t - 48.5f;
        float env = smoothstep(48.3f, 48.7f, t) * (1.0f - smoothstep(53.1f, 53.5f, t));

        float p_txt = spring_pop(tl, 0.05f, 0.55f);
        draw_card_3d(fb, g_sprites["txt_announce_updates"],
                     0.50f, 0.15f, 0.0f, 0.130f * p_txt, 0, 0, 0, env, false, false);

        // Main 3D Card: Product Changelog ("feedback.yourdomain.com/changelog")
        float p_ch = spring_pop(tl, 0.15f, 0.65f);
        float shift = ease_in_out_cubic((tl - 1.8f) / 1.2f);
        CardEffect fx_ch;
        fx_ch.highlight_pulse = (tl > 0.9f && tl < 2.5f);
        fx_ch.pulse_u = 0.70f; fx_ch.pulse_v = 0.52f;
        fx_ch.pulse_r = clampf((tl - 0.9f) * 0.18f, 0.0f, 0.24f);
        fx_ch.pulse_alpha = clampf(1.0f - (tl - 0.9f)*0.65f, 0.0f, 1.0f);

        draw_card_3d(fb, g_sprites["ui_changelog_main"],
                     0.50f - 0.13f * shift, 0.60f, 0.05f * shift,
                     0.46f * p_ch,
                     6.0f, 10.0f * shift, 0.0f, env, true, true, &fx_ch);

        // Related Posts Card ("Filter public roadmap by board / Related Posts") closing the loop!
        if (tl > 1.7f) {
            float p_rel = spring_pop(tl, 1.75f, 0.60f);
            draw_card_3d(fb, g_sprites["ui_related_posts"],
                         0.72f, 0.63f, -0.10f,
                         0.35f * p_rel,
                         4.0f, -14.0f, 1.0f, env, true, true);
        }

        draw_star_4pt(fb, 0.08f, 0.34f, 0.036f*p_ch, 0.036f*p_ch, tl*35.0f, teal_col, teal_col, false, 0.08f, env);
        draw_star_4pt(fb, 0.91f, 0.26f, 0.040f*p_ch, 0.040f*p_ch, -tl*30.0f, pink_glow, purple_glow, false, 0.08f, env);
    }

    // ========================================================================
    // SCENE 10 (53.3s - 57.0s): Finale — 3-Module Hero Lockup -> "⚡ Supahub" Brand Lockup
    // ========================================================================
    if (t >= 53.3f) {
        float tl = t - 53.4f;
        // Part A (53.3s - 55.0s): All 3 Modules ("CHANGELOG | FEEDBACK PORTAL | ROADMAP")
        if (t < 55.1f) {
            float env_a = smoothstep(53.3f, 53.65f, t) * (1.0f - smoothstep(54.65f, 55.05f, t));
            float p_m = spring_pop(tl, 0.05f, 0.55f);
            draw_card_3d(fb, g_sprites["ui_three_modules"],
                         0.50f, 0.54f, 0.0f,
                         0.48f * p_m,
                         4.0f * (1.0f - tl*0.4f), 0.0f, 0.0f, env_a, true, true);
            draw_star_4pt(fb, 0.09f, 0.66f, 0.042f*p_m, 0.042f*p_m, tl*40.0f, hex_rgb(0x787DFC), hex_rgb(0x787DFC), false, 0.08f, env_a);
            draw_star_4pt(fb, 0.90f, 0.26f, 0.044f*p_m, 0.044f*p_m, -tl*35.0f, pink_glow, pink_glow, false, 0.08f, env_a);
        }

        // Part B (54.7s - 57.0s): Iconic Zelios Finale — Light Lavender Canvas + 3D Blurred Stars + "⚡ Supahub"
        if (t >= 54.7f) {
            float tb = t - 54.8f;
            float env_b = smoothstep(54.7f, 55.1f, t);
            float p_logo = spring_pop(tb, 0.08f, 0.60f, 8.8f, 4.8f);

            // Large left 3D purple outline 4-point star (matching Zelios finale frame 1:1!)
            draw_star_4pt(fb, 0.17f, 0.44f, 0.18f * p_logo, 0.18f * p_logo,
                          -18.0f + tb * 5.0f, white, purple_glow, true, 0.085f, env_b * 0.90f);
            // Top-left pink bokeh 4-point star
            draw_star_4pt(fb, 0.125f, 0.21f, 0.032f * p_logo, 0.032f * p_logo,
                          tb * 25.0f, pink_glow, pink_glow, false, 0.08f, env_b * 0.70f);
            // Right mid-ground purple bokeh 4-point star
            draw_star_4pt(fb, 0.665f, 0.41f, 0.030f * p_logo, 0.030f * p_logo,
                          15.0f - tb * 20.0f, violet_col, purple_glow, false, 0.08f, env_b * 0.75f);

            // Center "⚡ Supahub" Wordmark + Tagline
            draw_card_3d(fb, g_sprites["logo_supahub_finale"],
                         0.50f, 0.56f, 0.0f,
                         0.215f * p_logo,
                         0.0f, 0.0f, 0.0f, env_b, false, false);
        }
    }
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
