---
title: Games202 - PRT 预计算（光系数与传输系数）
date: 2026-09-04
tags: [CG]
---

PRT 预计算笔记 —— GAMES202 作业二 `prt.cpp` 的 preprocess 部分

---

## 核心思想回顾

渲染方程（漫反射）的积分项可以拆成"光"和"传输"两部分，各自投影到球谐基（SH），渲染时只做点积：

$$
L_o(x) = \frac{\rho}{\pi}\int_\Omega L_i(\omega)\,T(\omega)\,d\omega
\;\xrightarrow{\text{SH 正交性}}\;
\sum_{l,m} L_{lm}\, T_{lm}
$$

- **光系数** $L_{lm}$：环境贴图投影到 SH（全局一份）。
- **传输系数** $T_{lm}$：每个顶点的 $T(\omega)=\max(N\cdot\omega,0)\cdot V(\omega)$ 投影到 SH（每顶点一份）。

系数就是"函数在基函数轴上的投影"：

$$
c_{lm} = \int_\Omega f(\omega)\,Y_{lm}(\omega)\,d\omega
$$

类比向量坐标 $c_x = \vec{v}\cdot\vec{e}_x$：**乘起来再积分**就是"点积"本身。

---

## 一、光系数：PrecomputeCubemapSH

### 离散化

积分无法解析计算，逐像素近似求和（cubemap 的每个像素贡献一份）：

$$
c_{lm} \approx \sum_{\text{px}} f(\omega_p)\, Y_{lm}(\omega_p)\, \Delta\omega_p
$$

| 数学量 | 代码 |
|---|---|
| $f(\omega_p)$（光函数值） | `Le`（该像素 RGB） |
| $Y_{lm}(\omega_p)$（基函数值） | `sh::EvalSH(l, m, dirD)` |
| $\Delta\omega_p$（立体角） | `CalcArea(x, y, width, height)` |

### 像素方向

每个面的方向由三个轴向量拼出（`cubemapFaceDirections`）：

```cpp
Eigen::Vector3f dir = (faceDirX * u + faceDirY * v + faceDirZ).normalized();
// u, v ∈ [-1, 1]，取自像素中心 (x + 0.5) / width
```

### 累加循环（核心）

```cpp
for (int i = 0; i < 6; i++)                 // 6 个面
    for (int y = 0; y < height; y++)
        for (int x = 0; x < width; x++) {
            Eigen::Vector3f dir = cubemapDirs[i * width * height + y * width + x];
            int index = (y * width + x) * channel;
            Eigen::Array3f Le(images[i][index + 0], images[i][index + 1],
                              images[i][index + 2]);

            float angle = CalcArea(x, y, width, height);          // 注意签名 (u_, v_, width, height)
            Eigen::Vector3d dirD = dir.cast<double>();            // EvalSH 要 double

            for (int l = 0; l <= SHOrder; ++l)                    // 阶数循环
                for (int m = -l; m <= l; ++m)                     // 每个阶有 2l+1 个 m
                    SHCoeffiecents[sh::GetIndex(l, m)] +=
                        Le * sh::EvalSH(l, m, dirD) * angle;      // f × Y × dω
        }
```

要点：

- `GetIndex(l, m) = l*(l+1)+m`：把 (l,m) 对压成扁平下标。
- `EvalSH` 需要 `Eigen::Vector3d`，`dir` 是 `Vector3f`，要 `cast<double>()`。
- 2 阶 SH → 9 个系数，`GetIndex` 下标范围 [0, 8]。

### 为什么叫"滤波"却不是模糊

- 不是"邻域像素取平均再存回"的空间域模糊。
- 是**投影到 SH 基 + 截断到 2 阶**：高频细节全部丢掉，等价于低通滤波。
- 依据（Ramamoorthi & Hanrahan 2001）：漫反射 BRDF 本身就是低通滤波器，光照与 cos 核卷积后只含低频，9 个系数近似误差约 1%。

---

## 二、传输系数：shFunc + ProjectFunction

### 职责分工（关键）

- `shFunc(phi, theta)`：给定一个方向，返回**一个数**——传输函数值 $T(\omega)$。
- `ProjectFunction(order, func, sample_count)`：内部做**分层均匀球面采样 + 乘基函数累加 + 乘权重 $4\pi/N$**，返回系数向量。

所以 `shFunc` 只写一句话级别，投影由 `ProjectFunction` 包办。

### unshadowed

$$T(\omega) = \max(N\cdot\omega,\ 0)$$

```cpp
auto shFunc = [&](double phi, double theta) -> double {
    Eigen::Array3d d = sh::ToVector(phi, theta);
    const auto wi = Vector3f(d.x(), d.y(), d.z());
    if (m_Type == Type::Unshadowed)
        return std::max(0.0f, n.dot(wi));     // 就是 H，一个数
    ...
};
```

### shadowed：可见性 = 一次射线求交

$$T(\omega) = \max(N\cdot\omega,\ 0)\cdot V(\omega)$$

```cpp
else  // Shadowed
{
    float H = n.dot(wi);
    if (H < 0.0) return 0.0f;               // 下半球直接 0，省一次求交

    Intersection its;
    Ray3f ray(v, wi);                       // 默认 mint = Epsilon，自动避免自相交
    if (scene->rayIntersect(ray, its))
        return 0.0f;                        // 有遮挡 → V = 0
    return H;                               // 无遮挡 → V = 1
}
```

- `scene->rayIntersect(const Ray3f&, Intersection&) const`：命中返回 true。
- `Ray3f(o, d)` 默认 `mint = Epsilon`（ray.h），不需要手动偏移起点。
- 先判 H 后打射线，省一半求交；`m_SampleCount`（默认 100）控制精度，每顶点要打几百根射线，这就是预计算的耗时来源。

### ProjectFunction 内部的权重

```cpp
auto shCoeff = sh::ProjectFunction(SHOrder, shFunc, m_SampleCount);
for (int j = 0; j < shCoeff->size(); j++)
    m_TransportSHCoeffs.col(i).coeffRef(j) = (*shCoeff)[j];
```

- 采样数会被取成不大于它的最大完全平方数。
- 权重 $4\pi/N$ 来自均匀球面采样的概率密度（球面积 $4\pi$），在库内部已乘好。

---

## 三、关于讲义里的 rgb offset

讲义伪代码：

```
result[j + red_offset]   += value;
result[j + green_offset] += value;
result[j + blue_offset]  += value;
```

- `red/green/blue_offset` **不是材质属性**（不是 metallic/roughness），是系数数组里 RGB 三个通道的存储偏移。
- 原因：传输项是"无色"标量，光系数是 RGB 三通道 → 把同一标量复制三份对齐 RGB。
- **本框架不需要**：`m_TransportSHCoeffs` 是 `SHCoeffLength × vertexCount` 的标量矩阵，`Li()` 里用同一个向量分别和 `rL/gL/bL` 点积，天然对齐。

---

## 四、渲染端（Li）

```cpp
Color3f c0 = Color3f(rL.dot(sh0), gL.dot(sh0), bL.dot(sh0));   // 光系数 · 传输系数
```

- 三角形三顶点分别点积，重心坐标插值。
- 系数算完后可删除法线可视化的四行（`c.isZero()` 分支）。

---

## 五、踩坑清单

1. `CalcArea(u, v, x, y)` 参数顺序错 → 签名是 `CalcArea(u_, v_, width, height)`，传 `(x, y, width, height)`。
2. `ProjectFunction` 不该用于光投影 → 它给解析函数用；cubemap 光要自己逐像素累加 `EvalSH`。
3. `shFunc` 里又写一遍 SH 投影循环 → 投影做了两遍；它只需返回一个标量。
4. 循环 `m < l` 应为 `m <= l`。
5. `EvalSH` 要 `Vector3d`：`dir.cast<double>()`。
6. `l <= SHOrder` 而不是 `l < SHNum`（SHNum=9 是系数个数不是阶数）。
7. `ProjectFunction` 的第一个参数是"最大阶数"，不是系数下标。

---

## 六、web 端调试全记录（症状 → 根因）

### 核心假设

整个 PRT 管线建立在一条隐含假设上：

> **一个 OBJ 文件 = 一个 mesh = 一整份按文件顺序平铺的顶点数据**（transport.txt 就是按"面-顶点顺序"写的平铺数组，长度 = 3×面数×9）。

任何破坏该假设的模型特性，都会导致**顶点与系数错位**，表现为"三角形面分明、局部黑块"。

### 错位来源（模型文件特性）

| 模型特性 | 后果 | 修复 |
|---|---|---|
| 四边形/多边形面 | Nori 与 three.js 三角化方式不同 → 面序错位 | 三角化（`triangulate_obj.js`，扇形） |
| `usemtl` 多材质 | three.js 按材质拆多个子 mesh，每个都拿整份平铺数组从头读 | 删除 `usemtl` 行 |
| `o`/`g` 多对象 | three.js 按对象拆多个子 mesh，同上 | 删除 `o`/`g` 行 |
| scenes 与 assets 文件版本不同 | 几何与 transport 来自不同模型 | 两端用同一份文件 |

> bunny 是单对象、单材质、全三角形的干净 OBJ，所以官方流程用 bunny 从未暴露这些问题。

### WebGL 与工程坑

| 问题 | 后果 | 修复 |
|---|---|---|
| `drawElements` + `Uint16Array` 索引 | 顶点数 > 65535 时索引回绕 → 三角形乱画 | 改 `gl.drawArrays(TRIANGLES, 0, count)`（索引本来就是 0..N-1） |
| OBJ/MTL/txt 加载无 cache-busting | 浏览器喂旧数据 | URL 加 `?t=Date.now()` |
| transport 解析 off-by-one | 丢最后一个系数 | 跳过首行（顶点数）后取完所有 token |
| mat3 attribute 绑定 | 需 3 个连续 location、stride=36、offset 0/12/24 | Mesh/MeshRender 增加 extraAttribs 通路 |
| `Mesh.js` 参数与局部变量重名 | `SyntaxError` → 整个脚本失效 → 连锁 `Mesh is not defined` | 删冗余局部变量 |
| ps1 脚本含中文注释 | PowerShell 5.1 按 ANSI 读脚本 → 乱码报错 | 脚本用 ASCII |

### shadowed 的 SH 振铃（不是 bug）

- 可见性 $V(\omega)$ 是 0/1 跳变的**不连续函数**，2 阶 SH 截断产生振荡 → 重建出负值 → clamp 成黑块。
- 这是低阶 SH 的固有伪影，C++ 的 `prt.png` 预览同样存在。
- unshadowed 是平滑的 $\cos$ 项，没有此问题 → 可作为报告对比内容。
- 高模黑块更小：顶点密度高时振铃更细碎。

### 校验与工具

- 对齐校验（node）：`transport.txt` token 数 == `1 + 9 × 3 × 面数`。
- 同步脚本：`Assignment2/sync_prt.ps1`（scenes/cubemap → assets/cubemap，三个环境贴图）。
- 标准流程：改 `prt.xml` → 跑 nori → 跑 sync → `Ctrl+Shift+R`。
- 换任何模型前：三角化 + 删 `o`/`g`/`usemtl` + 两端同文件。
