// FICTIONAL DEMO DATA. Every person, artist, label, venue, publication, place, album and crate
// named in this module is invented. Nothing here describes a real person or company, and any
// resemblance is accidental. Replace a name if it turns out to clash with a real one.
//
// Data classification: PUBLIC. No real personal data. The emails use the reserved .invalid
// domain, so nothing can ever be delivered to them.
//
// This module is data only. services/demo-seed.ts writes it to the database.
//
// Rules for anyone editing it (test/demo-seed.test.ts checks them):
// - A seedKey is the row's identity. Never change one, or the row is seeded a second time.
// - Usernames start 'demo-' and emails are '<username>@frisson.invalid'. No links, no avatars.
// - Crate names, crate labels, album titles, artists, usernames and display names must not
//   contain the letters 'ai' in any case: the Recommended section on Home may show no other
//   'AI' than its own note, and tape labels are upper case.
// - Crate createdAt and news publishedAt values are fixed, distinct and in the past.

export type DemoUser = {
  seedKey: string
  username: string
  email: string
  displayName: string
  bio: string
  createdAt: string
}

export type DemoAlbum = {
  seedKey: string
  title: string
  artist: string
  year: number
  genre: string
  format: 'LP' | 'EP' | '7"' | '12"'
  sleeveColor: string
  rating: number
  sides: Partial<Record<'A' | 'B' | 'C' | 'D', string[]>>
}

export type DemoCrate = {
  seedKey: string
  ownerSeedKey: string
  name: string
  label: string
  color: string
  /** Lower ranks come first on Home. Absent means the crate is not recommended. */
  recommendedRank?: number
  createdAt: string
  albums: DemoAlbum[]
}

export type DemoNewsItem = {
  seedKey: string
  title: string
  summary: string
  source: string
  publishedAt: string
}

export const DEMO_USERS: DemoUser[] = [
  {
    seedKey: 'user:odessa-quillfern',
    username: 'demo-odessa-quillfern',
    email: 'demo-odessa-quillfern@frisson.invalid',
    displayName: 'Odessa Quillfern',
    bio: 'Night shift nurse. Files her records by how late it should be when you play them.',
    createdAt: '2026-03-02T10:00:00.000Z',
  },
  {
    seedKey: 'user:tomasz-brindlewick',
    username: 'demo-tomasz-brindlewick',
    email: 'demo-tomasz-brindlewick@frisson.invalid',
    displayName: 'Tomasz Brindlewick',
    bio: 'Has never paid more than five for a record and will tell you about it.',
    createdAt: '2026-03-09T10:00:00.000Z',
  },
  {
    seedKey: 'user:junia-marrowby',
    username: 'demo-junia-marrowby',
    email: 'demo-junia-marrowby@frisson.invalid',
    displayName: 'Junia Marrowby',
    bio: 'Keeps one turntable in the kitchen, next to the toaster, against all advice.',
    createdAt: '2026-03-16T10:00:00.000Z',
  },
  {
    seedKey: 'user:priya-hollowmere',
    username: 'demo-priya-hollowmere',
    email: 'demo-priya-hollowmere@frisson.invalid',
    displayName: 'Priya Hollowmere',
    bio: 'Field recordist on weekends. Likes a song better if you can hear the crickets.',
    createdAt: '2026-03-23T10:00:00.000Z',
  },
  {
    seedKey: 'user:lucho-ferndrake',
    username: 'demo-lucho-ferndrake',
    email: 'demo-lucho-ferndrake@frisson.invalid',
    displayName: 'Lucho Ferndrake',
    bio: 'Runs a launderette by day. The disco records live under the folding table.',
    createdAt: '2026-03-30T10:00:00.000Z',
  },
  {
    seedKey: 'user:emeka-vossgrove',
    username: 'demo-emeka-vossgrove',
    email: 'demo-emeka-vossgrove@frisson.invalid',
    displayName: 'Emeka Vossgrove',
    bio: 'Bus driver and former bedroom producer. Counts everything in sixteen bars.',
    createdAt: '2026-04-06T10:00:00.000Z',
  },
  {
    seedKey: 'user:maren-oxtuft',
    username: 'demo-maren-oxtuft',
    email: 'demo-maren-oxtuft@frisson.invalid',
    displayName: 'Maren Oxtuft',
    bio: 'Plays the hall piano on Sundays. Buys anything with a choir on side two.',
    createdAt: '2026-04-13T10:00:00.000Z',
  },
]

export const DEMO_CRATES: DemoCrate[] = [
  {
    seedKey: 'crate:lamplit-dub-hours',
    ownerSeedKey: 'user:odessa-quillfern',
    name: 'Lamplit Dub Hours',
    label: 'DUB / AFTER DARK',
    color: '#6b5a44',
    recommendedRank: 1,
    createdAt: '2026-05-04T18:30:00.000Z',
    albums: [
      {
        seedKey: 'album:echoes-for-the-night-bus',
        title: 'Echoes for the Night Bus',
        artist: 'Mossbank Hi-Fi',
        year: 1979,
        genre: 'Dub',
        format: 'LP',
        sleeveColor: '#27413a',
        rating: 5,
        sides: {
          A: ['Last Stop Version', 'Upper Deck Skank', 'Wet Pavement'],
          B: ['Conductor Dub', 'Terminus at Three'],
        },
      },
      {
        seedKey: 'album:tin-roof-version',
        title: 'Tin Roof Version',
        artist: 'Mossbank Hi-Fi',
        year: 1981,
        genre: 'Dub',
        format: 'LP',
        sleeveColor: '#8a6d3b',
        rating: 4,
        sides: {
          A: ['Drip Tray', 'Gutter Echo'],
          B: ['Corrugated', 'Puddle Science', 'Dry by Morning'],
        },
      },
      {
        seedKey: 'album:sub-harbour',
        title: 'Sub Harbour',
        artist: 'Delroy Quaverstone',
        year: 1983,
        genre: 'Dub',
        format: '12"',
        sleeveColor: '#1f3a5f',
        rating: 4,
        sides: { A: ['Sub Harbour', 'Mooring Line'], B: ['Harbour Version', 'Bilge Pump Rock'] },
      },
      {
        seedKey: 'album:melodica-for-absent-friends',
        title: 'Melodica for Absent Friends',
        artist: 'Delroy Quaverstone',
        year: 1985,
        genre: 'Dub',
        format: 'LP',
        sleeveColor: '#a34a28',
        rating: 3,
        sides: {
          A: ['Empty Chair Skank', 'Letter to Nobody'],
          B: ['Melodica Version', 'See You Sunday'],
        },
      },
    ],
  },
  {
    seedKey: 'crate:thrift-bin-psych',
    ownerSeedKey: 'user:tomasz-brindlewick',
    name: 'Thrift Bin Psych',
    label: 'PSYCH / DOLLAR BIN',
    color: '#8f6f9e',
    recommendedRank: 2,
    createdAt: '2026-05-19T12:15:00.000Z',
    albums: [
      {
        seedKey: 'album:the-wallpaper-is-breathing',
        title: 'The Wallpaper Is Breathing',
        artist: 'Orchard Ferrymen',
        year: 1968,
        genre: 'Psychedelic',
        format: 'LP',
        sleeveColor: '#c04f8a',
        rating: 5,
        sides: {
          A: ['Paisley Lungs', 'Mister Thermostat', 'Ceiling Weather'],
          B: ['The Rug Remembers', 'Breathing Out'],
        },
      },
      {
        seedKey: 'album:marmalade-sextant',
        title: 'Marmalade Sextant',
        artist: 'Orchard Ferrymen',
        year: 1969,
        genre: 'Psychedelic',
        format: 'LP',
        sleeveColor: '#e08a1e',
        rating: 4,
        sides: { A: ['Navigating by Toast', 'Captain Peel'], B: ['Sticky Latitude', 'Landfall'] },
      },
      {
        seedKey: 'album:seven-clocks-no-hands',
        title: 'Seven Clocks, No Hands',
        artist: 'The Velvet Almanacs',
        year: 1967,
        genre: 'Psychedelic',
        format: 'LP',
        sleeveColor: '#3d2a6e',
        rating: 3,
        sides: { A: ['Tuesday Twice', 'Pendulum Girl'], B: ['Unwound', 'The Seventh Clock'] },
      },
      {
        seedKey: 'album:grandmothers-periscope',
        title: "Grandmother's Periscope",
        artist: 'Pewter Kite',
        year: 1970,
        genre: 'Psychedelic',
        format: 'EP',
        sleeveColor: '#4f8a6d',
        rating: 4,
        sides: { A: ['Up Periscope, Nana', 'Doily Submarine'], B: ['Knitted Sonar'] },
      },
    ],
  },
  {
    seedKey: 'crate:kitchen-table-jazz',
    ownerSeedKey: 'user:junia-marrowby',
    name: 'Kitchen Table Jazz',
    label: 'JAZZ / SMALL ROOMS',
    color: '#b5854b',
    recommendedRank: 3,
    createdAt: '2026-06-07T08:45:00.000Z',
    albums: [
      {
        seedKey: 'album:toast-at-midnight',
        title: 'Toast at Midnight',
        artist: 'Ignatius Bellwether Trio',
        year: 1959,
        genre: 'Jazz',
        format: 'LP',
        sleeveColor: '#2e4057',
        rating: 5,
        sides: { A: ['Toast at Midnight', 'Burnt Edges'], B: ['Butter Knife Blues', 'Crumbs'] },
      },
      {
        seedKey: 'album:blue-enamel-kettle',
        title: 'Blue Enamel Kettle',
        artist: 'Ignatius Bellwether Trio',
        year: 1961,
        genre: 'Jazz',
        format: 'LP',
        sleeveColor: '#2f78a8',
        rating: 4,
        sides: { A: ['Slow Boil', 'Whistle Stop Waltz'], B: ['Steam', 'Off the Heat'] },
      },
      {
        seedKey: 'album:waltz-for-a-leaky-faucet',
        title: 'Waltz for a Leaky Faucet',
        artist: 'Cordelia Nightjar Quartet',
        year: 1964,
        genre: 'Jazz',
        format: 'LP',
        sleeveColor: '#7a3e48',
        rating: 5,
        sides: { A: ['Drip in Three', 'Washer Ballad'], B: ['Plumber on Tuesday', 'Quarter Turn'] },
      },
      {
        seedKey: 'album:seconds-at-the-stove',
        title: 'Seconds at the Stove',
        artist: 'Cordelia Nightjar Quartet',
        year: 1966,
        genre: 'Jazz',
        format: 'LP',
        sleeveColor: '#d1b06b',
        rating: 3,
        sides: { A: ['Back Burner', 'Pinch of Something'], B: ['Leftover Bossa', 'Dish Towel'] },
      },
    ],
  },
  {
    seedKey: 'crate:neon-laundromat-disco',
    ownerSeedKey: 'user:lucho-ferndrake',
    name: 'Neon Laundromat Disco',
    label: 'DISCO / SPIN CYCLE',
    color: '#c2587f',
    recommendedRank: 4,
    createdAt: '2026-06-28T21:10:00.000Z',
    albums: [
      {
        seedKey: 'album:spin-cycle-serenade',
        title: 'Spin Cycle Serenade',
        artist: 'Sequin Dispatch',
        year: 1978,
        genre: 'Disco',
        format: '12"',
        sleeveColor: '#e23d8e',
        rating: 5,
        sides: {
          A: ['Spin Cycle Serenade', 'Delicates'],
          B: ['Permanent Press', 'Lint Trap Love'],
        },
      },
      {
        seedKey: 'album:tumble-dry-forever',
        title: 'Tumble Dry Forever',
        artist: 'Sequin Dispatch',
        year: 1979,
        genre: 'Disco',
        format: 'LP',
        sleeveColor: '#6c3fc5',
        rating: 4,
        sides: { A: ['Low Heat', 'Static Cling'], B: ['Odd Sock Hustle', 'Forever on Medium'] },
      },
      {
        seedKey: 'album:quarters-for-the-machine',
        title: 'Quarters for the Machine',
        artist: 'Contessa Velourne',
        year: 1977,
        genre: 'Disco',
        format: 'LP',
        sleeveColor: '#d4a017',
        rating: 4,
        sides: { A: ['Exact Change', 'Coin Slot Boogie'], B: ['Out of Order', 'One More Load'] },
      },
      {
        seedKey: 'album:mirrorball-parking-lot',
        title: 'Mirrorball Parking Lot',
        artist: 'Contessa Velourne',
        year: 1980,
        genre: 'Disco',
        format: 'LP',
        sleeveColor: '#1e8c93',
        rating: 3,
        sides: { A: ['Valet Dreams', 'Level Three'], B: ['Ticket Validated', 'Closing Lights'] },
      },
    ],
  },
  {
    seedKey: 'crate:cassette-porch-folk',
    ownerSeedKey: 'user:priya-hollowmere',
    name: 'Cassette Porch Folk',
    label: 'FOLK / PORCH TAPES',
    color: '#9c8a5e',
    recommendedRank: 5,
    createdAt: '2026-07-14T16:20:00.000Z',
    albums: [
      {
        seedKey: 'album:songs-the-screen-door-knows',
        title: 'Songs the Screen Door Knows',
        artist: 'Hester Fallowmoor',
        year: 1974,
        genre: 'Folk',
        format: 'LP',
        sleeveColor: '#7d8c5a',
        rating: 5,
        sides: { A: ['Slam Soft', 'Moth Light', 'Rusty Hinge'], B: ['Supper Call', 'Latch'] },
      },
      {
        seedKey: 'album:hand-me-down-weather',
        title: 'Hand-Me-Down Weather',
        artist: 'Hester Fallowmoor',
        year: 1976,
        genre: 'Folk',
        format: 'LP',
        sleeveColor: '#a8b5c0',
        rating: 4,
        sides: { A: ['Borrowed Coat', 'Almost Frost'], B: ['Sister Fog', 'Thaw'] },
      },
      {
        seedKey: 'album:creek-bed-hymnal',
        title: 'Creek Bed Hymnal',
        artist: 'The Barley Wardens',
        year: 1972,
        genre: 'Folk',
        format: 'LP',
        sleeveColor: '#55704a',
        rating: 4,
        sides: { A: ['Low Water Psalm', 'Stepping Stones'], B: ['Minnow Choir', 'Dry Season'] },
      },
      {
        seedKey: 'album:old-truck-new-verse',
        title: 'Old Truck, New Verse',
        artist: 'The Barley Wardens',
        year: 1978,
        genre: 'Folk',
        format: 'EP',
        sleeveColor: '#a65e2e',
        rating: 3,
        sides: { A: ['Second Gear', 'Tailgate Song'], B: ['New Verse'] },
      },
    ],
  },
  {
    seedKey: 'crate:overpass-breakbeats',
    ownerSeedKey: 'user:emeka-vossgrove',
    name: 'Overpass Breakbeats',
    label: 'BREAKS / UNDERPASS',
    color: '#5f6b73',
    recommendedRank: 6,
    createdAt: '2026-08-02T23:05:00.000Z',
    albums: [
      {
        seedKey: 'album:concrete-tempo',
        title: 'Concrete Tempo',
        artist: 'Culvert Committee',
        year: 1993,
        genre: 'Breakbeat',
        format: '12"',
        sleeveColor: '#3c4043',
        rating: 4,
        sides: { A: ['Concrete Tempo', 'Rebar'], B: ['Expansion Joint', 'Tempo Dub'] },
      },
      {
        seedKey: 'album:exit-ramp-etude',
        title: 'Exit Ramp Etude',
        artist: 'Culvert Committee',
        year: 1995,
        genre: 'Breakbeat',
        format: 'LP',
        sleeveColor: '#c9a227',
        rating: 5,
        sides: {
          A: ['Merge Left', 'Hard Shoulder'],
          B: ['Exit Ramp Etude', 'Toll Booth Interlude'],
        },
      },
      {
        seedKey: 'album:sample-clearance-pending',
        title: 'Sample Clearance Pending',
        artist: 'Tarmac Nines',
        year: 1996,
        genre: 'Breakbeat',
        format: 'LP',
        sleeveColor: '#b33a3a',
        rating: 4,
        sides: { A: ['Legal Pad', 'Uncredited Drummer'], B: ['Cease and Resist', 'Pending'] },
      },
      {
        seedKey: 'album:hazard-lights-on',
        title: 'Hazard Lights On',
        artist: 'Tarmac Nines',
        year: 1997,
        genre: 'Breakbeat',
        format: '12"',
        sleeveColor: '#e07b00',
        rating: 3,
        sides: { A: ['Hazard Lights On', 'Tow Truck Break'], B: ['Roadside Version'] },
      },
    ],
  },
  {
    seedKey: 'crate:slow-tide-ambient',
    ownerSeedKey: 'user:odessa-quillfern',
    name: 'Slow Tide Ambient',
    label: 'AMBIENT / LOW TIDE',
    color: '#5c8294',
    recommendedRank: 7,
    createdAt: '2026-08-21T05:40:00.000Z',
    albums: [
      {
        seedKey: 'album:low-water-ledger',
        title: 'Low-Water Ledger',
        artist: 'Saltmarsh Instruments',
        year: 1985,
        genre: 'Ambient',
        format: 'LP',
        sleeveColor: '#8fb0ba',
        rating: 5,
        sides: { A: ['Entry One: Mud'], B: ['Entry Two: Silt', 'Balance Carried Over'] },
      },
      {
        seedKey: 'album:fog-signal-studies',
        title: 'Fog Signal Studies',
        artist: 'Saltmarsh Instruments',
        year: 1987,
        genre: 'Ambient',
        format: 'LP',
        sleeveColor: '#c5cdd1',
        rating: 4,
        sides: { A: ['Study for Horn', 'Study for Bell'], B: ['Study for No One'] },
      },
      {
        seedKey: 'album:ebb-clock-for-sleepers',
        title: 'Ebb Clock for Sleepers',
        artist: 'Ondine Carrowgate',
        year: 1990,
        genre: 'Ambient',
        format: 'LP',
        sleeveColor: '#2b4c5e',
        rating: 4,
        sides: { A: ['Twelve Hours Out'], B: ['Twelve Hours Back', 'Slack Water'] },
      },
      {
        seedKey: 'album:buoy-music',
        title: 'Buoy Music',
        artist: 'Ondine Carrowgate',
        year: 1992,
        genre: 'Ambient',
        format: 'EP',
        sleeveColor: '#d0572f',
        rating: 3,
        sides: { A: ['Red Buoy, Left'], B: ['Green Buoy, Right'] },
      },
    ],
  },
  {
    seedKey: 'crate:garage-fuzz-receipts',
    ownerSeedKey: 'user:tomasz-brindlewick',
    name: 'Garage Fuzz Receipts',
    label: 'GARAGE / LOUD',
    color: '#a14f3c',
    createdAt: '2026-09-11T19:50:00.000Z',
    albums: [
      {
        seedKey: 'album:three-chords-no-refunds',
        title: 'Three Chords, No Refunds',
        artist: 'The Rusted Valets',
        year: 1966,
        genre: 'Garage Rock',
        format: 'LP',
        sleeveColor: '#7f1d1d',
        rating: 5,
        sides: { A: ['Store Credit', 'Keep Your Stub'], B: ['All Sales Final', 'Third Chord'] },
      },
      {
        seedKey: 'album:blown-fuse-boogie',
        title: 'Blown Fuse Boogie',
        artist: 'The Rusted Valets',
        year: 1967,
        genre: 'Garage Rock',
        format: '7"',
        sleeveColor: '#111827',
        rating: 4,
        sides: { A: ['Blown Fuse Boogie'], B: ['Flashlight Stomp'] },
      },
      {
        seedKey: 'album:oil-slick-romance',
        title: 'Oil Slick Romance',
        artist: 'Gutterball Regents',
        year: 1965,
        genre: 'Garage Rock',
        format: 'LP',
        sleeveColor: '#374151',
        rating: 3,
        sides: { A: ['Dipstick Baby', 'Under the Hood'], B: ['Jack Stand', 'Rainbow Puddle'] },
      },
      {
        seedKey: 'album:loud-enough-for-dad',
        title: 'Loud Enough for Dad',
        artist: 'Gutterball Regents',
        year: 1968,
        genre: 'Garage Rock',
        format: 'EP',
        sleeveColor: '#b45309',
        rating: 4,
        sides: { A: ['Turn It Down', 'Door Slam'], B: ['Grounded Again'] },
      },
    ],
  },
  {
    seedKey: 'crate:church-hall-soul',
    ownerSeedKey: 'user:maren-oxtuft',
    name: 'Church Hall Soul',
    label: 'SOUL / SIDE B ONLY',
    color: '#7b5d8c',
    createdAt: '2026-10-03T14:25:00.000Z',
    albums: [
      {
        seedKey: 'album:folding-seat-testimony',
        title: 'Folding Seat Testimony',
        artist: 'The Sunday Tollmen',
        year: 1969,
        genre: 'Soul',
        format: 'LP',
        sleeveColor: '#92400e',
        rating: 5,
        sides: { A: ['Stack Them Up', 'Row Nine'], B: ['Testify Quietly', 'Hall Booked Till Ten'] },
      },
      {
        seedKey: 'album:coffee-urn-gospel',
        title: 'Coffee Urn Gospel',
        artist: 'The Sunday Tollmen',
        year: 1971,
        genre: 'Soul',
        format: 'LP',
        sleeveColor: '#57534e',
        rating: 4,
        sides: { A: ['Two Sugars', 'Polystyrene Cup'], B: ['Refill My Soul', 'Lukewarm'] },
      },
      {
        seedKey: 'album:bake-sale-heartbreak',
        title: 'Bake Sale Heartbreak',
        artist: 'Ruthanne Merriweld',
        year: 1968,
        genre: 'Soul',
        format: '7"',
        sleeveColor: '#db7093',
        rating: 4,
        sides: { A: ['Bake Sale Heartbreak'], B: ['Lemon Bars Alone'] },
      },
      {
        seedKey: 'album:last-pew-on-the-left',
        title: 'Last Pew on the Left',
        artist: 'Ruthanne Merriweld',
        year: 1970,
        genre: 'Soul',
        format: 'LP',
        sleeveColor: '#4338ca',
        rating: 5,
        sides: {
          A: ['Hymn Book Sharing', 'Collection Plate'],
          B: ['Back Row Prayer', 'Amen, Then'],
        },
      },
    ],
  },
]

export const DEMO_NEWS: DemoNewsItem[] = [
  {
    seedKey: 'news:mossbank-tin-roof-reissue',
    title: 'Mossbank Hi-Fi plan a heavy reissue of Tin Roof Version',
    summary:
      'Quince Hollow Records will repress the 1981 dub set from the original lacquers, with a ' +
      'hand-stamped sleeve and no bonus tracks, at the band’s firm request.',
    source: 'Wax Almanack Weekly',
    publishedAt: '2026-10-27T09:00:00.000Z',
  },
  {
    seedKey: 'news:gullwick-palais-sequin-dispatch',
    title: 'Sequin Dispatch reunite for one night at the Gullwick Palais',
    summary:
      'The disco outfit will play Tumble Dry Forever in full under the Palais mirrorball. ' +
      'Organisers ask dancers to bring their own quarters for the cloakroom.',
    source: 'The Needle Gazetteer',
    publishedAt: '2026-10-19T17:30:00.000Z',
  },
  {
    seedKey: 'news:brackenmoor-third-press',
    title: 'Brackenmoor Disc Works switches on a third press',
    summary:
      'The small pressing plant says the backlog of short runs has reached eleven months, ' +
      'and that its second-hand press still only runs properly when it is warm outside.',
    source: 'Platter Parish Bulletin',
    publishedAt: '2026-10-11T11:15:00.000Z',
  },
  {
    seedKey: 'news:fallowmoor-porch-tapes',
    title: 'Lost Hester Fallowmoor porch tapes turn up in a biscuit tin',
    summary:
      'Fourteen cassettes from the Hand-Me-Down Weather sessions were found during a house ' +
      'clearance in Ostermere. Crickets are audible on most of them and will stay in the mix.',
    source: 'Dustsleeve Dispatch',
    publishedAt: '2026-10-02T08:45:00.000Z',
  },
  {
    seedKey: 'news:tollbridge-swap-night',
    title: 'Tollbridge Roller Hall to host an all-night 45s swap',
    summary:
      'Sellers get a trestle table, buyers get a pair of skates if they want them. The hall ' +
      'warns that nobody has yet managed to flip through a box while moving.',
    source: 'The Needle Gazetteer',
    publishedAt: '2026-09-23T19:00:00.000Z',
  },
  {
    seedKey: 'news:merriweld-hall-sessions',
    title: 'Ruthanne Merriweld church hall sessions finally pressed',
    summary:
      'Ninefold Pressing has licensed the 1970 rehearsal reels, recorded on a single microphone ' +
      'hung from the rafters. A bake sale at the launch will fund the sleeve printing.',
    source: 'Wax Almanack Weekly',
    publishedAt: '2026-09-14T10:20:00.000Z',
  },
  {
    seedKey: 'news:ostermere-fair-mislabelled',
    title: 'Ostermere record fair crowns its most mislabelled sleeve',
    summary:
      'A copy of Marmalade Sextant found inside a sleeve for a brass band Christmas album took ' +
      'this year’s prize. The dealer who sold it has asked for it back.',
    source: 'Platter Parish Bulletin',
    publishedAt: '2026-09-02T15:40:00.000Z',
  },
  {
    seedKey: 'news:culvert-committee-repress',
    title: 'Culvert Committee repress Exit Ramp Etude after years of bootlegs',
    summary:
      'The group say the new cut is the first to include the toll booth interlude at its proper ' +
      'length. Every earlier copy, they add, was mastered from a tape left in a van.',
    source: 'Dustsleeve Dispatch',
    publishedAt: '2026-08-24T13:05:00.000Z',
  },
  {
    seedKey: 'news:saltmarsh-pellmouth-lighthouse',
    title: 'Saltmarsh Instruments to score the Pellmouth lighthouse open day',
    summary:
      'The ambient duo will play Fog Signal Studies from the lamp room, timed to the tide. ' +
      'Visitors are told to bring a coat, and that the set lasts as long as the water does.',
    source: 'Wax Almanack Weekly',
    publishedAt: '2026-08-12T07:30:00.000Z',
  },
]
