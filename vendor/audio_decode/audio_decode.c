/**
 * Thin C wrapper around stb_vorbis + dr_mp3 + dr_flac for bun:ffi.
 * Decodes audio files to interleaved S16 PCM.
 *
 * API:
 *   jove_audio_decode(path, &samples, &channels, &sample_rate) → sample_count
 *   jove_audio_free(samples)
 */

#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#ifdef _WIN32
#define strcasecmp _stricmp
#endif

#define DR_MP3_IMPLEMENTATION
#include "dr_mp3.h"

#define DR_FLAC_IMPLEMENTATION
#include "dr_flac.h"

/* stb_vorbis decodes to S16 natively */
#include "stb_vorbis.c"

/**
 * Decode an audio file to interleaved S16 PCM.
 * Format detected by file extension (.ogg, .mp3, .flac).
 *
 * @param path       File path (null-terminated)
 * @param out_data   Receives malloc'd S16 buffer (caller frees via jove_audio_free)
 * @param out_ch     Receives channel count
 * @param out_rate   Receives sample rate
 * @return           Total number of sample frames (0 on error)
 */
int64_t jove_audio_decode(
    const char *path,
    int16_t **out_data,
    int *out_ch,
    int *out_rate
) {
    *out_data = NULL;
    *out_ch = 0;
    *out_rate = 0;

    /* Detect format by extension */
    const char *ext = strrchr(path, '.');
    if (!ext) return 0;

    if (strcasecmp(ext, ".ogg") == 0) {
        int channels, sample_rate;
        short *samples;
        int num_frames = stb_vorbis_decode_filename(path, &channels, &sample_rate, &samples);
        if (num_frames <= 0) return 0;
        *out_data = samples;
        *out_ch = channels;
        *out_rate = sample_rate;
        return (int64_t)num_frames;
    }

    if (strcasecmp(ext, ".mp3") == 0) {
        drmp3_config cfg;
        drmp3_uint64 total_frames;
        drmp3_int16 *samples = drmp3_open_file_and_read_pcm_frames_s16(
            path, &cfg, &total_frames, NULL
        );
        if (!samples) return 0;
        *out_data = samples;
        *out_ch = (int)cfg.channels;
        *out_rate = (int)cfg.sampleRate;
        return (int64_t)total_frames;
    }

    if (strcasecmp(ext, ".flac") == 0) {
        unsigned int channels, sample_rate;
        drflac_uint64 total_frames;
        drflac_int16 *samples = drflac_open_file_and_read_pcm_frames_s16(
            path, &channels, &sample_rate, &total_frames, NULL
        );
        if (!samples) return 0;
        *out_data = samples;
        *out_ch = (int)channels;
        *out_rate = (int)sample_rate;
        return (int64_t)total_frames;
    }

    return 0;
}

/** Free a buffer returned by jove_audio_decode. */
void jove_audio_free(int16_t *data) {
    free(data);
}

/* ============================================================
 * Streaming Decoder API
 * Handle-table pattern (same as pl_mpeg_jove.c)
 * ============================================================ */

#define MAX_DECODERS 32
#define DECODER_READ_BUF_FRAMES 8192

typedef struct {
    int type;          /* 0=none, 1=ogg, 2=mp3, 3=flac */
    int channels;
    int sample_rate;
    int64_t total_frames;
    int64_t position;  /* current frame position for tell() */
    union {
        stb_vorbis *vorbis;
        drmp3       mp3;
        drflac     *flac;
    };
} Decoder;

static Decoder g_decoders[MAX_DECODERS];
/* Shared C-side read buffer — max 8192 stereo frames = 32768 samples */
static int16_t g_read_buf[DECODER_READ_BUF_FRAMES * 2];

/**
 * Open a streaming decoder for the given audio file.
 * Returns handle index (0..MAX_DECODERS-1), or -1 on error.
 */
int jove_decoder_open(const char *path) {
    /* Find free slot */
    int idx = -1;
    for (int i = 0; i < MAX_DECODERS; i++) {
        if (g_decoders[i].type == 0) { idx = i; break; }
    }
    if (idx < 0) return -1;

    const char *ext = strrchr(path, '.');
    if (!ext) return -1;

    Decoder *d = &g_decoders[idx];
    memset(d, 0, sizeof(Decoder));

    if (strcasecmp(ext, ".ogg") == 0) {
        int error;
        stb_vorbis *v = stb_vorbis_open_filename(path, &error, NULL);
        if (!v) return -1;
        stb_vorbis_info info = stb_vorbis_get_info(v);
        d->type = 1;
        d->vorbis = v;
        d->channels = info.channels;
        d->sample_rate = info.sample_rate;
        d->total_frames = (int64_t)stb_vorbis_stream_length_in_samples(v);
        d->position = 0;
        return idx;
    }

    if (strcasecmp(ext, ".mp3") == 0) {
        if (!drmp3_init_file(&d->mp3, path, NULL)) return -1;
        d->type = 2;
        d->channels = (int)d->mp3.channels;
        d->sample_rate = (int)d->mp3.sampleRate;
        d->total_frames = (int64_t)drmp3_get_pcm_frame_count(&d->mp3);
        d->position = 0;
        return idx;
    }

    if (strcasecmp(ext, ".flac") == 0) {
        drflac *f = drflac_open_file(path, NULL);
        if (!f) return -1;
        d->type = 3;
        d->flac = f;
        d->channels = (int)f->channels;
        d->sample_rate = (int)f->sampleRate;
        d->total_frames = (int64_t)f->totalPCMFrameCount;
        d->position = 0;
        return idx;
    }

    return -1;
}

/** Close a streaming decoder and free its slot. */
void jove_decoder_close(int idx) {
    if (idx < 0 || idx >= MAX_DECODERS) return;
    Decoder *d = &g_decoders[idx];
    switch (d->type) {
        case 1: stb_vorbis_close(d->vorbis); break;
        case 2: drmp3_uninit(&d->mp3); break;
        case 3: drflac_close(d->flac); break;
    }
    d->type = 0;
}

/**
 * Read up to max_frames of interleaved S16 PCM into the shared buffer.
 * Returns number of frames actually read (0 = EOF).
 * max_frames is clamped to DECODER_READ_BUF_FRAMES / channels.
 */
int64_t jove_decoder_read(int idx, int max_frames) {
    if (idx < 0 || idx >= MAX_DECODERS) return 0;
    Decoder *d = &g_decoders[idx];
    if (d->type == 0) return 0;

    /* Clamp to buffer capacity */
    int buf_max = DECODER_READ_BUF_FRAMES * 2 / d->channels;
    if (max_frames > buf_max) max_frames = buf_max;
    if (max_frames <= 0) return 0;

    int64_t frames_read = 0;

    switch (d->type) {
        case 1: /* OGG/Vorbis */
            frames_read = (int64_t)stb_vorbis_get_samples_short_interleaved(
                d->vorbis, d->channels, g_read_buf, max_frames * d->channels
            );
            break;
        case 2: /* MP3 */
            frames_read = (int64_t)drmp3_read_pcm_frames_s16(
                &d->mp3, (drmp3_uint64)max_frames, g_read_buf
            );
            break;
        case 3: /* FLAC */
            frames_read = (int64_t)drflac_read_pcm_frames_s16(
                d->flac, (drflac_uint64)max_frames, g_read_buf
            );
            break;
    }

    d->position += frames_read;
    return frames_read;
}

/** Seek to a PCM frame offset. */
void jove_decoder_seek(int idx, int64_t frame) {
    if (idx < 0 || idx >= MAX_DECODERS) return;
    Decoder *d = &g_decoders[idx];
    if (frame < 0) frame = 0;

    switch (d->type) {
        case 1:
            stb_vorbis_seek(d->vorbis, (unsigned int)frame);
            d->position = frame;
            break;
        case 2:
            drmp3_seek_to_pcm_frame(&d->mp3, (drmp3_uint64)frame);
            d->position = frame;
            break;
        case 3:
            drflac_seek_to_pcm_frame(d->flac, (drflac_uint64)frame);
            d->position = frame;
            break;
    }
}

/** Get decoder metadata: channels, sample rate, total frames. */
void jove_decoder_get_info(int idx, int *out_ch, int *out_rate, int64_t *out_total) {
    if (idx < 0 || idx >= MAX_DECODERS) {
        *out_ch = 0; *out_rate = 0; *out_total = 0;
        return;
    }
    Decoder *d = &g_decoders[idx];
    *out_ch = d->channels;
    *out_rate = d->sample_rate;
    *out_total = d->total_frames;
}

/** Get the current frame position. */
int64_t jove_decoder_tell(int idx) {
    if (idx < 0 || idx >= MAX_DECODERS) return 0;
    return g_decoders[idx].position;
}

/** Return pointer to the shared read buffer (avoids ptr() Windows bug). */
int16_t* jove_decoder_get_buf(void) {
    return g_read_buf;
}
