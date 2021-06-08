import { ClientBase, PoolClient } from 'pg'
import { ClientDetails, ClientMode } from './client'

async function getTxId(client: ClientBase) {
	const {
		rows: [{ txid }]
	} = await client.query(`SELECT txid_current() AS "txid"`)
	return txid
}

/**
 * How have we implemented transaction - with database transaction or with a
 * savepoint
 */
enum TransactionMode {
	Transaction,
	Savepoint
}

export async function beginTransaction({
	client,
	clientMode
}: ClientDetails): Promise<TransactionMode> {
	switch (clientMode) {
		case ClientMode.Connected: /**
		 * If it's a client that we connected, we can be sure we can use it for a
		 * transaction
		 */ {
			await client.query(`BEGIN`)
			return TransactionMode.Transaction
		}
		case ClientMode.Provided: /**
		 * If it's a client that has been provided to us, we have to check if we
		 * actually start a new transaction, and revert to savepoints
		 */ {
			const preBeginTxId = await getTxId(client)
			await client.query(`BEGIN`)
			const postBeginTxId = await getTxId(client)
			const transactionMode =
				preBeginTxId !== postBeginTxId
					? TransactionMode.Transaction
					: TransactionMode.Savepoint
			if (transactionMode === TransactionMode.Savepoint) {
				await client.query(`SAVEPOINT pg_tx`)
			}
			return transactionMode
		}
	}
}

interface TransactionDetails {
	client: PoolClient
	transactionMode: TransactionMode
}

export function commitTransaction({
	client,
	transactionMode
}: TransactionDetails): Promise<unknown> {
	switch (transactionMode) {
		case TransactionMode.Transaction:
			return client.query(`COMMIT`)
		case TransactionMode.Savepoint:
			return client.query(`RELEASE SAVEPOINT pg_tx`)
	}
}

export async function cancelTransaction({
	client,
	transactionMode
}: TransactionDetails): Promise<unknown> {
	switch (transactionMode) {
		case TransactionMode.Transaction:
			return client.query(`ROLLBACK`)
		case TransactionMode.Savepoint:
			await client.query(`ROLLBACK TO SAVEPOINT pg_tx`)
			await client.query(`RELEASE SAVEPOINT pg_tx`)
			break
	}
}
