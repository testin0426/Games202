var cameraPosition = [30, 30, 30]

//生成的纹理的分辨率，纹理必须是标准的尺寸 256*256 1024*1024  2048*2048
var resolution = 2048;
var fbo;

// 调试参数：bias 与调试视图，GUI 实时修改
var GUIParams = {
	bias: 0.001,
	filterScale: 0.003,
	debugMode: 0, // 0=正常 1=阴影mask 2=shadowmap深度 3=片元深度 4=UV
};

GAMES202Main();

function GAMES202Main() {
	// Init canvas and gl
	const canvas = document.querySelector('#glcanvas');
	canvas.width = window.screen.width;
	canvas.height = window.screen.height;
	const gl = canvas.getContext('webgl');
	if (!gl) {
		alert('Unable to initialize WebGL. Your browser or machine may not support it.');
		return;
	}

	// Add camera
	const camera = new THREE.PerspectiveCamera(75, gl.canvas.clientWidth / gl.canvas.clientHeight, 1e-2, 1000);
	camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);

	// 正交相机：光源视角用，尺寸与光源 ortho 盒子大致匹配
	let orthoCamera = null;
	function createOrthoCamera() {
		const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
		const halfH = 80; // 光源 ortho 的 y 半范围
		orthoCamera = new THREE.OrthographicCamera(-halfH * aspect, halfH * aspect, halfH, -halfH, 0.1, 2000);
	}

	// Add resize listener
	function setSize(width, height) {
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		if (orthoCamera) {
			const aspect = width / height;
			const halfH = 80;
			orthoCamera.left = -halfH * aspect;
			orthoCamera.right = halfH * aspect;
			orthoCamera.top = halfH;
			orthoCamera.bottom = -halfH;
			orthoCamera.updateProjectionMatrix();
		}
	}
	setSize(canvas.clientWidth, canvas.clientHeight);
	window.addEventListener('resize', () => setSize(canvas.clientWidth, canvas.clientHeight));

	// Add camera control
	const cameraControls = new THREE.OrbitControls(camera, canvas);
	cameraControls.enableZoom = true;
	cameraControls.enableRotate = true;
	cameraControls.enablePan = true;
	cameraControls.rotateSpeed = 0.3;
	cameraControls.zoomSpeed = 1.0;
	cameraControls.panSpeed = 0.8;
	cameraControls.target.set(0, 0, 0);

	// Add renderer
	const renderer = new WebGLRenderer(gl, camera);

	// Add lights
	// light - is open shadow map == true
	let lightPos = [0, 80, 80];
	let focalPoint = [0, 0, 0];
	let lightUp = [0, 1, 0]
	const directionLight = new DirectionalLight(5000, [1, 1, 1], lightPos, focalPoint, lightUp, true, renderer.gl);
	renderer.addLight(directionLight);

	//const pointLight = new PointLight(5000, [1,1,1], true, renderer.gl);
	//renderer.addLight(pointLight);

	// Add shapes
	
	let floorTransform = setTransform(0, 0, -30, 4, 4, 4);
	let obj1Transform = setTransform(0, 0, 0, 20, 20, 20);
	let obj2Transform = setTransform(40, 0, -40, 10, 10, 10);

	loadOBJ(renderer, 'assets/', 'Cyan', 'PhongMaterial', obj1Transform);
	loadOBJ(renderer, 'assets/', 'Cyan', 'PhongMaterial', obj2Transform);
	loadOBJ(renderer, 'assets/floor/', 'floor', 'PhongMaterial', floorTransform);
	

	// let floorTransform = setTransform(0, 0, 0, 100, 100, 100);
	// let cubeTransform = setTransform(0, 50, 0, 10, 50, 10);
	// let sphereTransform = setTransform(30, 10, 0, 10, 10, 10);

	//loadOBJ(renderer, 'assets/basic/', 'cube', 'PhongMaterial', cubeTransform);
	// loadOBJ(renderer, 'assets/basic/', 'sphere', 'PhongMaterial', sphereTransform);
	//loadOBJ(renderer, 'assets/basic/', 'plane', 'PhongMaterial', floorTransform);


	function createGUI() {
		const gui = new dat.gui.GUI();
		const panel = gui.addFolder('Shadow Debug');
		panel.add(GUIParams, 'bias', -0.001, 0.005, 0.0005).name('Bias').listen();
		panel.add(GUIParams, 'filterScale', 0.0, 0.02, 0.0005).name('Filter Scale').listen();
		panel.add(GUIParams, 'debugMode', {
			'Normal': 0,
			'ShadowMask': 1,
			'ShadowMapDepth': 2,
			'FragDepth': 3,
			'UV': 4,
		}).name('Debug View').listen();

		// 视角切换按钮
		const views = {
			'Light View (Ortho)': function () {
				if (!orthoCamera) createOrthoCamera();
				cameraControls.object = orthoCamera;
				renderer.camera = orthoCamera;
				orthoCamera.position.set(lightPos[0], lightPos[1], lightPos[2]);
				orthoCamera.updateProjectionMatrix();
				cameraControls.target.set(focalPoint[0], focalPoint[1], focalPoint[2]);
				cameraControls.update();
			},
			'Default View (Persp)': function () {
				cameraControls.object = camera;
				renderer.camera = camera;
				camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
				cameraControls.target.set(0, 0, 0);
				cameraControls.update();
			}
		};
		panel.add(views, 'Light View (Ortho)').name('Light View (Ortho)');
		panel.add(views, 'Default View (Persp)').name('Default View (Persp)');
		panel.open();
	}
	createGUI();

	function mainLoop(now) {
		cameraControls.update();

		renderer.render();
		requestAnimationFrame(mainLoop);
	}
	requestAnimationFrame(mainLoop);
}

function setTransform(t_x, t_y, t_z, s_x, s_y, s_z) {
	return {
		modelTransX: t_x,
		modelTransY: t_y,
		modelTransZ: t_z,
		modelScaleX: s_x,
		modelScaleY: s_y,
		modelScaleZ: s_z,
	};
}
