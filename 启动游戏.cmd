@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "STORY_NODE="
for %%I in (node.exe) do set "STORY_NODE=%%~$PATH:I"
if not defined STORY_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "STORY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined STORY_NODE (
  echo 需要 Node.js 22.12 或更新版本。安装后再打开这个文件。
  pause
  exit /b 1
)
if exist "src\main.ts" if not exist "dist\index.html" (
  echo 这是源码目录。请先执行 npm install 和 npm run build。
  pause
  exit /b 1
)
echo 小雨点儿出门了
echo 游戏会在浏览器里打开。玩的时候保留这个窗口，关闭窗口会停止本地服务。
start "" "http://127.0.0.1:4175/"
"%STORY_NODE%" "scripts\serve.mjs" --port=4175
if errorlevel 1 (
  echo 如果浏览器里的游戏已经打开，可以继续玩；否则请查看上方的端口提示。
  pause
)
