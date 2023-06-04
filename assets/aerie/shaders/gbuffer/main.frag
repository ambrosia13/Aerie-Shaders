#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_glint;

// All common forward shading stuff is in this file
//#include aerie:shaders/gbuffer/gbuffer_common.glsl

layout(location = 0) out vec4 fragColor;

#ifdef SHADOW_MAP_PRESENT
	// Helper function
	vec3 shadowDist(int cascade, vec4 pos) {
		vec4 c = frx_shadowCenter(cascade);
		return abs((c.xyz - pos.xyz) / c.w);
	}

	// Function for obtaining the cascade level
	int selectShadowCascade(vec4 shadowViewSpacePos) {
		vec3 d3 = shadowDist(3, shadowViewSpacePos);
		vec3 d2 = shadowDist(2, shadowViewSpacePos);
		vec3 d1 = shadowDist(1, shadowViewSpacePos);

		int cascade = 0;

		if (d3.x < 1.0 && d3.y < 1.0 && d3.z < 1.0) {
			cascade = 3;
		} else if (d2.x < 1.0 && d2.y < 1.0 && d2.z < 1.0) {
			cascade = 2;
		} else if (d1.x < 1.0 && d1.y < 1.0 && d1.z < 1.0) {
			cascade = 1;
		}

		return cascade;
	}

	vec3 setupShadowPos(in vec3 sceneSpacePos, in vec3 bias, out int cascade) {
		vec4 shadowViewPos = frx_shadowViewMatrix * vec4(sceneSpacePos, 1.0);
		cascade = selectShadowCascade(shadowViewPos);

		shadowViewPos = frx_shadowViewMatrix * vec4(sceneSpacePos + bias * (1.5 + (3 - cascade)), 1.0);

		vec4 shadowClipPos = frx_shadowProjectionMatrix(cascade) * shadowViewPos;
		vec3 shadowScreenPos = (shadowClipPos.xyz / shadowClipPos.w) * 0.5 + 0.5;

		return shadowScreenPos;
	}
#endif

void frx_pipelineFragment() {
	bool isInventory = frx_isGui && !frx_isHand;
	vec3 gamma = vec3(isInventory ? 1.0 : 2.2);

	// Material effects
	frx_fragColor.rgb = mix(frx_fragColor.rgb, vec3(1.0, 0.0, 0.0), 0.5 * frx_matHurt);
	frx_fragColor.rgb = mix(frx_fragColor.rgb, vec3(4.0), 0.5 * frx_matFlash);
	frx_fragColor.rgb += pow(texture(u_glint, 0.3 * frx_normalizeMappedUV(frx_texcoord) + frx_renderSeconds * 0.1).rgb, vec3(4.0)) * frx_matGlint;

	if(isInventory) { // inventory stuff only gets diffuse lighting
		float diffuseFactor = dot(frx_vertexNormal, normalize(vec3(-0.5, 1.0, 0.0))) * 0.4 + 0.8;
		diffuseFactor = mix(diffuseFactor, 1.0, float(frx_matDisableDiffuse));

		frx_fragColor.rgb *= diffuseFactor;
	} else {
		// Resolve fragment normals
		mat3 tbn = mat3(
			frx_vertexTangent.xyz, 
			cross(frx_vertexTangent.xyz, frx_vertexNormal.xyz) * frx_vertexTangent.w, 
			frx_vertexNormal.xyz
		);

		frx_fragNormal = tbn * frx_fragNormal;
		if(frx_isHand) {
			// Fix hand normals because they are in view space
			frx_fragNormal = frx_fragNormal * frx_normalModelMatrix;
		}

		vec3 playerPos = frx_vertex.xyz + frx_cameraPos - frx_eyePos - vec3(0.0, 1.5, 0.0);
		float heldLightFactor = smoothstep(frx_heldLight.a * 10.0, 0.0, length(playerPos));

		frx_fragLight.x = max(heldLightFactor, frx_fragLight.x);

		// Lightmap sampling
		frx_fragLight.y = mix(15.0 / 16.0, frx_fragLight.y, float(frx_worldHasSkylight));
		frx_fragLight.z = mix(frx_fragLight.z, 1.0, float(frx_matDisableAo));

		frx_fragLight.xy = clamp(frx_fragLight.xy, 1.0 / 16.0, 15.0 / 16.0);

		#ifdef SHADOW_MAP_PRESENT
			int cascade = -1;

			vec3 shadowScreenPos = setupShadowPos(frx_vertex.xyz, frx_vertexNormal.xyz * (0.025), cascade);

			float shadowBlurAmount = mix(2.0, 5.0, float(frx_matDisableDiffuse));
			float shadow = 0.0;

			const int shadowSamples = 8;
			for(int i = 0; i < shadowSamples; i++) {
				vec2 offset = diskSampling(i, shadowSamples, 1.0);

				vec2 newScreenPos = shadowScreenPos.xy + offset * shadowBlurAmount / SHADOW_MAP_SIZE;
				shadow += texture(frxs_shadowMap, vec4(newScreenPos, cascade, shadowScreenPos.z));
			}
			shadow /= shadowSamples;

			float NdotL = mix(clamp01(dot(frx_fragNormal, frx_skyLightVector)), 1.0, frx_matDisableDiffuse);

			vec3 skyLight = texture(frxs_lightmap, vec2(1.0 / 16.0, frx_fragLight.y)).rgb * 0.75;
			vec3 directLight = frx_skyLightAtmosphericColor * shadow * sqrt(frx_skyLightTransitionFactor) * NdotL * 0.5;

			vec3 blockLight = texture(frxs_lightmap, vec2(frx_fragLight.x, 1.0 / 16.0)).rgb;

			vec3 totalSkyLight = skyLight + directLight;
			vec3 lightmap = max(totalSkyLight, blockLight) * frx_fragLight.z;
		#else 
			vec3 lightmap = texture(frxs_lightmap, frx_fragLight.xy).rgb * frx_fragLight.z;
		#endif


		// Diffuse lighting
		float diffuseFactor = dot(frx_fragNormal, normalize(vec3(0.75, 1.0, 0.2))) * 0.1 + 0.9;
		diffuseFactor = mix(diffuseFactor, 1.0, float(frx_matDisableDiffuse));
		
		lightmap *= diffuseFactor;

		// Apply emission
		lightmap = mix(lightmap, vec3(1.0 + EMISSION), frx_fragEmissive);	

		// Apply lightmap
		frx_fragColor.rgb *= lightmap;

		// Fog
		float fogDistance = max(0.0, frx_distance - frx_fogStart * FOG_START_MULTIPLIER);
		float fogFactor = 1.0 - exp(-fogDistance / frx_viewDistance);

		fogFactor = max(fogFactor, smoothstep(frx_fogStart, frx_fogEnd, frx_distance));
		frx_fragColor = mix(frx_fragColor, frx_fogColor, fogFactor);

		frx_fragColor.rgb = pow(frx_fragColor.rgb, vec3(2.2));
	}

	fragColor = frx_fragColor;
	gl_FragDepth = gl_FragCoord.z;
}