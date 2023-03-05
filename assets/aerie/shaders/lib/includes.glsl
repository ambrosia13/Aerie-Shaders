// --------------------------------------------------------------------------------------------------------
// #include aerie:shaders/lib/includes.glsl 
// --------------------------------------------------------------------------------------------------------

// Header to all shader files

uniform ivec2 frxu_size;
uniform int frxu_lod;

// Offsets from Chocapic13 shaders
vec2 taaOffsets[8] = vec2[8](
    vec2( 0.125,-0.375),
    vec2(-0.125, 0.375),
    vec2( 0.625, 0.125),
    vec2( 0.375,-0.625),
    vec2(-0.625, 0.625),
    vec2(-0.875,-0.125),
    vec2( 0.375,-0.875),
    vec2( 0.875, 0.875)
);

#include aerie:general
#include aerie:lighting
#include aerie:normals
#include aerie:bloom

#include aerie:shaders/lib/api_includes.glsl 
#include aerie:shaders/lib/functions/external.glsl
#include aerie:shaders/lib/functions/utility.glsl
