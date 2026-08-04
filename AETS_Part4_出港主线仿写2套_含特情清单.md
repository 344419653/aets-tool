# AETS Part 4 出港主线仿写（第 4–5 套）+ 特情类型设计依据

## 一、特情类型设计依据（官方文件映射）

仿写特情的选择范围，依据三份官方文件交叉确定：

### 1.《民用运输机场突发事件应急救援管理规则》（民航局令第208号）——航空器突发事件分类
- 航空器失事
- 航空器空中遇险（故障、遭遇危险天气、危险品泄露等）
- 航空器受到非法干扰（劫持、爆炸物威胁等）
- 航空器地面相撞或与障碍物相撞
- 跑道事件（跑道外接地、冲出、偏出跑道）
- 航空器火警
- 其他

### 2.《民用航空空中交通管理规则》——紧急情况三阶段与特殊编码
- 情况不明 / 告警 / 遇险 三阶段（对应 PANPAN/MAYDAY 分级训练）
- 特殊编码：非法干扰 A7500、通信失效 A7600、紧急遇险 A7700
- 重要细节：管制员不得在陆空通话中提及航空器受到非法干扰（这本身是考点）

### 3. 空管岗位特情处置检查单——处置流程骨架
收到特情后的处置顺序：① 了解机组意图 → ② 指挥其他航空器避让 → ③ 按机组意图提供协助 → ④ 征得同意后了解特情详情和飞行状况 → ⑤ 了解机上人数、剩余油量、危险品信息。这正是 Part 4 脚本中 B 指令的编排逻辑。

### 4. 特情池（Part 4 扩展规划，按文件分类）

| 类别 | 特情 | 状态 |
|---|---|---|
| 飞行能力受损（MAYDAY） | 燃油泄漏 | 原套 ✅ |
| | 发动机火警 | sim2 ✅ |
| | **鸟击+发动机喘振（出港返场）** | **sim4（本套）** |
| | 液压失效 | 待出 |
| | 起落架故障（收不上/放不下） | 待出 |
| | 快速释压 | 待出 |
| | 襟翼卡阻 | 待出 |
| 机上状况（PANPAN） | 旅客重病 | sim3 ✅ |
| | **货舱火警指示（出港返场）** | **sim5（本套）** |
| | 客舱烟雾 | 待出 |
| | 危险品泄漏 | 待出 |
| | 非法干扰（含"通话中不得提及"考点） | 待出 |
| 环境/运行 | 风切变复飞 | 待出 |
| | 跑道事件（冲出/偏出） | 待出 |
| | 危险天气绕飞+特情叠加 | 待出 |

## 二、出港主线的结构说明

原套进港主线席位链：CTL → APP → TWR。
出港主线席位链变为：**TWR（起飞放行）→ APP（返场引导）→ TWR（着陆）**，并把"让出跑道给特情机"的出港副线（hold position + 延误）纳入考察。副线仍为一进港一等待的组合。

---

# Simulation 4（主线出港：鸟击+发动机喘振 MAYDAY 返场）

**Directions: In this part, you are going to play the role of WH ATC, listen to the recordings and follow the instructions in the prompt. Record your answers within the time limit.**

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
CCA: WUHAN TOWER, CCA2291, ready for departure, RWY36R.
B: Tell CCA2291 to hold position, expect delay, because there is an emergency traffic returning to land.
C: CCA2291, WUHAN TOWER, hold position, expect delay due to emergency traffic landing.
CCA: holding, wilco, CCA2291.
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
CCA: WUHAN TOWER, CCA2291, still holding, request departure information.
B: Inform CCA2291 that the runway will be available soon, expect departure in 5 minutes after the landing traffic vacates the runway.
C: CCA2291, expect departure in 5 minutes after the landing aircraft vacates the runway.
CCA: roger, CCA2291.
AFR: WUHAN APPROACH, AFR720, 2700m maintaining, approaching the localizer.
B: Tell AFR720 to slow down to 180kts, inform AFR720 is No.2, and there will be a departure ahead of him.
C: AFR720, reduce speed to 180kts, you're NO.2, expect departure traffic ahead.
AFR: speed 180kts, No.2, AFR720.

---

# Simulation 5（主线出港：货舱火警指示 PANPAN 返场）

**Directions: In this part, you are going to play the role of WH ATC, listen to the recordings and follow the instructions in the prompt. Record your answers within the time limit.**

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
CHH: WUHAN TOWER, CHH3309, ready for departure, RWY36R.
B: Tell CHH3309 to hold position, expect delay, because there is an urgency traffic returning to land.
C: CHH3309, WUHAN TOWER, hold position, expect delay due to urgency traffic landing.
CHH: holding, wilco, CHH3309.
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
CHH: WUHAN TOWER, CHH3309, still holding, request departure information.
B: Inform CHH3309 that the runway is occupied by the landing traffic for a fire check, expect further delay of 15 minutes.
C: CHH3309, the runway is occupied due to fire check, expect further delay of 15 minutes.
CHH: roger, CHH3309.
JAL: WUHAN APPROACH, JAL782, 2400m maintaining, approaching the localizer.
B: Tell JAL782 to slow down to 170kts, inform JAL782 is No.2, and there may be a delay because the runway is occupied.
C: JAL782, reduce speed to 170kts, you're NO.2, expect delay due to runway occupied.
JAL: speed 170kts, No.2, JAL782.
