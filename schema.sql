-- Create stock_forecasts table
CREATE TABLE IF NOT EXISTS stock_forecasts (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  current_price FLOAT,
  four_week_outlook TEXT,
  eight_week_outlook TEXT,
  twelve_week_outlook TEXT,
  ai_analysis TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_price_snapshots table
CREATE TABLE IF NOT EXISTS stock_price_snapshots (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  price FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_forecasts_symbol ON stock_forecasts(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_forecasts_created_at ON stock_forecasts(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_price_snapshots_symbol ON stock_price_snapshots(symbol);
