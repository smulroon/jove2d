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
