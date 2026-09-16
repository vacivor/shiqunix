# 协议回归样本

这些 JSON 从本项目的实机采集和固件表提取结果中裁剪而来，用于离线回归。它们不由待测代码生成，也不需要连接键盘；`npm run test:research` 可直接使用仓库内的文件运行。

| 文件 | 保留内容 | 来源 |
| --- | --- | --- |
| `captured-requests.json` | 四次实验的 136 条完整请求；初始化中命令 `03`、`07` 的必要应答 | `a80-init-01`（15 条）、`a80-light-01`（25 条）、`a80-effects-02`（63 条）、`a80-keymap-01`（33 条）的 `transactions.json` |
| `reference-keymap.json` | `07` 参考表的 273 字节 | `a80-init-01/command-07.bin`；与 `a80-keymap-01` 的参考表逐字节相同 |
| `calibration-writes.json` | Q→W→Q、Z→X→Z、右方向→左方向→右方向的 30 条 `09` 请求 | `a80-keymap-calibration-02/transactions.json` |
| `keymap-types-writes.json` | 修饰键、功能键、导航键、静音九次写表操作的 45 条 `09` 请求 | `a80-keymap-types-03/transactions.json` |
| `lighting-parameters.json` | 72 条 `06` 参数请求，以及红色全亮、红色全灭、蓝色全亮各五条 `0B` 分片 | `a80-light-parameters-02/transactions.json`；三组自定义样本分别始于原记录的报文 1495、1515、1597 |
| `fn-reference-extracted.json` | `0x29c58` 的 29 条 Fn 表记录及源固件 SHA-256 | `firmware-analysis/tables.json`；仅提取键名、槽位、动作字节，不包含固件文件 |
| `readback-08.json` | A→B→B→A 四次当前键位表读取，每次 273 字节 | `readback-08-verified.json` |

`requestHex` 和 `dataHex` 保留抓包中的 Report ID `04`，总长为 64 字节。传给 WebHID 的数据应去掉首字节，保留其余 63 字节，包括原始尾部填充。键位表的 `bytes` 则直接表示表内容，不含报告头。

源记录名用于追溯实验，不是运行时路径。样本已去掉本机文件路径、时间戳、IRP、USB 完成信息、延迟和其他未用于测试的元数据；不包含 USB 拓扑、固件镜像或完整抓包。未用于断言的应答也未收录。
