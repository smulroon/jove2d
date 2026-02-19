cmake_minimum_required(VERSION 3.16)
project(box2d_jove C)

# Find Box2D static lib (built separately)
set(BOX2D_BUILD_DIR "" CACHE PATH "Box2D build directory")
set(BOX2D_SOURCE_DIR "" CACHE PATH "Box2D source directory")

# Export all symbols for DLL builds
set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)

add_library(box2d_jove SHARED box2d_jove.c)
target_include_directories(box2d_jove PRIVATE ${BOX2D_SOURCE_DIR}/include)

if(WIN32)
  target_link_libraries(box2d_jove PRIVATE
      ${BOX2D_BUILD_DIR}/src/libbox2d.a
  )
else()
  target_link_libraries(box2d_jove PRIVATE
      ${BOX2D_BUILD_DIR}/src/libbox2d.a
      m
  )
endif()

set_target_properties(box2d_jove PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    C_STANDARD 17
)
