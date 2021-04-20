import { Pool } from "pg"
import { tx } from "."

describe(`tx`, () => {
  let pg: Pool

  beforeAll(async () => {
    const { POSTGRES_URL } = process.env

    if (!POSTGRES_URL) {
      throw new Error('Must specify POSTGRES_URL')
    }

    pg = new Pool({ connectionString: POSTGRES_URL })

    await pg.query(`CREATE TABLE things (
      id SERIAL PRIMARY KEY,
      thing TEXT NOT NULL
    )`)
  })
  afterAll(async () => {
    await pg.query(`DROP TABLE THINGS`)
    await pg.end()
  })

  it(`commits changes when there's no error`, async () => {
    await tx(pg, async (db) => {
      db.query(`INSERT INTO things (thing) VALUES ('comitted')`)
    })
    const {rows: [committed]} = await pg.query(`SELECT id, thing FROM things WHERE thing = 'comitted'`)
    expect(committed).toBeDefined()
    expect(committed.thing).toEqual('comitted')
  })
})