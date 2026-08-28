#ifdef GL_ES
precision mediump float;
#endif

// Phong related variables
uniform sampler2D uSampler;
uniform vec3 uKd;
uniform vec3 uKs;
uniform vec3 uLightPos;
uniform vec3 uCameraPos;
uniform vec3 uLightIntensity;

varying highp vec2 vTextureCoord;
varying highp vec3 vFragPos;
varying highp vec3 vNormal;

// Shadow map related variables
#define NUM_SAMPLES 14
#define BLOCKER_SEARCH_NUM_SAMPLES NUM_SAMPLES
#define PCF_NUM_SAMPLES NUM_SAMPLES
#define NUM_RINGS 7

#define EPS 1e-3
#define PI 3.141592653589793
#define PI2 6.283185307179586

uniform sampler2D uShadowMap;
uniform float uBias;
uniform float uFilterScale;
uniform int uDebugMode;

varying vec4 vPositionFromLight;

highp float rand_1to1(highp float x ) { 
  // -1 -1
  return fract(sin(x)*10000.0);
}

highp float rand_2to1(vec2 uv ) { 
  // 0 - 1
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}

float unpack(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
    return dot(rgbaDepth, bitShift);
}

vec2 poissonDisk[NUM_SAMPLES];

void poissonDiskSamples( const in vec2 randomSeed ) {

  float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );
  float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );

  float angle = rand_2to1( randomSeed ) * PI2;
  float radius = INV_NUM_SAMPLES;
  float radiusStep = radius;

  for( int i = 0; i < NUM_SAMPLES; i ++ ) {
    poissonDisk[i] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
    radius += radiusStep;
    angle += ANGLE_STEP;
  }
}

void uniformDiskSamples( const in vec2 randomSeed ) {

  float randNum = rand_2to1(randomSeed);
  float sampleX = rand_1to1( randNum ) ;
  float sampleY = rand_1to1( sampleX ) ;

  float angle = sampleX * PI2;
  float radius = sqrt(sampleY);

  for( int i = 0; i < NUM_SAMPLES; i ++ ) {
    poissonDisk[i] = vec2( radius * cos(angle) , radius * sin(angle)  );

    sampleX = rand_1to1( sampleY ) ;
    sampleY = rand_1to1( sampleX ) ;

    angle = sampleX * PI2;
    radius = sqrt(sampleY);
  }
}

float findBlocker( sampler2D shadowMap, vec2 uv, float zReceiver ) {
  float z = unpack(texture2D(shadowMap, uv));

  
  if(zReceiver > z )
    return 1.0;
  return 0.;	
}

float PCF(sampler2D shadowMap, vec4 coords) {
  float z[NUM_SAMPLES];
  float tmp[NUM_SAMPLES];

  float sum = 0.0;
  
  uniformDiskSamples(coords.xy);
  for(int i = 0; i < NUM_SAMPLES; ++i){
    z[i] = unpack(texture2D(shadowMap, coords.xy + poissonDisk[i] * uFilterScale));
    tmp[i] = step(coords.z - uBias, z[i]);
    sum += tmp[i];
  }
  
  return sum / float(NUM_SAMPLES);
}

float PCSS(sampler2D shadowMap, vec4 coords){
  
  float z[NUM_RINGS];
  float tmp[NUM_RINGS];
  float sum = 0.0;
  float avgblocker = 0.0;
  float r = 0.0;
  float count = 0.;
  float lightWidth = 10.;


  float radius = float(NUM_RINGS) * 0.5;

  
  // STEP 1: avgblocker depth
  for(int i = 0; i < NUM_RINGS; ++i){
    z[i] = unpack(texture2D(shadowMap, coords.xy + (float(i) - radius) * 0.01));
    if(findBlocker(shadowMap,  coords.xy + (float(i) - radius) * 0.01, coords.z) == 1.){
      sum += z[i]; //whats this mean...add z[i]? (shadowmap?)
      count += 1.;
    }
  }
  
  if(count == 0.) return 1.;
  avgblocker += sum / count;
  
  
  // STEP 2: penumbra size
  r = (coords.z - avgblocker) / avgblocker * lightWidth;
  
  
  sum = 0.;
  // STEP 3: filtering
  uniformDiskSamples(coords.xy);
  for(int i = 0; i < NUM_SAMPLES; ++i){
    z[i] = unpack(texture2D(shadowMap, coords.xy + poissonDisk[i] * r * uFilterScale));
    tmp[i] = step(coords.z - uBias, z[i]);
    sum += tmp[i];
  }

  return sum / float(NUM_SAMPLES);

}


float useShadowMap(sampler2D shadowMap, vec4 shadowCoord){
  
  float z = unpack(texture2D(shadowMap, shadowCoord.xy));

  return step(shadowCoord.z - uBias, z);
  //return smoothstep(shadowCoord.z - 0.008, shadowCoord.z - 0.01, z);
}

vec3 blinnPhong() {
  vec3 color = texture2D(uSampler, vTextureCoord).rgb;
  color = pow(color, vec3(2.2));

  vec3 ambient = 0.05 * color;

  vec3 lightDir = normalize(uLightPos);
  vec3 normal = normalize(vNormal);
  float diff = max(dot(lightDir, normal), 0.0);
  vec3 light_atten_coff =
      uLightIntensity / pow(length(uLightPos - vFragPos), 2.0);
  vec3 diffuse = diff * light_atten_coff * color;

  vec3 viewDir = normalize(uCameraPos - vFragPos);
  vec3 halfDir = normalize((lightDir + viewDir));
  float spec = pow(max(dot(halfDir, normal), 0.0), 32.0);
  vec3 specular = uKs * light_atten_coff * spec;

  vec3 radiance = (ambient + diffuse + specular);
  vec3 phongColor = pow(radiance, vec3(1.0 / 2.2));
  return phongColor;
}

void main(void) {

  float visibility;

  
  vec3 shadowCoord = vPositionFromLight.xyz / vPositionFromLight.w * 0.5 + 0.5;
  

  visibility = useShadowMap(uShadowMap, vec4(shadowCoord, 1.0));
  //if(visibility < 0.1)
  visibility = PCF(uShadowMap, vec4(shadowCoord, 1.0));
  
  visibility = PCSS(uShadowMap, vec4(shadowCoord, 1.0));

  vec3 phongColor = blinnPhong();

  if (uDebugMode == 1) {
    // ask
    gl_FragColor = vec4(vec3(visibility), 1.0);
  } else if (uDebugMode == 2) {
    // shadow map
    float z = unpack(texture2D(uShadowMap, shadowCoord.xy));
    gl_FragColor = vec4(vec3(z), 1.0);
  } else if (uDebugMode == 3) {
    // shadowCoord.z
    gl_FragColor = vec4(vec3(shadowCoord.z), 1.0);
  } else if (uDebugMode == 4) {
    // shadowCoord.xy（UV）
    gl_FragColor = vec4(shadowCoord.xy, 0.0, 1.0);
  } else {
    gl_FragColor = vec4(phongColor * visibility, 1.0);
  }
}