#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_prior;
uniform sampler2D u_color;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

void main() {
	fragColor = frx_sampleTent(u_prior, texcoord, 1.0 / frxu_size, frxu_lod + 1) + textureLod(u_color, texcoord, frxu_lod);
}