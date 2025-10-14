# 提詞器 Teleprompter

一個基於 React + Vite 的純前端提詞器網頁應用，提供直覺易用的提詞功能。

## 功能特色

### 核心功能
- ✅ **文字輸入與編輯** - 直覺的文字輸入介面
- ✅ **自動滾動播放** - 使用 `requestAnimationFrame` 實現平滑滾動
- ✅ **播放控制** - 播放/暫停按鈕，一鍵開始提詞
- ✅ **速度調整** - 1-20 級速度控制，即時調整滾動速度
- ✅ **字體大小調整** - 35-100px 字體大小，適應不同觀看距離
- ✅ **全螢幕播放模式** - 沉浸式黑底白字提詞體驗

### 進階功能
- 📊 **智能字數統計** - 分別統計中文字數、中文標點、英文單詞、英文標點、總行數
- 🎭 **繞柱排版** - 0-30% 可調間隔寬度，支援左右分欄顯示（繞柱子效果）
- ✂️ **智能段落分割** - 10-200 字元可調，自動將長句分段，保持英文單詞完整
- ⏱️ **預計完成時間** - 即時顯示剩餘播放時間
- 📈 **進度條顯示** - 底部進度條，隨時掌握播放進度

### 使用者體驗
- 🎯 **極簡介面** - 首頁只有輸入框和開始按鈕，專注內容
- ⌨️ **快捷鍵支援** - 完整快捷鍵操作，無需觸碰滑鼠
- 📱 **響應式設計** - 桌面版完整控制列，手機版抽屜式設定面板
- 💾 **設定記憶** - 自動儲存速度、字體、間隔、分段等所有設定
- 🎨 **現代化 UI** - Material UI 組件，漸層背景，顏色編碼統計卡片
- 👤 **作者資訊** - 整合社群連結（Facebook、GitHub、Medium、YouTube）

### 快捷鍵
- `空白鍵` - 播放/暫停
- `↑/↓` - 調整速度 ±1
- `+/-` - 調整字體大小 ±5px
- `ESC` - 退出全螢幕
- `滑鼠滾輪` - 手動控制滾動位置

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