# ShiQunix

基于新建的 Vite 8 + React 19 + TypeScript 6 工程开发的 A80 本地配置工具。UI 使用 Tailwind CSS 4、shadcn/ui Button 与 Lucide，参考 Keychron Launcher 的布局重新实现。

## 运行

```sh
npm install
npm run dev
```

打开 http://127.0.0.1:5174 。连接键盘请使用桌面 Chrome / Edge，关闭官方驱动后通过 USB 连接。重启电脑后需要再次运行 `npm run dev`。

```sh
npm run build
npm run lint
npm test
```

## 使用

- 连接后读取 08 当前键位表，选择实体键和下方目标，点击「应用修改」。修改前备份，写入后核对全部 273 字节。
- 「重新读取并撤销草稿」会用设备配置替换未应用的编辑。
- 配置导入仅进入草稿；配置导出可保存并转移既有 JSON 配置。
- 支持八种灯效、五档亮度与速度、全彩／单色、自定义全亮／全灭。自定义持久化仍待验证。
- Fn 页面展示已确认功能，不提供虚构的可编辑 Fn 层。
- Mac 模式四个修饰键位置仍受固件覆盖；页面显示保存映射并提示已知限制。
- 通信记录可导出最近 500 条报文、设备快照、写前原始备份。最近一次写前备份也保存在当前站点 localStorage 的 `shiqunix.last-backup` 中。
- 当前表含未支持动作时不转换为可写草稿，仍可导出原始设备快照。

## 迁移边界

保留新工程的入口、TypeScript 项目引用、Vite、React、npm package-lock 与 oxlint。只迁入已验证的 protocol / transport / keymap / profiles / lighting / system-mode 模块、布局数据和其回归测试样本；App、状态 hook 与页面样式重新编写。父目录旧工程和逆向资料保留作参考，不参与本工程运行。

`docs/` 与 `evidence/` 为本地研究样本，不提交到公开仓库。`npm test` 运行不依赖私有样本的预览测试；`npm run test:research` 需本地研究资料，可执行完整协议回归测试。


## 页面路由

使用 Hash 路由，兼容 GitHub Pages 的 `/shiqunix/` 部署路径：

- `#/keymap`：键盘键位
- `#/lighting`：按键背光
- `#/fn`：Fn 组合键
- `#/tester`：键盘测试
- `#/logs`：通信记录

刷新保留当前页面，支持前进、后退；未知路径回到键位页面。切页保留连接及编辑草稿，刷新浏览器后需要重新连接设备。

## 发布

GitHub Pages：https://vacivor.github.io/shiqunix/ 。推送 main 自动构建；仓库 Pages 发布来源设置为 GitHub Actions。
