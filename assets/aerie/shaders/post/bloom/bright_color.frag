#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_color;
uniform sampler2D u_emissive;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

void main() {
	vec4 tex = texture(u_color, texcoord);
	vec3 color = pow(tex.rgb, vec3(1.5));

	fragColor = vec4(color + color * min(10.0, pow(frx_luminance(color), 2.0)), 1.0);
}