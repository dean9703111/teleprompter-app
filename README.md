# 提詞器 Teleprompter

一個基於 React + Vite 的純前端提詞器網頁應用，提供直覺易用的提詞功能。

## 功能特色

### 核心功能
- ✅ **文字輸入與編輯** - 直覺的文字輸入介面
- ✅ **自動滾動播放** - 平滑的文字滾動效果
- ✅ **播放控制** - 開始/暫停/停止按鈕
- ✅ **速度調整** - 1-20 級速度控制
- ✅ **字體大小調整** - 35-100px 字體大小調整
- ✅ **全螢幕模式** - 沉浸式提詞器體驗

### 使用者體驗
- 🎯 **極簡介面** - 首頁只有輸入框和開始按鈕
- ⌨️ **快捷鍵支援** - 空白鍵播放/暫停，上下箭頭調整速度
- 📱 **響應式設計** - 支援手機、平板、電腦
- 💾 **設定記憶** - 自動儲存速度和字體設定

### 快捷鍵
- `空白鍵` - 播放/暫停
- `↑/↓` - 調整速度
- `+/-` - 調整字體大小
- `ESC` - 退出全螢幕
- `滑鼠滾輪` - 手動控制滾動

## 技術規格

### 技術棧
- **框架**: React 18 + TypeScript
- **建構工具**: Vite
- **UI 框架**: Material UI (MUI)
- **樣式**: Emotion (CSS-in-JS)
- **Node 版本**: 22.6.0

### 效能優化
- 使用 `requestAnimationFrame` 確保流暢滾動
- 文字分段渲染，避免長文字卡頓
- LocalStorage 儲存使用者設定
- 響應式設計適配各種裝置

## 安裝與啟動

### 需求
- Node.js 22.6.0 或更高版本
- npm 或 yarn

### 安裝步驟

1. **安裝依賴**
   ```bash
   npm install
   ```

2. **啟動開發伺服器**
   ```bash
   npm run dev
   ```

3. **建構生產版本**
   ```bash
   npm run build
   ```

4. **預覽生產版本**
   ```bash
   npm run preview
   ```

## 部署

### GitHub Pages 部署

本專案使用 GitHub Actions 自動部署到 GitHub Pages：

- 僅在 `master` 分支觸發部署
- 自動建構並部署到 `gh-pages` 分支
- 部署 URL: `https://[username].github.io/teleprompter-app`

### 手動部署

1. 建構專案：
   ```bash
   npm run build
   ```

2. 將 `dist` 資料夾內容部署到任何靜態網站託管服務

## 專案結構

```
teleprompter-app/
├── src/
│   ├── components/
│   │   └── TeleprompterPlayer.tsx  # 全螢幕播放組件
│   ├── App.tsx                      # 主應用組件
│   ├── main.tsx                     # 應用入口
│   └── index.css                    # 全域樣式
├── public/                          # 靜態資源
├── .nvmrc                          # Node 版本指定
├── .gitignore                      # Git 忽略檔案
└── README.md                       # 專案說明
```

## 授權

MIT License - 詳見 LICENSE 檔案

## 貢獻

歡迎提交 Issue 和 Pull Request 來改善這個專案！

---

**提詞器 Teleprompter** - 讓你的演講更加流暢自然