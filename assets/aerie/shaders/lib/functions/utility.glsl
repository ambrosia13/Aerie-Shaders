// Canvas utility stuff
vec3 getSunVector() {
    return frx_worldIsMoonlit == 0 ? frx_skyLightVector : -frx_skyLightVector;
}
vec3 getMoonVector() {
    return frx_worldIsMoonlit == 1 ? frx_skyLightVector : -frx_skyLightVector;
}
vec3 getTimeOfDayFactors() {
    float nightFactor = frx_worldIsMoonlit == 1.0 ? 1.0 : 0.0;
    nightFactor *= frx_skyLightTransitionFactor;
    float dayFactor = frx_worldIsMoonlit == 0.0 ? 1.0 : 0.0;
    dayFactor *= frx_skyLightTransitionFactor;
    float sunsetFactor = 1.0 - frx_skyLightTransitionFactor;

    return vec3(dayFactor, nightFactor, sunsetFactor);
}
float getWorldTime() {
    return frx_worldTime * 24000.0 + frx_worldDay * 24000.0;
}

// Space conversions
// Scene space: Position centered on the camera, axes are world-aligned
// View space: Also called camera and eye space, axes are view-aligned (Z points out from camera)
vec3 setupSceneSpacePos(in vec2 texcoord, in float depth) {
    vec3 screenSpacePos = vec3(texcoord, depth);
    vec3 clipSpacePos = screenSpacePos * 2.0 - 1.0;
    vec4 temp = frx_inverseViewProjectionMatrix * vec4(clipSpacePos, 1.0);
    return temp.xyz / temp.w;
}
vec3 sceneSpaceToScreenSpace(in vec3 sceneSpacePos) {
    vec4 temp = frx_viewProjectionMatrix * vec4(sceneSpacePos, 1.0);
    return (temp.xyz / temp.w) * 0.5 + 0.5;
}
vec3 setupViewSpacePos(in vec2 texcoord, in float depth) {
    vec3 screenSpacePos = vec3(texcoord, depth);
    vec3 clipSpacePos = screenSpacePos * 2.0 - 1.0;
    vec4 temp = frx_inverseProjectionMatrix * vec4(clipSpacePos, 1.0);
    return temp.xyz / temp.w;
}
vec3 viewSpaceToScreenSpace(in vec3 viewSpacePos) {
    vec4 temp = frx_projectionMatrix * vec4(viewSpacePos, 1.0);
    return (temp.xyz / temp.w) * 0.5 + 0.5;
}
vec3 setupCleanSceneSpacePos(in vec2 texcoord, in float depth) {
    vec3 screenSpacePos = vec3(texcoord, depth);
    vec3 clipSpacePos = screenSpacePos * 2.0 - 1.0;
    vec4 temp = frx_inverseCleanViewProjectionMatrix * vec4(clipSpacePos, 1.0);
    return temp.xyz / temp.w;
}
vec3 cleanSceneSpaceToScreenSpace(in vec3 sceneSpacePos) {
    vec4 temp = frx_cleanViewProjectionMatrix * vec4(sceneSpacePos, 1.0);
    return (temp.xyz / temp.w) * 0.5 + 0.5;
}
vec3 setupLastFrameSceneSpacePos(in vec2 texcoord, in float depth) {
    vec3 screenSpacePos = vec3(texcoord, depth);
    vec3 clipSpacePos = screenSpacePos * 2.0 - 1.0;
    vec4 temp = (frx_lastViewProjectionMatrix) * vec4(clipSpacePos, 1.0);
    return temp.xyz / temp.w;
}
vec3 lastFrameSceneSpaceToScreenSpace(in vec3 sceneSpacePos) {
    vec4 temp = frx_lastViewProjectionMatrix * vec4(sceneSpacePos, 1.0);
    return (temp.xyz / temp.w) * 0.5 + 0.5;
}
vec3 sceneSpaceToViewSpace(in vec3 sceneSpacePos) {
    vec3 screenPos = sceneSpaceToScreenSpace(sceneSpacePos);
    return setupViewSpacePos(screenPos.xy, screenPos.z);
}

float clamp01(in float x) {
    return clamp(x, 0.0, 1.0);
}
vec2 clamp01(in vec2 x) {
    return clamp(x, vec2(0.0), vec2(1.0));
}
vec3 clamp01(in vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}
vec4 clamp01(in vec4 x) {
    return clamp(x, vec4(0.0), vec4(1.0));
}

// Angle should be in radians
vec2 rotate2D(vec2 uv, float angle) {
	float s = sin(angle);
	float c = cos(angle);
	mat2 mat = mat2(c, s, -s, c);
	return mat * uv;
}

// 1D, 2D, and 3D white noise. Not good for advanced use, just included as an example.
// 3D noise is usually needed for things like ray tracing, and 1D for things like dithering.
// For proper use I'd recommend looking into the following
// - hash without sine (https://www.shadertoy.com/view/4djSRW)
// - gold noise (https://www.shadertoy.com/view/ltB3zD)
// - pcg noise (https://www.pcg-random.org/)
// - blue noise
// - interleaved gradient noise (for dithering, works well with TAA)
float rand1D(vec2 st) {
    return frx_noise2d(st) * 2.0 - 1.0;
}
vec2 rand2D(vec2 st) {
    vec2 n = vec2(
        frx_noise2d(st + 50.0),
        frx_noise2d(st - 50.0)
    );

    return normalize(n * 2.0 - 1.0);
}
vec3 rand3D(vec2 st) {
    vec3 n = vec3(
        frx_noise2d(st),
        frx_noise2d(st - 100.0),
        frx_noise2d(st + 100.0)
    );

    return normalize(n * 2.0 - 1.0);
}

// Schlick fresnel approximation
vec3 getReflectance(in vec3 f0, in float NdotV) {
    NdotV = clamp01(NdotV);
    return f0 + (1.0 - f0) * pow((1.0 - NdotV), 5.0);
}

// Smooth noise function
float smoothHash(in vec2 st) {
	vec2 p = floor(st);
	vec2 f = fract(st);
		
	float n = p.x + p.y*57.0;

	float a =  frx_noise2d(vec2(n + 0.0)) * 2.0 - 1.0;
	float b =  frx_noise2d(vec2(n + 1.0)) * 2.0 - 1.0;
	float c = frx_noise2d(vec2(n + 57.0)) * 2.0 - 1.0;
	float d = frx_noise2d(vec2(n + 58.0)) * 2.0 - 1.0;
	
	vec2 f2 = f * f;
	vec2 f3 = f2 * f;
	
	vec2 t = 3.0 * f2 - 2.0 * f3;
	
	float u = t.x;
	float v = t.y;

	float noise = a + (b - a) * u +(c - a) * v + (a - b + d - c) * u * v;

    return noise;
}

// FBM Hash noise
float fbmHash(vec2 uv, int octaves) {
	float noise = 0.01;
	float amp = 0.5;

    mat2 rotationMatrix = mat2(cos(PI / 6.0), sin(PI / 6.0), -sin(PI / 6.0), cos(PI / 6.0));

	for (int i = 0; i < octaves; i++) {
		noise += amp * (smoothHash(uv) * 0.5 + 0.51);
		uv = rotationMatrix * uv * 2.0 + mod(frx_renderSeconds / 10.0, 1000.0);
		amp *= 0.5;
	}

    return noise;
}
// FBM Hash noise that accepts a time parameter
float fbmHash(vec2 uv, int octaves, float t) {
	float noise = 0.01;
	float amp = 0.5;

    mat2 rotationMatrix = mat2(cos(PI / 6.0), sin(PI / 6.0), -sin(PI / 6.0), cos(PI / 6.0));

	for (int i = 0; i < octaves; i++) {
		noise += amp * (smoothHash(uv) * 0.5 + 0.51);
		uv = rotationMatrix * uv * 2.0 + mod(frx_renderSeconds * t, 1000.0);
		amp *= 0.5;
	}

    return noise;
}