Playwright E2E tests for ASS Player

Requirements
- Python 3.8+
- Install test deps:

PowerShell:

```powershell
pip install playwright pytest
python -m playwright install
```

Run tests:

```powershell
# start tests
pytest tests_e2e -q
```

Notes:
- Tests start a small static HTTP server on `127.0.0.1:8001` and intercept `/api/auto-parse` and `/api/report-cdn`.
