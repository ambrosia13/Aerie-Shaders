#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_color;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

void main() {
    vec3 color = texture(u_color, texcoord).rgb;

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

    // cursed but simple tone map
    finalColor = tanh(finalColor);
    //finalColor = frx_toneMap(finalColor * 1.2);

    // finally, back into srgb
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    // vignette funnies
    vec3 vignetteColor = vec3(0.0);
    vignetteColor = mix(vignetteColor, vec3(1.0, 0.0, 0.0), frx_effectInstantDamage);
    vignetteColor = mix(vignetteColor, 1.0 / finalColor, clamp01(frx_effectJumpBoost + frx_effectSpeed));
    vignetteColor = mix(vignetteColor, vec3(0.5), frx_effectSlowness);
    vignetteColor = mix(vignetteColor, vec3(1.5, 1.5, 0.0), clamp01(frx_effectAbsorption + frx_effectHast));
    vignetteColor = mix(vignetteColor, vec3(1.0, 0.0, 0.5), frx_effectStrength);
    vignetteColor = mix(vignetteColor, vec3(0.0, 1.0, 0.0), clamp01(frx_effectPoison + frx_effectNausea));
    vignetteColor = mix(vignetteColor, vec3(1.0, 0.25, 0.75), clamp01(frx_effectPoison + frx_effectNausea));

    float vignetteFactor = smoothstep(-0.3, 0.6, pow(3.0 * texcoord.x * texcoord.y * (1.0 - texcoord.x) * (1.0 - texcoord.y), 0.25));
    //finalColor *= mix(vignetteColor, vec3(1.0), 0.25 + 0.75 * vignetteFactor);
    //finalColor *= mix(1.0, vignetteFactor, smoothstep(0.8, 0.2, l));


    fragColor = vec4(clamp01(finalColor), 1.0);
}