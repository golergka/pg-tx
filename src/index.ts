import { ClientBase, Pool, PoolClient } from 'pg'
import { ProxyClient } from './proxy_client'

async function getTxId(client: ClientBase) {
	const {
		rows: [{ txid }]
	} = await client.query(`SELECT txid_current() AS "txid"`)
	return txid
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPoolClient(p: any): p is PoolClient {
	return typeof p['release'] === 'function'
}

/**
 * @param pg node postgres pool
 * @param callback callback that will use provided transaction client
 * @param forceRollback force rollback even without errors - useful for tests
 * @returns
 */
export default async function tx<T>(
	pg: Pool | PoolClient,
	callback: (db: PoolClient) => Promise<T>,
	forceRollback?: boolean
): Promise<T> {
	let connected
	let client: PoolClient
	if (isPoolClient(pg)) {
		client = pg
		connected = false
	} else {
		client = await pg.connect()
		connected = true
	}

	const proxyClient = new ProxyClient(client)
	let startedTransaction

	if (connected) {
		await proxyClient.query(`BEGIN`)
		startedTransaction = true
	} else {
		const preBeginTxId = await getTxId(proxyClient)
		await proxyClient.query(`BEGIN`)
		const postBeginTxId = await getTxId(proxyClient)
		startedTransaction = preBeginTxId !== postBeginTxId
		if (!startedTransaction) {
			await proxyClient.query(`SAVEPOINT pg_tx`)
		}
	}

	try {
		const result = await callback(proxyClient)
		proxyClient.proxyRelease()
		if (startedTransaction) {
			await client.query(forceRollback ? `ROLLBACK` : `COMMIT`)
		} else {
			if (forceRollback) {
				await client.query(`ROLLBACK TO SAVEPOINT pg_tx`)
			}
			await client.query(`RELEASE SAVEPOINT pg_tx`)
		}
		return result
	} catch (e) {
		proxyClient.proxyRelease()
		if (startedTransaction) {
			await client.query(`ROLLBACK`)
		} else {
			await client.query(`ROLLBACK TO SAVEPOINT pg_tx`)
			await client.query(`RELEASE SAVEPOINT pg_tx`)
		}
		throw e
	} finally {
		if (connected) {
			client.release()
		}
	}
}
