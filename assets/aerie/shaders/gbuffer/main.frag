#include aerie:shaders/lib/includes.glsl 

uniform sampler2D u_glint;

// // All common forward shading stuff is in this file
#include aerie:shaders/gbuffer/gbuffer_common.glsl

layout(location = 0) out vec4 fragColor;

#ifdef SHADOWS
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
		vec4 shadowViewPos = frx_shadowViewMatrix * vec4(sceneSpacePos + bias, 1.0);
		cascade = selectShadowCascade(shadowViewPos);

		vec4 shadowClipPos = frx_shadowProjectionMatrix(cascade) * shadowViewPos;
		vec3 shadowScreenPos = (shadowClipPos.xyz / shadowClipPos.w) * 0.5 + 0.5;

		return shadowScreenPos;
	}
#endif

void frx_pipelineFragment() {
	isInventory = frx_isGui && !frx_isHand;
	blockDist = length(frx_vertex.xyz);
	gamma = vec3(isInventory ? 1.0 : 2.2);

	autogenNormals();
	transformNormals();

	#ifdef SHADOWS
		float shadowFactor = 1.0;

		if(!isInventory) {
			int cascade;
			vec3 shadowScreenPos = setupShadowPos(frx_vertex.xyz, frx_vertexNormal.xyz * 0.1, cascade);

			shadowFactor = texture(frxs_shadowMap, vec4(shadowScreenPos.xy, cascade, shadowScreenPos.z));
		}
	#else
		float shadowFactor = 0.0;
	#endif

	lighting(shadowFactor);

	float blockDist = length(frx_vertex.xz);
	float lightFactor = smoothstep(0.0, 0.5, frx_fragLight.y);

	#ifdef FOG 
		float vanillaFogFactor = smoothstep(frx_fogStart * FOG_START_MULTIPLIER, frx_fogEnd, blockDist);
		if(frx_cameraInFluid == 0) vanillaFogFactor *= lightFactor;
	#else
		float vanillaFogFactor = 0.0;
	#endif

	#ifdef RAIN_FOG
		float rainFogFactor = (1.0 - exp(-blockDist / frx_viewDistance)) * frx_rainGradient * lightFactor;
	#else
		float rainFogFactor = 0.0;
	#endif

	frx_fragColor = mix(frx_fragColor, frx_fogColor, max(vanillaFogFactor, rainFogFactor));

	// Transform the frx_fragColor into gamma space
	if(!isInventory) frx_fragColor.rgb = pow(frx_fragColor.rgb, vec3(2.2));

	fragColor = frx_fragColor;
	gl_FragDepth = gl_FragCoord.z;
}