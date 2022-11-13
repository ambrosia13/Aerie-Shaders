#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_glint;

layout(location = 0) out vec4 fragColor;

void frx_pipelineFragment() {
    bool isInventory = frx_isGui && !frx_isHand;
    float blockDist = length(frx_vertex.xyz);
    vec3 gamma = vec3(isInventory ? 1.0 : 2.2);

    #ifdef PBR_ENABLED
        // Convert tangent space frx_fragNormal to world space
        mat3 tbn = mat3(
            frx_vertexTangent.xyz, 
            cross(frx_vertexTangent.xyz, frx_vertexNormal.xyz), 
            frx_vertexNormal.xyz
        );

        frx_fragNormal = tbn * frx_fragNormal;
        if(frx_isHand) {
            // Fix hand normals
            frx_fragNormal = frx_fragNormal * frx_normalModelMatrix;
        }
    #else
        // safeguard
        #define frx_fragNormal frx_vertexNormal
    #endif

    // Add some blocklight flickering when underground
    frx_fragLight.x = mix(max(1.0 / 16.0, frx_fragLight.x - 0.025 * frx_noise2d(vec2(floor(frx_renderSeconds * 10.0)))), frx_fragLight.x, frx_fragLight.y);

    vec3 lightmap;
    if(!isInventory) lightmap = texture(frxs_lightmap, frx_fragLight.xy).rgb;

    // Put frx_fragColor into linear space
    frx_fragColor.rgb = pow(frx_fragColor.rgb, gamma);
    vec4 color = frx_fragColor;

    if(!isInventory) {
        // Remove ambient occlusion on materials that shouldn't have it
        frx_fragLight.z = mix(frx_fragLight.z, 1.0, frx_matDisableAo);

        // Make the normal face upwards for materials not supposed to have diffuse (like grass)
        {
            vec3 tempNormal = mix(frx_fragNormal, vec3(0.0, 1.0, 0.0), frx_matDisableDiffuse);
            lightmap *= mix(1.0, dot(tempNormal, normalize(vec3(0.2, 0.9, 0.4))) * 0.25 + 0.75, frx_fragLight.y);
        }

        // Handheld light - FREX supplies us with frx_eyePos which is the player position
        // This allows us to have proper shader handheld lights that conform to player position even in third person mode
        float heldLightDistance, heldLightMultiplier;
        vec3 heldLightNormal;
        if(distance(frx_eyePos, frx_cameraPos) > 2.0) {
            heldLightDistance = distance(frx_eyePos, frx_vertex.xyz + frx_cameraPos);

            heldLightNormal = normalize((frx_vertex.xyz + frx_cameraPos - frx_eyePos) - vec3(0.0, 1.5, 0.0));

            // Direct surfaces get lit up more
            heldLightMultiplier = mix(
                clamp01(dot(-frx_fragNormal, heldLightNormal)), 
                1.0, 
                frx_smootherstep(1.0, 0.0, distance(frx_eyePos + vec3(0.0, 1.0, 0.0), frx_vertex.xyz + frx_cameraPos))
            );
        } else {
            // Same thing as above for first person, because frx_eyePos is flickery
            heldLightDistance = blockDist;
            heldLightNormal = normalize(frx_vertex.xyz);

            heldLightMultiplier = clamp01(dot(-frx_fragNormal, heldLightNormal));
        }

        float heldLightFactor = frx_smootherstep(frx_heldLight.a * 15.0, 0.0, heldLightDistance);

        heldLightFactor *= heldLightMultiplier;

        // Hand is fully lit when holding an emitter
        if(frx_isHand && frx_heldLight.a > 0.0) {
            heldLightFactor = 1.0;
        }

        // Spotlight implementation from Canvas's Abstract shaders
        if(frx_heldLightInnerRadius < 2.0 * PI) {
            float innerAngle = sin(frx_heldLightInnerRadius);
            float outerAngle = sin(frx_heldLightOuterRadius);

            vec4 viewPos = frx_viewMatrix * frx_vertex;
            if(!frx_isHand) heldLightFactor *= smoothstep(outerAngle * outerAngle, innerAngle * innerAngle, 0.25 * dot(viewPos.xy, viewPos.xy));
        }

        heldLightFactor *= 1.3;
        lightmap = mix(lightmap, (max(frx_heldLight.rgb, lightmap)), heldLightFactor * heldLightFactor);

        // Since lightmap is given to us in sRGB, put it in linear space before applying lighting
        // because we're using gamma correcting in our pipeline
        #ifdef RTAO
            #define AO_EXP 1.5
        #else
            #define AO_EXP 2.2
        #endif

        lightmap = pow(lightmap, gamma) * pow(frx_fragLight.z, AO_EXP);
        lightmap = max(lightmap, vec3(0.005));

        color.rgb *= lightmap;

        // Ignore shading on emissive objects and brighten them up so they get bloom
        color.rgb = mix(color.rgb, frx_fragColor.rgb, frx_fragEmissive);
        #ifdef ENABLE_BLOOM
            color.rgb += color.rgb * EMISSION * frx_fragEmissive;
        #endif

        // Implement some canvas material conditions
        // frx_matHurt - red flash on hurt entities
        // frx_matFlash - white flash on things like tnt
        color.rgb = mix(color.rgb, vec3(frx_luminance(lightmap), 0.0, 0.0), 0.5 * frx_matHurt); 
        color.rgb = mix(color.rgb, vec3(2.0), 0.5 * frx_matFlash); 
    } else {
        vec3 direction = vec3(0.2, 0.8, 0.6);
        float lengthSquared = dot(direction, direction);
        direction *= inversesqrt(lengthSquared);
        color.rgb *= dot(frx_vertexNormal, direction) * 0.4 + 0.6;
    }

    if(frx_matGlint == 1) {
        // Not entirely vanilla implementation of enchantment glint
        vec3 glint = texture(u_glint, fract(frx_normalizeMappedUV(frx_texcoord) * 0.5 + frx_renderSeconds * 0.1)).rgb;
        glint = pow(glint, vec3(4.0));
        color.rgb += glint;
    }

    #ifdef FOG
        if(!isInventory) {
            // Put frx_fogColor into linear space
            vec3 fogColor = pow(frx_fogColor.rgb, vec3(2.2));

            float fogAmount = 0.0;

            #ifdef RAIN_FOG
                float fogDensity = 0.00003;

                fogDensity = mix(fogDensity, 0.001, frx_rainGradient);
                fogDensity = mix(fogDensity, 0.003, frx_thunderGradient);
                fogDensity = mix(fogDensity, 0.01, frx_worldIsNether + frx_worldIsEnd);
                fogDensity = mix(fogDensity, 0.025, frx_cameraInFluid);
                fogDensity = mix(fogDensity, 0.5, frx_effectBlindness);

                // Exponential fog for rain
                fogAmount = 1.0 - exp(-blockDist * fogDensity);
            #endif

            // Don't allow vanilla fog to get too close, exponential fog should handle that
            fogAmount = max(fogAmount, frx_smootherstep(max(frx_fogStart, frx_viewDistance * 0.25), max(frx_fogEnd, frx_viewDistance * 0.9), blockDist));

            color.rgb = mix(color.rgb, fogColor, fogAmount);
        }
    #endif

    fragColor = color;
    gl_FragDepth = gl_FragCoord.z;
}