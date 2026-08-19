const { Vector3 } = require("three");

class DirectionalLight {

    constructor(lightIntensity, lightColor, lightPos, focalPoint, lightUp, hasShadowMap, gl) {
        this.mesh = Mesh.cube(setTransform(0, 0, 0, 0.2, 0.2, 0.2, 0));
        this.mat = new EmissiveMaterial(lightIntensity, lightColor);
        this.lightPos = lightPos;
        this.focalPoint = focalPoint;
        this.lightUp = lightUp

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
		mat4.translate(modelMatrix, modelMatrix, this.mesh.transform.translate);
		mat4.scale(modelMatrix, modelMatrix, this.mesh.transform.scale);
        
        // View transform
        /*const a = new vec3();
        const b = this.focalPoint - this.lightPos;
        a.crossVectors(b, this.lightUp);
        const c = new vec3();
        c.crossVectors(a, this.lightUp);
        const lookat = new THREE.Matrix4().set(
            a.x, c.x, this.lightUp.x, 1,
            a.y, c.y, this.lightUp.y, 1,
            a.z, c.z, this.lightUp.z, 1,
            1,   1,   1,          1
            );
            mat4.invert(viewMatrix,lookat);*/
        
        mat4.lookAt(viewMatrix, lightPos, focalPoint, lightUP);

        // Projection transform
       

        mat4.multiply(lightMVP, projectionMatrix, viewMatrix);
        mat4.multiply(lightMVP, lightMVP, modelMatrix);
        return lightMVP;
    }
}
