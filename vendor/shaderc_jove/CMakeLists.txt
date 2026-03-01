cmake_minimum_required(VERSION 3.16)
project(shaderc_jove C CXX)

# Shaderc build paths (set by build script)
set(SHADERC_SOURCE_DIR "" CACHE PATH "Shaderc source directory")
set(SHADERC_BUILD_DIR "" CACHE PATH "Shaderc build directory")

# Export all symbols for DLL builds
set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)

add_library(shaderc_jove SHARED shaderc_jove.c)
target_include_directories(shaderc_jove PRIVATE ${SHADERC_SOURCE_DIR}/libshaderc/include)

target_link_libraries(shaderc_jove PRIVATE
    ${SHADERC_BUILD_DIR}/libshaderc/libshaderc_combined.a
    pthread
)

# Statically link libstdc++ and libgcc so the .so/.dll is self-contained
target_link_options(shaderc_jove PRIVATE
    -static-libstdc++ -static-libgcc
)

set_target_properties(shaderc_jove PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    C_STANDARD 11
)
