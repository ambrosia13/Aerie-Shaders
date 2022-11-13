#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_main_color;
uniform sampler2D u_main_depth;
uniform sampler2D u_translucent_color;
uniform sampler2D u_translucent_depth;
uniform sampler2D u_entity_color;
uniform sampler2D u_entity_depth;
uniform sampler2D u_weather_color;
uniform sampler2D u_weather_depth;
uniform sampler2D u_clouds_color;
uniform sampler2D u_clouds_depth;
uniform sampler2D u_particles_color;
uniform sampler2D u_particles_depth;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

// this is the exact same as vanilla fabulous blending

#define NUM_LAYERS 6

vec4 color_layers[NUM_LAYERS];
float depth_layers[NUM_LAYERS];
int active_layers = 0;

void try_insert(vec4 color, float depth) {
    if(color.a == 0.0) {
        return;
    }

    color_layers[active_layers] = color;
    depth_layers[active_layers] = depth;

    int jj = active_layers++;
    int ii = jj - 1;
    while(jj > 0 && depth_layers[jj] > depth_layers[ii]) {
        float depthTemp = depth_layers[ii];
        depth_layers[ii] = depth_layers[jj];
        depth_layers[jj] = depthTemp;

        vec4 colorTemp = color_layers[ii];
        color_layers[ii] = color_layers[jj];
        color_layers[jj] = colorTemp;

        jj = ii--;
    }
}

vec3 blend( vec3 dst, vec4 src ) {
    return ( dst * ( 1.0 - src.a ) ) + src.rgb;
}

void main() {
    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // sample things
    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

    vec4 translucent_color = texture(u_translucent_color, texcoord.xy);
    float translucent_depth = texture(u_translucent_depth, texcoord).r;

    vec4 main_color = texture(u_main_color, texcoord);
    float main_depth = texture(u_main_depth, texcoord).r;
    
    vec4 entity_color = texture(u_entity_color, texcoord);
    float entity_depth = texture(u_entity_depth, texcoord).r;

    vec4 weather_color = texture(u_weather_color, texcoord);
    weather_color.rgb = pow(weather_color.rgb, vec3(2.2));
    float weather_depth = texture(u_weather_depth, texcoord).r;

    vec4 clouds_color = texture(u_clouds_color, texcoord);
    clouds_color.rgb = pow(clouds_color.rgb, vec3(2.2));
    float clouds_depth = texture(u_clouds_depth, texcoord).r;

    vec4 particles_color = texture(u_particles_color, texcoord);
    float particles_depth = texture(u_particles_depth, texcoord).r;

    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // common things
    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

    // max_depth is effectively just the solid depth, min_depth is effectively just the composite depth including all terrain
    float max_depth = max(max(translucent_depth, particles_depth), main_depth);
    float min_depth = min(min(translucent_depth, particles_depth), main_depth);

    // following is view space constructed from the above depth
    // viewDir should calculate a new view space position using constant depth, but I didn't have much need for it
    vec3 maxViewSpacePos = setupSceneSpacePos(texcoord, max_depth);
    vec3 minViewSpacePos = setupSceneSpacePos(texcoord, min_depth);
    vec3 viewDir = normalize(maxViewSpacePos);

    // see utility.glsl
    // vec3(dayFactor, nightFactor, sunsetFactor)
    vec3 tdata = getTimeOfDayFactors();

    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // pre fabulous blending
    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

    // cloud fade into distance
    // I always hated how horrible the cloud fog looks in vanilla
    vec3 cloudPos = setupSceneSpacePos(texcoord, clouds_depth);
    clouds_color.a = mix(clouds_color.a, 0.0, frx_smootherstep(192.0, 320.0, length(cloudPos.xz)));

    if(max(max_depth, max(clamp(clouds_depth, 0.0, 0.999), clamp(weather_depth, 0.0, 0.999))) == 1.0) {
        // forward rendering doesn't control the sky, so we put sky to linear in post
        main_color.rgb = pow(main_color.rgb, vec3(2.2));

        if(frx_worldIsOverworld == 1) {
            // following code gives you funny square in the sky that is the same size as vanilla sun or moon.
            // you can use this for detecting it, in this case I make sun & moon a little bit brighter
            // the code was supplied by Bálint#1673
            vec3 sunPosition = getSunVector() * 20.0;

            float dist = 20.0;
            vec3 normal = getSunVector();
            vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normal));
            vec3 up = normalize(cross(normal, right));
            float t = -dist / dot(viewDir, normal);
            vec3 hitPoint = viewDir * t;
            vec3 diff = hitPoint - sunPosition;
            vec2 uv = vec2(dot(diff, right), dot(diff, up));
            float distToCenter = max(abs(uv.x), abs(uv.y));
            
            float sun = step(distToCenter, 1.5) * step(t, 0.0);
            float moon = step(distToCenter, 1.0) * (1.0 - step(t, 0.0));

            float l = frx_luminance(main_color.rgb);
            main_color.rgb *= mix(1.0, EMISSION / l, moon * smoothstep(0.0, 1.0, l) * (1.0 - frx_rainGradient));
            main_color.rgb *= mix(vec3(1.0), (EMISSION / l) * vec3(1.3, 1.2, 1.0), sun * (1.0 - frx_rainGradient));
        }
    }

    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // fabulous blending same as mojang (mostly)
    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    
    color_layers[0] = main_color;
    depth_layers[0] = main_depth;
    active_layers = 1;

    try_insert(translucent_color, translucent_depth);
    try_insert(entity_color, entity_depth);
    try_insert(weather_color, weather_depth);
    try_insert(particles_color, particles_depth);
    //try_insert(clouds_color, clouds_depth);

    vec3 composite = color_layers[0].rgb;
    for (int ii = 1; ii < active_layers; ++ii) {
        composite = blend(composite, color_layers[ii]);
    }

    if(clouds_depth < min_depth) composite.rgb = mix(composite.rgb, clouds_color.rgb, clouds_color.a);

    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
    // other stuff
    // ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

    // ...

    fragColor = max(vec4(1.0 / 65536.0), vec4(composite, 1.0));
}
