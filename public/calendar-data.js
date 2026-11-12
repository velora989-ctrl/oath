/* School planner data for the Holidays tab: Paragon Senior Secondary School, Sector-71, Mohali. July 2026 - March 2027.
   Copied from the school's Academic Planner PDF. Sundays are the weekly off (the calendar adds those itself).
   HOLIDAYS: day -> what the holiday is for.  EVENTS: day -> things happening at school that day.  MONTHS: house, theme and notes. */
(function () {
  const HOLIDAYS = {}, EVENTS = {};
  const pad = n => String(n).padStart(2, '0');
  const hol = (d, name) => { HOLIDAYS[d] = name; };
  const holRange = (a, b, name) => {   /* a, b = 'YYYY-MM-DD', both included */
    const s = new Date(a + 'T00:00:00Z'), e = new Date(b + 'T00:00:00Z');
    for (let t = s; t <= e; t = new Date(t.getTime() + 864e5)) hol(t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()), name);
  };
  const ev = (d, ...list) => { EVENTS[d] = (EVENTS[d] || []).concat(list); };

  /* ---- holidays */
  hol('2026-07-31', 'Martyrdom Day of Shaheed Udham Singh Ji');
  hol('2026-08-28', 'Raksha Bandhan');
  hol('2026-09-04', 'Janmashtami');
  hol('2026-10-02', 'Gandhi Jayanti');
  hol('2026-10-20', 'Dussehra');
  hol('2026-10-26', 'Valmiki Jayanti');
  hol('2026-10-29', 'Karwa Chauth');
  holRange('2026-11-06', '2026-11-11', 'Diwali Break');
  hol('2026-11-16', 'Martyrdom Day of S. Kartar Singh Sarabha');
  hol('2026-11-24', 'Prakash Purab of Shri Guru Nanak Dev Ji');
  hol('2026-12-14', 'Martyrdom Day of Shri Guru Teg Bahadur Ji');
  hol('2026-12-25', 'Christmas Day');
  holRange('2027-01-01', '2027-01-07', 'Winter Vacation (as per the State Government notification)');
  hol('2027-01-27', 'Holiday in lieu of Republic Day');
  hol('2027-02-20', 'Ravidas Jayanti');
  hol('2027-03-06', 'Maha Shivratri');
  hol('2027-03-22', 'Holi');

  /* ---- school events (from the day boxes of the planner) */
  ev('2026-07-01', 'School reopens after summer break');
  ev('2026-07-06', 'Assembly by the house teachers on welcoming the students');
  ev('2026-07-08', 'Nominations of Students Council, Round I');
  ev('2026-07-09', 'Van Mahotsav celebrations (Deptt. NCC - Army & Air Wing, NSS, Scouts & Guides)');
  ev('2026-07-10', 'Assembly on theme of the month: Class XII (Humanities & Commerce)');
  ev('2026-07-13', 'Special assembly of Classes IX - XII: introduction of nominees for Students Council');
  ev('2026-07-17', 'Investiture Ceremony');
  ev('2026-07-18', 'Inter House Competition');
  ev('2026-07-20', 'Assembly: commemoration of the birth anniversary of revered Director Late S. Iqbal Singh Shergill');
  ev('2026-07-24', 'Blood donation camp, in commemoration of the birth anniversary of revered Director Late S. Iqbal Singh Shergill');
  ev('2026-07-25', 'P.T.M, Classes III - XII', 'Exhibition by E.V.S, Sci, S. Sci, Maths Deptt., Classes III - VIII');
  ev('2026-07-27', 'Assembly by the Student Council members. Theme: success achieved with honesty & integrity lasts forever');

  ev('2026-08-01', 'Special assembly: commemoration of the death anniversary of the Founder of the School, Late S. Balraj Singh Shergill');
  ev('2026-08-03', 'Assembly by the house teachers on the theme of the month');
  ev('2026-08-06', 'Commencement of P.A - II, Classes I - VIII & X', 'Unit Test II, Class XII', 'Unit Test I, Class XI', 'P.A - I, Class IX');
  ev('2026-08-14', 'Assembly on Independence Day by EBSB Club');
  ev('2026-08-15', 'Independence Day celebrations [NCC, NSS, Scouts & Guides, Student Council]');
  ev('2026-08-17', 'Assembly by Class VI. Theme: "United we stand, divided we fall"', 'Panel discussion by Class X students');
  ev('2026-08-22', 'Inter School Competition: Young Entrepreneurs - Blaze to Chase');
  ev('2026-08-24', 'Assembly by Class V students. Theme: "One team, one dream" & Raksha Bandhan');
  ev('2026-08-29', 'P.T.M, Classes III - XII');

  ev('2026-09-03', 'Special assembly for Teachers’ Day celebration & Janmashtami');
  ev('2026-09-09', 'Commencement of Term I Examination, Classes I - IX & XI');
  [10, 11, 12, 14, 15, 16, 17, 18, 19, 21].forEach(d => ev('2026-09-' + pad(d), 'Term I Examination, Classes I - IX & XI'));
  ev('2026-09-23', 'Educational trip'); ev('2026-09-24', 'Educational trip'); ev('2026-09-25', 'Educational trip');
  ev('2026-09-26', 'P.T.M: result declaration of Term I Examination');
  ev('2026-09-28', 'Commencement of Term II & inauguration of NSS Camp');

  ev('2026-10-03', 'Valedictory ceremony of NSS Camp');
  ev('2026-10-05', 'Assembly on Gandhi Jayanti');
  ev('2026-10-09', 'Assembly on theme of the month by Class V students');
  ev('2026-10-12', 'Assembly by house teachers. Theme: the secret to a peaceful life is a thankful heart');
  ev('2026-10-16', 'Group discussion by Class IX students');
  ev('2026-10-19', 'Assembly on Navratri & Dussehra by Class IV students');
  ev('2026-10-21', 'Commencement of Preboard, Classes X & XII');
  ev('2026-10-23', 'Assembly on Valmiki Jayanti & Prakash Purab of Shri Guru Ram Das Ji');
  ev('2026-10-30', 'Inter House Football and Basketball competition');
  ev('2026-10-31', 'Inter House Football and Basketball competition');

  ev('2026-11-02', 'Assembly on the festivals: Diwali, Vishkarma Day, Bhai Dooj by Roots & Routes Club & Curtain Call Club');
  ev('2026-11-12', 'School reopens');
  ev('2026-11-14', 'Children’s Day celebration, Classes III - VIII', 'Constitution Day celebration, Classes IX - XII');
  ev('2026-11-23', 'Special assembly: Prakash Purab of Shri Guru Nanak Dev Ji');
  ev('2026-11-28', 'Annual Function');

  ev('2026-12-09', 'Commencement of Preboard II, Classes X & XII');
  ev('2026-12-11', 'Special assembly: Martyrdom Day of Shri Guru Teg Bahadur Ji');
  ev('2026-12-15', 'Commencement of P.A - III, Classes I - VIII', 'P.A - II, Class IX', 'Unit Test II, Class XI');
  ev('2026-12-16', 'Special assembly commemorating the death anniversary of respected Director Late S. Iqbal Singh Shergill');
  ev('2026-12-19', 'Kaushal Mela [A.I., Kaushal Bodh]');
  ev('2026-12-21', 'Christmas celebrations');
  ev('2026-12-22', 'Assembly on Veer Bal Diwas');
  ev('2026-12-24', 'Veer Baal Diwas celebration');

  ev('2027-01-08', 'School reopens');
  ev('2027-01-09', 'Parents Teacher Meeting, Classes IX - XII');
  ev('2027-01-14', 'Assembly on Makar Sankranti & Lohri');
  ev('2027-01-18', 'Preboard Examination, Class X', 'Assembly on theme of the month by Class III');
  ev('2027-01-25', 'Special assembly on Republic Day');
  ev('2027-01-26', 'Republic Day celebration [NSS, NCC, Music & Dance Deptt.]');
  ev('2027-01-30', 'Inter House Competition');

  ev('2027-02-06', 'Farewell, Classes XI - XII');
  ev('2027-02-08', 'Commencement of P.A - IV, Classes III - VIII');
  ev('2027-02-15', 'Assembly on theme of the month by all four houses');
  ev('2027-02-19', 'Assembly on Ravidas Jayanti');
  ev('2027-02-22', 'Founder’s Day celebration', 'Commencement of revision of Term II Examination');

  ev('2027-03-01', 'Commencement of Practical Examination, Class XI');
  ev('2027-03-05', 'Assembly. Theme: Mahashivratri, good luck for the final examination');
  ev('2027-03-08', 'Commencement of Final Examination');
  ev('2027-03-31', 'Result declaration');

  const PH = 'Public holidays 2027 are subject to change as per the State Government notification.';
  const MONTHS = {
    '2026-07': { house: 'Sachin Tendulkar', theme: 'Honesty & Integrity', sub: 'Honesty guides the heart, integrity shapes the character',
      notes: ['Van Mahotsav: Nature Parade (III - V), Herbarium Project & Eco Pledge Wall (VI - VIII), Miyawaki Corner (IX - XII)', 'Inter House competitions: Role Roulette, Master Chef (fireless cooking), Art on Screen (digital posters)'] },
    '2026-08': { house: 'Rabindra Nath Tagore', theme: 'Unity in Diversity', sub: 'Harmony among diverse people is the foundation of peace & progress',
      notes: ['Inter School Competition: Young Entrepreneurs - Blaze to Chase', 'Periodic Assessment / Unit Test: 6 - 13 August'] },
    '2026-09': { house: 'Isaac Newton, Kalpana Chawla, Rabindra Nath Tagore, Sachin Tendulkar', theme: 'Preparation. Practice. Performance.', sub: '',
      notes: ['Term I Examination (Classes I - IX, XI)', 'Term office for students: 22 - 25 September', 'Result declaration of Term I Examination', 'NSS Camp: 28 September - 3 October'] },
    '2026-10': { house: 'Isaac Newton', theme: 'Gratitude fills the heart, peace fills the soul', sub: 'Peace grows where gratitude lives',
      notes: ['Inter House competition, 30 & 31 October: Football (III - V), Basketball (VI - VIII)', 'Preboard Examination, Classes X & XII: 21 October - 5 November', 'Community Reach Programme (IX - XII)'] },
    '2026-11': { house: 'Kalpana Chawla', theme: 'Light of wisdom and prosperity', sub: 'Positive attitude, inner strength and self confidence',
      notes: ['Preboard Examination, Classes X & XII, runs until 5 November', 'Annual Function on 28 November'] },
    '2026-12': { house: 'Rabindra Nath Tagore', theme: 'Courage to compassion', sub: 'Strength, kindness and humanity',
      notes: ['Pre-board Examination, Classes X & XII: 9 - 21 December', 'Periodic Assessment: 15 - 21 December', 'Winter vacation: 1 - 7 January (as per the State Government notification)'] },
    '2027-01': { house: 'Sachin Tendulkar', theme: 'Responsible citizens, strong democracy', sub: 'Rights, duties & active citizenship',
      notes: ['Winter vacations: 1 - 7 January', 'Orientation programmes for parents', 'Inter House competition: Puppet Talk (III - V), Podcast Competition (VI - VIII)', PH] },
    '2027-02': { house: 'Isaac Newton, Kalpana Chawla, Rabindra Nath Tagore, Sachin Tendulkar', theme: 'Excellence through effort', sub: 'Success follows preparation',
      notes: ['Periodic Assessment: 8 - 13 February', PH] },
    '2027-03': { house: 'Isaac Newton, Kalpana Chawla, Rabindra Nath Tagore, Sachin Tendulkar', theme: 'Reflect, rejoice and rise', sub: '',
      notes: ['Practical Examination, Class XI: 1 - 5 March', 'Final Examination: 8 - 22 March', 'Result declaration', PH] }
  };
  window.GroveCalData = { school: 'Paragon Senior Secondary School, Sector-71, Mohali', first: '2026-07', last: '2027-03', start: '2026-11', holidays: HOLIDAYS, events: EVENTS, months: MONTHS };
})();
