@echo off
chcp 65001 >nul
title TOHO ELECTRIC VN - Server Local
cd /d "%~dp0"

echo ============================================
echo   TOHO ELECTRIC VN - Khoi dong website
echo ============================================
echo.
echo Dang khoi dong server tai http://localhost:8123 ...
echo (Giu cua so nay mo trong khi xem website. Tat cua so = tat website)
echo.

:: Mo trình duyệt trước cho nhanh
start "" http://localhost:8123/index.html

:: Có Python thì dùng Python
where python >nul 2>nul
if %errorlevel%==0 (
    python -m http.server 8123
    goto :eof
)

:: Không có Python thì dùng Node
where node >nul 2>nul
if %errorlevel%==0 (
    node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end('Not found');return;}s.writeHead(200,{'Content-Type':mime[path.extname(f).toLowerCase()]||'application/octet-stream'});s.end(d);});}).listen(8123,()=>console.log('Server chay tai http://localhost:8123'));"
    goto :eof
)

echo [LOI] May chua co Python hoac Node.js! Hay cai dat Python tu python.org
pause
