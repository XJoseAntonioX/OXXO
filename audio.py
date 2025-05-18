import pandas as pd
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
import io
from gtts import gTTS
import uvicorn

app = FastAPI()

# Enable CORS to allow frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the CSV file once when the server starts
try:
    df = pd.read_csv("public\Planograma_bueno.csv", encoding="latin1") 
    print(f"CSV loaded successfully with {len(df)} records")
except Exception as e:
    print(f"Error loading CSV: {str(e)}")
    df = pd.DataFrame()  # Empty dataframe as fallback

@app.get("/")
def read_root():
    return {"message": "Audio API is running"}

@app.get("/audio/{index}")
async def get_audio(index: int):
    try:
        if df.empty:
            return Response(content="Error: CSV data not loaded", status_code=500)
        
        if index < 0 or index >= len(df):
            return Response(content="Index out of range", status_code=400)
        
        row = df.iloc[index]
        
        # Generate the text for narration
        nombre = str(row.get('Nombre_limpio_azure', row.get('Nombre', 'Producto')))
        charola = str(row.get('Charola', 'desconocida'))
        posicion = str(row.get('Posicion en Charola', 'desconocida'))
        frentes = str(row.get('Cantidad de Frentes', '1'))
        
        texto = (
            f"Coloca {nombre} en la charola {charola}, "
            f"posición {posicion}, asegurando {frentes} unidades al frente."
        )
        
        # Generate audio using gTTS
        mp3_fp = io.BytesIO()
        tts = gTTS(texto, lang='es', slow=False)
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        
        # Return the audio file
        return Response(
            content=mp3_fp.getvalue(),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=audio_{index}.mp3"}
        )
    except Exception as e:
        return Response(content=f"Error: {str(e)}", status_code=500)

@app.get("/total-records")
async def get_total_records():
    return {"total": len(df) if not df.empty else 0}

# Add this for running the app directly
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)