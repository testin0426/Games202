class PhongMaterial extends Material {

/**
4 * Creates an instance of PhongMaterial .
5 * @param {vec3f} color The material color
6 * @param { Texture } colorMap The texture object of the material
7 * @param {vec3f} specular The material specular coefficient
8 * @param {float} intensity The light intensity
9 * @memberof PhongMaterial
10 */
    constructor (color , colorMap , specular , intensity ) {
        const textureSample = colorMap != null ? 1 : 0;
        const uniforms = {
            'uTextureSample': { type: '1i', value: textureSample },
            'uKd': { type: '3fv', value: color },
            'uKs': { type: '3fv', value: specular },
            'uLightIntensity': { type: '1f', value: intensity }
        };

        if (colorMap != null) {
            uniforms.uSampler = { type: 'texture', value: colorMap };
        }

        super(uniforms, [], PhongVertexShader, PhongFragmentShader);
    }
}