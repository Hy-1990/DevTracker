# DevTracker 本机 API 协议 v1

供本机 bot（包括 Grok bot）调用。自 0.1.5 起，API 内置于桌面进程，启动 DevTracker 后监听 `http://127.0.0.1:17863`，退出应用后停止；没有后台服务。关闭窗口但应用进程尚未退出时，接口仍然可用。可导入的 OpenAPI 文件见 [local-api.openapi.json](local-api.openapi.json)。

## 认证与首次连接

首次启动新版会生成随机 token，保存在数据库同目录的 `api-token` 文件。macOS 默认位置为 `~/Library/Application Support/DevTracker/api-token`，Unix 权限为 0600。bot 只需读取此凭证，不需要读取数据库文件。不要将 token 提交到仓库、日志或聊天。

所有端点都要求 `Authorization: Bearer <token>`。JSON 请求使用 `Content-Type: application/json`。不支持浏览器 Origin 请求或 CORS。软件启动时若端口被占用或凭证损坏，将报启动错误；不要让其他程序占用 17863。

```sh
DEVTRACKER_TOKEN="$(cat "$HOME/Library/Application Support/DevTracker/api-token")"
curl -H "Authorization: Bearer $DEVTRACKER_TOKEN" http://127.0.0.1:17863/api/v1/health
curl -H "Authorization: Bearer $DEVTRACKER_TOKEN" http://127.0.0.1:17863/api/v1/schema
```

若 bot 也没有读取凭证文件的权限，请在 bot 的密钥配置中手动设置 token。接口不会绕过 bot 所在环境的网络隔离。

## 通用协议

| 方法 | 路径 | 操作 |
|---|---|---|
| GET | `/api/v1/health` | 返回 `{"status":"ok","version":1}` |
| GET | `/api/v1/schema` | 获取六张表的字段名、类型、默认值、非空约束、主键顺序 |
| GET | `/api/v1/{table}` | 查询分页列表 |
| POST | `/api/v1/{table}` | 创建单条记录，body 为字段对象 |
| GET | `/api/v1/{table}/{id}` | 查询单条记录 |
| PATCH | `/api/v1/{table}/{id}` | 局部更新，未传字段保留；显式 null 清空可空字段 |
| DELETE | `/api/v1/{table}/{id}` | 删除单条记录 |

`task_assignees` 和 `task_testers` 的单条路径使用两个主键：`/api/v1/{table}/{task_id}/{member_id}`。PATCH 可以修改关联表的 task_id/member_id，返回修改后的记录；后续调用使用新主键。

允许的 table 仅为：`boards`、`projects`、`members`、`tasks`、`task_assignees`、`task_testers`。不开放 SQL 执行、DDL 或 SQLite 内部表。

列表支持全部字段的等值过滤（多个条件为 AND），例如 `/api/v1/tasks?board_id=8&status=进行中&limit=100&offset=0`。URL 参数必须编码。按主键升序返回；limit 默认 100，范围 1–1000，offset 默认 0。每页记录不足 limit 即已到末尾。不支持模糊搜索、范围过滤或跨表 JOIN；bot 可分页读取后在本地组合。

列表响应：`{"data":[...],"limit":100,"offset":0}`。单条查询/创建/修改响应：`{"data":{...}}`。删除响应：`{"deleted":1}`（只统计直接删除的记录，不含级联删除）。

POST 成功为 201，其他成功为 200。错误格式统一为 `{"error":"原因"}`：400 参数错误，401 认证失败，403 浏览器来源请求，404 记录或端点不存在，405 方法不支持，409 外键/唯一性/字段或层级约束冲突，413 请求超过 1 MiB，503 数据库忙（可重试），500 数据库内部错误。

## 字段及业务约束

- boards：name、year_month（例如 `2026-11`，唯一）。
- projects：name（唯一）。
- members：name、role（`dev` 或 `test`）。
- tasks：board_id、parent_id、name、description、status、priority、type、project_id、owner_id、start_date、estimated_test_date、actual_test_date、estimated_release_date、completion_date、progress、progress_auto、story_points、quality_rating、latest_note。
- task_assignees / task_testers：task_id、member_id，组合唯一。
- id、created_at、updated_at 由系统管理，不能写入；任务 PATCH 自动更新时间。
- status：已停滞、待开始、进行中、待上线、已完成。
- priority：紧急、重要、日常、不重要。
- type：产品需求、功能优化、基建、bug修复、日常维护、toboss。
- progress：0–100；progress_auto：0/1；quality_rating：null 或 1–10。日期请传 `YYYY-MM-DD` 字符串。
- 父子任务必须在同一月度表内，只允许一层子任务；禁止循环。修改父任务所属月份时若使子任务跨月将整体回滚。
- 删除月度表会级联删除其任务及人员关联；删除父任务会级联删除子任务；删除成员会移除人员关联，但若仍被 owner_id 引用则返回 409；被任务引用的项目不能直接删除。
- 每次写入都是独立事务。多次请求不构成一个事务。没有隐式自动更新状态/日期/进度；bot 应明确传入所需值。POST 不保证幂等，超时后应查询确认再决定是否重试。
- 桌面当前列表不主动接收 API 变更通知，切换月份或重新进入页面后刷新。

## 示例：创建任务、指定执行人、更新、查询、删除

```sh
curl -X POST http://127.0.0.1:17863/api/v1/tasks \
  -H "Authorization: Bearer $DEVTRACKER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"board_id":8,"name":"接口联调","status":"待开始"}'
# 使用上一响应的 data.id 替换下文 123；成员 2 必须已存在。
curl -X POST http://127.0.0.1:17863/api/v1/task_assignees \
  -H "Authorization: Bearer $DEVTRACKER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"task_id":123,"member_id":2}'
curl -X PATCH http://127.0.0.1:17863/api/v1/tasks/123 \
  -H "Authorization: Bearer $DEVTRACKER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"进行中","progress":30}'
curl -H "Authorization: Bearer $DEVTRACKER_TOKEN" http://127.0.0.1:17863/api/v1/tasks/123
curl -X DELETE -H "Authorization: Bearer $DEVTRACKER_TOKEN" \
  http://127.0.0.1:17863/api/v1/task_assignees/123/2
```

Bot 建议先调用 health 和 schema 确认服务及字段，再查询定位对象，最后修改准确主键。删除父任务/月度表前应向使用者说明级联范围。
