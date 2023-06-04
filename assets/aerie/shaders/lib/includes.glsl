// --------------------------------------------------------------------------------------------------------
// #include aerie:shaders/lib/includes.glsl 
// --------------------------------------------------------------------------------------------------------

// Header to all shader files

uniform ivec2 frxu_size;
uniform int frxu_lod;

vec2 taaOffsets[8] = vec2[8](
	vec2(-0.75, 0.25) * 0.75,
	vec2( 0.25, 0.75) * 0.75,
	vec2( 0.75,-0.25) * 0.75,
	vec2(-0.25,-0.75) * 0.75,
	vec2(-0.25, 0.75) * 0.75,
	vec2( 0.75, 0.25) * 0.75,
	vec2( 0.25,-0.75) * 0.75,
	vec2(-0.75,-0.25) * 0.75
);

#include aerie:general
#include aerie:lighting
#include aerie:clouds
#include aerie:normals
#include aerie:bloom
#include aerie:shadows

#include aerie:shaders/lib/api_includes.glsl
#include aerie:shaders/lib/functions/ext.glsl
#include aerie:shaders/lib/functions/utility.glsl

#ifdef CUSTOM_CLOUDS
#include aerie:shaders/lib/functions/clouds.glsl
#endif
