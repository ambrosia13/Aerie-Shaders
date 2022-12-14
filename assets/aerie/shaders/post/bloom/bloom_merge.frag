#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_color;
uniform sampler2D u_bloom;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

void main() {
    vec4 color = vec4(texture(u_color, texcoord).rgb, 1.0);
    vec4 bloom = frx_sampleTent(u_bloom, texcoord, 1. / frxu_size, 0) / 6.0;
    bloom.rgb = pow(bloom.rgb, vec3(1.0 / 1.5));

    // instead of bloom thresholding and additive blending, we use mix() for more realistic bloom that respects energy.
    fragColor = mix(color, bloom, mix(0.1 * tanh(frx_luminance(bloom.rgb)), 1.0, float(frx_cameraInFluid)));
}