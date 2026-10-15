# 背景音乐

《奶蛙泡泡日 · 柔和和声版》是本项目原创配乐，经用户试听后选用于替换单音合成 BGM。

- 92 BPM，C 大调，4/4，16 小节，约 41.739 秒。
- Cmaj9 → G/B → Am7 → Em7 → Fmaj9 → C/E → Dm7 → Gsus4–G7。
- 钢琴分解和弦、颤音琴旋律、原声低音；第二遍有少量旋律变化。
- MIDI 曲谱在 FL Studio 20 中使用 MIDI Out 和 Fruity LSD 配器、开启内置混响并实际渲染，未使用原打开示例工程的音乐内容。
- 原始渲染：44.1 kHz、双声道、24-bit WAV，Full song、Wrap remainder、HQ 插件；导出后统一增加 16 dB，峰值 -4.239 dBFS、无削波，再编码为 192 kbps MP3。
- 游戏资源：`public/assets/audio/bubble-day-soft-v1.mp3`，1,003,191 字节，与用户选定的试听文件逐字节一致。

使用同源音频文件并加入 PWA 预缓存；用户手势解锁后由 Web Audio 解码一次，以 AudioBuffer 循环播放。暂停、静音或进入后台会停止输出，恢复时从原位置继续；关闭设置会取消试听，加载中的旧请求不能触发过期试听。设置试听不改变原有音乐开关，音乐仍默认关闭；音效继续由 Web Audio 合成。

可编辑 FLP、MIDI 曲谱和无损母版保留在维护者本机的忽略目录 `.local/music-studio/`，不随站点部署。
