// PRT 材质：颜色 = 光系数(3×9) · 传输系数(每顶点 9)，在顶点着色器里点积算好插值
let _prtLightCache = {};

function PRTGetLightCoeffs() {
    let id = guiParams.envmapId;
    if (_prtLightCache[id]) return _prtLightCache[id];

    // uniform mat3 uPrecomputeL[3]：3 个 mat3（RGB），列主序，一次传 27 个 float
    let arr = new Float32Array(27);
    let L = precomputeL[id];
    for (let j = 0; j < 9; j++) {
        arr[j]      = L[j][0];  // R 通道
        arr[9 + j]  = L[j][1];  // G 通道
        arr[18 + j] = L[j][2];  // B 通道
    }
    _prtLightCache[id] = arr;
    return arr;
}

class ShMaterial extends Material {

    constructor(vertexShader, fragmentShader) {
        super({
            // 光系数：getter 实时读当前选中的环境贴图，切换 envmap 无需重建材质
            'uPrecomputeL': { type: 'matrix3fv', get value() { return PRTGetLightCoeffs(); } },
        }, [], vertexShader, fragmentShader, null);
    }
}

async function buildShMaterial(vertexPath, fragmentPath) {

    let vertexShader = await getShaderString(vertexPath);
    let fragmentShader = await getShaderString(fragmentPath);

    return new ShMaterial(vertexShader, fragmentShader);

}