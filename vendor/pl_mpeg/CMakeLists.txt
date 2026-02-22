cmake_minimum_required(VERSION 3.16)
project(pl_mpeg_jove C)

set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)

add_library(pl_mpeg_jove SHARED pl_mpeg_jove.c)

if(NOT WIN32)
  target_link_libraries(pl_mpeg_jove PRIVATE m)
endif()

set_target_properties(pl_mpeg_jove PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    C_STANDARD 11
)
