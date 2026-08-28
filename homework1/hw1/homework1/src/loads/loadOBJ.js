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
							let mesh = new Mesh({ name: 'aVertexPosition', array: geo.attributes.position.array },
								{ name: 'aNormalPosition', array: geo.attributes.normal.array },
								{ name: 'aTextureCoord', array: geo.attributes.uv.array },
								indices, transform);

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

							// ===== 诊断：光源 view 空间下的 AABB =====
							{
								let positions = geo.attributes.position.array;
								let m = mat4.create();
								let vm = mat4.create();
								mat4.identity(m);
								mat4.translate(m, m, Translation);
								mat4.scale(m, m, Scale);
								// 光源的 view 矩阵（与 CalcLightMVP 里一致）
								mat4.lookAt(vm, light.lightPos, light.focalPoint, light.lightUp);
								// view * model，把模型空间顶点变换到光源 view 空间
								let mv = mat4.create();
								mat4.multiply(mv, vm, m);

								let mn = [Infinity, Infinity, Infinity];
								let mx = [-Infinity, -Infinity, -Infinity];
								for (let i = 0; i < positions.length; i += 3) {
									let v = [positions[i], positions[i + 1], positions[i + 2], 1.0];
									let out = [0, 0, 0, 0];
									// 手动乘 mat4（gl-matrix 无 mat4*vec4 便捷 API）
									for (let r = 0; r < 4; r++) {
										out[r] = mv[r * 4 + 0] * v[0] + mv[r * 4 + 1] * v[1] + mv[r * 4 + 2] * v[2] + mv[r * 4 + 3] * v[3];
									}
									for (let j = 0; j < 3; j++) {
										if (out[j] < mn[j]) mn[j] = out[j];
										if (out[j] > mx[j]) mx[j] = out[j];
									}
								}
								console.log('AABB(lightView) name=', name,
									'min=', mn.map(n => n.toFixed(2)),
									'max=', mx.map(n => n.toFixed(2)));
							}

							switch (objMaterial) {
								case 'PhongMaterial':
									material = buildPhongMaterial(colorMap, mat.specular.toArray(), light, Translation, Scale, "./src/shaders/phongShader/phongVertex.glsl", "./src/shaders/phongShader/phongFragment.glsl");
									shadowMaterial = buildShadowMaterial(light, Translation, Scale, "./src/shaders/shadowShader/shadowVertex.glsl", "./src/shaders/shadowShader/shadowFragment.glsl");
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
						}
					});
				}, onProgress, onError);
		});
}
