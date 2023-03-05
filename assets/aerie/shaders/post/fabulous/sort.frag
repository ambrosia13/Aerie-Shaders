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

// Fabulous sorting algorithm by me - branchless, light
// 1.0 if a is greater than b, 0.0 otherwise. 
float getClosestDepth(const in float a, inout float b) {
    float isACloser = step(a, b);
    b = mix(b, min(a, b), isACloser);

    return isACloser;
}

void insertLayer(inout vec3 background, const in vec4 foreground, inout float backgroundDepth, const in float foregroundDepth) {
	background = mix(background, background * (1.0 - foreground.a) + foreground.rgb * foreground.a, getClosestDepth(foregroundDepth, backgroundDepth));
}

void main() {
	vec4 mainColor = texture(u_main_color, texcoord);
	float mainDepth = texture(u_main_depth, texcoord).r;

	vec4 translucentColor = texture(u_translucent_color, texcoord.xy);
	float translucentDepth = texture(u_translucent_depth, texcoord).r;

	vec4 particlesColor = texture(u_particles_color, texcoord);
	float particlesDepth = texture(u_particles_depth, texcoord).r;
	
	vec4 entityColor = texture(u_entity_color, texcoord);
	float entityDepth = texture(u_entity_depth, texcoord).r;

	vec4 cloudsColor = texture(u_clouds_color, texcoord);
	cloudsColor.rgb = pow(cloudsColor.rgb, vec3(2.2));
	float cloudsDepth = texture(u_clouds_depth, texcoord).r;

	vec4 weatherColor = texture(u_weather_color, texcoord);
	weatherColor.rgb = pow(weatherColor.rgb, vec3(2.2));
	float weatherDepth = texture(u_weather_depth, texcoord).r;

	// Calculate per-pixel view direction
	vec3 viewDir = normalize(setupSceneSpacePos(texcoord, 1.0));

	// Fix up sky
	if(mainDepth == 1.0) {
		// forward rendering doesn't control the sky, so we put sky to linear in post
		mainColor.rgb = pow(mainColor.rgb, vec3(2.2));

		#ifdef BRIGHTER_SUN_AND_MOON
			if(frx_worldIsOverworld == 1) {
				// Raytrace the sun in the sky
				vec3 sunPosition = getSunVector() * 20.0;

				const float dist = 20.0;

				vec3 normal = getSunVector();
				vec3 right = normalize(vec3(normal.z, 0.0, -normal.x));
				vec3 up = normalize(cross(normal, right));

				float t = -dist / dot(viewDir, normal);
				vec3 hitPoint = viewDir * t;
				vec3 diff = hitPoint - sunPosition;
				vec2 uv = vec2(dot(diff, right), dot(diff, up));
				float distToCenter = max(abs(uv.x), abs(uv.y));
				
				float sun = step(distToCenter, 1.5) * step(t, 0.0);
				float moon = step(distToCenter, 1.0) * (1.0 - step(t, 0.0));

				float l = frx_luminance(mainColor.rgb);
				mainColor.rgb *= mix(1.0, 3.0 * EMISSION / l, moon * smoothstep(0.15, 1.0, l) * (1.0 - frx_rainGradient));
				mainColor.rgb *= mix(vec3(1.0), (3.0 * EMISSION / l) * vec3(1.3, 1.2, 1.0), sun * (1.0 - frx_rainGradient));
			}
		#endif
	}

	// Fabulous blending
	vec3 composite = mainColor.rgb;
	float compositeDepth = mainDepth;

	insertLayer(composite, translucentColor, compositeDepth, translucentDepth);
	insertLayer(composite, particlesColor, compositeDepth, particlesDepth);
	insertLayer(composite, entityColor, compositeDepth, entityDepth);

	vec3 sceneSpacePos = setupSceneSpacePos(texcoord, compositeDepth);
	float blockDist = length(sceneSpacePos);

	#ifdef FOG 
		float vanillaFogFactor = smoothstep(frx_fogStart - 0.35 * frx_viewDistance * (1.0 - frx_cameraInFluid), frx_fogEnd, blockDist);
	#else
		float vanillaFogFactor = 0.0;
	#endif

	#ifdef RAIN_FOG
		float rainFogFactor = (1.0 - exp(-blockDist / frx_viewDistance)) * frx_rainGradient;
	#else
		float rainFogFactor = 0.0;
	#endif

	composite = mix(composite, pow(frx_fogColor.rgb, vec3(2.2)), (1.0 - floor(compositeDepth)) * max(vanillaFogFactor, rainFogFactor) * frx_smoothedEyeBrightness.y);

	insertLayer(composite, cloudsColor, compositeDepth, cloudsDepth);
	insertLayer(composite, weatherColor, compositeDepth, weatherDepth);

	fragColor = vec4(composite, 1.0);
}
