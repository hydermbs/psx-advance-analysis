from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from app.data.registry import get_data_adapter
from app.analysis.pipeline import run_analysis_pipeline
from app.database import init_db_tables
from app.scheduler import start_scheduler, shutdown_scheduler
from app.api.watchlist import router as watchlist_router
from app.api.dip_alerts import router as dip_alerts_router
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db_tables()
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(
    title="Stock Technical Analysis API", 
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(watchlist_router)
app.include_router(dip_alerts_router)

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "message": "API is functioning correctly"}

@app.get("/api/v1/stocks")
async def get_stocks():
    """Retrieves all stock symbols and metadata."""
    try:
        adapter = get_data_adapter()
        symbols = await adapter.get_symbols()
        if not symbols:
            # Fallback mock symbols if exchange fails/throttles
            return [
                {"symbol": "SYS", "name": "Systems Limited", "sector": "TECHNOLOGY & COMMUNICATION", "is_etf": False, "exchange": "PSX"},
                {"symbol": "HUBC", "name": "Hub Power Company Limited", "sector": "POWER GENERATION & DISTRIBUTION", "is_etf": False, "exchange": "PSX"},
                {"symbol": "TRG", "name": "TRG Pakistan Limited", "sector": "TECHNOLOGY & COMMUNICATION", "is_etf": False, "exchange": "PSX"},
                {"symbol": "ENGRO", "name": "Engro Corporation Limited", "sector": "FERTILIZER", "is_etf": False, "exchange": "PSX"},
                {"symbol": "LUCK", "name": "Lucky Cement Limited", "sector": "CEMENT", "is_etf": False, "exchange": "PSX"},
                {"symbol": "OGDC", "name": "Oil & Gas Development Company Limited", "sector": "OIL & GAS EXPLORATION COMPANIES", "is_etf": False, "exchange": "PSX"}
            ]
        return symbols
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch symbols: {str(e)}")

@app.get("/api/v1/analysis/{symbol}")
async def get_analysis(symbol: str, timeframe: str = Query("1d", regex="^(1d|int)$")):
    """
    Fetches raw market data and runs it through the technical analysis pipeline.
    """
    try:
        adapter = get_data_adapter()
        # Fetch OHLCV (DataFrame)
        df = await adapter.get_ohlcv(symbol, timeframe)
        
        if df.empty:
            raise HTTPException(
                status_code=444, 
                detail=f"No data returned for symbol '{symbol}' with timeframe '{timeframe}'"
            )
            
        # Intraday 5-minute candles from PSX only cover the current session,
        # so use a lower bar minimum than daily EOD analysis.
        min_bars = 10 if timeframe == 'int' else 20
        analysis_result = run_analysis_pipeline(df, min_bars=min_bars, timeframe=timeframe)

        if analysis_result.get('status') == 'error':
            raise HTTPException(
                status_code=444,
                detail=analysis_result.get('message', 'Insufficient data for analysis')
            )
        
        # Add basic symbol info to response
        analysis_result['symbol'] = symbol
        analysis_result['timeframe'] = timeframe
        
        return analysis_result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred while generating analysis for {symbol}: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
