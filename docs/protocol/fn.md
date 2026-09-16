# Fn 与固件范围

## 固定表路径

在已分析的 Nordic 镜像中，Fn 物理槽位为 68，扫描路径把按下状态单独保存。查找函数 `0x1E32C` 使用 29 个四字节项，每项为 `slot + 三字节动作`。

- 设备模式字段为零时，从 Flash `0x29C58` 按物理槽位查找。
- 非零时，从 Flash `0x29CCC` 查找。
- 动作读取 `0x1FBA2` 仍引用第一张表 `0x29C58 + index * 4`。
- 普通映射来自 RAM `0x20002B80 + slot * 3`，不是上述 Flash 表。

第二张表前七项 slot 为零，不能直接解释成七个 Esc 功能。模式选择条件不等于网页可编辑的第二层；Mac 普通修饰覆盖还使用精确等于 1 的判断，不能把其他非零模式值当作等价 Mac 模式。

Windows 固定 Fn 表提取：[fn-reference.json](../../src/data/fn-reference.json)。本仓库只开放已解释的固定功能展示，不提供 Fn 写入接口。

## 功能对应

下表按 Windows 设备模式整理，动作字节见链接的机器表或[动作编码表](keymap.md#媒体系统与背光动作)。部分来自手册和固件对应，未把整张表认定为逐项实测。

| Fn + 实体键 | 功能/状态 |
| --- | --- |
| F5 | My Computer |
| F6 | Browser Home |
| F7 | Ctrl+Alt+Del；手册中的 Task Manager 命名不等于独立启动任务管理器 |
| F8 | Calculator |
| F10 | Mute；普通 F10 改为 A 后仍保持，用户实测 |
| F11 / F12 | Volume Down / Up，用户确认 |
| PrtSc | Insert |
| Enter | Play / Pause |
| Left / Right | Previous / Next Track |
| Del | Backlight On / Off |
| PgUp / PgDn | Brightness Up / Down |
| Home / End | Effect Cycle / Color Cycle |
| Up / Down | Speed Up / Down，固件表对应 |
| Win | Lock Win，固件表对应 |
| 1 | Bluetooth 模式，用户确认需先切无线 |
| 4 | 2.4 GHz 模式，用户确认需先切无线 |
| 2 / 3 | 同类蓝牙动作的参数 1/2；对应槽功能与长按行为未完整实测 |
| Tab / Caps / Space / B / S / L Ctrl | 有固定编码记录，尚未完整解释，不开放成普通映射候选 |

长按、配对、重置等动作不根据短按表项推测。普通 F10 改键不改变 Fn+F10，已在实机上验证。

## 已定位写入区

以下是指定镜像的静态地址，不是可任意写入的网页 API：

| 命令 | 写入基址 | 保存块参数 | 当前用途 |
| --- | --- | --- | --- |
| `06` | RAM `0x20002AE0` | 2 | 已验证范围内的背光配置 |
| `09` | RAM `0x20002B80` | 3 | 273 字节普通键位表 |
| `0B` | RAM `0x20005B80` | 5 | 273 字节自定义灯光数据 |
| `15` | RAM `0x20004F80` | 4 | 尚未接入的其他配置区 |

这些路径以 `base + offset` 写 RAM。把 offset 放大不能将其当作 Fn 层号；超范围可能写到其他对象。已识别路径没有提供将普通配置上传到 Fn Flash 表的接口。

其他分支涉及状态切换、默认恢复及其他处理，但没有足够证据将其作为 Fn 编辑方案。这个结论限定于已分析的配置/按键路径，不代表对所有版本或升级器功能的穷尽证明。

## 当前未提供的功能

Fn 自定义、宏编辑、固件升级及固件补丁尚未接入。原驱动中存在宏选项，也观察到宏路径进入 Mac 覆盖处理；不能把录制出的 Win/Alt 名称当成绕过物理覆盖的证据。已采用的 Mac 方案及其作用边界见 [Mac 模式协议](mac-mode.md)。

原始升级器和固件镜像不随仓库分发。本文地址对应的分析输入哈希见[协议索引](README.md#证据与适用范围)。
