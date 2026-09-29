@echo off
REM OceanX Backend Launcher - uses Python 3.14 with full netCDF4 support
cd /d "C:\Users\JASH MOHITE\Desktop\26067"
"C:\Python314\python.exe" -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
