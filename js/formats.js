/* Format-specific ratings. Base ratings in players.js are "all-format". Here each player gets
   Test / ODI / T20 variants via per-player deltas (batting,bowling). Unlisted players use sensible defaults:
   retired legends lose 4 in T20 (era mismatch), everyone else keeps their all-format rating.
   Deltas are subjective approximations — tune freely. Format: "Name|test b,w|odi b,w|t20 b,w" */
const FORMATS = {
  all:  { label: 'All-format', short: 'ALL', desc: 'Balanced across formats' },
  test: { label: 'Test', short: 'TEST', desc: 'Long-form: bowlers win matches, patience counts' },
  odi:  { label: 'ODI', short: 'ODI', desc: '50 overs: balance and finishers' },
  t20:  { label: 'T20', short: 'T20', desc: 'Power hitting and death bowling' }
};
// weights used by the team-rating algorithm per format
const FORMAT_CFG = {
  all:  { bw: .5,  BAT_W: [1, 1, 1, .95, .9, .8, .65, .4, .25],    BOWL_W: [1, 1, 1, .9, .8, .35] },
  test: { bw: .45, BAT_W: [1, 1, 1, 1, .9, .7, .5, .25, .1],       BOWL_W: [1, 1, 1, .95, .7, .2] },
  odi:  { bw: .5,  BAT_W: [1, 1, 1, .95, .9, .8, .65, .4, .25],    BOWL_W: [1, 1, 1, .9, .8, .35] },
  t20:  { bw: .5,  BAT_W: [1, 1, 1, 1, .95, .85, .7, .5, .3],      BOWL_W: [1, 1, 1, .95, .85, .3] }
};

const FMT_RAW = `
Suryakumar Yadav|-18,0|-2,0|6,0
Virat Kohli|-1,0|2,0|0,0
Rohit Sharma|-6,0|3,0|2,0
Jasprit Bumrah|0,0|0,0|2,2
Shubman Gill|0,0|2,0|-4,0
Rishabh Pant|1,0|-4,0|-4,0
KL Rahul|-2,0|0,0|-3,0
Hardik Pandya|-14,-14|0,0|4,3
Ravindra Jadeja|2,2|0,0|-2,-2
Yashasvi Jaiswal|0,0|-8,0|3,0
Varun Chakravarthy|-35,-42|-10,-8|0,2
Arshdeep Singh|-20,-20|-4,-3|4,4
Kuldeep Yadav|-2,-2|2,2|2,2
Mohammed Shami|2,2|3,3|-4,-4
Mohammed Siraj|2,2|0,0|-3,-3
Sanju Samson|-22,0|-6,0|4,0
Shreyas Iyer|-4,0|3,0|0,0
MS Dhoni|-12,0|3,0|-2,0
Yuvraj Singh|-24,-10|5,2|4,4
Suresh Raina|-30,-25|4,0|6,0
Mohammad Kaif|-18,0|4,0|-12,0
Virender Sehwag|0,0|0,0|3,0
Sachin Tendulkar|1,0|2,0|-4,0
Rahul Dravid|3,0|-6,0|-14,0
Sunil Gavaskar|3,0|-18,0|-26,0
Cheteshwar Pujara|5,0|-28,0|-45,0
VVS Laxman|3,0|-10,0|-22,0
Gautam Gambhir|0,0|0,0|2,0
Sourav Ganguly|0,0|2,0|-8,0
Anil Kumble|2,2|-4,-4|-14,-14
R Ashwin|3,3|-4,-4|-6,-6
Kapil Dev|2,2|0,0|-10,-10
Harbhajan Singh|0,0|-2,-2|2,2
Zaheer Khan|2,2|0,0|-4,-4
Irfan Pathan|-4,-4|2,2|3,3
Dinesh Karthik|-8,0|-4,0|2,0
Ajinkya Rahane|3,0|-10,0|-18,0
Don Bradman|0,0|-12,0|-30,0
Ricky Ponting|1,0|2,0|-4,0
Adam Gilchrist|0,0|2,0|2,0
Matthew Hayden|1,0|0,0|-3,0
Michael Bevan|-20,0|8,0|-4,0
Michael Hussey|0,0|0,0|4,0
Shane Watson|-10,-8|4,3|5,3
Andrew Symonds|-6,-6|4,2|3,0
Shane Warne|3,3|-4,-4|-2,-2
Glenn McGrath|3,3|1,1|-8,-8
Brett Lee|-2,-2|3,3|0,0
Dennis Lillee|2,2|-8,-8|-14,-14
Keith Miller|1,1|-14,-14|-20,-20
Richie Benaud|0,0|-14,-14|-18,-18
Greg Chappell|2,0|-4,0|-14,0
Steve Smith|4,0|-3,0|-12,0
David Warner|-3,0|2,0|5,0
Pat Cummins|3,3|0,0|-3,-3
Mitchell Starc|2,2|3,3|-2,-2
Josh Hazlewood|3,3|0,0|-1,-1
Travis Head|0,0|4,0|3,0
Marnus Labuschagne|1,0|-6,0|-26,0
Glenn Maxwell|-14,-10|3,2|8,3
Mitchell Marsh|-4,-4|0,0|2,0
Nathan Lyon|3,3|-14,-14|-22,-22
Usman Khawaja|3,0|-18,0|-28,0
Adam Zampa|-16,-18|2,2|5,5
Marcus Stoinis|-30,-30|0,0|4,2
Cameron Green|0,0|-4,-4|-6,-6
Mitchell Johnson|0,0|1,1|-4,-4
Ian Botham|1,1|0,0|-6,-6
Geoffrey Boycott|3,0|-22,0|-35,0
Alastair Cook|3,0|-8,0|-26,0
Kevin Pietersen|0,0|0,0|3,0
James Anderson|3,3|-6,-6|-14,-14
Stuart Broad|2,2|-4,-4|-3,-3
Joe Root|3,0|-2,0|-14,0
Ben Stokes|2,2|0,0|-6,-6
Jos Buttler|-6,0|2,0|6,0
Jonny Bairstow|1,0|0,0|-2,0
Eoin Morgan|-14,0|5,0|4,0
Jofra Archer|-2,-2|0,0|3,3
Moeen Ali|-4,-4|0,0|3,0
Liam Livingstone|-30,-30|0,0|6,3
Phil Salt|-15,0|-2,0|6,0
Adil Rashid|-8,-8|2,2|1,1
Sam Curran|-3,-3|-2,-2|3,3
Jason Roy|-14,0|2,0|4,0
Jack Hobbs|0,0|-10,0|-18,0
Wally Hammond|0,0|-10,0|-18,0
Fred Trueman|0,0|-10,-10|-18,-18
Shahid Afridi|-12,-12|3,3|8,8
Shoaib Malik|-14,-12|2,2|3,3
Imran Khan|2,2|0,0|-8,-8
Wasim Akram|1,1|2,2|-2,-2
Waqar Younis|2,2|0,0|-4,-4
Younis Khan|3,0|-6,0|-8,0
Misbah-ul-Haq|3,0|-4,0|-4,0
Inzamam-ul-Haq|1,0|2,0|-12,0
Babar Azam|-2,0|3,0|3,0
Shaheen Afridi|3,3|0,0|-2,-2
Mohammad Rizwan|-2,0|0,0|4,0
Haris Rauf|-15,-15|0,0|4,4
Fakhar Zaman|-8,0|2,0|3,0
Shadab Khan|-14,-14|0,0|3,3
Mohammad Amir|1,1|-2,-2|2,2
Hanif Mohammad|2,0|-12,0|-20,0
Zaheer Abbas|1,0|-4,0|-14,0
Chris Gayle|-3,0|0,0|8,0
Andre Russell|-26,-26|0,0|9,5
Sunil Narine|-24,-28|0,0|10,6
Nicholas Pooran|-24,0|0,0|6,0
Kieron Pollard|-30,-30|2,2|10,6
Dwayne Bravo|-16,-12|0,0|4,10
Shimron Hetmyer|-26,0|0,0|6,0
Rovman Powell|-30,0|-2,0|8,0
Jason Holder|3,3|0,0|-3,-3
Viv Richards|0,0|3,0|-2,0
Brian Lara|1,0|-2,0|-8,0
Garry Sobers|0,0|-6,-6|-10,-10
Malcolm Marshall|2,2|-2,-2|-6,-6
Courtney Walsh|3,3|-2,-2|-14,-14
Curtly Ambrose|3,3|-4,-4|-12,-12
Everton Weekes|0,0|-12,0|-20,0
Clyde Walcott|0,0|-12,0|-20,0
Frank Worrell|0,0|-12,-12|-20,-20
Lance Gibbs|0,0|-12,-12|-20,-20
Jacques Kallis|3,2|0,0|-8,-6
AB de Villiers|0,0|2,0|3,0
Hashim Amla|2,0|0,0|-6,0
Graeme Smith|2,0|-4,0|-14,0
Jonty Rhodes|-10,0|6,0|-2,0
Lance Klusener|-8,-6|6,4|0,0
Dale Steyn|3,3|0,0|-3,-3
Barry Richards|1,0|-12,0|-20,0
Graeme Pollock|2,0|-12,0|-20,0
Mike Procter|0,0|-10,-10|-18,-18
Vernon Philander|4,4|-6,-6|-14,-14
Dean Elgar|3,0|-30,0|-40,0
Kagiso Rabada|2,2|0,0|1,1
Quinton de Kock|-2,0|3,0|3,0
Heinrich Klaasen|-12,0|2,0|5,0
David Miller|-14,0|0,0|5,0
Marco Jansen|3,3|-4,-4|-2,-2
Richard Hadlee|2,2|0,0|-8,-8
Martin Crowe|1,0|1,0|-10,0
Kane Williamson|2,0|0,0|-8,0
Brendon McCullum|-2,0|0,0|6,0
Daniel Vettori|0,0|0,0|1,1
Trent Boult|0,0|1,1|3,3
Tim Southee|2,2|0,0|0,0
Neil Wagner|4,4|-36,-36|-42,-42
Martin Guptill|-8,0|3,0|3,0
Glenn Phillips|-10,-10|0,0|5,3
Devon Conway|1,0|-2,0|2,0
Kumar Sangakkara|3,0|1,0|-4,0
Mahela Jayawardene|2,0|0,0|-2,0
Muttiah Muralitharan|3,3|0,0|-4,-4
Sanath Jayasuriya|-4,-4|5,3|2,2
Lasith Malinga|-12,-12|1,1|6,6
Rangana Herath|4,4|-8,-8|-14,-14
Tillakaratne Dilshan|-6,-6|0,0|4,2
Wanindu Hasaranga|-20,-20|0,0|6,6
Dimuth Karunaratne|2,0|-20,0|-35,0
Matheesha Pathirana|-35,-35|-2,-2|4,4
Shakib Al Hasan|0,0|2,2|4,3
Tamim Iqbal|0,0|3,0|-2,0
Mustafizur Rahman|-12,-12|1,1|3,3
Rashid Khan|-10,-10|2,2|4,4
Mohammad Nabi|-35,-35|0,0|4,4
Mujeeb Ur Rahman|-40,-40|0,0|4,4
Noor Ahmad|-35,-35|0,0|3,3
Fazalhaq Farooqi|-30,-30|0,0|3,3
Andy Flower|2,0|-2,0|-10,0
`;

(function buildFormats() {
  const FMT_MAP = {};
  FMT_RAW.trim().split('\n').forEach(l => {
    const [name, t, o, p] = l.split('|');
    FMT_MAP[name] = [t, o, p].map(x => x.split(',').map(Number));
  });
  const cl = v => Math.max(0, Math.min(99, Math.round(v)));
  PLAYERS.forEach(p => {
    const m = FMT_MAP[p.name];
    const d = m || [[0, 0], [0, 0], [p.era === 'L' ? -4 : 0, p.era === 'L' ? -4 : 0]];
    const mk = delta => {
      const bat = cl(p.bat + delta[0]), bowl = p.bowl > 0 ? cl(p.bowl + delta[1]) : 0;
      const ovr = overallOf(p.role, bat, bowl);
      return { bat, bowl, ovr, base: basePriceOf(ovr) };
    };
    p.fmt = { all: { bat: p.bat, bowl: p.bowl, ovr: p.ovr, base: p.base }, test: mk(d[0]), odi: mk(d[1]), t20: mk(d[2]) };
  });
})();

let CUR_FORMAT = 'all';
function applyFormat(f) {
  if (!FORMATS[f]) f = 'all';
  CUR_FORMAT = f;
  PLAYERS.forEach(p => Object.assign(p, p.fmt[f]));
  POOLS.forEach(pl => { pl.count = PLAYERS.filter(pl.f).length; });
}
applyFormat('all');
