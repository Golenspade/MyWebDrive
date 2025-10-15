
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model UploadSession
 * 
 */
export type UploadSession = $Result.DefaultSelection<Prisma.$UploadSessionPayload>
/**
 * Model DownloadEvent
 * 
 */
export type DownloadEvent = $Result.DefaultSelection<Prisma.$DownloadEventPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more UploadSessions
 * const uploadSessions = await prisma.uploadSession.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more UploadSessions
   * const uploadSessions = await prisma.uploadSession.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.uploadSession`: Exposes CRUD operations for the **UploadSession** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UploadSessions
    * const uploadSessions = await prisma.uploadSession.findMany()
    * ```
    */
  get uploadSession(): Prisma.UploadSessionDelegate<ExtArgs>;

  /**
   * `prisma.downloadEvent`: Exposes CRUD operations for the **DownloadEvent** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DownloadEvents
    * const downloadEvents = await prisma.downloadEvent.findMany()
    * ```
    */
  get downloadEvent(): Prisma.DownloadEventDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    UploadSession: 'UploadSession',
    DownloadEvent: 'DownloadEvent'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "uploadSession" | "downloadEvent"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      UploadSession: {
        payload: Prisma.$UploadSessionPayload<ExtArgs>
        fields: Prisma.UploadSessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UploadSessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UploadSessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>
          }
          findFirst: {
            args: Prisma.UploadSessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UploadSessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>
          }
          findMany: {
            args: Prisma.UploadSessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>[]
          }
          create: {
            args: Prisma.UploadSessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>
          }
          createMany: {
            args: Prisma.UploadSessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UploadSessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>[]
          }
          delete: {
            args: Prisma.UploadSessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>
          }
          update: {
            args: Prisma.UploadSessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>
          }
          deleteMany: {
            args: Prisma.UploadSessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UploadSessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UploadSessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UploadSessionPayload>
          }
          aggregate: {
            args: Prisma.UploadSessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUploadSession>
          }
          groupBy: {
            args: Prisma.UploadSessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<UploadSessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.UploadSessionCountArgs<ExtArgs>
            result: $Utils.Optional<UploadSessionCountAggregateOutputType> | number
          }
        }
      }
      DownloadEvent: {
        payload: Prisma.$DownloadEventPayload<ExtArgs>
        fields: Prisma.DownloadEventFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DownloadEventFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DownloadEventFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>
          }
          findFirst: {
            args: Prisma.DownloadEventFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DownloadEventFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>
          }
          findMany: {
            args: Prisma.DownloadEventFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>[]
          }
          create: {
            args: Prisma.DownloadEventCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>
          }
          createMany: {
            args: Prisma.DownloadEventCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DownloadEventCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>[]
          }
          delete: {
            args: Prisma.DownloadEventDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>
          }
          update: {
            args: Prisma.DownloadEventUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>
          }
          deleteMany: {
            args: Prisma.DownloadEventDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DownloadEventUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.DownloadEventUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DownloadEventPayload>
          }
          aggregate: {
            args: Prisma.DownloadEventAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDownloadEvent>
          }
          groupBy: {
            args: Prisma.DownloadEventGroupByArgs<ExtArgs>
            result: $Utils.Optional<DownloadEventGroupByOutputType>[]
          }
          count: {
            args: Prisma.DownloadEventCountArgs<ExtArgs>
            result: $Utils.Optional<DownloadEventCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model UploadSession
   */

  export type AggregateUploadSession = {
    _count: UploadSessionCountAggregateOutputType | null
    _avg: UploadSessionAvgAggregateOutputType | null
    _sum: UploadSessionSumAggregateOutputType | null
    _min: UploadSessionMinAggregateOutputType | null
    _max: UploadSessionMaxAggregateOutputType | null
  }

  export type UploadSessionAvgAggregateOutputType = {
    fileSize: number | null
    chunkSize: number | null
    totalChunks: number | null
  }

  export type UploadSessionSumAggregateOutputType = {
    fileSize: number | null
    chunkSize: number | null
    totalChunks: number | null
  }

  export type UploadSessionMinAggregateOutputType = {
    id: string | null
    fileName: string | null
    fileSize: number | null
    mimeType: string | null
    chunkSize: number | null
    totalChunks: number | null
    uploadedChunks: string | null
    chunkMd5s: string | null
    ownerId: string | null
    status: string | null
    storagePath: string | null
    md5Hash: string | null
    createdAt: Date | null
    updatedAt: Date | null
    expiresAt: Date | null
  }

  export type UploadSessionMaxAggregateOutputType = {
    id: string | null
    fileName: string | null
    fileSize: number | null
    mimeType: string | null
    chunkSize: number | null
    totalChunks: number | null
    uploadedChunks: string | null
    chunkMd5s: string | null
    ownerId: string | null
    status: string | null
    storagePath: string | null
    md5Hash: string | null
    createdAt: Date | null
    updatedAt: Date | null
    expiresAt: Date | null
  }

  export type UploadSessionCountAggregateOutputType = {
    id: number
    fileName: number
    fileSize: number
    mimeType: number
    chunkSize: number
    totalChunks: number
    uploadedChunks: number
    chunkMd5s: number
    ownerId: number
    status: number
    storagePath: number
    md5Hash: number
    createdAt: number
    updatedAt: number
    expiresAt: number
    _all: number
  }


  export type UploadSessionAvgAggregateInputType = {
    fileSize?: true
    chunkSize?: true
    totalChunks?: true
  }

  export type UploadSessionSumAggregateInputType = {
    fileSize?: true
    chunkSize?: true
    totalChunks?: true
  }

  export type UploadSessionMinAggregateInputType = {
    id?: true
    fileName?: true
    fileSize?: true
    mimeType?: true
    chunkSize?: true
    totalChunks?: true
    uploadedChunks?: true
    chunkMd5s?: true
    ownerId?: true
    status?: true
    storagePath?: true
    md5Hash?: true
    createdAt?: true
    updatedAt?: true
    expiresAt?: true
  }

  export type UploadSessionMaxAggregateInputType = {
    id?: true
    fileName?: true
    fileSize?: true
    mimeType?: true
    chunkSize?: true
    totalChunks?: true
    uploadedChunks?: true
    chunkMd5s?: true
    ownerId?: true
    status?: true
    storagePath?: true
    md5Hash?: true
    createdAt?: true
    updatedAt?: true
    expiresAt?: true
  }

  export type UploadSessionCountAggregateInputType = {
    id?: true
    fileName?: true
    fileSize?: true
    mimeType?: true
    chunkSize?: true
    totalChunks?: true
    uploadedChunks?: true
    chunkMd5s?: true
    ownerId?: true
    status?: true
    storagePath?: true
    md5Hash?: true
    createdAt?: true
    updatedAt?: true
    expiresAt?: true
    _all?: true
  }

  export type UploadSessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UploadSession to aggregate.
     */
    where?: UploadSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UploadSessions to fetch.
     */
    orderBy?: UploadSessionOrderByWithRelationInput | UploadSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UploadSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UploadSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UploadSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UploadSessions
    **/
    _count?: true | UploadSessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UploadSessionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UploadSessionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UploadSessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UploadSessionMaxAggregateInputType
  }

  export type GetUploadSessionAggregateType<T extends UploadSessionAggregateArgs> = {
        [P in keyof T & keyof AggregateUploadSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUploadSession[P]>
      : GetScalarType<T[P], AggregateUploadSession[P]>
  }




  export type UploadSessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UploadSessionWhereInput
    orderBy?: UploadSessionOrderByWithAggregationInput | UploadSessionOrderByWithAggregationInput[]
    by: UploadSessionScalarFieldEnum[] | UploadSessionScalarFieldEnum
    having?: UploadSessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UploadSessionCountAggregateInputType | true
    _avg?: UploadSessionAvgAggregateInputType
    _sum?: UploadSessionSumAggregateInputType
    _min?: UploadSessionMinAggregateInputType
    _max?: UploadSessionMaxAggregateInputType
  }

  export type UploadSessionGroupByOutputType = {
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    chunkSize: number
    totalChunks: number
    uploadedChunks: string
    chunkMd5s: string | null
    ownerId: string
    status: string
    storagePath: string | null
    md5Hash: string | null
    createdAt: Date
    updatedAt: Date
    expiresAt: Date
    _count: UploadSessionCountAggregateOutputType | null
    _avg: UploadSessionAvgAggregateOutputType | null
    _sum: UploadSessionSumAggregateOutputType | null
    _min: UploadSessionMinAggregateOutputType | null
    _max: UploadSessionMaxAggregateOutputType | null
  }

  type GetUploadSessionGroupByPayload<T extends UploadSessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UploadSessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UploadSessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UploadSessionGroupByOutputType[P]>
            : GetScalarType<T[P], UploadSessionGroupByOutputType[P]>
        }
      >
    >


  export type UploadSessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileName?: boolean
    fileSize?: boolean
    mimeType?: boolean
    chunkSize?: boolean
    totalChunks?: boolean
    uploadedChunks?: boolean
    chunkMd5s?: boolean
    ownerId?: boolean
    status?: boolean
    storagePath?: boolean
    md5Hash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    expiresAt?: boolean
  }, ExtArgs["result"]["uploadSession"]>

  export type UploadSessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileName?: boolean
    fileSize?: boolean
    mimeType?: boolean
    chunkSize?: boolean
    totalChunks?: boolean
    uploadedChunks?: boolean
    chunkMd5s?: boolean
    ownerId?: boolean
    status?: boolean
    storagePath?: boolean
    md5Hash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    expiresAt?: boolean
  }, ExtArgs["result"]["uploadSession"]>

  export type UploadSessionSelectScalar = {
    id?: boolean
    fileName?: boolean
    fileSize?: boolean
    mimeType?: boolean
    chunkSize?: boolean
    totalChunks?: boolean
    uploadedChunks?: boolean
    chunkMd5s?: boolean
    ownerId?: boolean
    status?: boolean
    storagePath?: boolean
    md5Hash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    expiresAt?: boolean
  }


  export type $UploadSessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UploadSession"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      fileName: string
      fileSize: number
      mimeType: string
      chunkSize: number
      totalChunks: number
      uploadedChunks: string
      chunkMd5s: string | null
      ownerId: string
      status: string
      storagePath: string | null
      md5Hash: string | null
      createdAt: Date
      updatedAt: Date
      expiresAt: Date
    }, ExtArgs["result"]["uploadSession"]>
    composites: {}
  }

  type UploadSessionGetPayload<S extends boolean | null | undefined | UploadSessionDefaultArgs> = $Result.GetResult<Prisma.$UploadSessionPayload, S>

  type UploadSessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UploadSessionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UploadSessionCountAggregateInputType | true
    }

  export interface UploadSessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UploadSession'], meta: { name: 'UploadSession' } }
    /**
     * Find zero or one UploadSession that matches the filter.
     * @param {UploadSessionFindUniqueArgs} args - Arguments to find a UploadSession
     * @example
     * // Get one UploadSession
     * const uploadSession = await prisma.uploadSession.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UploadSessionFindUniqueArgs>(args: SelectSubset<T, UploadSessionFindUniqueArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one UploadSession that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UploadSessionFindUniqueOrThrowArgs} args - Arguments to find a UploadSession
     * @example
     * // Get one UploadSession
     * const uploadSession = await prisma.uploadSession.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UploadSessionFindUniqueOrThrowArgs>(args: SelectSubset<T, UploadSessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first UploadSession that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UploadSessionFindFirstArgs} args - Arguments to find a UploadSession
     * @example
     * // Get one UploadSession
     * const uploadSession = await prisma.uploadSession.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UploadSessionFindFirstArgs>(args?: SelectSubset<T, UploadSessionFindFirstArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first UploadSession that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UploadSessionFindFirstOrThrowArgs} args - Arguments to find a UploadSession
     * @example
     * // Get one UploadSession
     * const uploadSession = await prisma.uploadSession.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UploadSessionFindFirstOrThrowArgs>(args?: SelectSubset<T, UploadSessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more UploadSessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UploadSessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UploadSessions
     * const uploadSessions = await prisma.uploadSession.findMany()
     * 
     * // Get first 10 UploadSessions
     * const uploadSessions = await prisma.uploadSession.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const uploadSessionWithIdOnly = await prisma.uploadSession.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UploadSessionFindManyArgs>(args?: SelectSubset<T, UploadSessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a UploadSession.
     * @param {UploadSessionCreateArgs} args - Arguments to create a UploadSession.
     * @example
     * // Create one UploadSession
     * const UploadSession = await prisma.uploadSession.create({
     *   data: {
     *     // ... data to create a UploadSession
     *   }
     * })
     * 
     */
    create<T extends UploadSessionCreateArgs>(args: SelectSubset<T, UploadSessionCreateArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many UploadSessions.
     * @param {UploadSessionCreateManyArgs} args - Arguments to create many UploadSessions.
     * @example
     * // Create many UploadSessions
     * const uploadSession = await prisma.uploadSession.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UploadSessionCreateManyArgs>(args?: SelectSubset<T, UploadSessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UploadSessions and returns the data saved in the database.
     * @param {UploadSessionCreateManyAndReturnArgs} args - Arguments to create many UploadSessions.
     * @example
     * // Create many UploadSessions
     * const uploadSession = await prisma.uploadSession.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UploadSessions and only return the `id`
     * const uploadSessionWithIdOnly = await prisma.uploadSession.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UploadSessionCreateManyAndReturnArgs>(args?: SelectSubset<T, UploadSessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a UploadSession.
     * @param {UploadSessionDeleteArgs} args - Arguments to delete one UploadSession.
     * @example
     * // Delete one UploadSession
     * const UploadSession = await prisma.uploadSession.delete({
     *   where: {
     *     // ... filter to delete one UploadSession
     *   }
     * })
     * 
     */
    delete<T extends UploadSessionDeleteArgs>(args: SelectSubset<T, UploadSessionDeleteArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one UploadSession.
     * @param {UploadSessionUpdateArgs} args - Arguments to update one UploadSession.
     * @example
     * // Update one UploadSession
     * const uploadSession = await prisma.uploadSession.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UploadSessionUpdateArgs>(args: SelectSubset<T, UploadSessionUpdateArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more UploadSessions.
     * @param {UploadSessionDeleteManyArgs} args - Arguments to filter UploadSessions to delete.
     * @example
     * // Delete a few UploadSessions
     * const { count } = await prisma.uploadSession.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UploadSessionDeleteManyArgs>(args?: SelectSubset<T, UploadSessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UploadSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UploadSessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UploadSessions
     * const uploadSession = await prisma.uploadSession.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UploadSessionUpdateManyArgs>(args: SelectSubset<T, UploadSessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one UploadSession.
     * @param {UploadSessionUpsertArgs} args - Arguments to update or create a UploadSession.
     * @example
     * // Update or create a UploadSession
     * const uploadSession = await prisma.uploadSession.upsert({
     *   create: {
     *     // ... data to create a UploadSession
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UploadSession we want to update
     *   }
     * })
     */
    upsert<T extends UploadSessionUpsertArgs>(args: SelectSubset<T, UploadSessionUpsertArgs<ExtArgs>>): Prisma__UploadSessionClient<$Result.GetResult<Prisma.$UploadSessionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of UploadSessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UploadSessionCountArgs} args - Arguments to filter UploadSessions to count.
     * @example
     * // Count the number of UploadSessions
     * const count = await prisma.uploadSession.count({
     *   where: {
     *     // ... the filter for the UploadSessions we want to count
     *   }
     * })
    **/
    count<T extends UploadSessionCountArgs>(
      args?: Subset<T, UploadSessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UploadSessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UploadSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UploadSessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UploadSessionAggregateArgs>(args: Subset<T, UploadSessionAggregateArgs>): Prisma.PrismaPromise<GetUploadSessionAggregateType<T>>

    /**
     * Group by UploadSession.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UploadSessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UploadSessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UploadSessionGroupByArgs['orderBy'] }
        : { orderBy?: UploadSessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UploadSessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUploadSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UploadSession model
   */
  readonly fields: UploadSessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UploadSession.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UploadSessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UploadSession model
   */ 
  interface UploadSessionFieldRefs {
    readonly id: FieldRef<"UploadSession", 'String'>
    readonly fileName: FieldRef<"UploadSession", 'String'>
    readonly fileSize: FieldRef<"UploadSession", 'Int'>
    readonly mimeType: FieldRef<"UploadSession", 'String'>
    readonly chunkSize: FieldRef<"UploadSession", 'Int'>
    readonly totalChunks: FieldRef<"UploadSession", 'Int'>
    readonly uploadedChunks: FieldRef<"UploadSession", 'String'>
    readonly chunkMd5s: FieldRef<"UploadSession", 'String'>
    readonly ownerId: FieldRef<"UploadSession", 'String'>
    readonly status: FieldRef<"UploadSession", 'String'>
    readonly storagePath: FieldRef<"UploadSession", 'String'>
    readonly md5Hash: FieldRef<"UploadSession", 'String'>
    readonly createdAt: FieldRef<"UploadSession", 'DateTime'>
    readonly updatedAt: FieldRef<"UploadSession", 'DateTime'>
    readonly expiresAt: FieldRef<"UploadSession", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UploadSession findUnique
   */
  export type UploadSessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * Filter, which UploadSession to fetch.
     */
    where: UploadSessionWhereUniqueInput
  }

  /**
   * UploadSession findUniqueOrThrow
   */
  export type UploadSessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * Filter, which UploadSession to fetch.
     */
    where: UploadSessionWhereUniqueInput
  }

  /**
   * UploadSession findFirst
   */
  export type UploadSessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * Filter, which UploadSession to fetch.
     */
    where?: UploadSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UploadSessions to fetch.
     */
    orderBy?: UploadSessionOrderByWithRelationInput | UploadSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UploadSessions.
     */
    cursor?: UploadSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UploadSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UploadSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UploadSessions.
     */
    distinct?: UploadSessionScalarFieldEnum | UploadSessionScalarFieldEnum[]
  }

  /**
   * UploadSession findFirstOrThrow
   */
  export type UploadSessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * Filter, which UploadSession to fetch.
     */
    where?: UploadSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UploadSessions to fetch.
     */
    orderBy?: UploadSessionOrderByWithRelationInput | UploadSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UploadSessions.
     */
    cursor?: UploadSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UploadSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UploadSessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UploadSessions.
     */
    distinct?: UploadSessionScalarFieldEnum | UploadSessionScalarFieldEnum[]
  }

  /**
   * UploadSession findMany
   */
  export type UploadSessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * Filter, which UploadSessions to fetch.
     */
    where?: UploadSessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UploadSessions to fetch.
     */
    orderBy?: UploadSessionOrderByWithRelationInput | UploadSessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UploadSessions.
     */
    cursor?: UploadSessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UploadSessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UploadSessions.
     */
    skip?: number
    distinct?: UploadSessionScalarFieldEnum | UploadSessionScalarFieldEnum[]
  }

  /**
   * UploadSession create
   */
  export type UploadSessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * The data needed to create a UploadSession.
     */
    data: XOR<UploadSessionCreateInput, UploadSessionUncheckedCreateInput>
  }

  /**
   * UploadSession createMany
   */
  export type UploadSessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UploadSessions.
     */
    data: UploadSessionCreateManyInput | UploadSessionCreateManyInput[]
  }

  /**
   * UploadSession createManyAndReturn
   */
  export type UploadSessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many UploadSessions.
     */
    data: UploadSessionCreateManyInput | UploadSessionCreateManyInput[]
  }

  /**
   * UploadSession update
   */
  export type UploadSessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * The data needed to update a UploadSession.
     */
    data: XOR<UploadSessionUpdateInput, UploadSessionUncheckedUpdateInput>
    /**
     * Choose, which UploadSession to update.
     */
    where: UploadSessionWhereUniqueInput
  }

  /**
   * UploadSession updateMany
   */
  export type UploadSessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UploadSessions.
     */
    data: XOR<UploadSessionUpdateManyMutationInput, UploadSessionUncheckedUpdateManyInput>
    /**
     * Filter which UploadSessions to update
     */
    where?: UploadSessionWhereInput
  }

  /**
   * UploadSession upsert
   */
  export type UploadSessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * The filter to search for the UploadSession to update in case it exists.
     */
    where: UploadSessionWhereUniqueInput
    /**
     * In case the UploadSession found by the `where` argument doesn't exist, create a new UploadSession with this data.
     */
    create: XOR<UploadSessionCreateInput, UploadSessionUncheckedCreateInput>
    /**
     * In case the UploadSession was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UploadSessionUpdateInput, UploadSessionUncheckedUpdateInput>
  }

  /**
   * UploadSession delete
   */
  export type UploadSessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
    /**
     * Filter which UploadSession to delete.
     */
    where: UploadSessionWhereUniqueInput
  }

  /**
   * UploadSession deleteMany
   */
  export type UploadSessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UploadSessions to delete
     */
    where?: UploadSessionWhereInput
  }

  /**
   * UploadSession without action
   */
  export type UploadSessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UploadSession
     */
    select?: UploadSessionSelect<ExtArgs> | null
  }


  /**
   * Model DownloadEvent
   */

  export type AggregateDownloadEvent = {
    _count: DownloadEventCountAggregateOutputType | null
    _avg: DownloadEventAvgAggregateOutputType | null
    _sum: DownloadEventSumAggregateOutputType | null
    _min: DownloadEventMinAggregateOutputType | null
    _max: DownloadEventMaxAggregateOutputType | null
  }

  export type DownloadEventAvgAggregateOutputType = {
    bytes: number | null
  }

  export type DownloadEventSumAggregateOutputType = {
    bytes: number | null
  }

  export type DownloadEventMinAggregateOutputType = {
    id: string | null
    fileId: string | null
    bytes: number | null
    ip: string | null
    createdAt: Date | null
  }

  export type DownloadEventMaxAggregateOutputType = {
    id: string | null
    fileId: string | null
    bytes: number | null
    ip: string | null
    createdAt: Date | null
  }

  export type DownloadEventCountAggregateOutputType = {
    id: number
    fileId: number
    bytes: number
    ip: number
    createdAt: number
    _all: number
  }


  export type DownloadEventAvgAggregateInputType = {
    bytes?: true
  }

  export type DownloadEventSumAggregateInputType = {
    bytes?: true
  }

  export type DownloadEventMinAggregateInputType = {
    id?: true
    fileId?: true
    bytes?: true
    ip?: true
    createdAt?: true
  }

  export type DownloadEventMaxAggregateInputType = {
    id?: true
    fileId?: true
    bytes?: true
    ip?: true
    createdAt?: true
  }

  export type DownloadEventCountAggregateInputType = {
    id?: true
    fileId?: true
    bytes?: true
    ip?: true
    createdAt?: true
    _all?: true
  }

  export type DownloadEventAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DownloadEvent to aggregate.
     */
    where?: DownloadEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DownloadEvents to fetch.
     */
    orderBy?: DownloadEventOrderByWithRelationInput | DownloadEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DownloadEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DownloadEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DownloadEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DownloadEvents
    **/
    _count?: true | DownloadEventCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DownloadEventAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DownloadEventSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DownloadEventMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DownloadEventMaxAggregateInputType
  }

  export type GetDownloadEventAggregateType<T extends DownloadEventAggregateArgs> = {
        [P in keyof T & keyof AggregateDownloadEvent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDownloadEvent[P]>
      : GetScalarType<T[P], AggregateDownloadEvent[P]>
  }




  export type DownloadEventGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DownloadEventWhereInput
    orderBy?: DownloadEventOrderByWithAggregationInput | DownloadEventOrderByWithAggregationInput[]
    by: DownloadEventScalarFieldEnum[] | DownloadEventScalarFieldEnum
    having?: DownloadEventScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DownloadEventCountAggregateInputType | true
    _avg?: DownloadEventAvgAggregateInputType
    _sum?: DownloadEventSumAggregateInputType
    _min?: DownloadEventMinAggregateInputType
    _max?: DownloadEventMaxAggregateInputType
  }

  export type DownloadEventGroupByOutputType = {
    id: string
    fileId: string
    bytes: number
    ip: string | null
    createdAt: Date
    _count: DownloadEventCountAggregateOutputType | null
    _avg: DownloadEventAvgAggregateOutputType | null
    _sum: DownloadEventSumAggregateOutputType | null
    _min: DownloadEventMinAggregateOutputType | null
    _max: DownloadEventMaxAggregateOutputType | null
  }

  type GetDownloadEventGroupByPayload<T extends DownloadEventGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DownloadEventGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DownloadEventGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DownloadEventGroupByOutputType[P]>
            : GetScalarType<T[P], DownloadEventGroupByOutputType[P]>
        }
      >
    >


  export type DownloadEventSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    bytes?: boolean
    ip?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["downloadEvent"]>

  export type DownloadEventSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    bytes?: boolean
    ip?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["downloadEvent"]>

  export type DownloadEventSelectScalar = {
    id?: boolean
    fileId?: boolean
    bytes?: boolean
    ip?: boolean
    createdAt?: boolean
  }


  export type $DownloadEventPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DownloadEvent"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      fileId: string
      bytes: number
      ip: string | null
      createdAt: Date
    }, ExtArgs["result"]["downloadEvent"]>
    composites: {}
  }

  type DownloadEventGetPayload<S extends boolean | null | undefined | DownloadEventDefaultArgs> = $Result.GetResult<Prisma.$DownloadEventPayload, S>

  type DownloadEventCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<DownloadEventFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: DownloadEventCountAggregateInputType | true
    }

  export interface DownloadEventDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DownloadEvent'], meta: { name: 'DownloadEvent' } }
    /**
     * Find zero or one DownloadEvent that matches the filter.
     * @param {DownloadEventFindUniqueArgs} args - Arguments to find a DownloadEvent
     * @example
     * // Get one DownloadEvent
     * const downloadEvent = await prisma.downloadEvent.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DownloadEventFindUniqueArgs>(args: SelectSubset<T, DownloadEventFindUniqueArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one DownloadEvent that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {DownloadEventFindUniqueOrThrowArgs} args - Arguments to find a DownloadEvent
     * @example
     * // Get one DownloadEvent
     * const downloadEvent = await prisma.downloadEvent.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DownloadEventFindUniqueOrThrowArgs>(args: SelectSubset<T, DownloadEventFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first DownloadEvent that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DownloadEventFindFirstArgs} args - Arguments to find a DownloadEvent
     * @example
     * // Get one DownloadEvent
     * const downloadEvent = await prisma.downloadEvent.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DownloadEventFindFirstArgs>(args?: SelectSubset<T, DownloadEventFindFirstArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first DownloadEvent that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DownloadEventFindFirstOrThrowArgs} args - Arguments to find a DownloadEvent
     * @example
     * // Get one DownloadEvent
     * const downloadEvent = await prisma.downloadEvent.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DownloadEventFindFirstOrThrowArgs>(args?: SelectSubset<T, DownloadEventFindFirstOrThrowArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more DownloadEvents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DownloadEventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DownloadEvents
     * const downloadEvents = await prisma.downloadEvent.findMany()
     * 
     * // Get first 10 DownloadEvents
     * const downloadEvents = await prisma.downloadEvent.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const downloadEventWithIdOnly = await prisma.downloadEvent.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DownloadEventFindManyArgs>(args?: SelectSubset<T, DownloadEventFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a DownloadEvent.
     * @param {DownloadEventCreateArgs} args - Arguments to create a DownloadEvent.
     * @example
     * // Create one DownloadEvent
     * const DownloadEvent = await prisma.downloadEvent.create({
     *   data: {
     *     // ... data to create a DownloadEvent
     *   }
     * })
     * 
     */
    create<T extends DownloadEventCreateArgs>(args: SelectSubset<T, DownloadEventCreateArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many DownloadEvents.
     * @param {DownloadEventCreateManyArgs} args - Arguments to create many DownloadEvents.
     * @example
     * // Create many DownloadEvents
     * const downloadEvent = await prisma.downloadEvent.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DownloadEventCreateManyArgs>(args?: SelectSubset<T, DownloadEventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DownloadEvents and returns the data saved in the database.
     * @param {DownloadEventCreateManyAndReturnArgs} args - Arguments to create many DownloadEvents.
     * @example
     * // Create many DownloadEvents
     * const downloadEvent = await prisma.downloadEvent.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DownloadEvents and only return the `id`
     * const downloadEventWithIdOnly = await prisma.downloadEvent.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DownloadEventCreateManyAndReturnArgs>(args?: SelectSubset<T, DownloadEventCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a DownloadEvent.
     * @param {DownloadEventDeleteArgs} args - Arguments to delete one DownloadEvent.
     * @example
     * // Delete one DownloadEvent
     * const DownloadEvent = await prisma.downloadEvent.delete({
     *   where: {
     *     // ... filter to delete one DownloadEvent
     *   }
     * })
     * 
     */
    delete<T extends DownloadEventDeleteArgs>(args: SelectSubset<T, DownloadEventDeleteArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one DownloadEvent.
     * @param {DownloadEventUpdateArgs} args - Arguments to update one DownloadEvent.
     * @example
     * // Update one DownloadEvent
     * const downloadEvent = await prisma.downloadEvent.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DownloadEventUpdateArgs>(args: SelectSubset<T, DownloadEventUpdateArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more DownloadEvents.
     * @param {DownloadEventDeleteManyArgs} args - Arguments to filter DownloadEvents to delete.
     * @example
     * // Delete a few DownloadEvents
     * const { count } = await prisma.downloadEvent.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DownloadEventDeleteManyArgs>(args?: SelectSubset<T, DownloadEventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DownloadEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DownloadEventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DownloadEvents
     * const downloadEvent = await prisma.downloadEvent.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DownloadEventUpdateManyArgs>(args: SelectSubset<T, DownloadEventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one DownloadEvent.
     * @param {DownloadEventUpsertArgs} args - Arguments to update or create a DownloadEvent.
     * @example
     * // Update or create a DownloadEvent
     * const downloadEvent = await prisma.downloadEvent.upsert({
     *   create: {
     *     // ... data to create a DownloadEvent
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DownloadEvent we want to update
     *   }
     * })
     */
    upsert<T extends DownloadEventUpsertArgs>(args: SelectSubset<T, DownloadEventUpsertArgs<ExtArgs>>): Prisma__DownloadEventClient<$Result.GetResult<Prisma.$DownloadEventPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of DownloadEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DownloadEventCountArgs} args - Arguments to filter DownloadEvents to count.
     * @example
     * // Count the number of DownloadEvents
     * const count = await prisma.downloadEvent.count({
     *   where: {
     *     // ... the filter for the DownloadEvents we want to count
     *   }
     * })
    **/
    count<T extends DownloadEventCountArgs>(
      args?: Subset<T, DownloadEventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DownloadEventCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DownloadEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DownloadEventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DownloadEventAggregateArgs>(args: Subset<T, DownloadEventAggregateArgs>): Prisma.PrismaPromise<GetDownloadEventAggregateType<T>>

    /**
     * Group by DownloadEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DownloadEventGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DownloadEventGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DownloadEventGroupByArgs['orderBy'] }
        : { orderBy?: DownloadEventGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DownloadEventGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDownloadEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DownloadEvent model
   */
  readonly fields: DownloadEventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DownloadEvent.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DownloadEventClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the DownloadEvent model
   */ 
  interface DownloadEventFieldRefs {
    readonly id: FieldRef<"DownloadEvent", 'String'>
    readonly fileId: FieldRef<"DownloadEvent", 'String'>
    readonly bytes: FieldRef<"DownloadEvent", 'Int'>
    readonly ip: FieldRef<"DownloadEvent", 'String'>
    readonly createdAt: FieldRef<"DownloadEvent", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DownloadEvent findUnique
   */
  export type DownloadEventFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * Filter, which DownloadEvent to fetch.
     */
    where: DownloadEventWhereUniqueInput
  }

  /**
   * DownloadEvent findUniqueOrThrow
   */
  export type DownloadEventFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * Filter, which DownloadEvent to fetch.
     */
    where: DownloadEventWhereUniqueInput
  }

  /**
   * DownloadEvent findFirst
   */
  export type DownloadEventFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * Filter, which DownloadEvent to fetch.
     */
    where?: DownloadEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DownloadEvents to fetch.
     */
    orderBy?: DownloadEventOrderByWithRelationInput | DownloadEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DownloadEvents.
     */
    cursor?: DownloadEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DownloadEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DownloadEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DownloadEvents.
     */
    distinct?: DownloadEventScalarFieldEnum | DownloadEventScalarFieldEnum[]
  }

  /**
   * DownloadEvent findFirstOrThrow
   */
  export type DownloadEventFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * Filter, which DownloadEvent to fetch.
     */
    where?: DownloadEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DownloadEvents to fetch.
     */
    orderBy?: DownloadEventOrderByWithRelationInput | DownloadEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DownloadEvents.
     */
    cursor?: DownloadEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DownloadEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DownloadEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DownloadEvents.
     */
    distinct?: DownloadEventScalarFieldEnum | DownloadEventScalarFieldEnum[]
  }

  /**
   * DownloadEvent findMany
   */
  export type DownloadEventFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * Filter, which DownloadEvents to fetch.
     */
    where?: DownloadEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DownloadEvents to fetch.
     */
    orderBy?: DownloadEventOrderByWithRelationInput | DownloadEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DownloadEvents.
     */
    cursor?: DownloadEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DownloadEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DownloadEvents.
     */
    skip?: number
    distinct?: DownloadEventScalarFieldEnum | DownloadEventScalarFieldEnum[]
  }

  /**
   * DownloadEvent create
   */
  export type DownloadEventCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * The data needed to create a DownloadEvent.
     */
    data: XOR<DownloadEventCreateInput, DownloadEventUncheckedCreateInput>
  }

  /**
   * DownloadEvent createMany
   */
  export type DownloadEventCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DownloadEvents.
     */
    data: DownloadEventCreateManyInput | DownloadEventCreateManyInput[]
  }

  /**
   * DownloadEvent createManyAndReturn
   */
  export type DownloadEventCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many DownloadEvents.
     */
    data: DownloadEventCreateManyInput | DownloadEventCreateManyInput[]
  }

  /**
   * DownloadEvent update
   */
  export type DownloadEventUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * The data needed to update a DownloadEvent.
     */
    data: XOR<DownloadEventUpdateInput, DownloadEventUncheckedUpdateInput>
    /**
     * Choose, which DownloadEvent to update.
     */
    where: DownloadEventWhereUniqueInput
  }

  /**
   * DownloadEvent updateMany
   */
  export type DownloadEventUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DownloadEvents.
     */
    data: XOR<DownloadEventUpdateManyMutationInput, DownloadEventUncheckedUpdateManyInput>
    /**
     * Filter which DownloadEvents to update
     */
    where?: DownloadEventWhereInput
  }

  /**
   * DownloadEvent upsert
   */
  export type DownloadEventUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * The filter to search for the DownloadEvent to update in case it exists.
     */
    where: DownloadEventWhereUniqueInput
    /**
     * In case the DownloadEvent found by the `where` argument doesn't exist, create a new DownloadEvent with this data.
     */
    create: XOR<DownloadEventCreateInput, DownloadEventUncheckedCreateInput>
    /**
     * In case the DownloadEvent was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DownloadEventUpdateInput, DownloadEventUncheckedUpdateInput>
  }

  /**
   * DownloadEvent delete
   */
  export type DownloadEventDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
    /**
     * Filter which DownloadEvent to delete.
     */
    where: DownloadEventWhereUniqueInput
  }

  /**
   * DownloadEvent deleteMany
   */
  export type DownloadEventDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DownloadEvents to delete
     */
    where?: DownloadEventWhereInput
  }

  /**
   * DownloadEvent without action
   */
  export type DownloadEventDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DownloadEvent
     */
    select?: DownloadEventSelect<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UploadSessionScalarFieldEnum: {
    id: 'id',
    fileName: 'fileName',
    fileSize: 'fileSize',
    mimeType: 'mimeType',
    chunkSize: 'chunkSize',
    totalChunks: 'totalChunks',
    uploadedChunks: 'uploadedChunks',
    chunkMd5s: 'chunkMd5s',
    ownerId: 'ownerId',
    status: 'status',
    storagePath: 'storagePath',
    md5Hash: 'md5Hash',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    expiresAt: 'expiresAt'
  };

  export type UploadSessionScalarFieldEnum = (typeof UploadSessionScalarFieldEnum)[keyof typeof UploadSessionScalarFieldEnum]


  export const DownloadEventScalarFieldEnum: {
    id: 'id',
    fileId: 'fileId',
    bytes: 'bytes',
    ip: 'ip',
    createdAt: 'createdAt'
  };

  export type DownloadEventScalarFieldEnum = (typeof DownloadEventScalarFieldEnum)[keyof typeof DownloadEventScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    
  /**
   * Deep Input Types
   */


  export type UploadSessionWhereInput = {
    AND?: UploadSessionWhereInput | UploadSessionWhereInput[]
    OR?: UploadSessionWhereInput[]
    NOT?: UploadSessionWhereInput | UploadSessionWhereInput[]
    id?: StringFilter<"UploadSession"> | string
    fileName?: StringFilter<"UploadSession"> | string
    fileSize?: IntFilter<"UploadSession"> | number
    mimeType?: StringFilter<"UploadSession"> | string
    chunkSize?: IntFilter<"UploadSession"> | number
    totalChunks?: IntFilter<"UploadSession"> | number
    uploadedChunks?: StringFilter<"UploadSession"> | string
    chunkMd5s?: StringNullableFilter<"UploadSession"> | string | null
    ownerId?: StringFilter<"UploadSession"> | string
    status?: StringFilter<"UploadSession"> | string
    storagePath?: StringNullableFilter<"UploadSession"> | string | null
    md5Hash?: StringNullableFilter<"UploadSession"> | string | null
    createdAt?: DateTimeFilter<"UploadSession"> | Date | string
    updatedAt?: DateTimeFilter<"UploadSession"> | Date | string
    expiresAt?: DateTimeFilter<"UploadSession"> | Date | string
  }

  export type UploadSessionOrderByWithRelationInput = {
    id?: SortOrder
    fileName?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    chunkSize?: SortOrder
    totalChunks?: SortOrder
    uploadedChunks?: SortOrder
    chunkMd5s?: SortOrderInput | SortOrder
    ownerId?: SortOrder
    status?: SortOrder
    storagePath?: SortOrderInput | SortOrder
    md5Hash?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type UploadSessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: UploadSessionWhereInput | UploadSessionWhereInput[]
    OR?: UploadSessionWhereInput[]
    NOT?: UploadSessionWhereInput | UploadSessionWhereInput[]
    fileName?: StringFilter<"UploadSession"> | string
    fileSize?: IntFilter<"UploadSession"> | number
    mimeType?: StringFilter<"UploadSession"> | string
    chunkSize?: IntFilter<"UploadSession"> | number
    totalChunks?: IntFilter<"UploadSession"> | number
    uploadedChunks?: StringFilter<"UploadSession"> | string
    chunkMd5s?: StringNullableFilter<"UploadSession"> | string | null
    ownerId?: StringFilter<"UploadSession"> | string
    status?: StringFilter<"UploadSession"> | string
    storagePath?: StringNullableFilter<"UploadSession"> | string | null
    md5Hash?: StringNullableFilter<"UploadSession"> | string | null
    createdAt?: DateTimeFilter<"UploadSession"> | Date | string
    updatedAt?: DateTimeFilter<"UploadSession"> | Date | string
    expiresAt?: DateTimeFilter<"UploadSession"> | Date | string
  }, "id">

  export type UploadSessionOrderByWithAggregationInput = {
    id?: SortOrder
    fileName?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    chunkSize?: SortOrder
    totalChunks?: SortOrder
    uploadedChunks?: SortOrder
    chunkMd5s?: SortOrderInput | SortOrder
    ownerId?: SortOrder
    status?: SortOrder
    storagePath?: SortOrderInput | SortOrder
    md5Hash?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    expiresAt?: SortOrder
    _count?: UploadSessionCountOrderByAggregateInput
    _avg?: UploadSessionAvgOrderByAggregateInput
    _max?: UploadSessionMaxOrderByAggregateInput
    _min?: UploadSessionMinOrderByAggregateInput
    _sum?: UploadSessionSumOrderByAggregateInput
  }

  export type UploadSessionScalarWhereWithAggregatesInput = {
    AND?: UploadSessionScalarWhereWithAggregatesInput | UploadSessionScalarWhereWithAggregatesInput[]
    OR?: UploadSessionScalarWhereWithAggregatesInput[]
    NOT?: UploadSessionScalarWhereWithAggregatesInput | UploadSessionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"UploadSession"> | string
    fileName?: StringWithAggregatesFilter<"UploadSession"> | string
    fileSize?: IntWithAggregatesFilter<"UploadSession"> | number
    mimeType?: StringWithAggregatesFilter<"UploadSession"> | string
    chunkSize?: IntWithAggregatesFilter<"UploadSession"> | number
    totalChunks?: IntWithAggregatesFilter<"UploadSession"> | number
    uploadedChunks?: StringWithAggregatesFilter<"UploadSession"> | string
    chunkMd5s?: StringNullableWithAggregatesFilter<"UploadSession"> | string | null
    ownerId?: StringWithAggregatesFilter<"UploadSession"> | string
    status?: StringWithAggregatesFilter<"UploadSession"> | string
    storagePath?: StringNullableWithAggregatesFilter<"UploadSession"> | string | null
    md5Hash?: StringNullableWithAggregatesFilter<"UploadSession"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"UploadSession"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"UploadSession"> | Date | string
    expiresAt?: DateTimeWithAggregatesFilter<"UploadSession"> | Date | string
  }

  export type DownloadEventWhereInput = {
    AND?: DownloadEventWhereInput | DownloadEventWhereInput[]
    OR?: DownloadEventWhereInput[]
    NOT?: DownloadEventWhereInput | DownloadEventWhereInput[]
    id?: StringFilter<"DownloadEvent"> | string
    fileId?: StringFilter<"DownloadEvent"> | string
    bytes?: IntFilter<"DownloadEvent"> | number
    ip?: StringNullableFilter<"DownloadEvent"> | string | null
    createdAt?: DateTimeFilter<"DownloadEvent"> | Date | string
  }

  export type DownloadEventOrderByWithRelationInput = {
    id?: SortOrder
    fileId?: SortOrder
    bytes?: SortOrder
    ip?: SortOrderInput | SortOrder
    createdAt?: SortOrder
  }

  export type DownloadEventWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: DownloadEventWhereInput | DownloadEventWhereInput[]
    OR?: DownloadEventWhereInput[]
    NOT?: DownloadEventWhereInput | DownloadEventWhereInput[]
    fileId?: StringFilter<"DownloadEvent"> | string
    bytes?: IntFilter<"DownloadEvent"> | number
    ip?: StringNullableFilter<"DownloadEvent"> | string | null
    createdAt?: DateTimeFilter<"DownloadEvent"> | Date | string
  }, "id">

  export type DownloadEventOrderByWithAggregationInput = {
    id?: SortOrder
    fileId?: SortOrder
    bytes?: SortOrder
    ip?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: DownloadEventCountOrderByAggregateInput
    _avg?: DownloadEventAvgOrderByAggregateInput
    _max?: DownloadEventMaxOrderByAggregateInput
    _min?: DownloadEventMinOrderByAggregateInput
    _sum?: DownloadEventSumOrderByAggregateInput
  }

  export type DownloadEventScalarWhereWithAggregatesInput = {
    AND?: DownloadEventScalarWhereWithAggregatesInput | DownloadEventScalarWhereWithAggregatesInput[]
    OR?: DownloadEventScalarWhereWithAggregatesInput[]
    NOT?: DownloadEventScalarWhereWithAggregatesInput | DownloadEventScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"DownloadEvent"> | string
    fileId?: StringWithAggregatesFilter<"DownloadEvent"> | string
    bytes?: IntWithAggregatesFilter<"DownloadEvent"> | number
    ip?: StringNullableWithAggregatesFilter<"DownloadEvent"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"DownloadEvent"> | Date | string
  }

  export type UploadSessionCreateInput = {
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    chunkSize: number
    totalChunks: number
    uploadedChunks: string
    chunkMd5s?: string | null
    ownerId: string
    status?: string
    storagePath?: string | null
    md5Hash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    expiresAt: Date | string
  }

  export type UploadSessionUncheckedCreateInput = {
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    chunkSize: number
    totalChunks: number
    uploadedChunks: string
    chunkMd5s?: string | null
    ownerId: string
    status?: string
    storagePath?: string | null
    md5Hash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    expiresAt: Date | string
  }

  export type UploadSessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    chunkSize?: IntFieldUpdateOperationsInput | number
    totalChunks?: IntFieldUpdateOperationsInput | number
    uploadedChunks?: StringFieldUpdateOperationsInput | string
    chunkMd5s?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    storagePath?: NullableStringFieldUpdateOperationsInput | string | null
    md5Hash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UploadSessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    chunkSize?: IntFieldUpdateOperationsInput | number
    totalChunks?: IntFieldUpdateOperationsInput | number
    uploadedChunks?: StringFieldUpdateOperationsInput | string
    chunkMd5s?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    storagePath?: NullableStringFieldUpdateOperationsInput | string | null
    md5Hash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UploadSessionCreateManyInput = {
    id: string
    fileName: string
    fileSize: number
    mimeType: string
    chunkSize: number
    totalChunks: number
    uploadedChunks: string
    chunkMd5s?: string | null
    ownerId: string
    status?: string
    storagePath?: string | null
    md5Hash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    expiresAt: Date | string
  }

  export type UploadSessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    chunkSize?: IntFieldUpdateOperationsInput | number
    totalChunks?: IntFieldUpdateOperationsInput | number
    uploadedChunks?: StringFieldUpdateOperationsInput | string
    chunkMd5s?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    storagePath?: NullableStringFieldUpdateOperationsInput | string | null
    md5Hash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UploadSessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    chunkSize?: IntFieldUpdateOperationsInput | number
    totalChunks?: IntFieldUpdateOperationsInput | number
    uploadedChunks?: StringFieldUpdateOperationsInput | string
    chunkMd5s?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    storagePath?: NullableStringFieldUpdateOperationsInput | string | null
    md5Hash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DownloadEventCreateInput = {
    id?: string
    fileId: string
    bytes: number
    ip?: string | null
    createdAt?: Date | string
  }

  export type DownloadEventUncheckedCreateInput = {
    id?: string
    fileId: string
    bytes: number
    ip?: string | null
    createdAt?: Date | string
  }

  export type DownloadEventUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    bytes?: IntFieldUpdateOperationsInput | number
    ip?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DownloadEventUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    bytes?: IntFieldUpdateOperationsInput | number
    ip?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DownloadEventCreateManyInput = {
    id?: string
    fileId: string
    bytes: number
    ip?: string | null
    createdAt?: Date | string
  }

  export type DownloadEventUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    bytes?: IntFieldUpdateOperationsInput | number
    ip?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DownloadEventUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    bytes?: IntFieldUpdateOperationsInput | number
    ip?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type UploadSessionCountOrderByAggregateInput = {
    id?: SortOrder
    fileName?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    chunkSize?: SortOrder
    totalChunks?: SortOrder
    uploadedChunks?: SortOrder
    chunkMd5s?: SortOrder
    ownerId?: SortOrder
    status?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type UploadSessionAvgOrderByAggregateInput = {
    fileSize?: SortOrder
    chunkSize?: SortOrder
    totalChunks?: SortOrder
  }

  export type UploadSessionMaxOrderByAggregateInput = {
    id?: SortOrder
    fileName?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    chunkSize?: SortOrder
    totalChunks?: SortOrder
    uploadedChunks?: SortOrder
    chunkMd5s?: SortOrder
    ownerId?: SortOrder
    status?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type UploadSessionMinOrderByAggregateInput = {
    id?: SortOrder
    fileName?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    chunkSize?: SortOrder
    totalChunks?: SortOrder
    uploadedChunks?: SortOrder
    chunkMd5s?: SortOrder
    ownerId?: SortOrder
    status?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type UploadSessionSumOrderByAggregateInput = {
    fileSize?: SortOrder
    chunkSize?: SortOrder
    totalChunks?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type DownloadEventCountOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    bytes?: SortOrder
    ip?: SortOrder
    createdAt?: SortOrder
  }

  export type DownloadEventAvgOrderByAggregateInput = {
    bytes?: SortOrder
  }

  export type DownloadEventMaxOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    bytes?: SortOrder
    ip?: SortOrder
    createdAt?: SortOrder
  }

  export type DownloadEventMinOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    bytes?: SortOrder
    ip?: SortOrder
    createdAt?: SortOrder
  }

  export type DownloadEventSumOrderByAggregateInput = {
    bytes?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use UploadSessionDefaultArgs instead
     */
    export type UploadSessionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UploadSessionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use DownloadEventDefaultArgs instead
     */
    export type DownloadEventArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = DownloadEventDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}