@echo off
echo === BACKEND TESTLERI BASLIYOR (PYTEST) ===
docker compose exec backend pytest test_api.py -v

echo.
echo === FRONTEND TESTLERI BASLIYOR (VITEST) ===
cd frontend
call npx vitest run

echo.
echo === TUM TESTLER TAMAMLANDI! ===
pause