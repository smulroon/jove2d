/**
 * Thin C wrapper around libshaderc for bun:ffi.
 * Compiles GLSL to SPIR-V via shaderc's C API.
 *
 * API:
 *   jove_shaderc_init()                          → void
 *   jove_shaderc_quit()                          → void
 *   jove_shaderc_compile(source, len, kind)      → 1 on success, 0 on error
 *   jove_shaderc_get_bytes()                     → pointer to SPIR-V bytes
 *   jove_shaderc_get_length()                    → SPIR-V byte count
 *   jove_shaderc_get_error()                     → error string (or "")
 */

#include <shaderc/shaderc.h>
#include <stdint.h>

static shaderc_compiler_t g_compiler = NULL;
static shaderc_compilation_result_t g_result = NULL;

/** Initialize the shaderc compiler. Safe to call multiple times. */
void jove_shaderc_init(void) {
    if (!g_compiler) {
        g_compiler = shaderc_compiler_initialize();
    }
}

/** Release the shaderc compiler and any pending result. */
void jove_shaderc_quit(void) {
    if (g_result) {
        shaderc_result_release(g_result);
        g_result = NULL;
    }
    if (g_compiler) {
        shaderc_compiler_release(g_compiler);
        g_compiler = NULL;
    }
}

/**
 * Compile GLSL source to SPIR-V.
 * @param source  GLSL source text
 * @param len     Length in bytes (0 = use strlen)
 * @param kind    0 = fragment, 1 = vertex
 * @return        1 on success, 0 on error
 */
int jove_shaderc_compile(const char *source, int len, int kind) {
    if (!g_compiler) return 0;

    /* Release previous result */
    if (g_result) {
        shaderc_result_release(g_result);
        g_result = NULL;
    }

    shaderc_shader_kind sk = (kind == 1)
        ? shaderc_vertex_shader
        : shaderc_fragment_shader;

    size_t source_len = (len > 0) ? (size_t)len : 0;
    /* len=0 means use strlen */
    if (source_len == 0) {
        const char *p = source;
        while (*p) { p++; source_len++; }
    }

    shaderc_compile_options_t opts = shaderc_compile_options_initialize();
    shaderc_compile_options_set_target_env(opts,
        shaderc_target_env_vulkan, shaderc_env_version_vulkan_1_0);

    g_result = shaderc_compile_into_spv(
        g_compiler, source, source_len,
        sk, "shader.glsl", "main", opts
    );

    shaderc_compile_options_release(opts);

    return (shaderc_result_get_compilation_status(g_result)
            == shaderc_compilation_status_success) ? 1 : 0;
}

/** Return pointer to compiled SPIR-V bytes (valid until next compile). */
const char *jove_shaderc_get_bytes(void) {
    if (!g_result) return NULL;
    return shaderc_result_get_bytes(g_result);
}

/** Return length of compiled SPIR-V in bytes. */
int jove_shaderc_get_length(void) {
    if (!g_result) return 0;
    return (int)shaderc_result_get_length(g_result);
}

/** Return error/warning message (empty string if none). */
const char *jove_shaderc_get_error(void) {
    if (!g_result) return "";
    const char *msg = shaderc_result_get_error_message(g_result);
    return msg ? msg : "";
}
