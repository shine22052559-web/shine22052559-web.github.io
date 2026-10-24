//+------------------------------------------------------------------+
//| BF_Scalping_7D.mq5 | BRAINFORZE 7-Day Trial |
//| Strategy: EMA + RSI Scalping Demo | For MetaTrader 5 (MQL5) |
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
input int FastEMA=9, SlowEMA=21, RSIPeriod=7;
input double Lots=0.01;
input int StopLossPoints=250, TakeProfitPoints=350;
int hFast,hSlow,hRsi;
int OnInit(){ hFast=iMA(_Symbol,_Period,FastEMA,0,MODE_EMA,PRICE_CLOSE); hSlow=iMA(_Symbol,_Period,SlowEMA,0,MODE_EMA,PRICE_CLOSE); hRsi=iRSI(_Symbol,_Period,RSIPeriod,PRICE_CLOSE); if(hFast==INVALID_HANDLE||hSlow==INVALID_HANDLE||hRsi==INVALID_HANDLE) return INIT_FAILED; return INIT_SUCCEEDED; }
bool Signal(bool &buy){ double f[2],s[2],r[1]; ArraySetAsSeries(f,true);ArraySetAsSeries(s,true);ArraySetAsSeries(r,true); if(CopyBuffer(hFast,0,0,2,f)<2||CopyBuffer(hSlow,0,0,2,s)<2||CopyBuffer(hRsi,0,0,1,r)<1)return false; if(f[0]>s[0]&&r[0]>52){buy=true;return true;} if(f[0]<s[0]&&r[0]<48){buy=false;return true;} return false; }
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
