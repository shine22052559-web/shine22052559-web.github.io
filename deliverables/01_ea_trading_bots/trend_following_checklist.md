# Trend Following EA — Build Checklist

- Symbol / timeframe: fill before test
- Signal: fast EMA crosses slow EMA, confirmed on closed bar
- Risk: fixed fractional risk or fixed micro-lot; default is conservative
- Stop: ATR-based; never disable without explicit review
- Exit: opposite signal / ATR trailing / emergency stop
- Test: spread, commission, slippage, out-of-sample, walk-forward
- Release gate: compile log clean, no critical warnings, demo test reviewed

This is a specification template, not a profitability claim.
