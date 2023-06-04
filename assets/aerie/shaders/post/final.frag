#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_color;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

vec3 reinhard(in vec3 color) {
	return color / (color + 1.0);
}

vec3 tonemap(in vec3 color) {
	//return clamp01(color);
	return pow(reinhard(pow(color, vec3(3.1))), vec3(1.0 / 3.1));
}

// Contrast Adaptive Sharpening (CAS)
// Reference: Lou Kramer, FidelityFX CAS, AMD Developer Day 2019,
// https://gpuopen.com/wp-content/uploads/2019/07/FidelityFX-CAS.pptx
// 
// Implementation from https://www.shadertoy.com/view/wtlSWB, slightly modified
vec3 contrastAdaptiveSharpening(sampler2D tex, ivec2 texcoord, float sharpnessKnob) {
	vec3 a = tonemap(texelFetch(tex, texcoord + ivec2(0.0, -1.0), 0).rgb);
	vec3 b = tonemap(texelFetch(tex, texcoord + ivec2(-1.0, 0.0), 0).rgb);
	vec3 c = tonemap(texelFetch(tex, texcoord + ivec2(0.0, 0.0), 0).rgb);
	vec3 d = tonemap(texelFetch(tex, texcoord + ivec2(1.0, 0.0), 0).rgb);
	vec3 e = tonemap(texelFetch(tex, texcoord + ivec2(0.0, 1.0), 0).rgb);

	float aLum = frx_luminance(a);
	float bLum = frx_luminance(b);
	float cLum = frx_luminance(c);
	float dLum = frx_luminance(d);
	float eLum = frx_luminance(e);

	float minLuminance = min(aLum, min(bLum, min(cLum, min(dLum, eLum))));
	float maxLuminance = max(aLum, max(bLum, max(cLum, max(dLum, eLum))));
	float sharpeningAmount = sqrt(min(1.0 - maxLuminance, minLuminance) / maxLuminance);
	float w = sharpeningAmount * mix(-0.125, -0.2, sharpnessKnob);

	return (w * (a + b + d + e) + c) / (4.0 * w + 1.0);
}

void main() {
	vec3 color = contrastAdaptiveSharpening(u_color, ivec2(gl_FragCoord.xy), 0.5);

	#ifdef CHROMATIC_ABBERATION
		color.r = texture(u_color, texcoord + vec2(1.0 / frxu_size.x, 0.0)).r;
		color.b = texture(u_color, texcoord - vec2(1.0 / frxu_size.x, 0.0)).b;
	#endif

	#ifdef LSD_MODE
		vec2 noise = vec2(snoise(texcoord * 10.0 + frx_renderSeconds * 0.1), snoise(texcoord * 10.0 + 1000.0 - frx_renderSeconds * 0.1)) * 0.005;

		#define texcoord (texcoord+noise)
		color.r = frx_sample13(u_color, texcoord + 0.01 * vec2(sin(frx_renderSeconds), cos(frx_renderSeconds)), 1.0 / frxu_size).r;
		color.g = frx_sample13(u_color, texcoord + 0.01 * vec2(2.0 * -sin(frx_renderSeconds + 50.0), cos(frx_renderSeconds + 50.0)), 1.0 / frxu_size).g;
		color.b = frx_sample13(u_color, texcoord + 0.01 * vec2(sin(frx_renderSeconds - 50.0), 2.0 * -cos(frx_renderSeconds - 50.0)), 1.0 / frxu_size).b;
	#endif

	vec3 finalColor = color.rgb;
	float l = frx_luminance(finalColor);

	// Tone map
	//finalColor = tanh(finalColor * 1.1);
	//finalColor = frx_toneMap(finalColor * 1.2);

	// Transform the color into sRGB space
	finalColor = pow(finalColor, vec3(1.0 / 2.2));

	fragColor = vec4(clamp01(finalColor), 1.0);
}