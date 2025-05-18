@echo off
echo Setting up the Audio API server environment...

echo Fixing package compatibility issues...
pip uninstall -y numpy pandas
pip install numpy pandas fastapi uvicorn gtts

echo Starting Audio API server...
python audio.py
pause
