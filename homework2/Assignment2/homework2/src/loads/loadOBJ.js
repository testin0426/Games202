function loadOBJ(renderer, path, name, objMaterial, transform) {

	const manager = new THREE.LoadingManager();
	manager.onProgress = function (item, loaded, total) {
		console.log(item, loaded, total);
	};

	function onProgress(xhr) {
		if (xhr.lengthComputable) {
			const percentComplete = xhr.loaded / xhr.total * 100;
			console.log('model ' + Math.round(percentComplete, 2) + '% downloaded');
			if (percentComplete == 100) {
				//console.log(renderer)
			}
		}
	}
	function onError() { }

	new THREE.MTLLoader(manager)
		.setPath(path)
		.load(name + '.mtl' + '?t=' + Date.now(), function (materials) {
			materials.preload();
			new THREE.OBJLoader(manager)
				.setMaterials(materials)
				.setPath(path)
				.load(name + '.obj' + '?t=' + Date.now(), function (object) {
					object.traverse(function (child) {
						if (child.isMesh) {
							let geo = child.geometry;
							let mat;
							if (Array.isArray(child.material)) mat = child.material[0];
							else mat = child.material;

							var indices = Array.from({ length: geo.attributes.position.count }, (v, k) => k);

							// PRT 材质需要把传输系数作为顶点 attribute 传进去
							let extraAttribs = null;
							if (objMaterial == 'ShMaterial') {
								extraAttribs = [{ name: 'aPrecomputeLT', array: precomputeLT[guiParams.envmapId], components: 9 }];
							}

							let mesh = new Mesh({ name: 'aVertexPosition', array: geo.attributes.position.array },
								{ name: 'aNormalPosition', array: geo.attributes.normal.array },
								//{ name: 'aTextureCoord', array: geo.attributes.uv.array },
								null,
								indices, transform, extraAttribs);
							let colorMap = new Texture();
							if (mat.map != null) {
								colorMap.CreateImageTexture(renderer.gl, mat.map.image);
							}
							else {
								colorMap.CreateConstantTexture(renderer.gl, mat.color.toArray());
							}

							let material, shadowMaterial;
							let Translation = [transform.modelTransX, transform.modelTransY, transform.modelTransZ];
							let Scale = [transform.modelScaleX, transform.modelScaleY, transform.modelScaleZ];

							let light = renderer.lights[0].entity;

							switch (objMaterial) {
								case 'PhongMaterial':
									material = buildPhongMaterial(colorMap, mat.specular.toArray(), light, Translation, Scale, "./src/shaders/phongShader/phongVertex.glsl", "./src/shaders/phongShader/phongFragment.glsl");
									shadowMaterial = buildShadowMaterial(light, Translation, Scale, "./src/shaders/shadowShader/shadowVertex.glsl", "./src/shaders/shadowShader/shadowFragment.glsl");
									break;
								// TODO: Add your PRTmaterial here
								case 'ShMaterial':
									material = buildShMaterial("./src/shaders/shshader/shVertex.glsl", "./src/shaders/shshader/shFragment.glsl");
									break;

								case 'SkyBoxMaterial':
									material = buildSkyBoxMaterial("./src/shaders/skyBoxShader/SkyBoxVertex.glsl", "./src/shaders/skyBoxShader/SkyBoxFragment.glsl");
									break;
							}

							material.then((data) => {
								let meshRender = new MeshRender(renderer.gl, mesh, data);
								renderer.addMeshRender(meshRender);
							});

							if (renderer.lights[0].entity.hasShadowMap == true) {
								shadowMaterial.then((data) => {
									let shadowMeshRender = new MeshRender(renderer.gl, mesh, data);
									renderer.addShadowMeshRender(shadowMeshRender);
								});
							}

						}
					});
				}, onProgress, onError);
		});
}