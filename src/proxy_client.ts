import {
	Notification,
	PoolClient,
	QueryArrayConfig,
	QueryArrayResult,
	QueryConfig,
	QueryResult,
	QueryResultRow,
	Submittable
} from 'pg'
import { NoticeMessage } from 'pg-protocol/dist/messages'
import stream from 'stream'

/* eslint @typescript-eslint/ban-types: 0 */
/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint node/no-unpublished-import: 0 */
/* eslint @typescript-eslint/explicit-module-boundary-types: 0 */

export class ProxyClient implements PoolClient {
	released = false

	private releaseCheck() {
		if (this.released) {
			throw new Error(`client already released`)
		}
	}

	public constructor(readonly client: PoolClient) {}

	// EventEmitter implementation
	addListener(
		event: string | symbol,
		listener: (...args: any[]) => void
	): this {
		this.releaseCheck()
		return this.client.addListener(event, listener) as this
	}

	once(event: string | symbol, listener: (...args: any[]) => void): this {
		this.releaseCheck()
		return this.client.once(event, listener) as this
	}

	removeListener(
		event: string | symbol,
		listener: (...args: any[]) => void
	): this {
		this.releaseCheck()
		return this.client.removeListener(event, listener) as this
	}

	off(event: string | symbol, listener: (...args: any[]) => void): this {
		this.releaseCheck()
		return this.client.off(event, listener) as this
	}

	removeAllListeners(event?: string | symbol): this {
		this.releaseCheck()
		return this.client.removeAllListeners(event) as this
	}
	setMaxListeners(n: number): this {
		this.releaseCheck()
		return this.client.setMaxListeners(n) as this
	}
	getMaxListeners(): number {
		this.releaseCheck()
		return this.client.getMaxListeners()
	}

	listeners(event: string | symbol): Function[] {
		this.releaseCheck()
		return this.client.listeners(event)
	}

	rawListeners(event: string | symbol): Function[] {
		this.releaseCheck()
		return this.client.rawListeners(event)
	}

	emit(event: string | symbol, ...args: any[]): boolean {
		this.releaseCheck()
		return this.client.emit(event, args)
	}

	listenerCount(event: string | symbol): number {
		this.releaseCheck()
		return this.client.listenerCount(event)
	}

	prependListener(
		event: string | symbol,
		listener: (...args: any[]) => void
	): this {
		this.releaseCheck()
		return this.client.prependListener(event, listener) as this
	}

	prependOnceListener(
		event: string | symbol,
		listener: (...args: any[]) => void
	): this {
		this.releaseCheck()
		return this.client.prependOnceListener(event, listener) as this
	}

	eventNames(): Array<string | symbol> {
		this.releaseCheck()
		return this.client.eventNames()
	}

	// ClientBase implementation

	connect(): Promise<void>
	connect(callback: (err: Error) => void): void
	connect(_?: any): any {
		throw new Error(`proxy client cannot connect`)
	}

	query<T extends Submittable>(queryStream: T): T
	// tslint:disable:no-unnecessary-generics
	query<R extends any[] = any[], I extends any[] = any[]>(
		queryConfig: QueryArrayConfig<I>,
		values?: I
	): Promise<QueryArrayResult<R>>
	query<R extends QueryResultRow = any, I extends any[] = any[]>(
		queryConfig: QueryConfig<I>
	): Promise<QueryResult<R>>
	query<R extends QueryResultRow = any, I extends any[] = any[]>(
		queryTextOrConfig: string | QueryConfig<I>,
		values?: I
	): Promise<QueryResult<R>>
	query<R extends any[] = any[], I extends any[] = any[]>(
		queryConfig: QueryArrayConfig<I>,
		callback: (err: Error, result: QueryArrayResult<R>) => void
	): void
	query<R extends QueryResultRow = any, I extends any[] = any[]>(
		queryTextOrConfig: string | QueryConfig<I>,
		callback: (err: Error, result: QueryResult<R>) => void
	): void
	query<R extends QueryResultRow = any>(
		queryText: string,
		values: any[],
		callback: (err: Error, result: QueryResult<R>) => void
	): void
	query(param1: any, param2?: any, param3?: any): any {
		this.releaseCheck()
		return this.client.query(param1, param2, param3)
	}

	copyFrom(queryText: string): stream.Writable {
		this.releaseCheck()
		return this.client.copyFrom(queryText)
	}

	copyTo(queryText: string): stream.Readable {
		this.releaseCheck()
		return this.client.copyTo(queryText)
	}

	pauseDrain(): void {
		this.releaseCheck()
		return this.client.pauseDrain()
	}

	resumeDrain(): void {
		this.releaseCheck()
		return this.client.resumeDrain()
	}
	escapeIdentifier(str: string): string {
		this.releaseCheck()
		return this.client.escapeIdentifier(str)
	}

	escapeLiteral(str: string): string {
		this.releaseCheck()
		return this.client.escapeLiteral(str)
	}

	on(event: 'drain', listener: () => void): this
	on(event: 'error', listener: (err: Error) => void): this
	on(event: 'notice', listener: (notice: NoticeMessage) => void): this
	on(event: 'notification', listener: (message: Notification) => void): this
	// tslint:disable-next-line unified-signatures
	on(event: 'end', listener: () => void): this
	on(param1: any, param2: any): any {
		this.releaseCheck()
		return this.client.on(param1, param2)
	}

	// PoolClient implementation

	release(err?: Error | boolean): void {
		this.releaseCheck()
		this.released = true
		this.client.release(err)
	}
}
