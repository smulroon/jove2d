/*
 * pl_mpeg_jove.c — Thin C wrapper around pl_mpeg for bun:ffi compatibility.
 *
 * Manages plm_t instances as int-indexed handles (avoids BigInt issues).
 * Stores decoded RGBA pixels and S16 audio in C-side buffers.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define PL_MPEG_IMPLEMENTATION
#include "pl_mpeg.h"

#define MAX_VIDEOS 16
/* Audio accumulation buffer: 32 MP2 frames × 1152 samples × 2 channels × 2 bytes */
#define AUDIO_BUF_SIZE (1152 * 2 * 2 * 32)

typedef struct {
    plm_t *plm;
    uint8_t *rgba_buf;       /* malloc'd, width * height * 4 */
    int width, height;
    int playing;
    int has_audio;
    /* Audio accumulation buffer (reset each update) */
    uint8_t audio_buf[AUDIO_BUF_SIZE];
    int audio_buf_len;
} VideoSlot;

static VideoSlot g_videos[MAX_VIDEOS];
static int g_inited = 0;

static void _init_slots(void) {
    if (g_inited) return;
    memset(g_videos, 0, sizeof(g_videos));
    g_inited = 1;
}

static int _alloc_slot(void) {
    _init_slots();
    for (int i = 0; i < MAX_VIDEOS; i++) {
        if (!g_videos[i].plm) return i;
    }
    return -1;
}

/* Audio decode callback: converts float interleaved → S16 PCM, accumulates */
static void _audio_cb(plm_t *plm, plm_samples_t *samples, void *user) {
    VideoSlot *slot = (VideoSlot *)user;
    int num_floats = samples->count * 2; /* stereo interleaved */
    int byte_count = num_floats * 2;     /* S16 = 2 bytes per sample */

    if (slot->audio_buf_len + byte_count > AUDIO_BUF_SIZE) return; /* overflow guard */

    int16_t *dst = (int16_t *)(slot->audio_buf + slot->audio_buf_len);
    for (int i = 0; i < num_floats; i++) {
        float f = samples->interleaved[i];
        if (f > 1.0f) f = 1.0f;
        if (f < -1.0f) f = -1.0f;
        dst[i] = (int16_t)(f * 32767.0f);
    }
    slot->audio_buf_len += byte_count;
}

/* Video decode callback: converts YCbCr → RGBA into slot's pixel buffer.
 * plm_frame_to_rgba outputs bytes [R, G, B, _] where _ is untouched (0xFF
 * from memset = alpha). JS side wraps this in an SDL_Surface with the
 * matching pixel format and uses SDL_CreateTextureFromSurface for automatic
 * format conversion to the GPU's native format. */
static void _video_cb(plm_t *plm, plm_frame_t *frame, void *user) {
    VideoSlot *slot = (VideoSlot *)user;
    if (slot->rgba_buf) {
        plm_frame_to_rgba(frame, slot->rgba_buf, slot->width * 4);
    }
}

/* ── Lifecycle ── */

int jove_video_open(const char *path, int decode_audio) {
    int idx = _alloc_slot();
    if (idx < 0) return -1;

    VideoSlot *slot = &g_videos[idx];
    slot->plm = plm_create_with_filename(path);
    if (!slot->plm) return -1;

    slot->width = plm_get_width(slot->plm);
    slot->height = plm_get_height(slot->plm);
    slot->playing = 0;
    slot->audio_buf_len = 0;

    /* Allocate RGBA pixel buffer */
    slot->rgba_buf = (uint8_t *)malloc(slot->width * slot->height * 4);
    if (!slot->rgba_buf) {
        plm_destroy(slot->plm);
        slot->plm = NULL;
        return -1;
    }
    memset(slot->rgba_buf, 255, slot->width * slot->height * 4);

    /* Set up video callback */
    plm_set_video_decode_callback(slot->plm, _video_cb, slot);

    /* Set up audio */
    slot->has_audio = decode_audio && plm_get_num_audio_streams(slot->plm) > 0;
    if (slot->has_audio) {
        plm_set_audio_enabled(slot->plm, 1);
        plm_set_audio_stream(slot->plm, 0);
        plm_set_audio_decode_callback(slot->plm, _audio_cb, slot);
        plm_set_audio_lead_time(slot->plm, 0.2);
    } else {
        plm_set_audio_enabled(slot->plm, 0);
    }

    return idx;
}

void jove_video_close(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS) return;
    VideoSlot *slot = &g_videos[idx];
    if (!slot->plm) return;
    plm_destroy(slot->plm);
    free(slot->rgba_buf);
    memset(slot, 0, sizeof(VideoSlot));
}

/* ── Properties ── */

int jove_video_get_width(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    return g_videos[idx].width;
}

int jove_video_get_height(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    return g_videos[idx].height;
}

float jove_video_get_duration(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0.0f;
    return (float)plm_get_duration(g_videos[idx].plm);
}

float jove_video_get_framerate(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0.0f;
    return (float)plm_get_framerate(g_videos[idx].plm);
}

int jove_video_has_audio(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    return g_videos[idx].has_audio;
}

int jove_video_get_samplerate(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    return plm_get_samplerate(g_videos[idx].plm);
}

/* ── Playback control ── */

void jove_video_play(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return;
    g_videos[idx].playing = 1;
}

void jove_video_pause(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return;
    g_videos[idx].playing = 0;
}

void jove_video_stop(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return;
    g_videos[idx].playing = 0;
    plm_rewind(g_videos[idx].plm);
    g_videos[idx].audio_buf_len = 0;
}

int jove_video_is_playing(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    return g_videos[idx].playing;
}

int jove_video_has_ended(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 1;
    return plm_has_ended(g_videos[idx].plm);
}

void jove_video_set_looping(int idx, int loop) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return;
    plm_set_loop(g_videos[idx].plm, loop);
}

int jove_video_is_looping(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    return plm_get_loop(g_videos[idx].plm);
}

/* ── Timing ── */

float jove_video_tell(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0.0f;
    return (float)plm_get_time(g_videos[idx].plm);
}

void jove_video_seek(int idx, float t) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return;
    plm_seek(g_videos[idx].plm, (double)t, 0);
    g_videos[idx].audio_buf_len = 0;
}

/* ── Per-frame update ── */

int jove_video_update(int idx, float dt) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    VideoSlot *slot = &g_videos[idx];
    if (!slot->playing) return 0;

    /* Reset audio accumulation buffer */
    slot->audio_buf_len = 0;

    double prev_time = plm_get_time(slot->plm);
    plm_decode(slot->plm, (double)dt);
    double new_time = plm_get_time(slot->plm);

    /* Auto-stop on end (if not looping) */
    if (plm_has_ended(slot->plm) && !plm_get_loop(slot->plm)) {
        slot->playing = 0;
    }

    /* Return 1 if time advanced (meaning a new frame was decoded) */
    return new_time != prev_time ? 1 : 0;
}

/* ── Data access ── */

void *jove_video_get_pixels(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return NULL;
    return g_videos[idx].rgba_buf;
}

int jove_video_get_audio_size(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return 0;
    return g_videos[idx].audio_buf_len;
}

void *jove_video_get_audio_ptr(int idx) {
    if (idx < 0 || idx >= MAX_VIDEOS || !g_videos[idx].plm) return NULL;
    return g_videos[idx].audio_buf;
}
