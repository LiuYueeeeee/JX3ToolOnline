# 天旨速能 · 视频交付台账 V4（纯 GitHub 版）

本版本只使用 GitHub：**GitHub Pages 托管网页，仓库中的 `site/data.json` 保存全部视频记录**。不使用数据库、Cloudflare、Worker、服务器或其他后端服务。

## V4 业务规则

- 普通视频编号：`NO.001`～`NO.100`，在管理端下拉菜单中滚动选择。
- 演示稿固定使用 `NO.000`，选择“演示稿”后编号自动锁定为 `NO.000`。
- 稿件类型：`初稿`、`终稿`、`演示稿`。
- 同一编号可保存多条初稿/终稿；首页按编号合并，优先显示最新终稿，没有终稿时显示最新初稿。
- `NO.000` 演示稿可查看和播放，但不计入数量、进度或累计时长。
- 初稿不计入统计。
- 只有终稿计入统计：同一编号只计 1 个；多条终稿只取最近更新的终稿时长。
- 客户端只读；管理端可新增、编辑、删除、备份和导入。
- 不包含截图、封面、图片上传或视频截帧功能。

## 工作方式

1. 客户端打开 GitHub Pages 发布后的 `data.json`，读取公开视频记录。
2. 管理端使用 GitHub Personal Access Token 登录。
3. 新增、编辑、删除或导入数据时，网页通过 GitHub Contents API 更新仓库中的 `site/data.json`。
4. 每次保存会在 GitHub 仓库中产生一次 Commit，并触发 GitHub Actions 重新发布 Pages。
5. 管理端直接从 GitHub API 读取最新数据；客户页面在 Pages 发布完成后看到更新。

因此，**数据和网页都在同一个 GitHub 仓库**。不需要单独部署数据库或 API 服务。

## 一、创建 GitHub 仓库

1. 在 GitHub 创建一个仓库，例如 `tianzhisuneng-video`。
2. 建议仓库设为 **Public**，这样客户无需登录就能访问 GitHub Pages 和视频清单数据。
3. 将本项目全部文件上传到仓库根目录，保留 `.github` 和 `site` 目录结构。
4. 打开 `site/config.js`，按实际情况填写：

```js
window.TZSN_CONFIG = {
  OWNER: "你的GitHub用户名",
  REPO: "tianzhisuneng-video",
  BRANCH: "main",
  DATA_PATH: "site/data.json"
};
```

- `OWNER`：GitHub 用户名或组织名。
- `REPO`：仓库名称，不是网页网址。
- `BRANCH`：实际保存代码的分支，默认 `main`。
- `DATA_PATH`：数据文件在仓库中的路径，默认 `site/data.json`，不要改成 Pages 网址。

## 二、开启 GitHub Pages

1. 在仓库打开 **Settings → Pages**。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 将项目推送到 `main` 分支后，仓库中的 `.github/workflows/deploy.yml` 会自动发布 `site` 目录。
4. 等待 Actions 中的 `Deploy GitHub Pages` 工作流完成。
5. 访问：
   - 客户端：`https://你的用户名.github.io/仓库名/`
   - 管理端：`https://你的用户名.github.io/仓库名/admin.html`

如果使用 `用户名.github.io` 这种个人主页仓库，网址中没有仓库名路径。

## 三、创建管理端 Token

管理端不再使用单独的管理员密码，而是使用 GitHub Token 验证仓库写入权限。

推荐创建 Fine-grained personal access token：

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**。
2. 点击 Generate new token。
3. Resource owner 选择你的 GitHub 账号。
4. Repository access 选择 **Only select repositories**，只勾选本项目仓库。
5. Repository permissions 中将 **Contents** 设置为 **Read and write**；Metadata 保持默认只读即可。
6. 生成 Token 并复制。
7. 打开管理端，把 Token 粘贴到登录框。

Token 只保存在当前浏览器标签页的 `sessionStorage` 中，退出管理端或关闭标签页后需要重新输入。它不会自动写入 `config.js` 或 GitHub 仓库。

> 如果你希望完全免登录，也可以把 Token 固定写进前端配置，但这会把仓库写入权限直接公开给所有访问者，不建议这样做。当前版本采用手动粘贴 Token 的方式，不需要额外服务器。

## 四、数据保存与同步说明

- 数据文件：`site/data.json`。
- 每次管理端保存操作会更新该 JSON 文件，并在 GitHub 仓库产生一个 Commit。
- 管理端从 GitHub API 读取最新文件，因此保存后能立即看到新数据。
- 客户端通过 GitHub Pages 读取已发布的 `data.json`。GitHub Actions 需要一点时间完成重新部署，客户页面更新可能有短暂延迟。
- 建议不要多人同时编辑。若两次提交发生冲突，页面会提示刷新后重试。
- GitHub 仓库的 Commit 历史也相当于一份数据变更记录；管理端仍保留 JSON 导出和导入备份。

## 五、公开访问说明

此方案按你的要求不设置数据库和独立数据安全层。若仓库设为 Public：

- 客户可以直接读取网页和 `site/data.json`。
- 视频主题、周次、时长、备注、百度网盘分享链接等记录都属于公开数据。
- GitHub Token 不要发给客户，也不要提交到仓库。

## 六、从旧版本迁移

1. 在旧版管理端导出 JSON 备份。
2. 打开新版管理端，使用 GitHub Token 登录。
3. 点击“导入 JSON 备份”，选择旧版导出的 JSON。
4. 对于 V3 数据，系统会按 V4 规则将旧普通编号整体加 1：旧 `NO.000` → 新 `NO.001`，旧 `NO.099` → 新 `NO.100`；演示稿仍固定 `NO.000`。
5. 导入成功后，新记录会写入 `site/data.json`。

## 七、播放说明

- 百度网盘分享链接：点击播放会打开百度网盘分享页面。
- HTTPS 视频直链：如果地址允许浏览器直接访问和播放，可在网页内播放。
- 百度网盘分享链接不是 MP4 直链，无法保证直接嵌入网页播放器。

## 八、本地预览

可双击 `site/index.html` 或 `site/admin.html`，或在网址后加 `?demo=1` 进入本地演示模式。演示模式只将记录保存在当前浏览器的 localStorage，不会写入 GitHub，也不会与其他设备同步。
