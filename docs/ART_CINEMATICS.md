# 过场视频素材

本组素材来自用户提供的桌面视频。本轮只使用 FFmpeg 将 MP4 容器重排为 faststart 布局；H.264 与 AAC 音视频流均直接复制，没有重新编码、裁切或调整画面与音量。原桌面文件保留不动。素材的创作方式和作者信息未作推断，本轮没有使用 AI 工具生成这些视频。

| 用户提供文件 | 项目资源 | 用途 |
| --- | --- | --- |
| `开场1.mp4` | `public/assets/video/escape-opening-v1.mp4` | 新游戏从两段开场中等概率随机选播 |
| `开场2.mp4` | `public/assets/video/escape-opening-2-v1.mp4` | 新游戏从两段开场中等概率随机选播 |
| `被抓1.mp4` | `public/assets/video/escape-caught-1-v1.mp4` | 被抓时三段视频之一；由运行时随机选播 |
| `被抓2.mp4` | `public/assets/video/escape-caught-2-v1.mp4` | 被抓时三段视频之一；由运行时随机选播 |
| `被抓3.mp4` | `public/assets/video/escape-caught-3-v1.mp4` | 被抓时三段视频之一；由运行时随机选播 |

五段视频均为 1280 × 720、H.264 High、yuv420p、24 fps，含 AAC-LC、48 kHz、双声道立体声音频。视频流为 240 帧（10.000 秒），容器时长为 10.005 秒。FFmpeg 使用 `-map 0 -c copy -movflags +faststart -map_metadata -1`；移除了容器级元数据，视频与音频码流未转码。0.16.2 新增开场2，两路码流的 streamhash 与桌面源文件一致，完整解码无错误；五段影片均加入启动预缓存与离线 Range。

| 项目资源 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `escape-opening-v1.mp4` | 2,835,923 | `e5d5d355fffe13945126da2b4fcaf48bddb5be995a3a9afae5c8cb6e9d75c9f5` |
| `escape-opening-2-v1.mp4` | 3,614,924 | `589389b71a24288c7c76b45743dcdd88397c700b7d67446ca5475bce808fe584` |
| `escape-caught-1-v1.mp4` | 3,706,266 | `5c6e2f289724c935cc26913f23a412976d773527f408caaafcfc76510d32e998` |
| `escape-caught-2-v1.mp4` | 4,077,054 | `bc4f3365648743d0bbd7b9fed3d73846ba59359ba63424ed2e3c99be3a29b8cf` |
| `escape-caught-3-v1.mp4` | 4,015,927 | `c7c25f7822f28af68d6e393c4a48cba233b7a9f5fab2c79cf55bf6a71108b114` |
