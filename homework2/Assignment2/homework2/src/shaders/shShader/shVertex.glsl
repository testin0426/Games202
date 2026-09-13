attribute vec3 aVertexPosition;
attribute vec3 aNormalPosition;
attribute mat3 aPrecomputeLT;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uPrecomputeL[3];

varying highp vec3 vColor;

void main(void) {

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix *
                vec4(aVertexPosition, 1.0);

  // 颜色 = 光系数 · 传输系数（逐通道点积）
  vColor.r = dot(aPrecomputeLT[0], uPrecomputeL[0][0]) +
             dot(aPrecomputeLT[1], uPrecomputeL[0][1]) +
             dot(aPrecomputeLT[2], uPrecomputeL[0][2]);
  vColor.g = dot(aPrecomputeLT[0], uPrecomputeL[1][0]) +
             dot(aPrecomputeLT[1], uPrecomputeL[1][1]) +
             dot(aPrecomputeLT[2], uPrecomputeL[1][2]);
  vColor.b = dot(aPrecomputeLT[0], uPrecomputeL[2][0]) +
             dot(aPrecomputeLT[1], uPrecomputeL[2][1]) +
             dot(aPrecomputeLT[2], uPrecomputeL[2][2]);
}