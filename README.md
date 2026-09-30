# 小雨点儿出门了

送给老婆的 2D 网页短篇解谜游戏。小雨点儿从家里出门，经过公园、相册亭和冰淇淋店，再回到收拾好的小家。六个场景、四个可以实际操作的谜题，搭配原稿字幕、个人配音和可自由翻看的相册。

线上游玩：[小雨点儿出门了](https://peytonliubruin.github.io/xiaoyudianersanbu/)。

游玩目标约 **8–12 分钟**，不是已经测得的通关时长。40 段配音的素材时长合计约 **217 秒**；实际游玩会因解谜、重试、支线反应和看照片而变化，没有倒计时。

远程仓库开始时为空，本项目从零实现。使用 TypeScript、Phaser 和 Vite；构建结果是纯静态文件。运行时没有后端、账号、外部 API 或 CDN，只读取同站资源。已放入 22 张游戏素材、7 张相册照片、40 段配音和 11 个 CC0 动作音效。没有背景音乐。

## 本地启动

源码开发需要 Node.js **22.12 或更新版本**（工作流使用 Node.js 24）。在项目根目录执行：

```sh
npm ci
npm run dev
```

在浏览器打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)。开发窗口需要保持开启。依赖版本已锁定在 `package-lock.json`；安装时需要 npm 网络访问，游戏本身不调用外部服务。

运行检查并生成成品：

```sh
npm test
npm run build
npm run play
```

构建文件位于 `dist/`，本地成品地址为 [http://127.0.0.1:4173](http://127.0.0.1:4173)。也可使用 `npm run preview`。请通过本地服务器打开，不要直接双击 `index.html`。

解压后的静态成品若含 `scripts/serve.mjs`，安装 Node.js 后执行 `node scripts/serve.mjs` 即可，不需要再安装 npm 依赖。服务器默认仅监听本机；按 Ctrl+C 结束。

测试 GitHub Pages 的子路径：

```sh
npm run play -- --base=/xiaoyudianersanbu/
```

打开 [http://127.0.0.1:4173/xiaoyudianersanbu/](http://127.0.0.1:4173/xiaoyudianersanbu/)。端口占用时可加 `--port=4174`。Vite 使用 `base: './'`，相对资源路径支持根目录及仓库子目录。

## 怎么玩

- 鼠标点击或触屏点按场景中的物品与下方按钮。第一次按下开始按钮后，浏览器允许播放配音。
- 家里：选纸团或拖鞋，从手边向左下拖，松开投掷；失败后可继续尝试并使用轨迹辅助。
- 公园：摸狗、尝试过门，再拖动树枝旋转；也可使用左右旋转按钮。
- 相册亭：照片可以直接翻看。封底的小卡可放入、取出、旋转，再检查路线。
- 冰淇淋店：改变三个拨片，放一粒米观察路线，成功后拉杆出餐。
- 点字幕可跳过当前配音；右上角可以静音、查看提示或重新开始。Tab 可选择按钮，Enter / 空格激活；Esc 关闭弹窗。

进度、已经触发的反应和静音偏好自动保存在当前浏览器的 `localStorage`。刷新后可以继续；不同设备、浏览器或网址不会共用存档。重新开始会先询问是否清空进度。浏览器禁止存储时，仍能完成本次游玩。结尾后也可以再看相册、回公园或冰淇淋店。

## 换照片、配音和文字

| 内容 | 修改位置 | 做法 |
|---|---|---|
| 照片 | `public/photos/`、`src/content/photos.ts` | 替换图片，或按顺序增删数组条目；填写 `caption` 与 `alt`。图片按原比例展示。 |
| 配音 | `public/audio/voice/N01.mp3` 等 | 使用相同 ID 替换 MP3。旁白为 `N01`–`N33`，企鹅为 `P01`–`P07`。 |
| 配音路径 | `public/audio/voice/voice-map.json` | 文件改名或换目录时同步映射；路径相对于站点根目录，不写电脑绝对路径。 |
| 原稿字幕 | `src/content/dialogue.ts` | 找到对应 ID，修改 `text`；保留 ID，并让录音与字幕对应。 |
| 按钮和提示文字 | `src/content/ui.ts` | 修改对应字符串。 |
| 谜题尺寸和路线 | `src/content/puzzleData.ts` | 修改数据后运行 `npm test`，确认解法和绘制仍一致。 |

字幕按提供的 `04_RECORDING_SCRIPT.md` 导入，没有另写故事台词。`public/audio/voice/manifest.json` 保留原始配音切分信息，不控制播放时间。修改成品内容后重新执行 `npm run build`。

原始素材已经准备好，普通运行和构建不需要原始文件夹。需要重新导入时，可执行：

```sh
npm run audit:assets -- --assets "素材目录" --photos "照片目录" --voice "voice_output目录"
```

素材目录需要保留既有 PNG 文件名；配音输出目录需要 `voice-map.json`、`manifest.json` 和其中指向的 MP3。工具仅裁去完全透明的边缘、无损编码 PNG，并逐字节复制照片和 MP3；来源、尺寸与哈希记录在 `asset-audit.json`。重新导入会生成 `assets.json` 和 `photos.ts`，自行填写的照片说明请先保留。

动作音效来自 Kenney 的 CC0 素材包。原始许可证和机器可读来源位于 `public/audio/sfx/`，详情见 [音效来源](docs/SOUND_CREDITS.md)。个人照片、游戏素材和故事配音属于用户提供的内容，不因音效的 CC0 许可证获得相同许可。

## GitHub Pages：需要发布时手动执行

网站通过 GitHub Actions 部署至 GitHub Pages。推送和 PR 只运行 `check.yml` 的安装、测试、构建；`deploy.yml` 只接受手动触发，后续源码更新需要手动运行部署工作流才会上线。

1. 将完整源码及 `public/` 资源提交、推送到需要发布的 GitHub 仓库。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 在 **Actions** 中选择 **Publish game to GitHub Pages (manual)**，按 **Run workflow** 并选择要发布的分支。
4. 成功后从该工作流的 `github-pages` 环境打开实际发布地址。工作流只发布 `dist/`。

更新后仍需再次手动运行部署工作流。GitHub 官方说明：[使用自定义工作流部署 Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
