#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_color;
uniform sampler2D u_bloom;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

void main() {
	vec4 color = vec4(texture(u_color, texcoord).rgb, 1.0);
	vec4 bloom = frx_sampleTent(u_bloom, texcoord, 1.0 / frxu_size, 0) / 6.0;

	float bloomLuminance = tanh(pow(frx_luminance(bloom.rgb), 2.0));
	fragColor = mix(color, bloom, BLOOM_AMOUNT);
}