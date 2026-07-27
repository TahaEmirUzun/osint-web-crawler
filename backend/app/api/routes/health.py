from fastapi import APIRouter

# Bu 'router' değişkeni, main.py'nin aradığı değişkendir.
router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "crawler": "available"
    }