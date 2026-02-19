cmake_minimum_required(VERSION 3.16)
project(audio_decode C)

# Export all symbols for DLL builds
set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)

add_library(audio_decode SHARED audio_decode.c)

if(WIN32)
  # No -lm needed on Windows (math functions are in msvcrt)
else()
  target_link_libraries(audio_decode PRIVATE m)
endif()

set_target_properties(audio_decode PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    C_STANDARD 11
)
