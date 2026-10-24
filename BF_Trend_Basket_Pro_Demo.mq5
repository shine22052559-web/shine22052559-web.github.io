//+------------------------------------------------------------------+
//| BF_Trend_Basket_Pro_Demo.mq5                                     |
//| BRAINFORZE MT5 prototype: Trend Following + Basket + Trailing    |
//| Compile status: NOT VERIFIED here. Compile in MetaEditor first.  |
//+------------------------------------------------------------------+
#property strict
#property version   "1.00"
#property description "BRAINFORZE demo prototype. Test on MT5 DEMO only."
#include <Trade/Trade.mqh>

CTrade trade;

//--- Strategy
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_M30;
input int             InpFastEMA = 10;
input int             InpSlowEMA = 30;
input int             InpRSIPeriod = 14;
input double          InpBuyRSIMin = 52.0;
input double          InpSellRSIMax = 48.0;
input int             InpADXPeriod = 14;
input double          InpADXMinimum = 18.0;
input int             InpATRPeriod = 14;

//--- Risk and order controls
input double          InpLots = 0.01;
input ulong           InpMagic = 2601021;
input int             InpDeviationPoints = 20;
input int             InpMaxPositions = 3;
input double          InpMaxBasketLossAccountCurrency = 25.0;
input double          InpMaxDrawdownPercent = 10.0;
input double          InpMaxSpreadPoints = 50.0;
input double          InpATRStopMultiplier = 2.0;
input double          InpATRTargetMultiplier = 3.0;

//--- Basket and trailing
input bool            InpUseBasket = true;
input int             InpBasketTPPoints = 150;
input int             InpBasketSLPoints = 1000;
input bool            InpUseTrailing = true;
input int             InpTrailStartPoints = 150;
input int             InpTrailDistancePoints = 100;
input int             InpTrailStepPoints = 20;

//--- Safety
input bool            InpAllowBuy = true;
input bool            InpAllowSell = true;
input bool            InpOneEntryPerBar = true;
input bool            InpDemoOnly = true;
input bool            InpShowDashboard = true;

int hFast = INVALID_HANDLE;
int hSlow = INVALID_HANDLE;
int hRSI  = INVALID_HANDLE;
int hADX  = INVALID_HANDLE;
int hATR  = INVALID_HANDLE;
datetime lastBar = 0;
double initialEquity = 0.0;
bool riskLocked = false;

string Prefix = "BF_TBP_";

string TradeSymbol() { return _Symbol; }

int OnInit()
{
   if(InpFastEMA < 2 || InpSlowEMA <= InpFastEMA ||
      InpRSIPeriod < 2 || InpADXPeriod < 2 || InpATRPeriod < 2 ||
      InpLots <= 0 || InpMaxPositions < 1 ||
      InpBasketTPPoints < 0 || InpBasketSLPoints < 0)
      return INIT_PARAMETERS_INCORRECT;

   if(InpDemoOnly && AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
   {
      Print("BF Trend Basket Pro: Demo-only mode is enabled. EA will not initialize on a non-demo account.");
      return INIT_FAILED;
   }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(TradeSymbol());

   hFast = iMA(TradeSymbol(), InpTimeframe, InpFastEMA, 0, MODE_EMA, PRICE_CLOSE);
   hSlow = iMA(TradeSymbol(), InpTimeframe, InpSlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   hRSI  = iRSI(TradeSymbol(), InpTimeframe, InpRSIPeriod, PRICE_CLOSE);
   hADX  = iADX(TradeSymbol(), InpTimeframe, InpADXPeriod);
   hATR  = iATR(TradeSymbol(), InpTimeframe, InpATRPeriod);

   if(hFast == INVALID_HANDLE || hSlow == INVALID_HANDLE ||
      hRSI == INVALID_HANDLE || hADX == INVALID_HANDLE || hATR == INVALID_HANDLE)
   {
      Print("BF Trend Basket Pro: failed to create one or more indicator handles. Error=", GetLastError());
      return INIT_FAILED;
   }

   initialEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   lastBar = iTime(TradeSymbol(), InpTimeframe, 0);
   EventSetTimer(1);
   Print("BF Trend Basket Pro initialized. DEMO testing only.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   if(hFast != INVALID_HANDLE) IndicatorRelease(hFast);
   if(hSlow != INVALID_HANDLE) IndicatorRelease(hSlow);
   if(hRSI  != INVALID_HANDLE) IndicatorRelease(hRSI);
   if(hADX  != INVALID_HANDLE) IndicatorRelease(hADX);
   if(hATR  != INVALID_HANDLE) IndicatorRelease(hATR);
   ObjectsDeleteAll(0, Prefix);
   Comment("");
}

void OnTick()
{
   UpdateRiskLock();
   ManageTrailing();
   ManageBasketExit();

   if(riskLocked) return;
   if(!SpreadAllowed()) return;
   if(InpOneEntryPerBar)
   {
      datetime t = iTime(TradeSymbol(), InpTimeframe, 0);
      if(t == 0 || t == lastBar) return;
      lastBar = t;
   }

   if(CountOurPositions() >= InpMaxPositions) return;
   if(InpMaxBasketLossAccountCurrency > 0 &&
      BasketFloatingProfit() <= -InpMaxBasketLossAccountCurrency) return;

   bool buySignal = false, sellSignal = false;
   if(!GetSignals(buySignal, sellSignal)) return;
   if(buySignal && InpAllowBuy) OpenTrade(ORDER_TYPE_BUY);
   else if(sellSignal && InpAllowSell) OpenTrade(ORDER_TYPE_SELL);
}

void OnTimer()
{
   if(InpShowDashboard) UpdateDashboard();
}

bool CopyOne(int handle, int buffer, int shift, double &value)
{
   double a[1];
   if(CopyBuffer(handle, buffer, shift, 1, a) != 1) return false;
   value = a[0];
   return MathIsValidNumber(value);
}

bool GetSignals(bool &buySignal, bool &sellSignal)
{
   double fast1, fast2, slow1, slow2, rsi1, adx1;
   if(!CopyOne(hFast, 0, 1, fast1) || !CopyOne(hFast, 0, 2, fast2) ||
      !CopyOne(hSlow, 0, 1, slow1) || !CopyOne(hSlow, 0, 2, slow2) ||
      !CopyOne(hRSI, 0, 1, rsi1) || !CopyOne(hADX, 0, 1, adx1))
      return false;

   bool trendUp = fast2 <= slow2 && fast1 > slow1;
   bool trendDown = fast2 >= slow2 && fast1 < slow1;
   bool trendStrengthOK = adx1 >= InpADXMinimum;

   buySignal = trendUp && trendStrengthOK && rsi1 >= InpBuyRSIMin;
   sellSignal = trendDown && trendStrengthOK && rsi1 <= InpSellRSIMax;
   return true;
}

bool SpreadAllowed()
{
   MqlTick tick;
   if(!SymbolInfoTick(TradeSymbol(), tick)) return false;
   double point = SymbolInfoDouble(TradeSymbol(), SYMBOL_POINT);
   if(point <= 0) return false;
   double spread = (tick.ask - tick.bid) / point;
   return (InpMaxSpreadPoints <= 0 || spread <= InpMaxSpreadPoints);
}

void OpenTrade(ENUM_ORDER_TYPE type)
{
   MqlTick tick;
   if(!SymbolInfoTick(TradeSymbol(), tick)) return;

   double atr;
   if(!CopyOne(hATR, 0, 1, atr) || atr <= 0) return;

   double point = SymbolInfoDouble(TradeSymbol(), SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(TradeSymbol(), SYMBOL_DIGITS);
   double price = (type == ORDER_TYPE_BUY ? tick.ask : tick.bid);
   double slDistance = atr * InpATRStopMultiplier;
   double tpDistance = atr * InpATRTargetMultiplier;
   double sl = 0, tp = 0;

   if(slDistance > 0)
      sl = NormalizeDouble(type == ORDER_TYPE_BUY ? price - slDistance : price + slDistance, digits);
   if(tpDistance > 0)
      tp = NormalizeDouble(type == ORDER_TYPE_BUY ? price + tpDistance : price - tpDistance, digits);

   double volume = NormalizeVolume(InpLots);
   if(volume <= 0) return;

   bool ok = false;
   if(type == ORDER_TYPE_BUY)
      ok = trade.Buy(volume, TradeSymbol(), 0, sl, tp, "BF Trend Basket BUY");
   else
      ok = trade.Sell(volume, TradeSymbol(), 0, sl, tp, "BF Trend Basket SELL");

   if(!ok)
      Print("Entry failed. Retcode=", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
}

double NormalizeVolume(double lots)
{
   double vmin = SymbolInfoDouble(TradeSymbol(), SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(TradeSymbol(), SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(TradeSymbol(), SYMBOL_VOLUME_STEP);
   if(step <= 0 || vmax <= 0 || vmin <= 0) return 0;
   double v = MathMax(vmin, MathMin(vmax, lots));
   v = MathFloor(v / step) * step;
   int vd = 2;
   if(step < 0.01) vd = 3;
   if(step < 0.001) vd = 4;
   return NormalizeDouble(v, vd);
}

int CountOurPositions()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != TradeSymbol()) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      count++;
   }
   return count;
}

double BasketFloatingProfit()
{
   double sum = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != TradeSymbol()) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      sum += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
   }
   return sum;
}

bool GetBasketAverage(int &direction, double &avgPrice, double &volume, double &totalProfit)
{
   double weighted = 0;
   volume = 0;
   totalProfit = 0;
   direction = 0;
   int buys = 0, sells = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != TradeSymbol()) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;

      long type = PositionGetInteger(POSITION_TYPE);
      if(type == POSITION_TYPE_BUY) buys++;
      if(type == POSITION_TYPE_SELL) sells++;
      double v = PositionGetDouble(POSITION_VOLUME);
      weighted += PositionGetDouble(POSITION_PRICE_OPEN) * v;
      volume += v;
      totalProfit += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
   }

   if(volume <= 0) { avgPrice = 0; return false; }
   // Mixed-direction baskets do not have a single meaningful average target.
   if(buys > 0 && sells > 0) { avgPrice = 0; direction = 2; return false; }
   direction = (buys > 0 ? 1 : -1);
   avgPrice = weighted / volume;
   return true;
}

void ManageBasketExit()
{
   if(!InpUseBasket || CountOurPositions() == 0) return;

   int direction;
   double avg, volume, floating;
   if(!GetBasketAverage(direction, avg, volume, floating)) return;

   MqlTick tick;
   if(!SymbolInfoTick(TradeSymbol(), tick)) return;
   double point = SymbolInfoDouble(TradeSymbol(), SYMBOL_POINT);
   if(point <= 0) return;

   bool hitTP = false, hitSL = false;
   if(InpBasketTPPoints > 0)
   {
      if(direction == 1) hitTP = tick.bid >= avg + InpBasketTPPoints * point;
      else hitTP = tick.ask <= avg - InpBasketTPPoints * point;
   }
   if(InpBasketSLPoints > 0)
   {
      if(direction == 1) hitSL = tick.bid <= avg - InpBasketSLPoints * point;
      else hitSL = tick.ask >= avg + InpBasketSLPoints * point;
   }
   if(hitTP || hitSL) CloseOurPositions(hitTP ? "Basket TP" : "Basket SL");
}

void CloseOurPositions(string reason)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != TradeSymbol()) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(!trade.PositionClose(ticket))
         Print(reason, ": close failed ticket=", ticket, " retcode=", trade.ResultRetcode());
   }
}

void ManageTrailing()
{
   if(!InpUseTrailing) return;
   MqlTick tick;
   if(!SymbolInfoTick(TradeSymbol(), tick)) return;
   double point = SymbolInfoDouble(TradeSymbol(), SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(TradeSymbol(), SYMBOL_DIGITS);
   if(point <= 0) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != TradeSymbol()) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;

      long type = PositionGetInteger(POSITION_TYPE);
      double open = PositionGetDouble(POSITION_PRICE_OPEN);
      double oldSL = PositionGetDouble(POSITION_SL);
      double oldTP = PositionGetDouble(POSITION_TP);
      double gainPts = type == POSITION_TYPE_BUY ? (tick.bid - open) / point : (open - tick.ask) / point;
      if(gainPts < InpTrailStartPoints) continue;

      double newSL = type == POSITION_TYPE_BUY
         ? NormalizeDouble(tick.bid - InpTrailDistancePoints * point, digits)
         : NormalizeDouble(tick.ask + InpTrailDistancePoints * point, digits);

      bool improves = type == POSITION_TYPE_BUY
         ? (oldSL == 0 || newSL > oldSL + InpTrailStepPoints * point)
         : (oldSL == 0 || newSL < oldSL - InpTrailStepPoints * point);

      if(improves && !trade.PositionModify(ticket, newSL, oldTP))
         Print("Trailing update failed ticket=", ticket, " retcode=", trade.ResultRetcode());
   }
}

void UpdateRiskLock()
{
   riskLocked = false;
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(InpMaxBasketLossAccountCurrency > 0 &&
      BasketFloatingProfit() <= -InpMaxBasketLossAccountCurrency)
      riskLocked = true;

   if(InpMaxDrawdownPercent > 0 && initialEquity > 0)
   {
      double dd = (initialEquity - equity) / initialEquity * 100.0;
      if(dd >= InpMaxDrawdownPercent) riskLocked = true;
   }
   if(balance <= 0) riskLocked = true;
}

void UpdateDashboard()
{
   int direction;
   double avg, volume, floating;
   bool oneDirection = GetBasketAverage(direction, avg, volume, floating);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double dd = initialEquity > 0 ? (initialEquity - equity) / initialEquity * 100.0 : 0;
   string side = !oneDirection ? (CountOurPositions() == 0 ? "FLAT" : "MIXED") : (direction == 1 ? "BUY" : "SELL");

   Comment("BRAINFORZE | TREND BASKET PRO (DEMO)\n",
           "Symbol/TF: ", TradeSymbol(), " / ", EnumToString(InpTimeframe), "\n",
           "Mode: ", side, " | Positions: ", CountOurPositions(), "/", InpMaxPositions, "\n",
           "Balance: ", DoubleToString(balance, 2), " | Equity: ", DoubleToString(equity, 2), "\n",
           "Basket P/L: ", DoubleToString(BasketFloatingProfit(), 2),
           " | DD from init equity: ", DoubleToString(dd, 2), "%\n",
           "Risk Guard: ", (riskLocked ? "LOCKED - NO NEW ENTRIES" : "READY"),
           " | Basket: ", (InpUseBasket ? "ON" : "OFF"),
           " | Trailing: ", (InpUseTrailing ? "ON" : "OFF"), "\n",
           "Prototype only. Check Experts/Journal and test on DEMO.");
}
