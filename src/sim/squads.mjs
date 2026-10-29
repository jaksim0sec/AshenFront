export function recoverSuppression(w) {
 for(const s of w.squads){if(w.tick-s.lastThreatTick>=40)s.suppression=Math.max(0,s.suppression-.4);
  if(s.suppression>=65)s.suppressed=true;else if(s.suppression<=35)s.suppressed=false;
  if(s.suppressed&&s.order!=='hold')s.movementBlockedReason='suppressed';else if(s.movementBlockedReason==='suppressed')s.movementBlockedReason=null;
 }
}
