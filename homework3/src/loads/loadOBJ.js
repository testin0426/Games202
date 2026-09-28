function loadOBJ(renderer, path, name, objMaterial, transform) {

	const manager = new THREE.LoadingManager();
	manager.onProgress = function (item, loaded, total) {
		console.log(item, loaded, total);
	};

	function onProgress(xhr) {
		if (xhr.lengthComputable) {
			const percentComplete = xhr.loaded / xhr.total * 100;
			console.log('model ' + Math.round(percentComplete, 2) + '% downloaded');
		}
	}
	function onError() { }

	new THREE.MTLLoader(manager)
		.setPath(path)
		.load(name + '.mtl', function (materials) {
			materials.preload();
			new THREE.OBJLoader(manager)
				.setMaterials(materials)
				.setPath(path)
				.load(name + '.obj', function (object) {
					object.traverse(function (child) {
						if (child.isMesh) {
							let geo = child.geometry;
							let mat;
							if (Array.isArray(child.material)) mat = child.material[0];
							else mat = child.material;

							var indices = Array.from({ length: geo.attributes.position.count }, (v, k) => k);
							let positions = { name: 'aVertexPosition', array: geo.attributes.position.array };
							let normals = geo.attributes.normal ? { name: 'aNormalPosition', array: geo.attributes.normal.array } : null;
							let texcoords = geo.attributes.uv ? { name: 'aTextureCoord', array: geo.attributes.uv.array } : null;
							let mesh = new Mesh(positions, normals, texcoords, indices, transform);

							let colorMap = new Texture();
							if (mat.map != null) {
								colorMap.CreateImageTexture(renderer.gl, mat.map.image);
							}
							else {
								colorMap.CreateConstantTexture(renderer.gl, mat.color.toArray(), true);
							}

							let specularMap = new Texture();
							specularMap.CreateConstantTexture(renderer.gl, [0, 0, 0]);

							let normalMap = new Texture();
							if (mat.normalMap != null) {
								normalMap.CreateImageTexture(renderer.gl, mat.normalMap.image);
							}
							else {
								normalMap.CreateConstantTexture(renderer.gl, [0.5, 0.5, 1], false);
							}

							let material, shadowMaterial, bufferMaterial;

							let light = renderer.lights[0].entity;
							switch (objMaterial) {
								case 'SSRMaterial':
									material = buildSSRMaterial(colorMap, specularMap, light, renderer.camera, "./src/shaders/ssrShader/ssrVertex.glsl", "./src/shaders/ssrShader/ssrFragment.glsl");
									shadowMaterial = buildShadowMaterial(light, "./src/shaders/shadowShader/shadowVertex.glsl", "./src/shaders/shadowShader/shadowFragment.glsl");
									bufferMaterial = buildGbufferMaterial(colorMap, normalMap, light, renderer.camera, "./src/shaders/gbufferShader/gbufferVertex.glsl", "./src/shaders/gbufferShader/gbufferFragment.glsl");
									break;
							}

							material.then((data) => {
								let meshRender = new MeshRender(renderer.gl, mesh, data);
								renderer.addMeshRender(meshRender);
							});
							shadowMaterial.then((data) => {
								let shadowMeshRender = new MeshRender(renderer.gl, mesh, data);
								renderer.addShadowMeshRender(shadowMeshRender);
							});
							bufferMaterial.then((data) => {
								let bufferMeshRender = new MeshRender(renderer.gl, mesh, data);
								renderer.addBufferMeshRender(bufferMeshRender);
							});

						}
					});
				}, onProgress, onError);
		});
}
