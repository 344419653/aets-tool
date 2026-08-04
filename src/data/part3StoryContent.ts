import type { StoryKeyword } from '@/types/exam';

/** Part 2 故事复述的参考内容（原文/中文梗概/关键词），key 为故事 id（1-42，与 questionsPart3Story.ts 一致） */
export const storyContent: Record<number, {
  /** 中文故事梗概（1-2 句） */
  outline: string;
  /** 5 个关键词（中英对照） */
  keywords: StoryKeyword[];
  /** 故事英文原文 */
  transcript: string;
}> = {
  1: {
    outline: '2000 年的一天，152 航班起飞三分钟后遭遇鸟击请求返场，但本场 RVR 低于着陆最低标准。机组决定备降 A 机场却因高度不够无法到达，最终在河面上以约 150 英里/小时的速度无动力迫降。',
    keywords: [
      { chinese: '鸟击', english: 'bird strike' },
      { chinese: '跑道视程', english: 'RVR (runway visual range)' },
      { chinese: '低于着陆最低标准', english: 'below landing minima' },
      { chinese: '紧急着陆', english: 'emergency landing' },
      { chinese: '水上迫降', english: 'ditching' },
    ],
    transcript: "One day in 2000, Flight 152 reported bird strike three minutes after takeoff, and requested return to the airport. But the controller told the crew that the RVR of the airport was below landing minima, so the captain made a decision to make an emergency landing at airport A. Air traffic controller quickly contacted A airport and gained permission for a landing on runway 15. However, the aircraft could not reach A airport due to lack of altitude. The crew decided to make a ditching in a river and they reported it to the controller. Finally, the crew made a ditching without power at about 150 miles per hour in the river.",
  },
  2: {
    outline: 'SIA188 在进入芝加哥区域管制区前被指令换频，副驾驶正确复诵了新频率，但机组并未在新频率上建立联系。由于接收扇区正逢交接班，管制员 30 分钟后才发现该航班未建立无线电联系，又经多方尝试，最终在 50 分钟后通过应急频率恢复了联系。',
    keywords: [
      { chinese: '换频', english: 'frequency change' },
      { chinese: '复诵', english: 'read back' },
      { chinese: '交接班', english: 'shift change' },
      { chinese: '建立无线电联系', english: 'establish radio contact' },
      { chinese: '应急频率', english: 'emergency frequency' },
    ],
    transcript: "When SIA188 was approaching the airspace of Chicago Center Area Control, the controller instructed the flight crew to change radio frequency for the next section on 132.1. The first officer acknowledged the frequency change and read back the correct frequency. However, the flight crew did not contact ATC on the new frequency. Because the controllers in the receiving units were preparing for a shift change, they didn't know that flight 188 did not establish radio contact, 30 minutes later, the controller at the next sector identified SIA188 on the radar. Although they attempted to establish contact with the airplane by calling the company dispatcher, they got no response from the pilots. The controller finally regained contact with SIA188 on the emergency frequency 50 minutes later.",
  },
  3: {
    outline: '一架 B757 落地后脱离跑道 36L，获准穿越跑道 36R 时却停在两条跑道之间的滑行道 A9 上，无线电无应答且着陆灯熄灭，管制员判断其无线电失效，于是向 36R 上的 A320 发出起飞许可。突然发现 B757 灯光亮起并开始移动，管制员立即取消 A320 的起飞许可，避免了一次跑道入侵。',
    keywords: [
      { chinese: '脱离跑道', english: 'vacate runway' },
      { chinese: '穿越跑道许可', english: 'clearance to cross runway' },
      { chinese: '无线电失效', english: 'radio failure' },
      { chinese: '跑道入侵', english: 'runway incursion' },
      { chinese: '取消起飞许可', english: "cancel takeoff clearance" },
    ],
    transcript: "Landing light signal could provide useful information to controllers. One day, a B757 vacated runway 36L via taxiway A9 after landing. It was then cleared to cross runway 36R. But it stopped taxiing on taxiway A9 between runway 36L and runway 36R. The tower controller attempted to contact the pilot but received no reply. He saw the aircraft landing lights were also off. This made him believe that the B757 had a radio failure and had not received the clearance to cross runway 36R. So he issued takeoff clearance to A320 on runway 36R. Suddenly, the controller noticed the B757's lights came on and it began to move. Realizing the risk of runway incursion, he cancelled A320's takeoff clearance immediately.",
  },
  4: {
    outline: '2002 年的一个大雾天，SIA686 被许可滑向跑道 36R，同时一架塞斯纳获准开车后误入滑行道 R6，地面管制员未察觉并让其继续滑行，而塔台管制员又许可 686 航班起飞。塞斯纳越过跑道等待标志进入使用中的 36R 跑道，两机相撞，机上 114 人全部遇难。',
    keywords: [
      { chinese: '大雾天气', english: 'foggy day' },
      { chinese: '发动机启动许可', english: 'start-up clearance' },
      { chinese: '不同的无线电频率', english: 'different radio frequencies' },
      { chinese: '进入使用跑道', english: 'enter the active runway' },
      { chinese: '两机相撞', english: 'collision (collide)' },
    ],
    transcript: "It was a foggy day in 2002, SIA 686 was cleared to taxi to runway 36R. A few minutes later, the Cessna pilot requested engine start. The ground controller gave start-up clearance. Then he requested Flight 686 to contact the Tower controller. From then on, those two aircraft were on two different radio frequencies. The Cessna started to taxi, but the pilot made a mistake to taxi to right and entered taxiway R6. But the ground controller did not realize it and cleared the Cessna to continue its taxi. At the same time, the Tower controller cleared Flight 686 for takeoff. When the flight 686 was rolling on the runway, the Cessna crossed the runway holding sign and entered the active runway 36R. Unfortunately, the two aircraft collided, all 114 people on board died.",
  },
  5: {
    outline: '塔台管制员许可 345 航班在跑道 22 着陆，却忘记该进近航空器，又许可 101 航班从交叉的跑道 16 起飞。345 接地后地面雷达告警，飞机停在交叉道口中间，101 无法中断起飞，只能提前拉升从 345 上方掠过，两机仅以 50 英尺之差躲过相撞。',
    keywords: [
      { chinese: '交叉跑道', english: 'intersecting runways' },
      { chinese: '着陆许可', english: 'landing clearance' },
      { chinese: '地面雷达告警', english: 'ground radar alert' },
      { chinese: '中断起飞', english: 'abort takeoff' },
      { chinese: '提前离地', english: 'early liftoff' },
    ],
    transcript: "Flight 345 nearly collided with Flight 101 at the intersection of runway 16 and runway 22. There were no injuries and no damage to either aircraft. But it was regarded as the most serious incident of this kind. That day, the tower controller cleared Flight 345 to land on runway 22. But he forgot the arriving aircraft when he cleared Flight 101 for take off from the intersecting runway 16. After Flight 345 touched down, the ground radar system alerted. The controller tried to instruct Flight 345 to stop short of runway 16. However, the aircraft managed to stop in the middle of the intersection. It was impossible for Flight 101 to abort takeoff. Flight 101 made an early liftoff and flew over Flight 345. The two aircraft missed colliding by only 50 feet.",
  },
  6: {
    outline: '美航 835 航班进近目的地时请求 12 号跑道 ILS 进近，管制员因顺风建议使用 30 号跑道盘旋进近，但机组坚持在 12 号跑道着陆。跑道湿滑、刹车效应差，着陆滑跑中飞机向左偏出跑道并撞穿机场围栏，机身断成三截，无人死亡但多名乘客受重伤。',
    keywords: [
      { chinese: 'ILS 进近', english: 'ILS approach' },
      { chinese: '顺风', english: 'tailwind' },
      { chinese: '盘旋进近', english: 'circling approach' },
      { chinese: '刹车效应', english: 'braking action' },
      { chinese: '偏出跑道', english: 'skid off the runway (runway excursion)' },
    ],
    transcript: "As American Flight 835 was approaching the terminal area of its destination, the flight crew contacted the Approach Control and requested ILS approach for runway 12. Tailwind conditions were reported on runway 12 at that time, so the controller advised the pilot to make a circling approach for runway 30. But the crew insisted to land on runway 12 and the controller cleared them to land on the runway 12. The runway was wet and braking action was not good. During landing roll, the aircraft skidded to the left of the runway and went through the airport fences. The fuselage was broken into three pieces, the right engine and right main gear were separated from the aircraft. No one was killed, but many passengers suffered from serious injuries.",
  },
  7: {
    outline: '123 航班（B737，载 152 名乘客和 9 名机组）在成田机场因交通拥挤被指令等待，期间天气恶化，管制员建议备降但机组报告燃油不足。雷达引导进近 34R 时因风切变无法稳定在航向道上而复飞，第二次进近后因燃油耗尽撞上山坡，机上人员全部遇难。',
    keywords: [
      { chinese: '等待（盘旋）', english: 'holding' },
      { chinese: '天气恶化', english: 'weather deteriorating' },
      { chinese: '备降', english: 'divert to the alternate' },
      { chinese: '风切变', english: 'wind shear' },
      { chinese: '燃油不足', english: 'fuel shortage' },
    ],
    transcript: "One day, Flight 123, a B737 carrying 152 passengers and 9 crews was flying to land at Tokyo Narita International Airport. When it was transferred from Tokyo Control to Tokyo Approach, flight 123 was instructed to proceed to DA to hold because of traffic congestion. During the holding, the flight crew was informed that the local weather was deteriorating and the controller suggested the pilot divert to the alternate, but the pilot reported that their fuel was not enough to the alternate. So the controller vectored flight 123 by radar to land at runway 34R. Unfortunately, the pilot couldn't stabilize the aircraft on the localizer due to wind shear. Flight 123 went around and made a second approach. Later, it crashed into a hillside due to fuel shortage. The aircraft was broken into pieces and all the people on board were killed.",
  },
  8: {
    outline: '印尼 205 航班从济南飞往杭州，移交杭州进近后两次被指令减速，通过外指点标后管制员因间隔问题发出复飞指令。复飞过程中飞机因机械故障失控，以大迎角持续下降，撞上树木和建筑物，部分机身受损。',
    keywords: [
      { chinese: '减速', english: 'reduce speed (slow down)' },
      { chinese: '外指点标', english: 'outer marker' },
      { chinese: '复飞指令', english: 'missed approach clearance' },
      { chinese: '失控', english: 'out of control' },
      { chinese: '大迎角', english: 'high angle of attack' },
    ],
    transcript: "One day, Indonesia 205 took off from Jinan to Hangzhou. About one hour later, the aircraft was transferred to Hangzhou Approach. Hangzhou Approach required Indonesia 205 to slow down to 190 knots and later the controller asked the pilot to reduce speed to 160 knots. Three minutes later, Indonesia 205 passed the outer marker inbound. At that time, the controller issued a missed approach clearance because of separation. He instructed Indonesia 205 to make a right turn to a heading of 180 and climb to 900m. But during the missed approach, the aircraft was out of control because of mechanical problem. The aircraft continued to descend with a high angle of attack. The aircraft impacted trees and buildings and part of the fuselage was damaged.",
  },
  9: {
    outline: 'AFR188 在新加坡樟宜机场起飞时坠毁：塔台指令使用 02L 跑道，机组却进入 02R 跑道滑跑起飞，冲出跑道撞上机场围栏起火，机组和 110 名乘客遇难。调查发现三个原因：机组未有效核实机场位置、未检查是否在正确跑道上、滑行时闲聊导致情景意识丧失。',
    keywords: [
      { chinese: '对正跑道', english: 'line up (the runway)' },
      { chinese: '起飞滑跑', english: 'takeoff rolling' },
      { chinese: '冲出跑道', english: 'overrun the runway' },
      { chinese: '核实位置', english: 'verify position' },
      { chinese: '情景意识丧失', english: 'loss of situational awareness' },
    ],
    transcript: "One day, AFR188 crashed at Singapore Changi Airport during takeoff. The tower controller instructed the crew to takeoff on Runway 02L, but the crew lined up runway 02R and began their takeoff rolling. The aircraft overran the runway, and crashed into the fence of the airport. Crew members and 110 passengers were killed, and the co-pilot was badly injured. The plane was destroyed by the impact and caught on an intense fire. According to the investigation, there were three reasons leading to the accident. First of all, the crew didn't use effective methods to verify their position at the airport. Secondly, the crew forgot to check whether they were on the correct runway or not. Finally, the crew members' idle chatting during the taxi resulted in the loss of situational awareness.",
  },
  10: {
    outline: '一架 A320 滑行时与一架停着的 B737 相撞，B737 右侧副翼严重受损并漏油，A320 仅左机翼轻微受损，无人受伤。A320 机长原以为有足够间隔从右侧超越 B737，碰撞后消防到场，所幸漏油未引发火灾。',
    keywords: [
      { chinese: '滑行相撞', english: 'collision during taxi' },
      { chinese: '副翼', english: 'aileron' },
      { chinese: '足够的间隔', english: 'enough room' },
      { chinese: '燃油泄漏', english: 'fuel leakage' },
      { chinese: '停留刹车', english: 'parking brakes applied' },
    ],
    transcript: "One day, an A320 collided with a B737 during taxi. The right ailerons of B737 was severely damaged but A320 only had minor damage of its left wing. Luckily, there were no injuries. After receiving ATC taxi instruction, the A320 began to pass the B737 from the right side. The captain of A320 thought they had enough room to pass over the B737. But unfortunately, two aircraft collided together with the wings. Both captains reported the collision immediately to the controller. Because the Boeing aircraft was damaged seriously, fuel leakage was reported and fire services were required. Fortunately, the fuel leak didn't develop into fire. The crew of the Boeing aircraft complained that they just parked stationary with the parking brakes applied when they were hit.",
  },
  11: {
    outline: '国航一名飞行员回忆：他在跑道等待点被指令跑道外等待，为宣布紧急情况的 AFR123（起落架故障）让路。AFR123 先做低空通场让管制员目视检查，确认起落架仍在收上位，又尝试触地复飞震松卡阻的起落架未果，最终在铺泡沫的跑道上机腹着陆，安全落地，仅少数人轻伤。',
    keywords: [
      { chinese: '起落架故障', english: 'landing gear problem' },
      { chinese: '宣布紧急情况', english: 'declare emergency' },
      { chinese: '低空通场', english: 'low pass' },
      { chinese: '触地复飞', english: 'touch and go' },
      { chinese: '机腹着陆', english: 'belly landing' },
    ],
    transcript: "A pilot of Air China airline company told us an event with landing gear problem several days ago. After normal pushback, startup and taxi, he requested takeoff at the holding point of the active runway. However, he was instructed to hold short of the runway in order to give way to AFR123 on final. AFR123 declared emergency because of landing gear problem. AFR123 asked for a low pass to have a visual check. The controller verified the landing gear was still in up position during low pass. Then AFR123 requested a touch and go to jar the jammed gear. Unfortunately, after doing this, the landing gear still couldn't be extended. So, AFR123 had to make a belly landing on a foamed runway. AFR123 made a safe landing. There were no casualties except some minor injuries.",
  },
  12: {
    outline: 'CSN341（北京至洛杉矶）进近时被告知 RVR 500 米，因决断高度无法建立目视而复飞，雷达引导做第二次 ILS 进近。管制员在外指点标发着陆许可后，发现飞机偏离下滑道，再次发出复飞指令却未获回复，飞机撞上一栋高楼顶部坠毁。调查认为低能见度使飞行员紧张，误解复飞指令转错了弯。',
    keywords: [
      { chinese: '跑道视程', english: 'runway visual range (RVR)' },
      { chinese: '复飞', english: 'missed approach' },
      { chinese: '雷达引导', english: 'radar vectors' },
      { chinese: '偏离下滑道', english: 'leave the glide path' },
      { chinese: '误解指令', english: 'misunderstand the instructions' },
    ],
    transcript: "CSN341 was a flight from Beijing to Los Angles. When CSN341 initially contacted the tower controller, he was told the runway visual range was 500m. The pilot executed a missed approach two minutes later because of no contact at minima. Then, CSN341 was given radar vectors for a second ILS approach. In the second approach, the controller issued landing clearance to CSN341 at outer marker. One minute later, the controller observed the airplane was leaving the glide path on his radar display, so he issued missed approach instructions again. There was no further reply from the pilot. The airplane impacted the top of a tall building and crashed. According to the investigation, the poor visibility made the pilot nervous and he misunderstood the missed approach instructions and made a wrong turn.",
  },
  13: {
    outline: '纽约机场两条交叉跑道上，塔台一边指令 B767 在跑道 21 着陆，一边许可 A320 从跑道 18 起飞。B767 接地时地面雷达告警，管制员令其立即停止滑跑，但飞机只能停在交叉道口中间；A320 无法中断起飞，提前拉升避让，两机仅以 60 英尺之差错过。',
    keywords: [
      { chinese: '跑道入侵', english: 'runway incursion' },
      { chinese: '交叉跑道', english: 'intersecting runways' },
      { chinese: '接地', english: 'touch down' },
      { chinese: '停止着陆滑跑', english: 'stop landing rolling' },
      { chinese: '避让拉起', english: 'pull up to avoid collision' },
    ],
    transcript: "This story is about runway incursion. One day, A B767 nearly collided with an A320 at New York Airport, which is operating with two intersecting runways. Although there was neither casualties nor aircraft damages for both aircraft, still the incident was regarded as one of the most serious incidents of this kind. The tower controller instructed B767 to land at runway 21, meanwhile, he cleared A320 to take off at runway 18. Just as B767 touched down, the ground radar system sounded the alarm. The tower controller realized the problem and instructed B767 to stop landing rolling immediately, trying to stay out of the intersection of runway 18. In spite of the effort, B767 could only stop in the middle of the intersecting runway. However, the pilot of A320 could not abort takeoff, and pulled up the aircraft in advance to avoid collision. They missed each other by only 60 feet.",
  },
  14: {
    outline: '2010 年的一天，达美一架 767-300 从上海浦东飞往首尔，起飞滑跑时左发吸入外来物触发火警。机组升空后宣布紧急状态，因超重着陆需先放油，管制员雷达引导至放油区，在海上盘旋放油近一小时后安全返场着陆。',
    keywords: [
      { chinese: '外来物吸入发动机', english: 'foreign object sucked into engine' },
      { chinese: '发动机火警', english: 'engine fire warning' },
      { chinese: '宣布紧急情况', english: 'declare an emergency' },
      { chinese: '超重着陆', english: 'overweight to land' },
      { chinese: '放油', english: 'dump fuel' },
    ],
    transcript: "It was a sunny day in 2010, a Delta Airline's 767-300 departed from Shanghai Pudong International Airport to Seoul. It carried 256 passengers and 13 crew members on board. During takeoff rolling, an unknown foreign object was sucked into port engine and the engine fire warning light illuminated. Then the flight crew declared an emergency right after airborne and completed the emergency checklist procedure. Through good communication, the controller understood the flight crew wanted to return to land. But the pilot had to dump fuel before landing because the aircraft was overweight to land. So the controller vectored the aircraft by radar to the dumping area. After circling over the sea and dumping fuel for almost one hour, the plane returned to land at departure airport safely.",
  },
  15: {
    outline: '一架 B737 夜间进近，请求 22 号跑道 ILS 进近，管制员因前机报告强顺风建议盘旋到 04 号跑道着陆，机组坚持使用 22 号跑道并获许可。跑道上有冰雪，飞机错过正常接地点后冲出跑道撞上机场围栏，机身断成三截、右发脱离机翼，无人死亡但多名乘客重伤。',
    keywords: [
      { chinese: '强顺风', english: 'strong tailwind' },
      { chinese: '盘旋着陆', english: 'circling to land' },
      { chinese: '跑道冰雪', english: 'runway scattered with snow and ice' },
      { chinese: '冲出跑道', english: 'overrun the runway' },
      { chinese: '右发动机', english: 'starboard engine' },
    ],
    transcript: "One day, a B737 flew into the terminal control area of its destination airport. After establishing contact with Approach control, the flight crew requested clearance for ILS approach runway 22. During the approach, the controller suggested the flight crew make a circling to land on runway 04 because strong tailwind on runway 22 was just reported by previous A330. But the crew insisted on using runway 22, so the controller gave them clearance to land on runway 22. It was at night, the runway was scattered with snow and ice. Unfortunately, the plane missed the proper landing point on the runway, overran the runway and crashed into the fence of the airport. The fuselage was broken into three parts with the starboard engine separated from the wing. Fortunately, there were no killings, but many passengers were seriously injured.",
  },
  16: {
    outline: '1996 年 11 月，一名等待心脏移植的病人乘机飞往纽约，医院已备好心脏。但因克林顿总统在纽约，安保部门拒绝其落地，机长以向媒体曝光相威胁仍无效，只好备降。所幸病人及时赶到医院，手术 11 年后仍健在。',
    keywords: [
      { chinese: '心脏移植', english: 'heart transplant' },
      { chinese: '拒绝落地', english: 'not let (the flight) land' },
      { chinese: '安保部门', english: 'security service' },
      { chinese: '向媒体曝光', english: 'report to the press and TV stations' },
      { chinese: '备降', english: 'divert to the alternate airport' },
    ],
    transcript: "In November 1996 I was in a flight flying to New York. I was in the flight because I got a call from New York Hospital that a heart would be ready for me. The pilot called the tower and told them who we were. The ATC said we could not land because President Clinton was there and the security service would not let us land. The pilot told the ATC that he would report this to the press and TV stations. I think they would let us land because of the bad influence. However, it didn't work because the controllers wanted to have a look of Clinton. So we had to divert to the alternate airport instead. Fortunately, I got to the hospital on time. It was a great heart as you can see I am still alive almost 11 years after the operation.",
  },
  17: {
    outline: '2005 年 2 月 17 日，美联航一架 A320 在 19 号跑道北端试车区滑行时与国航一架 B737 相撞：B737 右副翼严重受损，A320 左机翼轻微受损，无人受伤。A320 机长称 ATC 指令其滑过停在原地的 B737，他判断有足够间距但发生了碰撞；消防到场，所幸无漏油起火。',
    keywords: [
      { chinese: '试车区', english: 'run-up area' },
      { chinese: '滑行时相撞', english: 'collide during taxi' },
      { chinese: '副翼受损', english: 'aileron damaged' },
      { chinese: '滑过（超越）', english: 'taxi past' },
      { chinese: '停留刹车', english: 'parking brake applied' },
    ],
    transcript: "On February 17th, 2005, United airline 123, an Airbus 320, collided with Air China 321, a Boeing 737, during taxi in the run-up area at the north end of runway 19. The right aileron of the Boeing 737 was severely damaged; the left wing of the Airbus 320 had minor damage. There were no injuries. The pilot of the Airbus 320 reported that he was positioned to the right of the Boeing 737. ATC cleared them for departure, which required them to taxi past the Boeing 737. The captain stated that he checked the position of the Boeing 737, and he thought he could clear it and then felt the impact. The captain notified ATC of the collision. Airport fire crews responded, but there was no fuel leak or fire. The crew of the Boeing 737 reported that they were stationary with the parking brake applied while awaiting ATC clearance.",
  },
  18: {
    outline: '523 航班在 FL290、LAMEN 附近通过 TCAS 发现 FL294 有 20 海里外的前方冲突飞机，报告上海区调后管制员称雷达上无显示。冲突飞机继续接近并触发 TCAS 告警，机组断开自动驾驶右转下降避让，冲突解除后向管制员报告了经过。',
    keywords: [
      { chinese: '空中防撞系统', english: 'TCAS' },
      { chinese: '飞行高度层', english: 'flight level (FL)' },
      { chinese: '冲突飞机', english: 'conflicting traffic' },
      { chinese: '断开自动驾驶', english: 'disengage the autopilot' },
      { chinese: '避让', english: 'avoidance' },
    ],
    transcript: "The crew of flight 523 found a traffic 20 miles at FL 294 right ahead of the airplane on TCAS at FL 290 near LAMEN. The captain reported to Shanghai Control immediately, but the controller responded that there was no indication on his radar screen and there had not been any flight advisory. The captain then instructed the crew to turn left and found the conflicting traffic closing to the flight path and a TCAS warning was initiated. The crew then immediately turns right for avoidance, disengage the autopilot and descended to a lower altitude. The crew reported to the controller about the conflict after the conflict had been cleared.",
  },
  19: {
    outline: '2003 年 9 月 28 日，美联航 552（DC-9-82）从纽约起飞爬升时左发空中起火，返场途中前起落架又无法放下，复飞期间机组用应急程序放下前起落架后紧急着陆，全部人员安全撤离。NTSB 认定事故原因是维修人员使用了不当的人工发动机启动程序。',
    keywords: [
      { chinese: '空中发动机起火', english: 'in-flight engine fire' },
      { chinese: '前起落架无法放下', english: 'nose landing gear failed to extend' },
      { chinese: '复飞', english: 'go-around' },
      { chinese: '应急程序', english: 'emergency procedure' },
      { chinese: '在跑道上撤离', english: 'deplane on the runway' },
    ],
    transcript: "On September 28, 2003, United 552, a DC-9-82, experienced an in-flight engine fire during departure climb from New York City. During the return to the departure airport, the nose landing gear failed to extend, and the flight crew was instructed by the ATC to execute a go-around, during which the crew extended the nose gear using the emergency procedure. The flight crew conducted an emergency landing, and the 2 flight crew members, 3 flight attendants, and 138 passengers deplaned on the runway. No occupant injuries were reported, but the airplane sustained substantial damage from the fire. The National Transportation Safety Board determines that the probable cause of this accident was American Airlines' maintenance personnel's use of an inappropriate manual engine-start procedure, which lead to the subsequent left engine fire.",
  },
  20: {
    outline: '2008 年 3 月 22 日，南航 303（B757-200）在 FL270 巡航时左翼上表面后缘面板脱落，砸中 19 排 ABC 舷窗，仅外层破裂、客舱未失压。机组继续飞往目的地，进近时因可能的机体损伤无法按管制员要求增速，最终安全着陆，机上 180 人无人受伤。',
    keywords: [
      { chinese: '面板脱落', english: 'lose a wing panel' },
      { chinese: '巡航飞行', english: 'cruise flight' },
      { chinese: '舷窗破裂', english: 'crack the window' },
      { chinese: '未失压', english: 'pressurization was not lost' },
      { chinese: '机体损伤', english: 'airframe damage' },
    ],
    transcript: "On March 22, 2008, China Southern 303, a Boeing 757-200, lost a left upper wing trailing edge panel during cruise flight at FL270. Initially, ATC received a pilot report that the flight crew had experienced \"light chop\" at the time. The flight was en route from Greenyard Airport to Blueyard Airport. The broken panel struck the window of passenger row 19ABC and cracked only the outer portion of the window. Pressurization was not lost. The flight crew continued on to Blueyard. Upon approach to Blueyard, ATC instructed the flight crew to expedite for separation. the flight crew informed ATC that they could not increase their airspeed due to possible airframe damage. The flight landed safely. There were 174 passengers and 6 crew members on board with no reported injuries.",
  },
  21: {
    outline: '2005 年 2 月 17 日，美联航一架 A320 在 19 号跑道北端 J 滑行道试车区滑行时与美航一架 ERJ145 相撞：ERJ145 右副翼严重受损，A320 左翼尖小翼轻微受损，无人受伤。A320 机长称 ATC 指令其滑过停着等待的 ERJ145，判断可通过但发生碰撞；消防到场，无漏油起火。',
    keywords: [
      { chinese: '试车区', english: 'runup area' },
      { chinese: '翼尖小翼', english: 'winglet' },
      { chinese: '滑行时相撞', english: 'collide during taxi' },
      { chinese: '滑过（超越）', english: 'taxi past' },
      { chinese: '等待 ATC 许可', english: 'awaiting ATC clearance' },
    ],
    transcript: "On February 17, 2005, an Airbus 320 operated by United Airline, collided with an ERJ 145, operated by US Airways during taxi in the runup area of taxiway J at the north end of runway 19. The right aileron of the ERJ 145 was substantially damaged; the left winglet of the Airbus 320 had minor damage. There were no injuries. The pilot of the Airbus 320 reported that he was positioned to the right of the ERJ 145. ATC cleared them for departure, which required them to taxi past the ERJ 145. The captain stated that he checked the proximity of the ERJ 145, and it looked like he could clear it and then felt the impact. The captain notified ATC of the collision. Airport fire crews responded, but there was no fuel leak or fire. The crew of the ERJ 145 reported that they were stationary with the parking brake applied while awaiting ATC clearance.",
  },
  22: {
    outline: '日航 223 在 10R 跑道第一次 ILS 进近前被告知 RVR 600 英尺并获着陆许可，随后复飞并被雷达引导做第二次进近。第二次进近获着陆许可后，管制员发现飞机偏向跑道南侧，发出复飞指令未获回复，飞机撞上一棵 85 英尺高的树后坠地。公布的复飞程序要求先爬升至 900 英尺再右转切入 160 度径向线，飞行员可能在爬升前就右转，导致撞树。',
    keywords: [
      { chinese: '跑道视程', english: 'runway visual range (RVR)' },
      { chinese: '复飞程序', english: 'missed approach procedure' },
      { chinese: '切入径向线', english: 'intercept the radial' },
      { chinese: '爬升后转弯', english: 'climb then turn' },
      { chinese: '误解复飞指令', english: 'misinterpret the missed approach instructions' },
    ],
    transcript: "Prior to initiating the first ILS approach to runway 10R, the pilot of Japan air 223 was advised by the tower controller that the runway visual range (RVR) was 600 feet, followed by being given a landing clearance. The pilot declared a missed approach two minutes later and was given radar vectors for a second ILS approach. After turning inbound on the localizer, the pilot was advised the runway visual range and then cleared to land. When the tower controller observed the airplane turning to the south of the runway on her radar display, she issued missed approach instructions. There was no further reply from the pilot. The airplane impacted the top of an 85-foot tall tree, and then continued to collide on the ground. The published missed approach procedure instructed the pilot to climb to 900 feet, then right turn to intercept the 160 degree radial of the VORTAC. It appears the pilot likely misinterpreted the missed approach instructions by making the right hand turn prior to initiating a climb to 900 feet, which resulted in the subsequent impact with the tree.",
  },
  23: {
    outline: '2001 年 2 月 28 日，一架 B757 和一架庞巴迪在相邻登机口同时推出时尾翼相撞，双双严重受损。当时 B757 从 80 号登机口、庞巴迪从 79 号登机口先后仅隔 41 秒被许可推上同一滑行道 alpha，地面管制员未向任何一方通报相邻同时推出的情况，他原以为两机有足够空间。',
    keywords: [
      { chinese: '推出', english: 'pushback' },
      { chinese: '相邻登机口', english: 'adjacent terminal gates' },
      { chinese: '尾翼相撞', english: 'tails collided' },
      { chinese: '脱开拖车', english: 'disconnect the tug' },
      { chinese: '交通冲突', english: 'traffic conflict' },
    ],
    transcript: "On February 28, 2001, A Boeing 757 and a Bombardier were substantially damaged when the tails of both airplanes collided during the pushback process from two adjacent terminal gates in Greenyard airport. The flight crew of the Bombardier reported that during the final stages of pushback from gate 79, they were in a stopped position while their ground crew was in the process of disconnecting the tug when the collision occurred. Company maintenance personnel stated they were pushing the 757 back from gate 80 and did not see the Bombardier. Review of ATC communication recordings between ground control and both airplanes revealed that the 757 was initially cleared for pushback onto taxiway alpha from gate 80. About 41 seconds later, the ground controller cleared the Bombardier to push back onto taxiway alpha from gate 79. The recordings revealed that the ground controller did not advise either aircraft of simultaneous adjacent pushback operations. The controller stated that he believed there was room for both aircraft to push back and did not forecast a traffic conflict.",
  },
  24: {
    outline: '2002 年 12 月 11 日，美联航 83 在 6 海里五边时获许在 10 号跑道着陆，同时本地管制员许可法航 551 从交叉的 15R 跑道起飞。法航 551 在 F 滑行道附近抬前轮，在两条跑道交叉点上方以仅 300 英尺间隔飞越美联航 83。事故主因是本地管制员情景意识缺失、未在交叉跑道运行的两机之间提供适当间隔。',
    keywords: [
      { chinese: '五边进近', english: 'final approach' },
      { chinese: '起飞许可', english: 'takeoff clearance' },
      { chinese: '抬前轮', english: 'rotate' },
      { chinese: '飞越', english: 'overfly' },
      { chinese: '交叉跑道运行', english: 'operating on intersecting runways' },
    ],
    transcript: "On December 11, 2002, Air France 551 departed runway 15R and over flew United83, which had landed on runway 10 at Atlantic international Airport. The tower controller had cleared United83 to land on runway 10 when United83 was approximately 6 mile on final approach. Simultaneously, the ATC local controller cleared Air France 551 for takeoff on runway 15R. Air France 551 was on taxiway A about 500 feet short of runway 15R when the takeoff clearance was issued. Air France 551 rotated at taxiway F and over flew United83 by 300 feet at the intersection of runways 10 and 15R. United83 exited runway 10 afterwards. The main cause of this incident is local controller's failure of maintaining awareness of the situation and failing to provide the appropriate separation between the two aircraft operating on intersecting runways.",
  },
  25: {
    outline: '2010 年 10 月 2 日，CCA102 与 CCA101 两架航班号相近的飞机同时进近，CCA101 误执行了发给 CCA102 的下降指令，管制员又未能听出复诵中的噪音差异，直到 CCA101 穿越 2700 米继续下降、与反向 2400 米飞机冲突时才制止，TCAS 告警仍然响起。',
    keywords: [
      { chinese: '相似航班号', english: 'similar callsign' },
      { chinese: '下降指令', english: 'descent instruction' },
      { chinese: '复诵噪音', english: 'frequency noise in readback' },
      { chinese: '反向飞行', english: 'opposite direction' },
      { chinese: 'TCAS 告警', english: 'TCAS alarm' },
    ],
    transcript: "On Oct 2nd 2010, two aircraft with similar callsign caused an unsafe situation. CCA102 was instructed to dove to 2700 meters by controller when approaching destination airport. Meanwhile, CCA101 was descending to 3000 meters when he first had radio contact with controller. Later on, the controller asked CCA102 to continue descent to 1800 meters, but got readback with loud noise. A few minutes later, he noticed that CCA101 was passing 2700 meters and seemed to continue. Simultaneously, there was an aircraft levelling at 2400 meters in opposite direction. The controller stopped CCA101 descending, but the TCAS still sounded alarm. Investigator found it was because CCA101 mistakenly executed descent instruction and controller didn't find the differential in frequency noise.",
  },
  26: {
    outline: '悉尼机场一次跑道入侵：CSN321 在跑道外等待，JAL578 长五边进近。塔台指令 CSN321 在 JAL578 落地后再上跑道等待，但指令后半段被静电干扰中断，飞行员误以为获准起飞而上了跑道。管制员果断指令 JAL578 立即复飞，两机仅以 100 英尺之差避免相撞。',
    keywords: [
      { chinese: '跑道入侵', english: 'runway incursion' },
      { chinese: '跑道外等待', english: 'holding short of runway' },
      { chinese: '静电干扰', english: 'static noise' },
      { chinese: '复飞', english: 'go-around (pull up)' },
      { chinese: '不规范用语', english: 'improper syntax' },
    ],
    transcript: "A runway incursion occurred at Sydney airport on Tuesday. CSN321, bound for London, was holding short of runway. Meanwhile, JAL578 was on long final for landing. After receiving reports from both flights, the tower controller asked CSN321 to line up and wait after the JAL578 landing. At that time, the radio communication broke down. The rear part of instruction was interrupted by static noise. The pilot of CSN321 misunderstood that he was cleared for departure, and then lined up. The tower controller identified the potential danger. Without hesitation, he instructed JAL578 to pull up immediately and initiate go-around in an attempt to avoid collision. The two aircraft missed colliding by only 100 feet. The subsequent investigation revealed the improper syntax of the controller's instruction was one of contributors to such incident.",
  },
  27: {
    outline: '1995 年 9 月 15 日，DAL716 载 105 吨燃油执行航班，进近时因交通拥挤被指令等待，三次等待后仍须再等 20 分钟，飞行员报告燃油不足只能再坚持 5 分钟并请求尽快落地。五边进近时因强阵雨能见度恶化而复飞，最终因燃油耗尽撞山，无人生还。',
    keywords: [
      { chinese: '等待程序', english: 'holding procedure' },
      { chinese: '交通拥挤', english: 'traffic congestion' },
      { chinese: '燃油不足', english: 'fuel shortage' },
      { chinese: '强阵雨', english: 'heavy shower' },
      { chinese: '燃油耗尽', english: 'fuel starvation' },
    ],
    transcript: "On Sep 15th 1995, DAL716 performed a scheduled flight with 105 tons of fuel. When he approached the destination airport, the controller instructed DAL716 to enter holding procedure due to traffic congestion. After three times of holding procedure, the controller told DAL716 that he was expected to continue holding for another 20 minutes. The pilot informed he could only hold for another 5 minutes because of fuel shortage, and intended to land as soon as possible. Upon receiving the request, the controller delivered landing clearance immediately. During the final approach, visibility got worse as a result of heavy shower. DAL716 had to execute missed approach. At last, this aircraft impacted hillside following fuel starvation. There were no survivors.",
  },
  28: {
    outline: '七月一个晴天，CCA101 从南京飞往洛杉矶，起飞后报告一名乘客心脏区剧痛请求返场，因超重需先放油。放油完成后乘客病情加重晕倒，签派建议备降上海浦东以获得急救。管制员协调相关单位后，CCA101 安全落地 35L 跑道，患病乘客被担架抬下。',
    keywords: [
      { chinese: '返场着陆', english: 'return to land' },
      { chinese: '超重', english: 'overweight' },
      { chinese: '空中放油', english: 'fuel jettison (fuel dumping)' },
      { chinese: '备降', english: 'divert' },
      { chinese: '急救服务', english: 'first-aid service' },
    ],
    transcript: "On a sunny day in July, CCA101 departed from Nanjing bound for Los Angles. After takeoff, the pilot reported a passenger suffered acute pain in the heart area and requested return to land. However, they had to dump fuel before landing because of overweight. Upon receiving the request for fuel jettison, the controller instructed CCA101 to proceed to fuel dumping area with heading 060. After fuel dumping was completed, the pilot reported the sick passenger's situation got worse and had fainted. The crew informed their company of details. The dispatcher contacted pertinent airport authorities, and then advised flight crew to divert to Shanghai Pudong airport due to first-aid service supply. Afterwards, the pilot told ATC they intended to proceed to Shanghai Pudong airport. The controller coordinated with relevant units, and got landing permission to the flight. Finally, CCA101 landed safely on runway 35L, and the sick passenger was carried off on a stretcher.",
  },
  29: {
    outline: '218 航班载 108 名乘客和 8 名机组，移交进近后两台发动机因台风造成的破坏性天气熄火，机组执行应急检查单并决定返场，但重启尝试均告失败，最终在到达跑道前坠地，98 人遇难、10 人重伤。调查显示该航班起飞前因坏天气延误约两小时，天气好转时机组不顾 ATC 建议坚持起飞。',
    keywords: [
      { chinese: '发动机熄火', english: 'engines flamed out' },
      { chinese: '台风', english: 'typhoon' },
      { chinese: '应急检查单', english: 'contingency checklist' },
      { chinese: '坠毁', english: 'plunged into ground' },
      { chinese: '坚持起飞', english: 'insisted on departure' },
    ],
    transcript: "One day, Flight 218 performed schedule flight carrying 108 passengers and 8 crew. When he was transferred to the Approach Control, two engines flamed out due to unexpected destructive weather caused by typhoon. The flight crew worked the contingency checklist immediately and decided to return to land. Unfortunately, most of their attempts were unsuccessful. The engines sustained severe damage beyond repair after all. Finally, Flight 218 plunged into ground before reaching the runway. 98 passengers including 2 Frenchmen were killed, and 10 passengers were badly injured. The airline set up an emergency center following this miserable tragedy. The subsequent investigation revealed that this aircraft had experienced around two hours delay due to bad weather before takeoff. When the weather trend looked promising, the flight crew insisted on departure in spite of ATC's suggestion. The airline exhausted all means to help the families of the victims. They also dispatched the expert squad for further investigation.",
  },
  30: {
    outline: '5 月 24 日，美联航 126 从纽约飞往洛杉矶，爬升中机长发现左发推力丧失，7000 英尺时左发喘振告警。机组请求返场并先放油，放油过程中情况恶化，发动机前后喷出火焰，机组发出遇险呼叫获准迫降。约两分钟后雷达目标消失，飞机坠入人口稠密的居民区，仅一名婴儿生还。',
    keywords: [
      { chinese: '推力丧失', english: 'thrust loss' },
      { chinese: '发动机喘振', english: 'engine surge' },
      { chinese: '遇险呼叫', english: 'distress call' },
      { chinese: '迫降', english: 'forced landing' },
      { chinese: '居民区', english: 'residential area' },
    ],
    transcript: "On May 24th, United Airlines 126 departed from New York to Los Angeles with 85 souls on board. In the process of its climb out, the captain found the left engine thrust loss. Upon reaching 7000 feet, the port engine surge warning sounded. In the meantime, the crew requested to return. But they needed fuel dumping prior to land. During the fuel dumping process, the situation deteriorated. The captain heard a loud bang and the flight attendants saw flames coming out the front and the rear of the engine. Without any hesitation, the crew sent out a distress call and received clearance to make a forced landing. About two minutes later, the radar target of United Airlines 126 disappeared from the radar screen. The controllers tried their best to contact the crew. However, there was no response. Finally, the aircraft crashed into a densely populated residential area, killing all occupants except an infant. The contributor to the engine issue is still unveiled.",
  },
  31: {
    outline: '1986 年 5 月 17 日（史实 1977 年），两架 B747 在特内里费机场跑道上相撞，461 人遇难，为航空史上最严重空难。另一机场的恐怖事件致大量航班备降特内里费，机场拥挤迫使离场航空器在跑道上滑行，浓雾又使塔台与飞机互不可见。调查原因：1205 航班未获许可即起飞、1627 错过第三个出口、两条关键无线电信息同频互扰、使用非标准用语。',
    keywords: [
      { chinese: '跑道相撞', english: 'collided on the runway' },
      { chinese: '备降', english: 'diverted' },
      { chinese: '浓雾', english: 'thick fog' },
      { chinese: '未经许可起飞', english: 'takeoff without proper clearance' },
      { chinese: '非标准用语', english: 'non-standard responses' },
    ],
    transcript: "On May 17, 1986, two B747, Flight 1205 and Flight 1627 collided on the runway at Tenerife Airport killing 461 people, which is considered as the worst disaster in aviation history. A terrorist incident at another airport had caused many flights to be diverted to Tenerife Airport, including the two accident aircraft. The airport quickly became congested and forced departing aircraft to taxi on the runway instead. And the thick patches of fog also prevented aircraft and control tower from seeing each other. The collision occurred when Flight 1205 initiated its takeoff run while Flight 1627 was still on the runway. Main reasons were figured out as following after the investigation: Flight 1205 started its takeoff without proper clearance; Flight 1627 missed the third exit it was told to use, instead carrying on towards exit four; the loss of two crucial radio messages due to their being broadcast as exactly the same time and cause cross-interference; use of non-standard responses, such as \"OK\".",
  },
  32: {
    outline: '1998 年的一天，一架 B747 在距跑道 6 英里处撞山坠毁。调查查明主因是管制员与飞行员之间对 TWO 和 TO 两词的误解：先是指令 “descend to two seven zero zero” 被复诵为 2700 英尺，后 “descend two four zero zero” 被飞行员误解为 “descend to four zero zero”，最终在下降到 400 英尺时撞山。',
    keywords: [
      { chinese: '撞山', english: 'collided with mountains' },
      { chinese: '误解高度指令', english: 'misunderstanding of altitude instruction' },
      { chinese: '复诵', english: 'readback' },
      { chinese: '监听复诵', english: 'hearback' },
      { chinese: '标准通话用语', english: 'standard phraseologies' },
    ],
    transcript: "One day in 1998, a B747 collided with mountains and crashed 6 miles from the runway. After the accident, some authorities and organizations carried out investigations and managed to figure out the fatal reasons causing this disaster. One of the main reasons was the misunderstanding of the two words TWO and TO in communication between controller and the pilot. In the beginning, the controller instructed the pilot to \"descend to two seven zero zero\", and the pilot readback as \"cleared to two thousand seven hundred\". But later on, the controller gave the instruction as \"Descend two four zero zero\", and the pilot readback as \"OK, four zero zero\". That means, unfortunately, the pilot misunderstood \"descend two four zero zero\" as \"descend to four zero zero\". Finally, the aircraft crashed on the mountain during descending to 400 feet. According to this accident, standard phraseologies, readback and hearback play the key roles in communication between controller and pilot.",
  },
  33: {
    outline: '2010 年 10 月 4 日，国际 142 航班获许执行 36L 跑道 VOR/DME 进近，但机长不顾飞机未配备 RNAV 必需的 GNSS 设备，擅自决定按 RNAV 进近，还隐瞒管制员。能见度差、无目视参考，压力增大与情景意识丧失导致进近中飞得又低又快，接地后弹跳并冲出跑道，起落架折断、机翼与双发严重受损，所幸乘客全部安全撤离。',
    keywords: [
      { chinese: 'VOR/DME 进近', english: 'VOR/DME approach' },
      { chinese: 'RNAV 进近', english: 'RNAV approach' },
      { chinese: '导航设备', english: 'navigation equipment (GNSS)' },
      { chinese: '情景意识丧失', english: 'loss of situational awareness' },
      { chinese: '起落架折断', english: 'landing gears collapsed' },
    ],
    transcript: "On October 4th, 2010, International Flight 142 was cleared by ATC to follow the VOR/DME approach to runway 36L. But the captain decided to request for RNAV approach regardless of the fact that his aircraft was not equipped with mandatory navigation equipment (GNSS) required for RNAV approach. The Approach controller found the flight being right of track and asked cockpit crew to verify it. The Captain quickly asked first officer to tell the Approach that they were following RNAV procedure. Actually, the cockpit crew was carrying out VOR/DME approach. The captain kept flying the aircraft with no visual cues due to poor visibility. Increased stress level, loss of situational awareness and reduced mental ability caused the pilots flying low on approach with high speed. The aircraft bounced on the runway after touchdown and skidded off. All passengers were safely evacuated, but the aircraft wings and two engines sustained extensive damage after landing gears collapsed.",
  },
  34: {
    outline: '七月一个多云天，一架 B737 从广州经济南飞济南，在合肥管制区 7500 米巡航时遭遇缓慢释压，座舱高度警告喇叭响、座舱压力渐降。机组请求立即下降并落地，但下方航班多，管制员难以立即发指令。合肥管制中心与相关单位高效协作、向军方申请机动空域，指挥飞机向西偏航下降直飞合肥，25 分钟内安全落地，无人受伤。',
    keywords: [
      { chinese: '缓慢释压', english: 'chronic decompression' },
      { chinese: '座舱高度警告', english: 'cabin altitude warning horn' },
      { chinese: '机动空域', english: 'maneuvering airspace' },
      { chinese: '军方', english: 'military' },
      { chinese: '偏航下降', english: 'deviate and descend' },
    ],
    transcript: "On a cloudy day in July, a B737 departed from Guangzhou to Jinan via Hefei. When it was cruising at 7500 meters in Hefei controlled area, it encountered chronic decompression. The crew reported that there was a cabin altitude warning horn sound and the cabin pressure was dropping gradually. Considering the safety of passengers, the crew requested to descend immediately and land at local airport. However, there were a lot of flights below the Boeing 737 so that it was difficult for controller to give the descent instructions initially. Then Hefei Air Traffic Control Center cooperated with other relative units efficiently and requested maneuvering airspace from military. A few minutes later, controllers instructed the pilot to deviate to the west and descend, and then direct to Hefei airport. Finally, as the crew required, the Boeing 737 landed at Hefei Airport in 25 minutes without any injuries.",
  },
  35: {
    outline: '1956 年 6 月 14 日，TWA 201（洛杉矶—华盛顿）与美联航 718（洛杉矶—芝加哥）起初被分配同一航路、不同高度。约一小时后两机飞行员请求抄近路获准，进入非管制空域按目视飞行规则飞行，随后双双失联，残骸在一个偏远峡谷中被发现，无人生还。调查认为根本原因是此前十年经费不足未能增设航路，此次空中相撞最终推动政府大规模改造 ATC 系统。',
    keywords: [
      { chinese: '抄近路', english: 'take short-cuts' },
      { chinese: '非管制空域', english: 'uncontrolled airspace' },
      { chinese: '目视飞行规则', english: 'VFR flight rules' },
      { chinese: '空中相撞', english: 'midair collision' },
      { chinese: 'ATC 现代化', english: 'ATC modernization' },
    ],
    transcript: "On Saturday, June 14th, 1956, TWA Flight 201 departed from Los Angeles to Washington D.C. United Airlines Flight 718 left Los Angeles for Chicago. Both aircraft were initially assigned the same route, with the TWA aircraft climbing to 17000 feet and the United aircraft climbing to 21000 feet. About one hour later, the pilots of both aircraft requested that they intended to take short-cuts to their destination. Air traffic controllers routinely approved this route deviation. Then the two flights entered uncontrolled airspace and operated under VFR flight rules. When the pilots of both aircraft failed to make any additional position reports, an intensive ground and air search was begun. The wreckage of the two aircraft was eventually found scattered in a remote gorge. There were no survivors. According to the ensuing investigation, the underlying reason was that additional airways had not been developed due to insufficient funding during the previous decade. This midair collision finally persuaded the government to embark on massive ATC modernization plans.",
  },
  36: {
    outline: '一架 B747 飞越东南亚时，数千公里外印尼一座火山正在喷发，气象雷达毫无异常显示，四台发动机先后无征兆熄火。机组按检查单处置无果，立即决定备降印尼，最终在低能见度下无动力成功着陆。调查确认飞机误入火山灰云，大量火山灰吸入发动机造成叶片变形、发动机过热。',
    keywords: [
      { chinese: '火山喷发', english: 'volcano erupting' },
      { chinese: '气象雷达', english: 'weather radar' },
      { chinese: '发动机失效', english: 'engine failed' },
      { chinese: '火山灰云', english: 'volcanic ash cloud' },
      { chinese: '叶片变形', english: 'deformed blades' },
    ],
    transcript: "One day, a B747 was flying over the Southeast of Asia, but there was a volcano located in Indonesia erupting thousands of kilometers away. The flight crew did not realize what would happen to them because there was no any abnormal indication on the weather radar screen. Suddenly, one of the four engines failed without any previous warning. The crew followed the checklist and tried to deal with it. However, the other three engines failed subsequently. So the flight crew decided immediately to divert to Indonesia. Fortunately, this B747 landed successfully in the poor visibility even without power. The investigation reported that this aircraft happened to run into the volcanic ash cloud and a large amount of volcanic ash had been ingested into power plant, which caused deformed blades and overheated engines.",
  },
  37: {
    outline: '2016 年 5 月 19 日，一架埃及航空巴黎—开罗航班（A320，载 66 人）进入埃及空域后不久从雷达上消失，坠入地中海。希腊国防部长称飞机曾急转弯并掉高度，克里特岛东南发现塑料碎片，救援人员搜寻残骸，恐怖袭击的怀疑不断上升。',
    keywords: [
      { chinese: '残骸', english: 'wreckage' },
      { chinese: '坠入地中海', english: 'crashed into the Mediterranean Sea' },
      { chinese: '从雷达上消失', english: 'disappeared from the radar' },
      { chinese: '急转弯', english: 'abrupt turns' },
      { chinese: '恐怖袭击', english: 'terrorist attack' },
    ],
    transcript: "On the 19th May 2016, rescuers searched for wreckage from an EgyptAir Paris-Cairo flight which crashed into the Mediterranean Sea. The Airbus A320, carrying 66 passengers and crew, disappeared from the radar shortly after entering Egyptian airspace. Greece's defense minister said the plane made abrupt turns and lost altitude. Plastic debris was seen south-east of Crete. Suspicions are mounting of a terrorist attack.",
  },
  38: {
    outline: '9 月 17 日，一架执行定期航班飞往纽约的飞机在 1130 UTC 报告一名乘客心脏病发作需尽快手术。机长向管制单位通报详情，管制员指挥其飞往纽约机场。1145 UTC 进近目的地时天气恶化、能见度不满足着陆标准，管制员建议备降邻近的纽瓦克机场，飞机安全落地，病人被及时送医。',
    keywords: [
      { chinese: '心脏病发作', english: 'heart attack' },
      { chinese: '能见度差', english: 'poor visibility' },
      { chinese: '着陆标准', english: 'landing criteria' },
      { chinese: '备降', english: 'divert' },
      { chinese: '备降机场', english: 'alternate airport' },
    ],
    transcript: "On the 17th September, an aircraft executed a scheduled regular transport flight to New York. At 1130 UTC time, the stewardess found a passenger suffered heart attack and needed a surgery as soon as possible. The captain informed control unit of detailed information. The controller instructed the flight to proceed to New York airport. When the aircraft approached the destination airport at 1145 UTC time, the weather became bad and visibility was so poor that it could not meet the landing criteria. The controller advised the crew to divert to Newark airport which is adjacent to New York. Fortunately the aircraft landed at alternate airport and the patient was transferred to hospital in time.",
  },
  39: {
    outline: '2002 年 6 月 20 日，FAA 提醒所有飞行员格外重视飞行准备及当地机场活动。当周末一架塞斯纳 182 为避让坏天气误入华盛顿特区限制空域，被军用飞机拦截。FAA 强调飞行员应联系飞行情报服务获取最新信息、向当地机场通报详情，并始终保持最高水平的准备、责任心与判断力。',
    keywords: [
      { chinese: '飞行准备', english: 'flight preparation' },
      { chinese: '限制空域', english: 'restricted airspace' },
      { chinese: '拦截', english: 'intercepted' },
      { chinese: '误入', english: 'inadvertently strayed into' },
      { chinese: '避让坏天气', english: 'avoid the bad weather' },
    ],
    transcript: "On the 20th, June, 2002, FAA reminds all pilots to particularly alert their own flight preparations, as well as activities of their local airports. The incident on this weekend with a Cessna182 which was flying into the restricted airspace of Washington DC clearly indicates that flight preparation is more important than ever. The Cessna was intercepted by a military aircraft. After inadvertently strayed into the restricted airspace while it was attempting to avoid the bad weather, the pilot should contact FAA flight services to receive the latest information, and tell the local airport about details. It is credible for pilots to continuously use the highest levels of preparation, responsibility and judgement. They should also encourage others to do so as well.",
  },
  40: {
    outline: '2006 年 8 月 18 日，一架载 243 名乘客的 B747 从香港飞往墨尔本，巡航中乘务报告头等舱有燃油味，飞行员从舷窗检查发现 3 号发动机后部有明显油迹，机长关闭了 3 号发动机。后续检查发现燃油歧管回油管断裂导致漏油，NTSB 还对同型发动机在类似情况下的歧管回油管断裂问题展开了调查。',
    keywords: [
      { chinese: '燃油味', english: 'smell of fuel' },
      { chinese: '油迹', english: 'fluid trail' },
      { chinese: '关闭发动机', english: 'shut down the engine' },
      { chinese: '燃油歧管回油管', english: 'fuel manifolds return lines' },
      { chinese: '燃油泄漏', english: 'fuel leak' },
    ],
    transcript: "On the 18th August 2006, a B747 aircraft with 243 passengers departed from Hongkong China, on a scheduled passenger flight to Melbourne Australia. While on cruise, one of the cabin crew notified flight crew there was a smell of fuel in the first class cabin. One of the pilots verified the fuel smell and then proceeded to inspect the engine from the cabin windows. The fluid trail was evident from the rear of NO3. engine. The captain shut down the NO3. engine. The subsequent inspection revealed that the fuel manifolds return lines had fractured causing a fuel leak. The NTSB investigated the other fuel manifolds return lines fractured from the same engine type under the similar circumstance.",
  },
  41: {
    outline: '西南航空 3472 航班（新奥尔良—奥兰多）起飞 25 分钟后左发爆炸，发动机冒烟、残骸碎片翻飞，飞机剧烈抖动下坠，氧气面罩脱落，10 分钟内掉了 20000 英尺。机组保持冷静稳住飞机，数分钟后在彭萨科拉紧急着陆，99 名乘客和 5 名机组安全下机，事故原因仍在由 FAA 和 NTSB 调查。',
    keywords: [
      { chinese: '发动机爆炸', english: 'engine explodes (mid air blast)' },
      { chinese: '氧气面罩脱落', english: 'oxygen masks deployed' },
      { chinese: '急速下降', english: 'descending rapidly' },
      { chinese: '稳住飞机', english: 'stabilized the plane' },
      { chinese: '紧急着陆', english: 'emergency landing' },
    ],
    transcript: "Southwest flight makes an emergency landing after engine explodes. Southwest flight 3472 narrowly avoided tragedy. Thanks to pilot's quickly response to a mid air blast. The plane was 25 minutes into a flight from New Orleans to Orlando on Saturday when a loud explosion erupted from the left engine. Smoke was coming from the ruined engine, the dismantled part flap in the wind while the plane shook violently. The plane began falling, and panic set in as oxygen masks deployed inside the cabin. The aircraft was tilting dangerously to one side and descending rapidly dropping 20000 feet in less than 10 minutes. Startled passengers was crying and screaming and feared it was the end. But the crew remained calm. And the pilot soon managed to stabilized the plane. The B737 made an emergency landing in Pensacola minutes later where the 99 passengers and 5 crew members disembarked safely. Southwest airlines has not yet to specify what caused the engine failure. But it is working with the FAA and NTSB to investigate.",
  },
  42: {
    outline: '2014 年 3 月 8 日，MH370（吉隆坡—北京）在巡航高度 01:20 UTC 失去雷达联系。越南 ATC 用备用和应急频率 121.5 反复呼叫无果，又请中国 ATC 协助联络亦失败。救援单位赴南海搜寻 30 小时、一周后仍未发现任何残骸，后续搜索转至西澳外的印度洋仍一无所获，最终宣布 MH370 完全失联，227 名乘客和 12 名机组遇难。',
    keywords: [
      { chinese: '失去雷达联系', english: 'lost radar contact' },
      { chinese: '应急频率 121.5', english: 'emergency frequency 121.5' },
      { chinese: '搜寻', english: 'search' },
      { chinese: '残骸', english: 'debris' },
      { chinese: '宣布失联', english: 'declared totally lost' },
    ],
    transcript: "On the 8th March 2014, MH370, a scheduled passenger flight from Kuala Lumpur, Malaysia to Beijing China, lost radar contact at 01:20 UTC time when it was on cruising level. Vietnam ATC tried their best to establish radio contact with flight crew of MH370, such as using back-up and emergency frequency 121.5. However, there was no reply. Then, they contact China ATC, and required them to try to establish contact with MH370. But it also didn't work. Subsequently, rescue units were informed and they went to South China Sea to search this aircraft. After 30 hours, the airplane was not found and the survival chance became little and little. Unfortunately, after a week, they could not find any debris. Further search was conducted in the Indian Ocean, west of Australia. But the government and rescue units were also sorrowful. Because they found nothing. Finally, they declared the MH370 was totally lost. 227 passengers and 12 flight crew reportedly died. This accident caught the world's eyes. Many people suspected the accident resulted from the pilot's suicide.",
  },
};
