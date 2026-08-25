from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

#============= Connections ============#

app = FastAPI()


#============= Classes ==============#

class TextRequest(BaseModel):
    text: str

#============= Routes ===============#

@app.get("/")
def home():
    return {"message": "Backend is running"}


@app.post("/login")
def getAuth():
    return {"message": "Logining User"}


@app.post("/response")
def getResponse():
    return {"message": "Responding to your query"}

