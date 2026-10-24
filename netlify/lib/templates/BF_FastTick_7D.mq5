//+------------------------------------------------------------------+
//| BF_FastTick_7D.mq5 | BRAINFORZE 7-Day Trial |
//| Strategy: Fast-Tick Momentum Demo (not true HFT) | For MetaTrader 5 (MQL5) |
//| Demo/testing only. No profit guarantee. |
//+------------------------------------------------------------------+
#property strict
#property version "1.00"
#include <Trade/Trade.mqh>
CTrade trade;
input ulong MagicNumber=26010221;
input bool EnableTrading=true;
// Expiration is assigned by the download server at download time (UTC).
const datetime TRIAL_EXPIRES_UTC = D'EXPIRY_PLACEHOLDER';
input int LookbackTicks=12;
input double Lots=0.01;
input int StopLossPoints=300, TakeProfitPoints=300;
MqlTick ticks[];
int SetupStrategy(){ ArrayResize(ticks,LookbackTicks+1); return INIT_SUCCEEDED; }
bool Signal(bool &buy){ MqlTick t; if(!SymbolInfoTick(_Symbol,t))return false; static double first=0; static int seen=0; if(first==0){first=t.bid;seen=0;return false;} seen++; if(seen<LookbackTicks)return false; double move=(t.bid-first)/_Point; first=t.bid;seen=0; if(move>15){buy=true;return true;} if(move<-15){buy=false;return true;} return false; }
bool Expired(){ return TimeGMT() >= TRIAL_EXPIRES_UTC; }
int OnInit(){ trade.SetExpertMagicNumber(MagicNumber); return SetupStrategy(); }
void OnTick(){
 if(Expired()){ Comment("BRAINFORZE trial expired. Please request a new trial."); return; }
 if(!EnableTrading) return;
 if(PositionSelect(_Symbol)) return;
 bool buy=false; if(!Signal(buy)) return;
 MqlTick tick; if(!SymbolInfoTick(_Symbol,tick))return;
 double lot=Lots; double minLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN), maxLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX), step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
 lot=MathMax(minLot,MathMin(maxLot,MathFloor(lot/step)*step));
 double sl=0,tp=0; int digits=(int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS);
 if(buy){ if(StopLossPoints>0)sl=NormalizeDouble(tick.ask-StopLossPoints*_Point,digits); if(TakeProfitPoints>0)tp=NormalizeDouble(tick.ask+TakeProfitPoints*_Point,digits); trade.Buy(lot,_Symbol,0,sl,tp,"BF 7D trial"); }
 else { if(StopLossPoints>0)sl=NormalizeDouble(tick.bid+StopLossPoints*_Point,digits); if(TakeProfitPoints>0)tp=NormalizeDouble(tick.bid-TakeProfitPoints*_Point,digits); trade.Sell(lot,_Symbol,0,sl,tp,"BF 7D trial"); }
}
