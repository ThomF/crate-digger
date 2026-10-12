import { createDb } from './client.js'
import { albums, crates, tracks, type NewAlbum } from './schema.js'

// Wipes the database and fills it with sample records. Run with: npm run db:seed

type SeedAlbum = Omit<NewAlbum, 'crateId' | 'position'> & {
  sides?: Partial<Record<'A' | 'B' | 'C' | 'D', string[]>>
}

const SEED: { name: string; label: string; color: string; albums: SeedAlbum[] }[] = [
  {
    name: 'Guitars',
    label: 'ROCK / ALT',
    color: '#c8a374',
    albums: [
      {
        title: 'Nevermind',
        artist: 'Nirvana',
        year: 1991,
        genre: 'Grunge',
        rating: 5,
        sleeveColor: '#2f6fa3',
        sides: {
          A: [
            'Smells Like Teen Spirit',
            'In Bloom',
            'Come as You Are',
            'Breed',
            'Lithium',
            'Polly',
          ],
          B: [
            'Territorial Pissings',
            'Drain You',
            'Lounge Act',
            'Stay Away',
            'On a Plain',
            'Something in the Way',
          ],
        },
      },
      {
        title: 'OK Computer',
        artist: 'Radiohead',
        year: 1997,
        genre: 'Alternative',
        rating: 5,
        sleeveColor: '#9fb7c9',
        notes: 'Gatefold 2LP. Play side C late at night.',
        sides: {
          A: ['Airbag', 'Paranoid Android', 'Subterranean Homesick Alien'],
          B: ['Exit Music (For a Film)', 'Let Down', 'Karma Police'],
          C: ['Fitter Happier', 'Electioneering', 'Climbing Up the Walls', 'No Surprises'],
          D: ['Lucky', 'The Tourist'],
        },
      },
      {
        title: 'Weezer (Blue Album)',
        artist: 'Weezer',
        year: 1994,
        genre: 'Power Pop',
        rating: 4,
        sleeveColor: '#3b8fd9',
        sides: {
          A: [
            'My Name Is Jonas',
            'No One Else',
            'The World Has Turned and Left Me Here',
            'Buddy Holly',
            'Undone – The Sweater Song',
          ],
          B: ['Surf Wax America', "Say It Ain't So", 'In the Garage', 'Holiday', 'Only in Dreams'],
        },
      },
      {
        title: 'Odelay',
        artist: 'Beck',
        year: 1996,
        genre: 'Alternative',
        rating: 4,
        sleeveColor: '#e0b43c',
        sides: {
          A: [
            'Devils Haircut',
            'Hotwax',
            'Lord Only Knows',
            'The New Pollution',
            'Derelict',
            'Novacane',
          ],
          B: [
            'Jack-Ass',
            "Where It's At",
            'Minus',
            'Sissyneck',
            'Readymade',
            'High 5 (Rock the Catskills)',
            'Ramshackle',
          ],
        },
      },
    ],
  },
  {
    name: 'Beats & Bass',
    label: 'HIP-HOP / TRIP-HOP',
    color: '#a67c52',
    albums: [
      {
        title: 'The Low End Theory',
        artist: 'A Tribe Called Quest',
        year: 1991,
        genre: 'Hip-Hop',
        rating: 5,
        sleeveColor: '#c0392b',
        sides: {
          A: [
            'Excursions',
            "Buggin' Out",
            'Rap Promoter',
            'Butter',
            'Verses from the Abstract',
            'Show Business',
            'Vibes and Stuff',
          ],
          B: [
            'The Infamous Date Rape',
            'Check the Rhime',
            'Everything Is Fair',
            "Jazz (We've Got)",
            'Skypager',
            'What?',
            'Scenario',
          ],
        },
      },
      {
        title: 'Ready to Die',
        artist: 'The Notorious B.I.G.',
        year: 1994,
        genre: 'Hip-Hop',
        rating: 5,
        sleeveColor: '#f1f1f1',
        notes: 'Tracklist still to add.',
      },
      {
        title: 'The Miseducation of Lauryn Hill',
        artist: 'Lauryn Hill',
        year: 1998,
        genre: 'R&B',
        rating: 5,
        sleeveColor: '#8b6b4a',
      },
      {
        title: 'Dummy',
        artist: 'Portishead',
        year: 1994,
        genre: 'Trip-Hop',
        rating: 5,
        sleeveColor: '#5a2a6e',
        sides: {
          A: ['Mysterons', 'Sour Times', 'Strangers', 'It Could Be Sweet', 'Wandering Star'],
          B: ["It's a Fire", 'Numb', 'Roads', 'Pedestal', 'Biscuit', 'Glory Box'],
        },
      },
      {
        title: 'Mezzanine',
        artist: 'Massive Attack',
        year: 1998,
        genre: 'Trip-Hop',
        rating: 4,
        sleeveColor: '#1d1d1d',
        sides: {
          A: ['Angel', 'Risingson', 'Teardrop'],
          B: ['Inertia Creeps', 'Exchange', 'Dissolved Girl'],
          C: ['Man Next Door', 'Black Milk', 'Mezzanine'],
          D: ['Group Four', '(Exchange)'],
        },
      },
      {
        title: 'Debut',
        artist: 'Björk',
        year: 1993,
        genre: 'Electronic',
        rating: 4,
        sleeveColor: '#e8e2d6',
        sides: {
          A: [
            'Human Behaviour',
            'Crying',
            'Venus as a Boy',
            "There's More to Life Than This",
            'Like Someone in Love',
          ],
          B: [
            'Big Time Sensuality',
            'One Day',
            'Aeroplane',
            'Come to Me',
            'Violently Happy',
            'The Anchor Song',
          ],
        },
      },
    ],
  },
]

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV is production and seeding wipes all data.')
  process.exit(1)
}

const { db, close } = createDb()

// One transaction: either everything is replaced, or nothing changes.
db.transaction((tx) => {
  tx.delete(tracks).run()
  tx.delete(albums).run()
  tx.delete(crates).run()

  SEED.forEach((crateSeed, crateIndex) => {
    const crate = tx
      .insert(crates)
      .values({
        name: crateSeed.name,
        label: crateSeed.label,
        color: crateSeed.color,
        sortOrder: crateIndex,
      })
      .returning()
      .get()

    crateSeed.albums.forEach(({ sides, ...albumSeed }, albumIndex) => {
      const album = tx
        .insert(albums)
        .values({ ...albumSeed, crateId: crate.id, position: albumIndex })
        .returning()
        .get()

      const trackRows = Object.entries(sides ?? {}).flatMap(([side, titles]) =>
        titles.map((title, i) => ({
          albumId: album.id,
          side: side as 'A' | 'B' | 'C' | 'D',
          position: i + 1,
          title,
        })),
      )
      if (trackRows.length > 0) tx.insert(tracks).values(trackRows).run()
    })
  })
})

const counts = {
  crates: await db.$count(crates),
  albums: await db.$count(albums),
  tracks: await db.$count(tracks),
}
console.log(`Seeded ${counts.crates} crates, ${counts.albums} albums, ${counts.tracks} tracks.`)
close()
