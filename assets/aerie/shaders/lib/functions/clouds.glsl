struct Hit {
	bool success;

	vec3 pos;
	vec3 normal;
};

struct CloudLayer {
	int minHeight;
	int maxHeight;

	float threshold; // Higher means less clouds, lower means more clouds
};

CloudLayer[3] createCloudLayers() {
	CloudLayer[3] cloudLayers = CloudLayer[3] (
		CloudLayer(150, 155, 0.8),
		CloudLayer(210, 215, 0.9),
		CloudLayer(285, 290, 0.95)
	);

	return cloudLayers;
}

float rayPlaneIntersection(vec3 rayPos, vec3 rayDir, vec3 planeNormal, float planeHeight) {
	return -(dot(rayPos, planeNormal) + planeHeight) / dot(rayDir, planeNormal);
}

bool evaluateHit(inout Hit hit, vec3 voxelPos, int i, sampler2D noise) {
	CloudLayer cloudLayer = createCloudLayers()[i];

	float cloudDensity = 0.4 + 0.2 * frx_rainGradient;

	hit.success = texture(noise, (voxelPos.xz + 150.0 * i) * 1e-4).r < cloudDensity;
	hit.success = hit.success && voxelPos.y > cloudLayer.minHeight && voxelPos.y < cloudLayer.maxHeight;

	return hit.success;
}

// Algorithm from Balint: https://blog.balintcsala.com/posts/voxel-tracing/
Hit raytraceCloudLayer(vec3 startPos, vec3 endPos, int raytraceLength, int layerIndex, sampler2D noise) {
	Hit hit;
	hit.pos = vec3(0.0);
	hit.success = false;

	vec3 rayPos = startPos;
	vec3 rayDir = normalize(endPos - startPos);

	rayPos += frx_cameraPos;

	vec3 stepSizes = 1.0 / abs(rayDir);
	vec3 stepDir = sign(rayDir);
	vec3 nextDist = (stepDir * 0.5 + 0.5 - fract(rayPos)) / rayDir;

	ivec3 voxelPos = ivec3(rayPos);
	vec3 currentPos = rayPos;

	for(int i = 0; i < raytraceLength; i++) {
		float closestDist = min(nextDist.x, min(nextDist.y, nextDist.z));

		currentPos += rayDir * closestDist;
		
		vec3 stepAxis = vec3(lessThanEqual(nextDist, vec3(closestDist)));

		voxelPos += ivec3(stepAxis * stepDir);

		nextDist -= closestDist;
		nextDist += stepSizes * stepAxis;

		hit.normal = stepAxis;

		if(evaluateHit(hit, voxelPos, layerIndex, noise)) {
			hit.pos = currentPos - frx_cameraPos;
			hit.normal *= -stepDir;
			break;
		}
	}

	return hit;
}

Hit raytraceClouds(vec3 viewDir, sampler2D noise) {
	CloudLayer[3] cloudLayers = createCloudLayers();

	Hit hit = Hit(false, vec3(100000.0), vec3(-1.0));

	for(int i = 0; i < 3; i++) {
		float distToLowerBoundingPlane = rayPlaneIntersection(frx_cameraPos, viewDir, vec3(0.0, -1.0, 0.0), cloudLayers[i].minHeight);
		float distToUpperBoundingPlane = rayPlaneIntersection(frx_cameraPos, viewDir, vec3(0.0, -1.0, 0.0), cloudLayers[i].maxHeight);

		vec3 startPos = viewDir * max(0.0, distToLowerBoundingPlane);
		vec3 endPos = viewDir * max(0.0, distToUpperBoundingPlane);

		// startPos.xz += frx_renderSeconds * (3.0 - i) * 0.5;
		// endPos.xz += frx_renderSeconds * (3.0 - i) * 0.5;

		Hit thisHit = raytraceCloudLayer(startPos, endPos, 20, i, noise);

		if(thisHit.success && abs(length(thisHit.pos)) < abs(length(hit.pos))) {
			hit = thisHit;
		}
	}

	return hit;
}
