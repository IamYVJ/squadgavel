/* Squadgavel player database.
   Format: Name|Country|Role|Batting|Bowling|Era   (ratings 0-99, approximate/subjective)
   Role: BAT, BOWL, AR (all-rounder), WK (wicketkeeper-batter). Era: L = legend/retired, C = current/recent. */
const CTY = {
  IND: { name: 'India', hue: 215 }, AUS: { name: 'Australia', hue: 48 }, ENG: { name: 'England', hue: 350 },
  PAK: { name: 'Pakistan', hue: 140 }, WI: { name: 'West Indies', hue: 20 }, SA: { name: 'South Africa', hue: 100 },
  NZ: { name: 'New Zealand', hue: 260 }, SL: { name: 'Sri Lanka', hue: 235 }, BAN: { name: 'Bangladesh', hue: 160 },
  AFG: { name: 'Afghanistan', hue: 190 }, ZIM: { name: 'Zimbabwe', hue: 0 }
};
const ROLE_NAME = { BAT: 'Batter', BOWL: 'Bowler', AR: 'All-rounder', WK: 'WK-Batter' };

const RAW = `
Sachin Tendulkar|IND|BAT|97|35|L
Sunil Gavaskar|IND|BAT|93|15|L
Rahul Dravid|IND|BAT|93|25|L
VVS Laxman|IND|BAT|87|20|L
Sourav Ganguly|IND|BAT|86|45|L
Virender Sehwag|IND|BAT|89|40|L
Gautam Gambhir|IND|BAT|82|10|L
Yuvraj Singh|IND|AR|82|62|L
MS Dhoni|IND|WK|89|10|L
Kapil Dev|IND|AR|80|88|L
Anil Kumble|IND|BOWL|32|93|L
Harbhajan Singh|IND|BOWL|35|84|L
Zaheer Khan|IND|BOWL|28|85|L
Javagal Srinath|IND|BOWL|25|82|L
Mohammad Azharuddin|IND|BAT|84|10|L
Bishan Singh Bedi|IND|BOWL|20|83|L
Syed Kirmani|IND|WK|68|0|L
Ravi Shastri|IND|AR|68|66|L
Gundappa Viswanath|IND|BAT|80|10|L
Irfan Pathan|IND|AR|58|76|L
Ashish Nehra|IND|BOWL|20|77|L
Mohammad Kaif|IND|BAT|68|10|L
Suresh Raina|IND|BAT|78|40|L
Venkatesh Prasad|IND|BOWL|20|72|L
Dinesh Karthik|IND|WK|74|0|L
Cheteshwar Pujara|IND|BAT|83|5|L
R Ashwin|IND|AR|64|91|L
Virat Kohli|IND|BAT|97|20|C
Rohit Sharma|IND|BAT|92|20|C
Jasprit Bumrah|IND|BOWL|25|97|C
Ravindra Jadeja|IND|AR|72|86|C
Rishabh Pant|IND|WK|86|0|C
KL Rahul|IND|WK|84|0|C
Shubman Gill|IND|BAT|87|5|C
Hardik Pandya|IND|AR|77|74|C
Mohammed Shami|IND|BOWL|20|87|C
Suryakumar Yadav|IND|BAT|88|5|C
Kuldeep Yadav|IND|BOWL|22|85|C
Mohammed Siraj|IND|BOWL|15|82|C
Axar Patel|IND|AR|62|80|C
Yashasvi Jaiswal|IND|BAT|85|5|C
Shreyas Iyer|IND|BAT|81|5|C
Arshdeep Singh|IND|BOWL|12|79|C
Varun Chakravarthy|IND|BOWL|10|80|C
Sanju Samson|IND|WK|80|0|C
Ajinkya Rahane|IND|BAT|76|5|C
Donald Bradman|AUS|BAT|100|20|L
Ricky Ponting|AUS|BAT|93|20|L
Steve Waugh|AUS|BAT|86|50|L
Mark Waugh|AUS|BAT|85|45|L
Adam Gilchrist|AUS|WK|92|0|L
Matthew Hayden|AUS|BAT|90|10|L
Justin Langer|AUS|BAT|78|5|L
Allan Border|AUS|BAT|85|40|L
Shane Warne|AUS|BOWL|30|96|L
Glenn McGrath|AUS|BOWL|15|95|L
Brett Lee|AUS|BOWL|25|86|L
Dennis Lillee|AUS|BOWL|20|93|L
Jason Gillespie|AUS|BOWL|22|82|L
Michael Hussey|AUS|BAT|86|10|L
Michael Clarke|AUS|BAT|84|40|L
Andrew Symonds|AUS|AR|78|62|L
Shane Watson|AUS|AR|76|68|L
Greg Chappell|AUS|BAT|90|45|L
Ian Healy|AUS|WK|72|0|L
Rod Marsh|AUS|WK|70|0|L
Richie Benaud|AUS|AR|55|82|L
Keith Miller|AUS|AR|78|84|L
Mitchell Johnson|AUS|BOWL|28|87|L
Michael Bevan|AUS|BAT|80|20|L
Steve Smith|AUS|BAT|94|40|C
David Warner|AUS|BAT|88|10|C
Pat Cummins|AUS|BOWL|45|93|C
Mitchell Starc|AUS|BOWL|30|91|C
Josh Hazlewood|AUS|BOWL|15|88|C
Travis Head|AUS|BAT|87|30|C
Marnus Labuschagne|AUS|BAT|83|30|C
Glenn Maxwell|AUS|AR|82|65|C
Mitchell Marsh|AUS|AR|76|60|C
Nathan Lyon|AUS|BOWL|20|85|C
Alex Carey|AUS|WK|74|0|C
Cameron Green|AUS|AR|66|68|C
Usman Khawaja|AUS|BAT|80|5|C
Adam Zampa|AUS|BOWL|12|80|C
Marcus Stoinis|AUS|AR|74|58|C
Ian Botham|ENG|AR|86|88|L
Geoffrey Boycott|ENG|BAT|88|15|L
Graham Gooch|ENG|BAT|87|35|L
David Gower|ENG|BAT|85|5|L
Michael Vaughan|ENG|BAT|80|20|L
Kevin Pietersen|ENG|BAT|89|35|L
Andrew Flintoff|ENG|AR|80|84|L
Alastair Cook|ENG|BAT|91|5|L
Andrew Strauss|ENG|BAT|78|5|L
Jonathan Trott|ENG|BAT|78|25|L
Ian Bell|ENG|BAT|82|10|L
James Anderson|ENG|BOWL|18|92|L
Stuart Broad|ENG|BOWL|40|88|L
Graeme Swann|ENG|BOWL|30|83|L
Bob Willis|ENG|BOWL|15|82|L
Alec Stewart|ENG|WK|82|0|L
Matt Prior|ENG|WK|76|0|L
Jack Hobbs|ENG|BAT|93|10|L
Wally Hammond|ENG|BAT|92|45|L
Fred Trueman|ENG|BOWL|18|88|L
Eoin Morgan|ENG|BAT|82|10|L
Paul Collingwood|ENG|AR|70|55|L
Joe Root|ENG|BAT|94|35|C
Ben Stokes|ENG|AR|86|80|C
Jos Buttler|ENG|WK|87|0|C
Jonny Bairstow|ENG|WK|80|0|C
Harry Brook|ENG|BAT|85|10|C
Jofra Archer|ENG|BOWL|25|87|C
Mark Wood|ENG|BOWL|15|82|C
Moeen Ali|ENG|AR|70|65|C
Chris Woakes|ENG|AR|60|78|C
Jason Roy|ENG|BAT|78|5|C
Liam Livingstone|ENG|AR|72|50|C
Adil Rashid|ENG|BOWL|20|79|C
Sam Curran|ENG|AR|60|72|C
Phil Salt|ENG|WK|80|0|C
Ben Duckett|ENG|BAT|80|5|C
Imran Khan|PAK|AR|78|93|L
Wasim Akram|PAK|BOWL|52|94|L
Waqar Younis|PAK|BOWL|25|91|L
Javed Miandad|PAK|BAT|90|25|L
Inzamam-ul-Haq|PAK|BAT|87|5|L
Saeed Anwar|PAK|BAT|82|5|L
Younis Khan|PAK|BAT|87|15|L
Mohammad Yousuf|PAK|BAT|87|5|L
Shahid Afridi|PAK|AR|74|78|L
Shoaib Akhtar|PAK|BOWL|15|88|L
Abdul Qadir|PAK|BOWL|20|84|L
Saqlain Mushtaq|PAK|BOWL|20|80|L
Zaheer Abbas|PAK|BAT|85|10|L
Hanif Mohammad|PAK|BAT|85|10|L
Misbah-ul-Haq|PAK|BAT|78|5|L
Rashid Latif|PAK|WK|68|0|L
Mushtaq Ahmed|PAK|BOWL|20|78|L
Abdul Razzaq|PAK|AR|68|72|L
Moin Khan|PAK|WK|66|0|L
Saleem Malik|PAK|BAT|80|20|L
Shoaib Malik|PAK|AR|74|62|L
Sarfaraz Ahmed|PAK|WK|72|0|L
Babar Azam|PAK|BAT|91|10|C
Shaheen Afridi|PAK|BOWL|20|90|C
Mohammad Rizwan|PAK|WK|84|0|C
Naseem Shah|PAK|BOWL|15|82|C
Haris Rauf|PAK|BOWL|12|78|C
Fakhar Zaman|PAK|BAT|78|5|C
Shadab Khan|PAK|AR|62|74|C
Mohammad Amir|PAK|BOWL|22|85|C
Mohammad Hafeez|PAK|AR|72|60|L
Yasir Shah|PAK|BOWL|18|78|L
Saud Shakeel|PAK|BAT|74|5|C
Abrar Ahmed|PAK|BOWL|10|76|C
Viv Richards|WI|BAT|96|40|L
Brian Lara|WI|BAT|96|15|L
Garry Sobers|WI|AR|96|88|L
Gordon Greenidge|WI|BAT|87|5|L
Desmond Haynes|WI|BAT|86|5|L
Clive Lloyd|WI|BAT|85|20|L
Shivnarine Chanderpaul|WI|BAT|86|15|L
Chris Gayle|WI|BAT|90|45|L
Courtney Walsh|WI|BOWL|15|90|L
Curtly Ambrose|WI|BOWL|15|93|L
Malcolm Marshall|WI|BOWL|40|96|L
Michael Holding|WI|BOWL|18|92|L
Joel Garner|WI|BOWL|20|90|L
Andy Roberts|WI|BOWL|18|88|L
Jeff Dujon|WI|WK|74|0|L
Ramnaresh Sarwan|WI|BAT|78|20|L
Lance Gibbs|WI|BOWL|15|84|L
Everton Weekes|WI|BAT|92|10|L
Clyde Walcott|WI|WK|90|0|L
Frank Worrell|WI|AR|84|65|L
Dwayne Bravo|WI|AR|66|74|L
Kieron Pollard|WI|AR|78|50|L
Carl Hooper|WI|AR|78|50|L
Richie Richardson|WI|BAT|82|5|L
Sunil Narine|WI|AR|50|85|C
Andre Russell|WI|AR|82|72|C
Nicholas Pooran|WI|WK|82|0|C
Shai Hope|WI|WK|76|0|C
Jason Holder|WI|AR|62|78|C
Shimron Hetmyer|WI|BAT|76|5|C
Alzarri Joseph|WI|BOWL|12|74|C
Kemar Roach|WI|BOWL|15|76|C
Rovman Powell|WI|BAT|70|20|C
Akeal Hosein|WI|BOWL|20|72|C
Jacques Kallis|SA|AR|94|82|L
AB de Villiers|SA|WK|96|0|L
Graeme Smith|SA|BAT|86|10|L
Hashim Amla|SA|BAT|90|5|L
Gary Kirsten|SA|BAT|82|5|L
Herschelle Gibbs|SA|BAT|82|5|L
Jonty Rhodes|SA|BAT|72|5|L
Hansie Cronje|SA|AR|72|60|L
Shaun Pollock|SA|AR|68|90|L
Allan Donald|SA|BOWL|18|92|L
Dale Steyn|SA|BOWL|20|96|L
Makhaya Ntini|SA|BOWL|15|80|L
Mark Boucher|SA|WK|76|0|L
Lance Klusener|SA|AR|76|72|L
Barry Richards|SA|BAT|90|10|L
Graeme Pollock|SA|BAT|93|10|L
Morne Morkel|SA|BOWL|15|82|L
Vernon Philander|SA|BOWL|30|85|L
Faf du Plessis|SA|BAT|85|10|L
JP Duminy|SA|AR|72|50|L
Imran Tahir|SA|BOWL|12|78|L
Mike Procter|SA|AR|75|85|L
Dean Elgar|SA|BAT|74|5|L
Kagiso Rabada|SA|BOWL|25|91|C
Quinton de Kock|SA|WK|87|0|C
Aiden Markram|SA|BAT|80|35|C
Heinrich Klaasen|SA|WK|84|0|C
David Miller|SA|BAT|82|5|C
Anrich Nortje|SA|BOWL|15|83|C
Temba Bavuma|SA|BAT|76|5|C
Marco Jansen|SA|AR|40|82|C
Keshav Maharaj|SA|BOWL|25|78|C
Tristan Stubbs|SA|BAT|76|20|C
Ryan Rickelton|SA|WK|76|0|C
Lungi Ngidi|SA|BOWL|12|78|C
Richard Hadlee|NZ|AR|65|94|L
Martin Crowe|NZ|BAT|88|15|L
Stephen Fleming|NZ|BAT|80|5|L
Brendon McCullum|NZ|WK|88|0|L
Ross Taylor|NZ|BAT|87|10|L
Daniel Vettori|NZ|AR|56|85|L
Chris Cairns|NZ|AR|74|78|L
Shane Bond|NZ|BOWL|15|85|L
Nathan Astle|NZ|BAT|78|35|L
Glenn Turner|NZ|BAT|80|5|L
Chris Harris|NZ|AR|62|62|L
Jacob Oram|NZ|AR|66|68|L
Martin Guptill|NZ|BAT|82|5|L
Neil Wagner|NZ|BOWL|20|78|L
BJ Watling|NZ|WK|70|0|L
Kane Williamson|NZ|BAT|93|20|C
Trent Boult|NZ|BOWL|20|90|C
Tim Southee|NZ|BOWL|35|85|C
Kyle Jamieson|NZ|BOWL|35|82|C
Daryl Mitchell|NZ|AR|80|50|C
Devon Conway|NZ|WK|80|0|C
Mitchell Santner|NZ|AR|58|78|C
Rachin Ravindra|NZ|AR|76|65|C
Tom Latham|NZ|WK|76|0|C
Lockie Ferguson|NZ|BOWL|12|80|C
Glenn Phillips|NZ|AR|76|55|C
Matt Henry|NZ|BOWL|20|80|C
Kumar Sangakkara|SL|WK|94|0|L
Mahela Jayawardene|SL|BAT|90|10|L
Muttiah Muralitharan|SL|BOWL|18|98|L
Sanath Jayasuriya|SL|AR|86|60|L
Aravinda de Silva|SL|BAT|85|25|L
Arjuna Ranatunga|SL|BAT|74|10|L
Chaminda Vaas|SL|BOWL|40|86|L
Lasith Malinga|SL|BOWL|15|90|L
Rangana Herath|SL|BOWL|20|80|L
Tillakaratne Dilshan|SL|AR|84|50|L
Marvan Atapattu|SL|BAT|78|5|L
Angelo Mathews|SL|AR|78|60|L
Ajantha Mendis|SL|BOWL|10|76|L
Upul Tharanga|SL|BAT|74|5|L
Dimuth Karunaratne|SL|BAT|74|5|C
Wanindu Hasaranga|SL|AR|58|80|C
Kusal Mendis|SL|WK|76|0|C
Pathum Nissanka|SL|BAT|76|5|C
Maheesh Theekshana|SL|BOWL|15|76|C
Dhananjaya de Silva|SL|AR|72|55|C
Matheesha Pathirana|SL|BOWL|10|78|C
Charith Asalanka|SL|BAT|74|10|C
Shakib Al Hasan|BAN|AR|82|86|C
Tamim Iqbal|BAN|BAT|78|5|L
Mushfiqur Rahim|BAN|WK|78|0|C
Mustafizur Rahman|BAN|BOWL|12|82|C
Mashrafe Mortaza|BAN|BOWL|30|72|L
Mahmudullah|BAN|AR|72|50|C
Litton Das|BAN|WK|74|0|C
Taskin Ahmed|BAN|BOWL|12|74|C
Najmul Hossain Shanto|BAN|BAT|70|10|C
Mehidy Hasan Miraz|BAN|AR|60|74|C
Rashid Khan|AFG|BOWL|40|94|C
Mohammad Nabi|AFG|AR|66|72|C
Rahmanullah Gurbaz|AFG|WK|76|0|C
Mujeeb Ur Rahman|AFG|BOWL|10|74|C
Ibrahim Zadran|AFG|BAT|72|5|C
Fazalhaq Farooqi|AFG|BOWL|10|74|C
Noor Ahmad|AFG|BOWL|10|74|C
Azmatullah Omarzai|AFG|AR|64|68|C
Andy Flower|ZIM|WK|86|0|L
Heath Streak|ZIM|AR|60|80|L
Grant Flower|ZIM|BAT|74|30|L
Brendan Taylor|ZIM|WK|74|0|L
`;

function overallOf(role, bat, bowl) {
  let v;
  if (role === 'BAT') v = bat * 0.94 + bowl * 0.06;
  else if (role === 'BOWL') v = bowl * 0.94 + bat * 0.06;
  else if (role === 'AR') v = (bat + bowl) / 2 + 5;
  else v = bat + 1; // WK
  return Math.min(99, Math.round(v));
}
function basePriceOf(o) { // in lakhs
  if (o >= 95) return 200;
  if (o >= 90) return 150;
  if (o >= 85) return 100;
  if (o >= 80) return 75;
  if (o >= 72) return 50;
  if (o >= 64) return 30;
  return 20;
}

const PLAYERS = RAW.trim().split('\n').map((l, id) => {
  const [name, cty, role, bat, bowl, era] = l.split('|');
  const b = +bat, w = +bowl, ovr = overallOf(role, b, w);
  return { id, name, cty, role, bat: b, bowl: w, era, ovr, base: basePriceOf(ovr) };
});

const SENA = ['SA', 'ENG', 'NZ', 'AUS'];
const ASIA = ['IND', 'PAK', 'SL', 'BAN', 'AFG'];
const POOLS = [
  { id: 'all', name: 'Entire Universe', icon: '🌍', desc: 'Every player in the database', f: p => true },
  { id: 'greats', name: 'World Greats', icon: '👑', desc: 'Overall 84 and above', f: p => p.ovr >= 84 },
  { id: 'legends', name: 'All-Time Legends', icon: '🏛️', desc: 'Retired icons', f: p => p.era === 'L' },
  { id: 'modern', name: 'Modern Stars', icon: '⚡', desc: 'Active / recent players', f: p => p.era === 'C' },
  { id: 'ind', name: 'India All-Time', icon: '🇮🇳', desc: 'Every Indian great', f: p => p.cty === 'IND' },
  { id: 'ind-l', name: 'India Legends', icon: '🏏', desc: 'Retired Indian icons', f: p => p.cty === 'IND' && p.era === 'L' },
  { id: 'ind-c', name: 'India Current', icon: '💙', desc: 'Men in Blue today', f: p => p.cty === 'IND' && p.era === 'C' },
  { id: 'sena', name: 'SENA Nations', icon: '🌏', desc: 'South Africa, England, NZ, Australia', f: p => SENA.includes(p.cty) },
  { id: 'asia', name: 'Asia', icon: '🌴', desc: 'IND, PAK, SL, BAN, AFG', f: p => ASIA.includes(p.cty) },
  { id: 'aus', name: 'Australia', icon: '🦘', desc: 'All-time Aussies', f: p => p.cty === 'AUS' },
  { id: 'eng', name: 'England', icon: '🦁', desc: 'All-time English', f: p => p.cty === 'ENG' },
  { id: 'pak', name: 'Pakistan', icon: '🌙', desc: 'All-time Pakistanis', f: p => p.cty === 'PAK' },
  { id: 'wi', name: 'West Indies', icon: '🌴', desc: 'Calypso cricket', f: p => p.cty === 'WI' },
  { id: 'sa', name: 'South Africa', icon: '🦌', desc: 'All-time Proteas', f: p => p.cty === 'SA' },
  { id: 'nz', name: 'New Zealand', icon: '🥝', desc: 'All-time Kiwis', f: p => p.cty === 'NZ' },
  { id: 'sl', name: 'Sri Lanka', icon: '🦁', desc: 'All-time Lankans', f: p => p.cty === 'SL' }
];
POOLS.forEach(pl => { pl.count = PLAYERS.filter(pl.f).length; });
