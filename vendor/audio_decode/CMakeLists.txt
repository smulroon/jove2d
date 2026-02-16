cmake_minimum_required(VERSION 3.16)
project(audio_decode C)

add_library(audio_decode SHARED audio_decode.c)
target_link_libraries(audio_decode PRIVATE m)
set_target_properties(audio_decode PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    C_STANDARD 11
)
