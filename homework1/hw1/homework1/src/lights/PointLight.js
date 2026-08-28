class PointLight {
    /**
     * Creates an instance of PointLight.
     * @param {float} lightIntensity  The intensity of the PointLight.
     * @param {vec3f} lightColor The color of the PointLight.
     * @memberof PointLight
     */
    constructor(lightIntensity, lightColor, hasShadowMap, gl) {
        this.mesh = Mesh.cube(setTransform(0, 0, 0, 0.2, 0.2, 0.2, 0));
        this.mat = new EmissiveMaterial(lightIntensity, lightColor);

        this.hasShadowMap = hasShadowMap;
        this.fbo = new FBO(gl);
        if (!this.fbo) {
            console.log("无法设置帧缓冲区对象");
            return;
        }
    }
    CalcLightMVP(translate, scale) {
        let lightMVP = mat4.create();
        let modelMatrix = mat4.create();
        let viewMatrix = mat4.create();
        let projectionMatrix = mat4.create();

        //Model transform
        mat4.identity(modelMatrix);
		mat4.translate(modelMatrix, modelMatrix, translate);
		mat4.scale(modelMatrix, modelMatrix, scale);
        
        //View transform
        
        mat4.lookAt(viewMatrix, this.lightPos, this.focalPoint, this.lightUp);//

        mat4.ortho(projectionMatrix, -111.70, 111.70, -78.98, 78.98, 0.1, 2000);

        mat4.multiply(lightMVP, projectionMatrix, viewMatrix);
        mat4.multiply(lightMVP, lightMVP, modelMatrix);
        return lightMVP;
    }
}