# AETS Part 4 修订：新增 Wuhan Apron 机坪席位

## 修订说明

1. **席位链变化**：原"塔台"角色拆分为 **Wuhan Apron（机坪，频率 119.25，沿用真题设定）** 和 **Wuhan Tower（塔台，124.35）**。出港主线席位链：Apron（开车/推出/滑行）→ Tower（起飞）→ APP（返场引导）→ Tower（着陆）→ Apron（滑回机位）。进港主线在着陆后增加 Apron 移交。
2. **机坪段新增考察点**（原套没有，均为机坪管制员核心业务）：开车许可、推出许可（含机头朝向）、机坪滑行指令（机坪滑行道→移交点）、移交塔台时机、落地后滑回与特种车辆协调。
3. sim2/sim3 只补结尾 3 行机坪移交（见文末补丁）；sim4/sim5 为完整修订版（见下文）。

---

# Simulation 4 修订版（主线出港：鸟击+发动机喘振 MAYDAY 返场）

**Directions: In this part, you are going to play the role of WH ATC, listen to the recordings and follow the instructions in the prompt. Record your answers within the time limit.**

CSN: WUHAN APRON, CSN6688, stand 214, information K, request start-up.
B: Inform CSN6688 that the start-up is approved.
C: CSN6688, WUHAN APRON, start-up approved.
CSN: start-up approved, CSN6688.
CSN: WUHAN APRON, CSN6688, request pushback.
B: Approve the pushback, and tell CSN6688 to face south after pushback.
C: CSN6688, pushback approved, face south.
CSN: pushback approved, face south, CSN6688.
CSN: WUHAN APRON, CSN6688, request taxi.
B: Instruct CSN6688 to taxi via K and T2 to the holding point of RWY36R, and contact WUHAN TOWER on 124.35 when at the holding point.
C: CSN6688, taxi via K and T2 to holding point of RWY36R, contact WUHAN TOWER on 124.35 at the holding point.
CSN: taxi via K and T2 to holding point RWY36R, contact TOWER 124.35, CSN6688.
CSN: WUHAN TOWER, CSN6688, ready for departure, RWY36R.
B: Issue takeoff clearance to CSN6688, RWY36R, surface wind 030 degrees 8m/s gusting to 16m/s, and instruct him to contact Departure on 118.9 after airborne.
C: CSN6688, WUHAN TOWER, cleared for takeoff, RWY36R, surface wind 030 degrees 8m/s gusting to 16m/s, after airborne contact Departure 118.9.
CSN: cleared for takeoff, RWY36R, contact Departure 118.9, CSN6688.
CSN: WUHAN APPROACH, CSN6688, 400m climbing. We had a bird strike, the left engine is surging, request return to land.
B: Inform CSN6688 that you have received his message, tell him to continue runway heading, turn left after passing 900m, and maintain 1500m.
C: CSN6688, WUHAN APPROACH, roger, continue runway heading, turn left after 900m, maintain 1500m.
CSN: continue runway heading, turn left after 900m, maintain 1500m, CSN6688.
B: Ask CSN6688 about the engine condition, and whether there is any visible damage to the aircraft.
C: CSN6688, confirm the engine condition, any visible damage to the aircraft?
CSN: WUHAN APPROACH, the left engine is still surging with serious vibration, we have shut it down, no visible damage.
B: Inform CSN6688 that you have received the message, get some info of the NO of people on board and the assistance they need on landing.
C: CSN6688, roger, confirm POB and the assistance you need on landing.
CSN: We have 168 passengers and 8 crew members on board, request fire trucks on standby, and we will be landing overweight.
B: Inform CSN6688 that the fire trucks will be ready, tell him he is No.1, and expect ILS approach RWY36R.
C: CSN6688, roger, fire trucks will be ready, you're NO.1, expect ILS approach RWY36R.
CSN: roger, No.1, CSN6688.
CCA: WUHAN APRON, CCA2291, stand 306, information K, request start-up.
B: Tell CCA2291 to standby for start-up, because an emergency traffic is returning to land, and expect delay of 15 minutes.
C: CCA2291, WUHAN APRON, standby for start-up, expect delay of 15 minutes due to emergency traffic returning.
CCA: roger, standby for start-up, CCA2291.
AFR: WUHAN APPROACH, AFR720, 3900m maintaining, estimating KG 25, information T.
B: Inform AFR720 that you have seen him on radar, tell to proceed to the A/P via KG-11A, the app procedure will be ILS app, RWY in use is 36R, lower lvl to 2700m on QNH 1013, and inform AFR720 is No.2 in the app sequence.
C: AFR720, WUHAN APPROACH, radar contact, follow KG-11A, expect ILS approach RWY36R, descend to 2700m on QNH 1013, you're NO.2 for app.
AFR: KG-11A, ILS approach RWY36R, descend to 2700m on QNH 1013, No.2 for app, AFR720.
B: Instruct CSN6688 to turn left, set course on 270 degrees, lower to 1200m, and slow down to 170kts.
C: CSN6688, turn left heading 270, descend to 1200m, reduce speed to 170kts.
CSN: heading 270, descend to 1200m, speed 170kts, CSN6688.
B: Ask CSN6688 to turn left to a heading of 320, tell CSN6688 that he is allowed to capture the localizer signal of RWY36R, and call you when the signal is captured.
C: CSN6688, turn left heading 320, cleared for ILS approach RWY36R, report established localizer.
CSN: roger, heading 320 to intercept the localizer of RWY36R, CSN6688.
CSN: WUHAN APPROACH, CSN6688, established the localizer.
B: Inform CSN6688 that he is 10km from touchdown, establish radio comms with WH TWR on 124.35.
C: CSN6688, 10km from touchdown, radar service terminated, contact WH tower on 124.35.
CSN: contact tower on 124.35, CSN6688.
CSN: MAYDAY MAYDAY MAYDAY, WUHAN TOWER, this is CSN6688, single engine, overweight landing, 8km from touchdown, fully established on RWY36R.
B: Inform CSN6688 that you have received his distress message, ask him to call you when passing OM, tell the pilot that fire trucks are ready for him.
C: CSN6688, WUHAN TOWER, roger MAYDAY, report passing outer marker, fire trucks are ready.
CSN: roger, report outer marker, CSN6688.
CSN: outer marker, CSN6688.
B: Issue landing clearance to CSN6688, the wind component is 020 at 9 meters/sec, gusting to 17m/s, and ask if he can vacate the runway normally after landing.
C: CSN6688, surface wind 020 degrees 9m/s gusting to 17m/s, cleared to land, confirm you can vacate the runway after landing.
CSN: affirmative, but request the fire trucks to follow us to the stand, CSN6688.
B: Inform CSN6688 that the fire trucks will follow, and tell him to contact WUHAN APRON on 119.25 for taxi to the stand after vacating the runway.
C: CSN6688, roger, fire trucks will follow you, after vacating the runway, contact WUHAN APRON on 119.25.
CSN: contact APRON 119.25, CSN6688.
CSN: WUHAN APRON, CSN6688, vacated the runway, request taxi to stand 214.
B: Instruct CSN6688 to taxi to stand 214 via B7, and tell him the fire trucks are following.
C: CSN6688, taxi to stand 214 via B7, fire trucks are following.
CSN: taxi to stand 214 via B7, CSN6688.
CCA: WUHAN APRON, CCA2291, still standing by, request start-up information.
B: Inform CCA2291 that the emergency traffic has landed, approve the start-up, and tell him to request pushback when ready.
C: CCA2291, start-up approved, request pushback when ready.
CCA: start-up approved, wilco, CCA2291.
AFR: WUHAN APPROACH, AFR720, 2700m maintaining, approaching the localizer.
B: Tell AFR720 to slow down to 180kts, inform AFR720 is No.2, and there will be a departure ahead of him.
C: AFR720, reduce speed to 180kts, you're NO.2, expect departure traffic ahead.
AFR: speed 180kts, No.2, AFR720.

---

# Simulation 5 修订版（主线出港：货舱火警指示 PANPAN 返场）

**Directions: In this part, you are going to play the role of WH ATC, listen to the recordings and follow the instructions in the prompt. Record your answers within the time limit.**

CCA: WUHAN APRON, CCA7715, stand 306, information M, request start-up.
B: Inform CCA7715 that the start-up is approved.
C: CCA7715, WUHAN APRON, start-up approved.
CCA: start-up approved, CCA7715.
CCA: WUHAN APRON, CCA7715, request pushback.
B: Approve the pushback, and tell CCA7715 to face north after pushback.
C: CCA7715, pushback approved, face north.
CCA: pushback approved, face north, CCA7715.
CCA: WUHAN APRON, CCA7715, request taxi.
B: Instruct CCA7715 to taxi via A and A5 to the holding point of RWY36R, and contact WUHAN TOWER on 124.35 when at the holding point.
C: CCA7715, taxi via A and A5 to holding point of RWY36R, contact WUHAN TOWER on 124.35 at the holding point.
CCA: taxi via A and A5 to holding point RWY36R, contact TOWER 124.35, CCA7715.
CCA: WUHAN TOWER, CCA7715, ready for departure, RWY36R.
B: Issue takeoff clearance to CCA7715, RWY36R, surface wind 340 degrees 6m/s gusting to 12m/s, and instruct him to contact Departure on 118.9 after airborne.
C: CCA7715, WUHAN TOWER, cleared for takeoff, RWY36R, surface wind 340 degrees 6m/s gusting to 12m/s, after airborne contact Departure 118.9.
CCA: cleared for takeoff, RWY36R, contact Departure 118.9, CCA7715.
CCA: PANPAN, PANPAN, PANPAN, WUHAN APPROACH, CCA7715, 600m climbing. We have a cargo fire indication, we have discharged the fire extinguisher, request return to land.
B: Inform CCA7715 that you have received his urgency message, tell him to continue runway heading, turn right after passing 1000m, and maintain 1800m.
C: CCA7715, WUHAN APPROACH, roger PANPAN, continue runway heading, turn right after 1000m, maintain 1800m.
CCA: continue runway heading, turn right after 1000m, maintain 1800m, CCA7715.
B: Ask CCA7715 whether the fire warning is still on, and if there is any smoke in the cabin.
C: CCA7715, confirm the fire warning is still on, any smoke in the cabin?
CCA: WUHAN APPROACH, the warning is still on, no smoke in the cabin.
B: Inform CCA7715 that you have received the message, get some info of the NO of people on board, whether there are any dangerous goods on board, and the assistance they need on landing.
C: CCA7715, roger, confirm POB, any dangerous goods on board, and the assistance you need on landing.
CCA: We have 145 passengers and 9 crew members on board, no dangerous goods, request fire trucks and an inspection after landing.
B: Inform CCA7715 that the fire trucks will be ready, tell him he is No.1, and expect ILS approach RWY36R.
C: CCA7715, roger, fire trucks will be ready, you're NO.1, expect ILS approach RWY36R.
CCA: roger, No.1, CCA7715.
CHH: WUHAN APRON, CHH3309, stand 318, information M, request start-up.
B: Tell CHH3309 to standby for start-up, because an urgency traffic is returning to land, and expect delay of 20 minutes.
C: CHH3309, WUHAN APRON, standby for start-up, expect delay of 20 minutes due to urgency traffic returning.
CHH: roger, standby for start-up, CHH3309.
JAL: WUHAN APPROACH, JAL782, 3600m maintaining, estimating XS 30, information K.
B: Inform JAL782 that you have seen him on radar, tell to proceed to the A/P via XS-11A, the app procedure will be ILS app, RWY in use is 36R, lower lvl to 2400m on QNH 1011, and inform JAL782 is No.2 in the app sequence.
C: JAL782, WUHAN APPROACH, radar contact, follow XS-11A, expect ILS approach RWY36R, descend to 2400m on QNH 1011, you're NO.2 for app.
JAL: XS-11A, ILS approach RWY36R, descend to 2400m on QNH 1011, No.2 for app, JAL782.
B: Instruct CCA7715 to turn right, set course on 090 degrees, lower to 1500m, and slow down to 180kts.
C: CCA7715, turn right heading 090, descend to 1500m, reduce speed to 180kts.
CCA: heading 090, descend to 1500m, speed 180kts, CCA7715.
B: Ask CCA7715 to turn right to a heading of 300, tell CCA7715 that he is allowed to capture the localizer signal of RWY36R, and call you when the signal is captured.
C: CCA7715, turn right heading 300, cleared for ILS approach RWY36R, report established localizer.
CCA: roger, heading 300 to intercept the localizer of RWY36R, CCA7715.
CCA: WUHAN APPROACH, CCA7715, established the localizer.
B: Inform CCA7715 that he is 9km from touchdown, establish radio comms with WH TWR on 124.35.
C: CCA7715, 9km from touchdown, radar service terminated, contact WH tower on 124.35.
CCA: contact tower on 124.35, CCA7715.
CCA: PANPAN PANPAN PANPAN, WUHAN TOWER, this is CCA7715, cargo fire warning, 7km from touchdown, fully established on RWY36R.
B: Inform CCA7715 that you have received his urgency message, ask him to call you when passing OM, tell the pilot that fire trucks are ready for him.
C: CCA7715, WUHAN TOWER, roger PANPAN, report passing outer marker, fire trucks are ready.
CCA: roger, report outer marker, CCA7715.
CCA: outer marker, CCA7715.
B: Issue landing clearance to CCA7715, the wind component is 350 at 5 meters/sec, gusting to 11m/s, and ask his intention after landing.
C: CCA7715, surface wind 350 degrees 5m/s gusting to 11m/s, cleared to land, confirm your intention after landing.
CCA: we will stop on the runway for a fire check, request the fire crew to meet us on the runway, CCA7715.
B: Inform CCA7715 that the fire crew will meet him on the runway, and after the check, contact WUHAN APRON on 119.25 for further taxi instruction.
C: CCA7715, roger, fire crew will meet you on the runway, after the check, contact WUHAN APRON on 119.25.
CCA: contact APRON 119.25, CCA7715.
CHH: WUHAN APRON, CHH3309, still standing by, request start-up information.
B: Inform CHH3309 that the runway is occupied by the landing traffic for a fire check, expect further delay of 15 minutes.
C: CHH3309, the runway is occupied due to fire check, expect further delay of 15 minutes.
CHH: roger, CHH3309.
JAL: WUHAN APPROACH, JAL782, 2400m maintaining, approaching the localizer.
B: Tell JAL782 to slow down to 170kts, inform JAL782 is No.2, and there may be a delay because the runway is occupied.
C: JAL782, reduce speed to 170kts, you're NO.2, expect delay due to runway occupied.
JAL: speed 170kts, No.2, JAL782.

---

# 补丁：sim2 / sim3 结尾追加机坪移交

## Simulation 2（结尾原句 "negative, we can taxi to the stand, CSN4580." 之后追加）

B: Tell CSN4580 to contact WUHAN APRON on 119.25 for taxi to the stand after vacating the runway.
C: CSN4580, after vacating the runway, contact WUHAN APRON on 119.25.
CSN: contact APRON 119.25, CSN4580.

## Simulation 3（结尾原句 "affirmative, just need the ambulance at the stand, CES7721." 之后追加）

B: Inform CES7721 that the ambulance will be arranged at the stand, and tell him to contact WUHAN APRON on 119.25 for taxi to the stand after vacating the runway.
C: CES7721, roger, the ambulance will meet you at the stand, after vacating the runway, contact WUHAN APRON on 119.25.
CES: contact APRON 119.25, CES7721.
