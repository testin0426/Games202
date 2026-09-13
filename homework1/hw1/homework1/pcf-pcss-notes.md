---
title: Games202 - PCF 与 PCSS
date: 2026-08-28
tags: [CG]
---

PCF 与 PCSS 笔记 —— 基于 GAMES202 作业一 Shadow Map 框架

---

## PCF

### 核心理解

shadow map 每个位置（`coords.xy`）存的是"该处离光源最近的深度"。PCF 做的事是：

> 以 `coords.xy` 为中心，在周围**随机取 N 个点**做深度比较，把 N 次 0/1 结果取平均，得到 0~1 的连续 visibility。

采样点位置：

```glsl
coords.xy + poissonDisk[i] * filterSize
```

**关键澄清**（课上强调的点）：

- 不是对 `step` 的结果做模糊；
- 也不是"检测阴影边缘再做模糊"；
- 而是**对 shadow map 本身多采样**（每个采样点独立做一次遮挡比较），再对比较结果求平均。

只有阴影**边界**附近的点才会采样到"一半是遮挡、一半不是"的情况，平均出来是灰 → 软边缘。完全在阴影内/外的点，所有采样结果一致，平均还是 0 或 1。

### 采样点生成（均匀圆盘采样）

```glsl
void uniformDiskSamples( const in vec2 randomSeed ) {
  float randNum = rand_2to1(randomSeed);
  float sampleX = rand_1to1( randNum );
  float sampleY = rand_1to1( sampleX );

  float angle = sampleX * PI2;
  float radius = sqrt(sampleY);

  for( int i = 0; i < NUM_SAMPLES; i ++ ) {
    poissonDisk[i] = vec2( radius * cos(angle), radius * sin(angle) );

    sampleX = rand_1to1( sampleY );
    sampleY = rand_1to1( sampleX );

    angle = sampleX * PI2;
    radius = sqrt(sampleY);
  }
}
```

- 用 `coords.xy` 作随机种子 → 每个像素的采样模式**固定**（不会每帧闪烁）。
- 半径范围 `0 ~ 1`（UV 单位），实际使用时要乘 `filterSize` 缩小。

### 滤波循环（每点一次比较，求平均）

```glsl
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
```

逐行含义：

| 代码 | 含义 |
|---|---|
| `coords.xy + poissonDisk[i] * uFilterScale` | 第 i 个采样点的 UV = 中心 + 偏移 × 滤波半径 |
| `unpack(texture2D(...))` | 读出该 texel 存的最近深度 `z[i]` |
| `step(coords.z - uBias, z[i])` | 该采样点的遮挡判定（bias 容忍量化误差） |
| `sum / float(NUM_SAMPLES)` | N 次判定取平均 → 0~1 visibility |

### 偏移量的单位（texel space）

shadow map 是 `2048 × 2048`，一个 texel 在 UV 空间约 `1/2048 ≈ 0.0005`。

- `uFilterScale = 0.003` ≈ 6 个 texel 的滤波半径。
- **偏移必须乘在偏移上**（`poissonDisk[i] * scale`），不能乘在采样结果（深度值）上——乘错对象会导致深度被破坏、全图噪声。

---

## PCSS

### 总体思路

以 `coords.xy` 为圆心，在固定半径内查周围点 → 求 blocker 的平均深度 → 由平均深度算半影宽度 → 用半影宽度做 PCF 的滤波半径 → 得到最终 visibility。

```
STEP 1: 找 blocker，求平均深度 avgBlocker
STEP 2: 由 avgBlocker 算半影宽度 r（纯算术，不采样）
STEP 3: 用 r 做滤波半径跑 PCF → 最终 visibility
```

### STEP 1：平均 blocker 深度

```glsl
float radius = float(NUM_RINGS) * 0.5;

for(int i = 0; i < NUM_RINGS; ++i){
  z[i] = unpack(texture2D(shadowMap, coords.xy + (float(i) - radius) * 0.01));
  if(findBlocker(shadowMap,  coords.xy + (float(i) - radius) * 0.01, coords.z) == 1.){
    sum += z[i];   // 累加 blocker 的深度
    count += 1.;   // 计数
  }
}

if(count == 0.) return 1.;        // 周围没有遮挡物 → 完全被照亮
avgblocker += sum / count;        // blocker 平均深度
```

要点：

- 搜索范围：`(float(i) - radius) * 0.01`，i 从 0 到 `NUM_RINGS-1`，覆盖中心两侧的网格点。
- blocker 判定：`z < zReceiver`（shadow map 里的深度比接收面浅 → 有东西挡在前面）。
- **读深度和判 blocker 必须在同一个采样点**（同一 UV），否则平均出来的深度与判定脱节。
- `count == 0` 说明该片元完全没被挡 → 直接返回 1（亮），跳过后续。

### STEP 2：半影宽度

```glsl
r = (coords.z - avgblocker) / avgblocker * lightWidth;
```

相似三角形关系：

$$\text{penumbra} = \text{lightWidth} \times \frac{z_{\text{Receiver}} - z_{\text{Blocker}}}{z_{\text{Blocker}}}$$

- 接收面离 blocker 越远（分子越大）→ 半影越宽 → 阴影边缘越软。
- 接收面贴着 blocker（分子→0）→ 半影→0 → 阴影边缘锐利（接触点处）。

### STEP 3：用半影宽度做 PCF

```glsl
sum = 0.;                         // 重要：复用 sum 前必须清零
uniformDiskSamples(coords.xy);
for(int i = 0; i < NUM_SAMPLES; ++i){
  z[i] = unpack(texture2D(shadowMap, coords.xy + poissonDisk[i] * r * uFilterScale));
  tmp[i] = step(coords.z - uBias, z[i]);
  sum += tmp[i];
}

return sum / float(NUM_SAMPLES);
```

- 与 PCF 结构完全相同，只是滤波半径变成了 `r * uFilterScale`（半影宽度 × 基础尺度）。
- 半影宽度随距离变化 → 阴影软硬随距离变化：**根部硬、远端软**，这是 PCSS 区别于 PCF 的视觉签名。

### 完整函数

```glsl
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
      sum += z[i];
      count += 1.;
    }
  }

  if(count == 0.) return 1.;
  avgblocker += sum / count;

  // STEP 2: penumbra size
  r = (coords.z - avgblocker) / avgblocker * lightWidth;

  // STEP 3: filtering
  sum = 0.;
  uniformDiskSamples(coords.xy);
  for(int i = 0; i < NUM_SAMPLES; ++i){
    z[i] = unpack(texture2D(shadowMap, coords.xy + poissonDisk[i] * r * uFilterScale));
    tmp[i] = step(coords.z - uBias, z[i]);
    sum += tmp[i];
  }

  return sum / float(NUM_SAMPLES);
}
```

### 踩坑清单（本次调试沉淀）

1. **偏移缩放乘在偏移上**：`poissonDisk[i] * scale` 是对的；`texture2D(...) * 0.001`（乘在深度上）是错的。
2. **读深度与判 blocker 同一采样点**：不一致会让 avgBlocker 混入随机成分。
3. **`sum` 复用前清零**：STEP 1 的累加和会污染 STEP 3。
4. **循环边界对齐数组大小**：`poissonDisk` 有 `NUM_SAMPLES` 个元素，循环别超过；GLSL ES 1.00 循环上限必须是编译期常量。
5. **`count == 0` 提前返回 1**：完全被照亮的点不需要走后续步骤。
