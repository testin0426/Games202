class PhongMaterial extends Material {

    constructor(color, specular, light, translate, scale, vertexShader, fragmentShader) {
        let lightMVP = light.CalcLightMVP(translate, scale);
        //let lightOrtho = light.CalcLightMVP()
        let lightIntensity = light.mat.GetIntensity();

        super({
            // Phong
            'uSampler': { type: 'texture', value: color },
            'uKs': { type: '3fv', value: specular },
            'uLightIntensity': { type: '3fv', value: lightIntensity },
            // Shadow
            'uShadowMap': { type: 'texture', value: light.fbo },
            'uLightMVP': { type: 'matrix4fv', value: lightMVP },
            // 调试参数：通过 getter 实时读取全局 GUIParams，GUI 拖动即可联动
            'uBias': { type: '1f', get value() { return GUIParams.bias; } },
            'uDebugMode': { type: '1i', get value() { return GUIParams.debugMode; } },
            //'uLightOrtho'

        }, [], vertexShader, fragmentShader);
    }
}

async function buildPhongMaterial(color, specular, light, translate, scale, vertexPath, fragmentPath) {


    let vertexShader = await getShaderString(vertexPath);
    let fragmentShader = await getShaderString(fragmentPath);

    console.log(vertexShader,fragmentShader);

    return new PhongMaterial(color, specular, light, translate, scale, vertexShader, fragmentShader);

}