// --------------------------------------------------------------------------------------------------------
// Interleaved Gradient Noise with better precision
// From LowellCamp#8190
// Slightly modified
// --------------------------------------------------------------------------------------------------------
#ifndef VERTEX_SHADER
const ivec2 interleave_vec = ivec2(1125928, 97931);
const float interleaved_z = 52.9829189;
const float fixed2float = 1.0 / exp2(24.0);
const int ref_fixed_point = int(exp2(24.0));

float interleaved_gradient(ivec2 seed, int t) {
	ivec2 components = ivec2(seed + 5.588238 * t) * interleave_vec;
	int internal_modulus = (components.x + components.y) & (ref_fixed_point - 1);
	return fract(float(internal_modulus) * (fixed2float * interleaved_z));
}

float interleaved_gradient() {
	ivec2 seed = ivec2(gl_FragCoord.xy);
	int t = int(frx_renderFrames % 100u);
	ivec2 components = ivec2(seed + 5.588238 * t) * interleave_vec;
	int internal_modulus = (components.x + components.y) & (ref_fixed_point - 1);
	return fract(float(internal_modulus) * (fixed2float * interleaved_z));
}

// accepts offset parameter
float interleaved_gradient(int offset) {
	ivec2 seed = ivec2(gl_FragCoord.xy) + offset;
	int t = int(frx_renderFrames % 100u);
	ivec2 components = ivec2(seed + 5.588238 * t) * interleave_vec;
	int internal_modulus = (components.x + components.y) & (ref_fixed_point - 1);
	return fract(float(internal_modulus) * (fixed2float * interleaved_z));
}
#endif
// --------------------------------------------------------------------------------------------------------

// --------------------------------------------------------------------------------------------------------
// From lumi lights by spiralhalo
// --------------------------------------------------------------------------------------------------------
float linearizeDepth(float depth) {
	float nearZ = 0.0001 * (32. * 16.) / frx_viewDistance;
	const float farZ = 1.0;
	return 2.0 * (nearZ * farZ) / (farZ + nearZ - (depth * 2.0 - 1.0) * (farZ - nearZ));
}
// --------------------------------------------------------------------------------------------------------

// Credit goes to Belmu#4066 for helping me solve my shadow sampling issues through the following two functions.
vec2 sincos(float x) {
	return vec2(sin(x), cos(x));
}
vec2 diskSampling(float i, float n, float phi) {
	float theta = (i + phi) / n; 
	return sincos(theta * TAU * n * 1.618033988749894) * theta;
}