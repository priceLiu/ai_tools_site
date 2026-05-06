# 双跑（Dual-Run）切流策略

> Vercel(老) + CloudBase Run(新) 同时在线期间的运营手册。
> 适用日期：2026-05-06 ~ 切流完成 + 7 日观察期结束。
> 配套文件：[migration-tencent.md](./migration-tencent.md) · [done.md](./done.md) · [`lib/deploy-target.ts`](../lib/deploy-target.ts)

---

## 一、核心原则

> **一个数据真源（Tencent PG）+ 两个无状态部署（Vercel 老 / CloudBase Run 新）**

```
                 ┌──────────────┐
       (老)      │ Vercel 全球边缘 │  DATABASE_URL=Tencent 公网串
       ─────────→│ Next.js       │──────┐
                 └──────────────┘      │
                                       ▼  跨境 + sslmode=disable + SG 0.0.0.0/0
                                 ┌──────────────┐
                                 │ Tencent PG   │ ← 数据真源（唯一写入点）
                                 │ 上海二区     │
                                 └──────────────┘
                                       ▲  VPC 内网 10.0.0.2:5432，<1ms
                 ┌──────────────┐      │
       (新)      │ CloudBase Run │──────┘  DATABASE_URL=Tencent 内网串
       ─────────→│ Next.js 容器  │
                 └──────────────┘
```

**为什么这么设计**：
- ✅ 不需要双向同步：两端都写同一个 PG，无冲突合并问题
- ✅ Neon 立即可下线：迁移完成那一刻起就不再有人写它
- ✅ 故障域单一：任一部署挂了不影响数据，DNS 切到另一个即可
- ✅ 切流零数据风险：DNS 改完用户路径切换，**数据不需要"跟着搬家"**

**代价**：
- ⚠️ Vercel 是全球节点，连 Tencent 上海要跨境，**单次 SQL 200~500ms**（不影响功能，体感慢）
- ⚠️ Tencent SG 双跑期临时放宽到 `0.0.0.0/0`（接受 Vercel 任意边缘 IP）；**切流完立即收紧**
- ⚠️ 公网串 `sslmode=disable`：传输不加密，密码裸跑；**切流完关闭外网，仅留内网**

---

## 二、切流期 4 阶段

### 阶段 P1：双跑启动（迁移当天）

**部署状态**：

| 平台 | DATABASE_URL | 用户访问 | 流量比 |
|---|---|---|---|
| Vercel | Tencent 公网串 (`sslmode=disable`) | 自有域名 / `*.vercel.app` | **100%** |
| CloudBase Run | Tencent VPC 内网串 | `*.tcbgateway.com`（仅内部测试） | 0% |

**关键动作**：
1. 把 Vercel 的环境变量 `DATABASE_URL` **改指向 Tencent 公网串**（公开界面操作，含密码）
2. Vercel 自动重新部署（约 1-2 分钟）
3. 部署完成后 `curl https://your-vercel.vercel.app/api/diag` 应返回：
   ```json
   { "deploy": { "target": "vercel" }, "database": { "kind": "tencent", "via_vpc": false } }
   ```
4. CloudBase Run 部署成功后，`curl https://*.tcbgateway.com/api/diag` 应返回：
   ```json
   { "deploy": { "target": "cloudbase" }, "database": { "kind": "tencent", "via_vpc": true } }
   ```

**Neon 状态**：彻底进入"冷备"——不再被读、不再被写。可保留账号 7 天作为最终回滚保险。

### 阶段 P2：CloudBase Run 灰度（双跑 1-3 天）

**部署状态**：

| 平台 | DATABASE_URL | 用户访问 | 流量比 |
|---|---|---|---|
| Vercel | Tencent 公网串 | 主域名 | **100%** |
| CloudBase Run | Tencent 内网串 | `*.tcbgateway.com` | 0%（你 + 国内朋友点测） |

**验证清单**（你做）：

- [ ] 国内朋友（移动 4G / 5G、电信宽带）打开 `*.tcbgateway.com` 各页面响应正常
- [ ] 上海地铁 / 高铁 4G 弱网测试 5 分钟无加载失败
- [ ] `/api/diag` 显示 `database.via_vpc: true` 且单次 SQL < 5ms
- [ ] 后台登录 / 提交工具 / 评论 / 点赞 全功能跑一遍
- [ ] 抓 5-10 条记录在 Vercel 跑过的 vs CloudBase 跑过的，看数据库里**最终落到同一行**（同 id、同时间戳）

### 阶段 P3：切流（备案完成后 + 上面验证清单全过）

**条件**：
- ✅ 域名 ICP 备案完成（见 [migration-tencent.md 第十节](./migration-tencent.md)）
- ✅ CloudBase Run 24h 无报警
- ✅ 阶段 P2 验证清单全勾

**操作**：
1. 在 CloudBase 控制台给 CloudBase Run 服务**绑定自有域名**（备案过的）
2. DNS 商（Cloudflare / 阿里云 / 腾讯云 DNSPod）：
   - 主域名 `A`/`CNAME` 记录从 Vercel 改到 CloudBase Run
   - **TTL 改成 60 秒**（提前 24h 调），切换时秒级生效
3. **暂时不删 Vercel 部署**，保留 7 天回滚窗口
4. 在 CloudBase 给 Tencent PG 实例**关闭外网 IP** + **SG 删除 `0.0.0.0/0` 那条规则**
5. 验证：
   - [ ] DNS 已生效（`dig +short yourdomain.com` 返回 CloudBase IP）
   - [ ] 浏览器开 `https://yourdomain.com` 是 CloudBase Run 出的页面（DevTools Network 看 `x-deploy-target: cloudbase`）
   - [ ] Vercel 旧域名 `*.vercel.app` 仍可访问（用作回滚演练）

### 阶段 P4：清理（切流后 + 7 日观察期）

**前置条件**：切流后 7 天 0 报错、0 用户投诉。

**操作**：
1. Vercel 项目「**暂停部署**」（先不删）
2. Neon 项目「**Pause compute**」（也不删）
3. 再观察 7 天后：删 Vercel + 删 Neon + 改 Tencent PG 密码为强密码（至此 `Password_1` 退役）

---

## 三、Vercel 侧操作清单（你在 Vercel 控制台做）

### 切到 Tencent 公网串（阶段 P1）

1. Vercel Dashboard → 项目 → **Settings → Environment Variables**
2. 找到 `DATABASE_URL`，点编辑
3. **Production / Preview / Development 三档都要改**（避免 Preview 仍指向 Neon）
4. 新值：
   ```
   postgresql://aitools_admin:Password_1@sh-postgres-i556nz8q.sql.tencentcdb.com:24155/aitools?sslmode=disable
   ```
5. 保存 → 顶部「**Redeploy**」按钮重新部署最新的 commit
6. 部署完后 `curl https://your.vercel.app/api/diag | jq .database` 验证

### 紧急回滚 Neon（阶段 P1 出问题时）

把 `DATABASE_URL` 改回 Neon 串（保留好原值！）：

```
postgresql://neondb_owner:npg_XKHk8mD3nfbC@ep-restless-forest-aowyp60d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

⚠️ **代价**：阶段 P1 之后写到 Tencent 的所有新数据**会丢**——因为切回去后用户继续往 Neon 写，Tencent 那份变成"过去某时刻的快照"。所以阶段 P2 验证清单全过之前，**写动作能少则少**（建议你不要在双跑期接受新工具提交、不发新评论）。

---

## 四、CloudBase Run 部署清单（我做 + 你点确认）

### 核心环境变量

部署面板里设置（Run 控制台 → 服务 → 服务配置 → 环境变量）：

| 变量 | 值 | 备注 |
|---|---|---|
| `DATABASE_URL` | `postgresql://aitools_admin:Password_1@10.0.0.2:5432/aitools?sslmode=disable` | **VPC 内网串**，CloudBase Run 容器在同 VPC 里才能访问 |
| `AUTH_SECRET` | `+abtxd3xFUF2uawqCLNYtncdFt6ZeTq+enzQgHrSggk=` | **必须和 Vercel 一致**（不一致会导致用户登录会话失效） |
| `DEPLOY_TARGET` | `cloudbase` | 显式标记，覆盖自动检测 |
| `NODE_ENV` | `production` | Next.js 标配 |
| `PORT` | `3000` | Dockerfile 暴露端口 |

### 网络配置

- VPC：`vpc-a1sslqsg / aitools-vpc`
- 子网：`aitools-subnet-sh`（与 PG 同子网，内网直连）
- 公网入口：使用 CloudBase Run 默认的 `*.tcbgateway.com`（先这个跑通；备案后再绑自有域名）

### 资源配置（起步）

- CPU：0.5 / 1 核
- 内存：1 GB
- 实例数：1（自动伸缩 1-3）
- 计费：按量付费（流量小时几乎免费）

---

## 五、代码层保险丝

代码层已加 3 个识别点，方便诊断：

### 1. `lib/deploy-target.ts`
- `getDeployTarget()` 返回 `vercel|cloudbase|local|unknown`
- `getDatabaseKind()` 返回 `neon|tencent|unknown`
- `isDatabaseViaVpc()` 返回内网串 / 公网串

### 2. 中间件响应头（所有页面都带）

任意请求的 Response Headers 都会有：

```
x-deploy-target: vercel | cloudbase | local
x-db-kind: neon | tencent
x-db-via-vpc: 0 | 1
```

浏览器 DevTools → Network 看一眼即知"这次请求是哪个部署服务的、走的是 Neon 还是 Tencent、走的是公网还是内网"。

### 3. `/api/diag` 增强

返回 JSON 含：

```json
{
  "deploy": { "target": "cloudbase" },
  "database": {
    "host": "10.0.0.2:5432",
    "kind": "tencent",
    "via_vpc": true,
    "region": null,
    "url": "postgresql://***@10.0.0.2:5432/aitools"
  }
}
```

---

## 六、写入安全保证（双端同写一个 DB 不会有事的论证）

**用户担心**：Vercel + CloudBase 同时接到一个 PG，会不会出现并发写冲突？

**答案**：不会，原因如下：

1. **`tools.slug` / `categories.slug` / `tag_categories.slug` 都是 UNIQUE**：双端同时提交相同 slug 的工具，PG 会拒绝第二条
2. **`tool_tags(tool_id, tag_id)` 是 PK**：双端同时给一个工具打同一标签，PG 拒绝第二条
3. **`view_count` 用乐观增量**：`UPDATE tools SET view_count = view_count + 1 WHERE id = $1` —— PG 行级锁保证原子性
4. **`favorites(user_id, tool_id)` 是 UNIQUE**：双端同时收藏同一工具，PG 拒绝第二条
5. **评论 `tool_comments` 没有去重约束**：双端同时发同一句评论，**会出 2 条**——但这是用户故意刷的极小概率，且非破坏性

**结论**：业务层不需要做任何冲突解决；PG 自身的 UNIQUE / PK / FK / 行锁就是兜底。

---

## 七、应急预案速查

| 现象 | 阶段 | 处置 |
|---|---|---|
| Vercel 切到 Tencent 后 502 / 504 | P1 | 立刻把 Vercel `DATABASE_URL` 改回 Neon；24h 内排查（8 成是 Tencent SG 没放行 Vercel IP）|
| CloudBase Run 部署后 503 | P1-P2 | 看部署日志；常见是 `DATABASE_URL` 用了公网串而 VPC 出口没开（必须用内网串）|
| 切流后国内仍打不开 | P3 | DNS TTL 没生效；用 `dig` 确认；不行就在 Cloudflare 上手动 purge |
| 切流后某些功能 500 | P3 | DevTools 看 `x-deploy-target` 头确认是新部署；检查 CloudBase 日志 |
| 误删 Tencent PG 数据 | 任何阶段 | 腾讯云控制台 → 实例 → 备份恢复 → 选时间点恢复（高可用版默认日备 + 30 天 PITR）|

---

## 八、阶段确认日志

> 每完成一个阶段记一行，方便事后复盘。

| 阶段 | 完成时间 | 当时观察到的关键指标 / 异常 |
|---|---|---|
| P1（双跑启动）| - | - |
| P2（灰度 1-3 天）| - | - |
| P3（DNS 切流）| - | - |
| P4（清理 Vercel + Neon）| - | - |
