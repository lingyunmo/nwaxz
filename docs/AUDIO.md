# 背景音乐

## iPhone 媒体通道兼容（0.9.1 候选）

iOS 的 WebAudio 默认会话可能使用 ambient 通道，侧边静音开关可将其静音，即使 AudioContext 为 running、分析器有非零样本，也不能据此声称扬声器发声。优先在用户手势中设置 `navigator.audioSession.type = "playback"`；WebKit 参考见 [237322](https://bugs.webkit.org/show_bug.cgi?id=237322)、[251532](https://bugs.webkit.org/show_bug.cgi?id=251532)。这是与用户症状相符的兼容机制，不代表已远程确认手机的物理静音开关或系统内部状态。

没有此 API 或 setter 受限时，仅 Apple 触控设备使用 `ios-session-v1.mp3` 开通媒体通道。它是专用全静音素材（1 秒、44.1 kHz 单声道、32 kbps、4407 字节），用于兼容旧 iOS，不是背景音乐，也不替换任何可听录音。生成命令：

```sh
ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -c:a libmp3lame -b:a 32k public/assets/audio/ios-session-v1.mp3
```

复用同一原生 audio 元素，在手势内先 play 再等待 WebAudio；预览结束、暂停、静音、后台和销毁时清理。桌面不创建该循环。该资源有内容修订并加入离线预缓存，不需要麦克风权限。

解锁监听 pointerdown、pointerup、touchend、click、keydown；一个未完成的 resume 不阻塞下一次真实手势，每次等待最多 2 秒，失败能再次尝试，兼容 webkitAudioContext。触摸结束后的激活参考 [Chrome Web Audio autoplay](https://developer.chrome.com/blog/web-audio-autoplay)。设置中的“恢复声音”重新请求媒体会话并直接试听音效，不更改已有音乐和音效开关。

当前修复通过自动测试、桌面真实声音链路及模拟 API 分支检查；iPhone Safari/微信的实际听感仍待用户在更新后确认。模拟手机视口或 navigator API 不等于 WebKit 真机验收。

## 普通模式配乐

《奶蛙泡泡日 · 柔和和声版》是本项目原创配乐，经用户试听后选用于替换单音合成 BGM。

- 92 BPM，C 大调，4/4，16 小节，约 41.739 秒。
- Cmaj9 → G/B → Am7 → Em7 → Fmaj9 → C/E → Dm7 → Gsus4–G7。
- 钢琴分解和弦、颤音琴旋律、原声低音；第二遍有少量旋律变化。
- MIDI 曲谱在 FL Studio 20 中使用 MIDI Out 和 Fruity LSD 配器、开启内置混响并实际渲染，未使用原打开示例工程的音乐内容。
- 原始渲染：44.1 kHz、双声道、24-bit WAV，Full song、Wrap remainder、HQ 插件；导出后统一增加 16 dB，峰值 -4.239 dBFS、无削波，再编码为 192 kbps MP3。
- 游戏资源：`public/assets/audio/bubble-day-soft-v1.mp3`，1,003,191 字节，与用户选定的试听文件逐字节一致。

使用同源音频文件并加入 PWA 预缓存；用户手势解锁后由 Web Audio 解码一次，以 AudioBuffer 循环播放。暂停、静音或进入后台会停止输出，恢复时从原位置继续；关闭设置会取消试听，加载中的旧请求不能触发过期试听。设置试听不改变原有音乐开关，音乐仍默认关闭；音效继续由 Web Audio 合成。

可编辑 FLP、MIDI 曲谱和无损母版保留在维护者本机的忽略目录 `.local/music-studio/`，不随站点部署。

## 恐怖模式（0.9.0）

普通模式继续使用用户选定的钢琴录音。恐怖模式独立使用 `haunted-bath-v1.mp3`（32 秒，48 kHz，192 kbps），以低沉持续音、风声和少量金属泛音构成循环氛围；`haunted-laugh-v1.mp3`（2.35 秒，48 kHz，160 kbps）是元音泛音与气声合成的三声怪笑，并非真人录音。生成脚本为 `ops/generate-horror-audio.mjs`，需要本机 FFmpeg；WAV 中间文件只保留于忽略目录 `.local/horror-audio/`。

氛围录音 mean -17.4 dBFS、峰值 -4.5 dBFS；怪笑 mean -20.8 dBFS、峰值 -0.6 dBFS。编码保留 Xing 的延迟/填充元数据，浏览器解码分别为 32 和 2.35 秒，氛围循环结束点为 32 秒。游戏中怪笑输出增益 .32，遵循音效开关；氛围音遵循背景音乐开关。暂停、后台、退出关卡和切换模式均清理怪笑与过期下载，恢复关卡时续播氛围；普通钢琴缓存独立保留。

SHA256：氛围 `479333fcb6b584740dc5a4963c64dd7f17ae6c3383a020a766387958d2da406b`；怪笑 `25804c3d6924f47fcf3e9ccf3cde91b375e16a86dc4c5f6331aa0c94959faea7`。所有录音加入同源离线预缓存。
