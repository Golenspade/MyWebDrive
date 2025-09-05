
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
 * Model File
 * 
 */
export type File = $Result.DefaultSelection<Prisma.$FilePayload>
/**
 * Model FileVersion
 * 
 */
export type FileVersion = $Result.DefaultSelection<Prisma.$FileVersionPayload>
/**
 * Model FileTag
 * 
 */
export type FileTag = $Result.DefaultSelection<Prisma.$FileTagPayload>
/**
 * Model FileAccessLog
 * 
 */
export type FileAccessLog = $Result.DefaultSelection<Prisma.$FileAccessLogPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Files
 * const files = await prisma.file.findMany()
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
   * // Fetch zero or more Files
   * const files = await prisma.file.findMany()
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
   * `prisma.file`: Exposes CRUD operations for the **File** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Files
    * const files = await prisma.file.findMany()
    * ```
    */
  get file(): Prisma.FileDelegate<ExtArgs>;

  /**
   * `prisma.fileVersion`: Exposes CRUD operations for the **FileVersion** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more FileVersions
    * const fileVersions = await prisma.fileVersion.findMany()
    * ```
    */
  get fileVersion(): Prisma.FileVersionDelegate<ExtArgs>;

  /**
   * `prisma.fileTag`: Exposes CRUD operations for the **FileTag** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more FileTags
    * const fileTags = await prisma.fileTag.findMany()
    * ```
    */
  get fileTag(): Prisma.FileTagDelegate<ExtArgs>;

  /**
   * `prisma.fileAccessLog`: Exposes CRUD operations for the **FileAccessLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more FileAccessLogs
    * const fileAccessLogs = await prisma.fileAccessLog.findMany()
    * ```
    */
  get fileAccessLog(): Prisma.FileAccessLogDelegate<ExtArgs>;
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
    File: 'File',
    FileVersion: 'FileVersion',
    FileTag: 'FileTag',
    FileAccessLog: 'FileAccessLog'
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
      modelProps: "file" | "fileVersion" | "fileTag" | "fileAccessLog"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      File: {
        payload: Prisma.$FilePayload<ExtArgs>
        fields: Prisma.FileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.FileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.FileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>
          }
          findFirst: {
            args: Prisma.FileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.FileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>
          }
          findMany: {
            args: Prisma.FileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>[]
          }
          create: {
            args: Prisma.FileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>
          }
          createMany: {
            args: Prisma.FileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.FileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>[]
          }
          delete: {
            args: Prisma.FileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>
          }
          update: {
            args: Prisma.FileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>
          }
          deleteMany: {
            args: Prisma.FileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.FileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.FileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FilePayload>
          }
          aggregate: {
            args: Prisma.FileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateFile>
          }
          groupBy: {
            args: Prisma.FileGroupByArgs<ExtArgs>
            result: $Utils.Optional<FileGroupByOutputType>[]
          }
          count: {
            args: Prisma.FileCountArgs<ExtArgs>
            result: $Utils.Optional<FileCountAggregateOutputType> | number
          }
        }
      }
      FileVersion: {
        payload: Prisma.$FileVersionPayload<ExtArgs>
        fields: Prisma.FileVersionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.FileVersionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.FileVersionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>
          }
          findFirst: {
            args: Prisma.FileVersionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.FileVersionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>
          }
          findMany: {
            args: Prisma.FileVersionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>[]
          }
          create: {
            args: Prisma.FileVersionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>
          }
          createMany: {
            args: Prisma.FileVersionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.FileVersionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>[]
          }
          delete: {
            args: Prisma.FileVersionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>
          }
          update: {
            args: Prisma.FileVersionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>
          }
          deleteMany: {
            args: Prisma.FileVersionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.FileVersionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.FileVersionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileVersionPayload>
          }
          aggregate: {
            args: Prisma.FileVersionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateFileVersion>
          }
          groupBy: {
            args: Prisma.FileVersionGroupByArgs<ExtArgs>
            result: $Utils.Optional<FileVersionGroupByOutputType>[]
          }
          count: {
            args: Prisma.FileVersionCountArgs<ExtArgs>
            result: $Utils.Optional<FileVersionCountAggregateOutputType> | number
          }
        }
      }
      FileTag: {
        payload: Prisma.$FileTagPayload<ExtArgs>
        fields: Prisma.FileTagFieldRefs
        operations: {
          findUnique: {
            args: Prisma.FileTagFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.FileTagFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>
          }
          findFirst: {
            args: Prisma.FileTagFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.FileTagFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>
          }
          findMany: {
            args: Prisma.FileTagFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>[]
          }
          create: {
            args: Prisma.FileTagCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>
          }
          createMany: {
            args: Prisma.FileTagCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.FileTagCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>[]
          }
          delete: {
            args: Prisma.FileTagDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>
          }
          update: {
            args: Prisma.FileTagUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>
          }
          deleteMany: {
            args: Prisma.FileTagDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.FileTagUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.FileTagUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileTagPayload>
          }
          aggregate: {
            args: Prisma.FileTagAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateFileTag>
          }
          groupBy: {
            args: Prisma.FileTagGroupByArgs<ExtArgs>
            result: $Utils.Optional<FileTagGroupByOutputType>[]
          }
          count: {
            args: Prisma.FileTagCountArgs<ExtArgs>
            result: $Utils.Optional<FileTagCountAggregateOutputType> | number
          }
        }
      }
      FileAccessLog: {
        payload: Prisma.$FileAccessLogPayload<ExtArgs>
        fields: Prisma.FileAccessLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.FileAccessLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.FileAccessLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>
          }
          findFirst: {
            args: Prisma.FileAccessLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.FileAccessLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>
          }
          findMany: {
            args: Prisma.FileAccessLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>[]
          }
          create: {
            args: Prisma.FileAccessLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>
          }
          createMany: {
            args: Prisma.FileAccessLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.FileAccessLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>[]
          }
          delete: {
            args: Prisma.FileAccessLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>
          }
          update: {
            args: Prisma.FileAccessLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>
          }
          deleteMany: {
            args: Prisma.FileAccessLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.FileAccessLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.FileAccessLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FileAccessLogPayload>
          }
          aggregate: {
            args: Prisma.FileAccessLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateFileAccessLog>
          }
          groupBy: {
            args: Prisma.FileAccessLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<FileAccessLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.FileAccessLogCountArgs<ExtArgs>
            result: $Utils.Optional<FileAccessLogCountAggregateOutputType> | number
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
   * Count Type FileCountOutputType
   */

  export type FileCountOutputType = {
    children: number
    versions: number
    tags: number
    accessLogs: number
  }

  export type FileCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    children?: boolean | FileCountOutputTypeCountChildrenArgs
    versions?: boolean | FileCountOutputTypeCountVersionsArgs
    tags?: boolean | FileCountOutputTypeCountTagsArgs
    accessLogs?: boolean | FileCountOutputTypeCountAccessLogsArgs
  }

  // Custom InputTypes
  /**
   * FileCountOutputType without action
   */
  export type FileCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileCountOutputType
     */
    select?: FileCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * FileCountOutputType without action
   */
  export type FileCountOutputTypeCountChildrenArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileWhereInput
  }

  /**
   * FileCountOutputType without action
   */
  export type FileCountOutputTypeCountVersionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileVersionWhereInput
  }

  /**
   * FileCountOutputType without action
   */
  export type FileCountOutputTypeCountTagsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileTagWhereInput
  }

  /**
   * FileCountOutputType without action
   */
  export type FileCountOutputTypeCountAccessLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileAccessLogWhereInput
  }


  /**
   * Models
   */

  /**
   * Model File
   */

  export type AggregateFile = {
    _count: FileCountAggregateOutputType | null
    _avg: FileAvgAggregateOutputType | null
    _sum: FileSumAggregateOutputType | null
    _min: FileMinAggregateOutputType | null
    _max: FileMaxAggregateOutputType | null
  }

  export type FileAvgAggregateOutputType = {
    size: number | null
    version: number | null
  }

  export type FileSumAggregateOutputType = {
    size: number | null
    version: number | null
  }

  export type FileMinAggregateOutputType = {
    id: string | null
    name: string | null
    type: string | null
    size: number | null
    mimeType: string | null
    parentId: string | null
    ownerId: string | null
    path: string | null
    version: number | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
  }

  export type FileMaxAggregateOutputType = {
    id: string | null
    name: string | null
    type: string | null
    size: number | null
    mimeType: string | null
    parentId: string | null
    ownerId: string | null
    path: string | null
    version: number | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
  }

  export type FileCountAggregateOutputType = {
    id: number
    name: number
    type: number
    size: number
    mimeType: number
    parentId: number
    ownerId: number
    path: number
    version: number
    createdAt: number
    updatedAt: number
    deletedAt: number
    _all: number
  }


  export type FileAvgAggregateInputType = {
    size?: true
    version?: true
  }

  export type FileSumAggregateInputType = {
    size?: true
    version?: true
  }

  export type FileMinAggregateInputType = {
    id?: true
    name?: true
    type?: true
    size?: true
    mimeType?: true
    parentId?: true
    ownerId?: true
    path?: true
    version?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
  }

  export type FileMaxAggregateInputType = {
    id?: true
    name?: true
    type?: true
    size?: true
    mimeType?: true
    parentId?: true
    ownerId?: true
    path?: true
    version?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
  }

  export type FileCountAggregateInputType = {
    id?: true
    name?: true
    type?: true
    size?: true
    mimeType?: true
    parentId?: true
    ownerId?: true
    path?: true
    version?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    _all?: true
  }

  export type FileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which File to aggregate.
     */
    where?: FileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Files to fetch.
     */
    orderBy?: FileOrderByWithRelationInput | FileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: FileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Files from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Files.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Files
    **/
    _count?: true | FileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: FileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: FileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: FileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: FileMaxAggregateInputType
  }

  export type GetFileAggregateType<T extends FileAggregateArgs> = {
        [P in keyof T & keyof AggregateFile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFile[P]>
      : GetScalarType<T[P], AggregateFile[P]>
  }




  export type FileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileWhereInput
    orderBy?: FileOrderByWithAggregationInput | FileOrderByWithAggregationInput[]
    by: FileScalarFieldEnum[] | FileScalarFieldEnum
    having?: FileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: FileCountAggregateInputType | true
    _avg?: FileAvgAggregateInputType
    _sum?: FileSumAggregateInputType
    _min?: FileMinAggregateInputType
    _max?: FileMaxAggregateInputType
  }

  export type FileGroupByOutputType = {
    id: string
    name: string
    type: string
    size: number | null
    mimeType: string | null
    parentId: string | null
    ownerId: string
    path: string
    version: number
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    _count: FileCountAggregateOutputType | null
    _avg: FileAvgAggregateOutputType | null
    _sum: FileSumAggregateOutputType | null
    _min: FileMinAggregateOutputType | null
    _max: FileMaxAggregateOutputType | null
  }

  type GetFileGroupByPayload<T extends FileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof FileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FileGroupByOutputType[P]>
            : GetScalarType<T[P], FileGroupByOutputType[P]>
        }
      >
    >


  export type FileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    size?: boolean
    mimeType?: boolean
    parentId?: boolean
    ownerId?: boolean
    path?: boolean
    version?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    parent?: boolean | File$parentArgs<ExtArgs>
    children?: boolean | File$childrenArgs<ExtArgs>
    versions?: boolean | File$versionsArgs<ExtArgs>
    tags?: boolean | File$tagsArgs<ExtArgs>
    accessLogs?: boolean | File$accessLogsArgs<ExtArgs>
    _count?: boolean | FileCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["file"]>

  export type FileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    size?: boolean
    mimeType?: boolean
    parentId?: boolean
    ownerId?: boolean
    path?: boolean
    version?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    parent?: boolean | File$parentArgs<ExtArgs>
  }, ExtArgs["result"]["file"]>

  export type FileSelectScalar = {
    id?: boolean
    name?: boolean
    type?: boolean
    size?: boolean
    mimeType?: boolean
    parentId?: boolean
    ownerId?: boolean
    path?: boolean
    version?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }

  export type FileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    parent?: boolean | File$parentArgs<ExtArgs>
    children?: boolean | File$childrenArgs<ExtArgs>
    versions?: boolean | File$versionsArgs<ExtArgs>
    tags?: boolean | File$tagsArgs<ExtArgs>
    accessLogs?: boolean | File$accessLogsArgs<ExtArgs>
    _count?: boolean | FileCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type FileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    parent?: boolean | File$parentArgs<ExtArgs>
  }

  export type $FilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "File"
    objects: {
      parent: Prisma.$FilePayload<ExtArgs> | null
      children: Prisma.$FilePayload<ExtArgs>[]
      versions: Prisma.$FileVersionPayload<ExtArgs>[]
      tags: Prisma.$FileTagPayload<ExtArgs>[]
      accessLogs: Prisma.$FileAccessLogPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      type: string
      size: number | null
      mimeType: string | null
      parentId: string | null
      ownerId: string
      path: string
      version: number
      createdAt: Date
      updatedAt: Date
      deletedAt: Date | null
    }, ExtArgs["result"]["file"]>
    composites: {}
  }

  type FileGetPayload<S extends boolean | null | undefined | FileDefaultArgs> = $Result.GetResult<Prisma.$FilePayload, S>

  type FileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<FileFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: FileCountAggregateInputType | true
    }

  export interface FileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['File'], meta: { name: 'File' } }
    /**
     * Find zero or one File that matches the filter.
     * @param {FileFindUniqueArgs} args - Arguments to find a File
     * @example
     * // Get one File
     * const file = await prisma.file.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FileFindUniqueArgs>(args: SelectSubset<T, FileFindUniqueArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one File that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {FileFindUniqueOrThrowArgs} args - Arguments to find a File
     * @example
     * // Get one File
     * const file = await prisma.file.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FileFindUniqueOrThrowArgs>(args: SelectSubset<T, FileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first File that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileFindFirstArgs} args - Arguments to find a File
     * @example
     * // Get one File
     * const file = await prisma.file.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FileFindFirstArgs>(args?: SelectSubset<T, FileFindFirstArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first File that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileFindFirstOrThrowArgs} args - Arguments to find a File
     * @example
     * // Get one File
     * const file = await prisma.file.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FileFindFirstOrThrowArgs>(args?: SelectSubset<T, FileFindFirstOrThrowArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Files that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Files
     * const files = await prisma.file.findMany()
     * 
     * // Get first 10 Files
     * const files = await prisma.file.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const fileWithIdOnly = await prisma.file.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends FileFindManyArgs>(args?: SelectSubset<T, FileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a File.
     * @param {FileCreateArgs} args - Arguments to create a File.
     * @example
     * // Create one File
     * const File = await prisma.file.create({
     *   data: {
     *     // ... data to create a File
     *   }
     * })
     * 
     */
    create<T extends FileCreateArgs>(args: SelectSubset<T, FileCreateArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Files.
     * @param {FileCreateManyArgs} args - Arguments to create many Files.
     * @example
     * // Create many Files
     * const file = await prisma.file.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends FileCreateManyArgs>(args?: SelectSubset<T, FileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Files and returns the data saved in the database.
     * @param {FileCreateManyAndReturnArgs} args - Arguments to create many Files.
     * @example
     * // Create many Files
     * const file = await prisma.file.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Files and only return the `id`
     * const fileWithIdOnly = await prisma.file.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends FileCreateManyAndReturnArgs>(args?: SelectSubset<T, FileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a File.
     * @param {FileDeleteArgs} args - Arguments to delete one File.
     * @example
     * // Delete one File
     * const File = await prisma.file.delete({
     *   where: {
     *     // ... filter to delete one File
     *   }
     * })
     * 
     */
    delete<T extends FileDeleteArgs>(args: SelectSubset<T, FileDeleteArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one File.
     * @param {FileUpdateArgs} args - Arguments to update one File.
     * @example
     * // Update one File
     * const file = await prisma.file.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends FileUpdateArgs>(args: SelectSubset<T, FileUpdateArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Files.
     * @param {FileDeleteManyArgs} args - Arguments to filter Files to delete.
     * @example
     * // Delete a few Files
     * const { count } = await prisma.file.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends FileDeleteManyArgs>(args?: SelectSubset<T, FileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Files.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Files
     * const file = await prisma.file.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends FileUpdateManyArgs>(args: SelectSubset<T, FileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one File.
     * @param {FileUpsertArgs} args - Arguments to update or create a File.
     * @example
     * // Update or create a File
     * const file = await prisma.file.upsert({
     *   create: {
     *     // ... data to create a File
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the File we want to update
     *   }
     * })
     */
    upsert<T extends FileUpsertArgs>(args: SelectSubset<T, FileUpsertArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Files.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileCountArgs} args - Arguments to filter Files to count.
     * @example
     * // Count the number of Files
     * const count = await prisma.file.count({
     *   where: {
     *     // ... the filter for the Files we want to count
     *   }
     * })
    **/
    count<T extends FileCountArgs>(
      args?: Subset<T, FileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], FileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a File.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends FileAggregateArgs>(args: Subset<T, FileAggregateArgs>): Prisma.PrismaPromise<GetFileAggregateType<T>>

    /**
     * Group by File.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileGroupByArgs} args - Group by arguments.
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
      T extends FileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FileGroupByArgs['orderBy'] }
        : { orderBy?: FileGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, FileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetFileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the File model
   */
  readonly fields: FileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for File.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    parent<T extends File$parentArgs<ExtArgs> = {}>(args?: Subset<T, File$parentArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    children<T extends File$childrenArgs<ExtArgs> = {}>(args?: Subset<T, File$childrenArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findMany"> | Null>
    versions<T extends File$versionsArgs<ExtArgs> = {}>(args?: Subset<T, File$versionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "findMany"> | Null>
    tags<T extends File$tagsArgs<ExtArgs> = {}>(args?: Subset<T, File$tagsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "findMany"> | Null>
    accessLogs<T extends File$accessLogsArgs<ExtArgs> = {}>(args?: Subset<T, File$accessLogsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "findMany"> | Null>
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
   * Fields of the File model
   */ 
  interface FileFieldRefs {
    readonly id: FieldRef<"File", 'String'>
    readonly name: FieldRef<"File", 'String'>
    readonly type: FieldRef<"File", 'String'>
    readonly size: FieldRef<"File", 'Int'>
    readonly mimeType: FieldRef<"File", 'String'>
    readonly parentId: FieldRef<"File", 'String'>
    readonly ownerId: FieldRef<"File", 'String'>
    readonly path: FieldRef<"File", 'String'>
    readonly version: FieldRef<"File", 'Int'>
    readonly createdAt: FieldRef<"File", 'DateTime'>
    readonly updatedAt: FieldRef<"File", 'DateTime'>
    readonly deletedAt: FieldRef<"File", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * File findUnique
   */
  export type FileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * Filter, which File to fetch.
     */
    where: FileWhereUniqueInput
  }

  /**
   * File findUniqueOrThrow
   */
  export type FileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * Filter, which File to fetch.
     */
    where: FileWhereUniqueInput
  }

  /**
   * File findFirst
   */
  export type FileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * Filter, which File to fetch.
     */
    where?: FileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Files to fetch.
     */
    orderBy?: FileOrderByWithRelationInput | FileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Files.
     */
    cursor?: FileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Files from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Files.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Files.
     */
    distinct?: FileScalarFieldEnum | FileScalarFieldEnum[]
  }

  /**
   * File findFirstOrThrow
   */
  export type FileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * Filter, which File to fetch.
     */
    where?: FileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Files to fetch.
     */
    orderBy?: FileOrderByWithRelationInput | FileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Files.
     */
    cursor?: FileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Files from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Files.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Files.
     */
    distinct?: FileScalarFieldEnum | FileScalarFieldEnum[]
  }

  /**
   * File findMany
   */
  export type FileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * Filter, which Files to fetch.
     */
    where?: FileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Files to fetch.
     */
    orderBy?: FileOrderByWithRelationInput | FileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Files.
     */
    cursor?: FileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Files from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Files.
     */
    skip?: number
    distinct?: FileScalarFieldEnum | FileScalarFieldEnum[]
  }

  /**
   * File create
   */
  export type FileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * The data needed to create a File.
     */
    data: XOR<FileCreateInput, FileUncheckedCreateInput>
  }

  /**
   * File createMany
   */
  export type FileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Files.
     */
    data: FileCreateManyInput | FileCreateManyInput[]
  }

  /**
   * File createManyAndReturn
   */
  export type FileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Files.
     */
    data: FileCreateManyInput | FileCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * File update
   */
  export type FileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * The data needed to update a File.
     */
    data: XOR<FileUpdateInput, FileUncheckedUpdateInput>
    /**
     * Choose, which File to update.
     */
    where: FileWhereUniqueInput
  }

  /**
   * File updateMany
   */
  export type FileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Files.
     */
    data: XOR<FileUpdateManyMutationInput, FileUncheckedUpdateManyInput>
    /**
     * Filter which Files to update
     */
    where?: FileWhereInput
  }

  /**
   * File upsert
   */
  export type FileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * The filter to search for the File to update in case it exists.
     */
    where: FileWhereUniqueInput
    /**
     * In case the File found by the `where` argument doesn't exist, create a new File with this data.
     */
    create: XOR<FileCreateInput, FileUncheckedCreateInput>
    /**
     * In case the File was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FileUpdateInput, FileUncheckedUpdateInput>
  }

  /**
   * File delete
   */
  export type FileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    /**
     * Filter which File to delete.
     */
    where: FileWhereUniqueInput
  }

  /**
   * File deleteMany
   */
  export type FileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Files to delete
     */
    where?: FileWhereInput
  }

  /**
   * File.parent
   */
  export type File$parentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    where?: FileWhereInput
  }

  /**
   * File.children
   */
  export type File$childrenArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
    where?: FileWhereInput
    orderBy?: FileOrderByWithRelationInput | FileOrderByWithRelationInput[]
    cursor?: FileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: FileScalarFieldEnum | FileScalarFieldEnum[]
  }

  /**
   * File.versions
   */
  export type File$versionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    where?: FileVersionWhereInput
    orderBy?: FileVersionOrderByWithRelationInput | FileVersionOrderByWithRelationInput[]
    cursor?: FileVersionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: FileVersionScalarFieldEnum | FileVersionScalarFieldEnum[]
  }

  /**
   * File.tags
   */
  export type File$tagsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    where?: FileTagWhereInput
    orderBy?: FileTagOrderByWithRelationInput | FileTagOrderByWithRelationInput[]
    cursor?: FileTagWhereUniqueInput
    take?: number
    skip?: number
    distinct?: FileTagScalarFieldEnum | FileTagScalarFieldEnum[]
  }

  /**
   * File.accessLogs
   */
  export type File$accessLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    where?: FileAccessLogWhereInput
    orderBy?: FileAccessLogOrderByWithRelationInput | FileAccessLogOrderByWithRelationInput[]
    cursor?: FileAccessLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: FileAccessLogScalarFieldEnum | FileAccessLogScalarFieldEnum[]
  }

  /**
   * File without action
   */
  export type FileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the File
     */
    select?: FileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileInclude<ExtArgs> | null
  }


  /**
   * Model FileVersion
   */

  export type AggregateFileVersion = {
    _count: FileVersionCountAggregateOutputType | null
    _avg: FileVersionAvgAggregateOutputType | null
    _sum: FileVersionSumAggregateOutputType | null
    _min: FileVersionMinAggregateOutputType | null
    _max: FileVersionMaxAggregateOutputType | null
  }

  export type FileVersionAvgAggregateOutputType = {
    version: number | null
    size: number | null
  }

  export type FileVersionSumAggregateOutputType = {
    version: number | null
    size: number | null
  }

  export type FileVersionMinAggregateOutputType = {
    id: string | null
    fileId: string | null
    version: number | null
    size: number | null
    storagePath: string | null
    md5Hash: string | null
    comment: string | null
    createdAt: Date | null
  }

  export type FileVersionMaxAggregateOutputType = {
    id: string | null
    fileId: string | null
    version: number | null
    size: number | null
    storagePath: string | null
    md5Hash: string | null
    comment: string | null
    createdAt: Date | null
  }

  export type FileVersionCountAggregateOutputType = {
    id: number
    fileId: number
    version: number
    size: number
    storagePath: number
    md5Hash: number
    comment: number
    createdAt: number
    _all: number
  }


  export type FileVersionAvgAggregateInputType = {
    version?: true
    size?: true
  }

  export type FileVersionSumAggregateInputType = {
    version?: true
    size?: true
  }

  export type FileVersionMinAggregateInputType = {
    id?: true
    fileId?: true
    version?: true
    size?: true
    storagePath?: true
    md5Hash?: true
    comment?: true
    createdAt?: true
  }

  export type FileVersionMaxAggregateInputType = {
    id?: true
    fileId?: true
    version?: true
    size?: true
    storagePath?: true
    md5Hash?: true
    comment?: true
    createdAt?: true
  }

  export type FileVersionCountAggregateInputType = {
    id?: true
    fileId?: true
    version?: true
    size?: true
    storagePath?: true
    md5Hash?: true
    comment?: true
    createdAt?: true
    _all?: true
  }

  export type FileVersionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FileVersion to aggregate.
     */
    where?: FileVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileVersions to fetch.
     */
    orderBy?: FileVersionOrderByWithRelationInput | FileVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: FileVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned FileVersions
    **/
    _count?: true | FileVersionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: FileVersionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: FileVersionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: FileVersionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: FileVersionMaxAggregateInputType
  }

  export type GetFileVersionAggregateType<T extends FileVersionAggregateArgs> = {
        [P in keyof T & keyof AggregateFileVersion]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFileVersion[P]>
      : GetScalarType<T[P], AggregateFileVersion[P]>
  }




  export type FileVersionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileVersionWhereInput
    orderBy?: FileVersionOrderByWithAggregationInput | FileVersionOrderByWithAggregationInput[]
    by: FileVersionScalarFieldEnum[] | FileVersionScalarFieldEnum
    having?: FileVersionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: FileVersionCountAggregateInputType | true
    _avg?: FileVersionAvgAggregateInputType
    _sum?: FileVersionSumAggregateInputType
    _min?: FileVersionMinAggregateInputType
    _max?: FileVersionMaxAggregateInputType
  }

  export type FileVersionGroupByOutputType = {
    id: string
    fileId: string
    version: number
    size: number
    storagePath: string
    md5Hash: string
    comment: string | null
    createdAt: Date
    _count: FileVersionCountAggregateOutputType | null
    _avg: FileVersionAvgAggregateOutputType | null
    _sum: FileVersionSumAggregateOutputType | null
    _min: FileVersionMinAggregateOutputType | null
    _max: FileVersionMaxAggregateOutputType | null
  }

  type GetFileVersionGroupByPayload<T extends FileVersionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FileVersionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof FileVersionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FileVersionGroupByOutputType[P]>
            : GetScalarType<T[P], FileVersionGroupByOutputType[P]>
        }
      >
    >


  export type FileVersionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    version?: boolean
    size?: boolean
    storagePath?: boolean
    md5Hash?: boolean
    comment?: boolean
    createdAt?: boolean
    file?: boolean | FileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fileVersion"]>

  export type FileVersionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    version?: boolean
    size?: boolean
    storagePath?: boolean
    md5Hash?: boolean
    comment?: boolean
    createdAt?: boolean
    file?: boolean | FileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fileVersion"]>

  export type FileVersionSelectScalar = {
    id?: boolean
    fileId?: boolean
    version?: boolean
    size?: boolean
    storagePath?: boolean
    md5Hash?: boolean
    comment?: boolean
    createdAt?: boolean
  }

  export type FileVersionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    file?: boolean | FileDefaultArgs<ExtArgs>
  }
  export type FileVersionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    file?: boolean | FileDefaultArgs<ExtArgs>
  }

  export type $FileVersionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "FileVersion"
    objects: {
      file: Prisma.$FilePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      fileId: string
      version: number
      size: number
      storagePath: string
      md5Hash: string
      comment: string | null
      createdAt: Date
    }, ExtArgs["result"]["fileVersion"]>
    composites: {}
  }

  type FileVersionGetPayload<S extends boolean | null | undefined | FileVersionDefaultArgs> = $Result.GetResult<Prisma.$FileVersionPayload, S>

  type FileVersionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<FileVersionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: FileVersionCountAggregateInputType | true
    }

  export interface FileVersionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['FileVersion'], meta: { name: 'FileVersion' } }
    /**
     * Find zero or one FileVersion that matches the filter.
     * @param {FileVersionFindUniqueArgs} args - Arguments to find a FileVersion
     * @example
     * // Get one FileVersion
     * const fileVersion = await prisma.fileVersion.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FileVersionFindUniqueArgs>(args: SelectSubset<T, FileVersionFindUniqueArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one FileVersion that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {FileVersionFindUniqueOrThrowArgs} args - Arguments to find a FileVersion
     * @example
     * // Get one FileVersion
     * const fileVersion = await prisma.fileVersion.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FileVersionFindUniqueOrThrowArgs>(args: SelectSubset<T, FileVersionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first FileVersion that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileVersionFindFirstArgs} args - Arguments to find a FileVersion
     * @example
     * // Get one FileVersion
     * const fileVersion = await prisma.fileVersion.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FileVersionFindFirstArgs>(args?: SelectSubset<T, FileVersionFindFirstArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first FileVersion that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileVersionFindFirstOrThrowArgs} args - Arguments to find a FileVersion
     * @example
     * // Get one FileVersion
     * const fileVersion = await prisma.fileVersion.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FileVersionFindFirstOrThrowArgs>(args?: SelectSubset<T, FileVersionFindFirstOrThrowArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more FileVersions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileVersionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FileVersions
     * const fileVersions = await prisma.fileVersion.findMany()
     * 
     * // Get first 10 FileVersions
     * const fileVersions = await prisma.fileVersion.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const fileVersionWithIdOnly = await prisma.fileVersion.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends FileVersionFindManyArgs>(args?: SelectSubset<T, FileVersionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a FileVersion.
     * @param {FileVersionCreateArgs} args - Arguments to create a FileVersion.
     * @example
     * // Create one FileVersion
     * const FileVersion = await prisma.fileVersion.create({
     *   data: {
     *     // ... data to create a FileVersion
     *   }
     * })
     * 
     */
    create<T extends FileVersionCreateArgs>(args: SelectSubset<T, FileVersionCreateArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many FileVersions.
     * @param {FileVersionCreateManyArgs} args - Arguments to create many FileVersions.
     * @example
     * // Create many FileVersions
     * const fileVersion = await prisma.fileVersion.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends FileVersionCreateManyArgs>(args?: SelectSubset<T, FileVersionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many FileVersions and returns the data saved in the database.
     * @param {FileVersionCreateManyAndReturnArgs} args - Arguments to create many FileVersions.
     * @example
     * // Create many FileVersions
     * const fileVersion = await prisma.fileVersion.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many FileVersions and only return the `id`
     * const fileVersionWithIdOnly = await prisma.fileVersion.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends FileVersionCreateManyAndReturnArgs>(args?: SelectSubset<T, FileVersionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a FileVersion.
     * @param {FileVersionDeleteArgs} args - Arguments to delete one FileVersion.
     * @example
     * // Delete one FileVersion
     * const FileVersion = await prisma.fileVersion.delete({
     *   where: {
     *     // ... filter to delete one FileVersion
     *   }
     * })
     * 
     */
    delete<T extends FileVersionDeleteArgs>(args: SelectSubset<T, FileVersionDeleteArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one FileVersion.
     * @param {FileVersionUpdateArgs} args - Arguments to update one FileVersion.
     * @example
     * // Update one FileVersion
     * const fileVersion = await prisma.fileVersion.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends FileVersionUpdateArgs>(args: SelectSubset<T, FileVersionUpdateArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more FileVersions.
     * @param {FileVersionDeleteManyArgs} args - Arguments to filter FileVersions to delete.
     * @example
     * // Delete a few FileVersions
     * const { count } = await prisma.fileVersion.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends FileVersionDeleteManyArgs>(args?: SelectSubset<T, FileVersionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FileVersions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileVersionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FileVersions
     * const fileVersion = await prisma.fileVersion.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends FileVersionUpdateManyArgs>(args: SelectSubset<T, FileVersionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one FileVersion.
     * @param {FileVersionUpsertArgs} args - Arguments to update or create a FileVersion.
     * @example
     * // Update or create a FileVersion
     * const fileVersion = await prisma.fileVersion.upsert({
     *   create: {
     *     // ... data to create a FileVersion
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FileVersion we want to update
     *   }
     * })
     */
    upsert<T extends FileVersionUpsertArgs>(args: SelectSubset<T, FileVersionUpsertArgs<ExtArgs>>): Prisma__FileVersionClient<$Result.GetResult<Prisma.$FileVersionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of FileVersions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileVersionCountArgs} args - Arguments to filter FileVersions to count.
     * @example
     * // Count the number of FileVersions
     * const count = await prisma.fileVersion.count({
     *   where: {
     *     // ... the filter for the FileVersions we want to count
     *   }
     * })
    **/
    count<T extends FileVersionCountArgs>(
      args?: Subset<T, FileVersionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], FileVersionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a FileVersion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileVersionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends FileVersionAggregateArgs>(args: Subset<T, FileVersionAggregateArgs>): Prisma.PrismaPromise<GetFileVersionAggregateType<T>>

    /**
     * Group by FileVersion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileVersionGroupByArgs} args - Group by arguments.
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
      T extends FileVersionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FileVersionGroupByArgs['orderBy'] }
        : { orderBy?: FileVersionGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, FileVersionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetFileVersionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the FileVersion model
   */
  readonly fields: FileVersionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FileVersion.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FileVersionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    file<T extends FileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, FileDefaultArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
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
   * Fields of the FileVersion model
   */ 
  interface FileVersionFieldRefs {
    readonly id: FieldRef<"FileVersion", 'String'>
    readonly fileId: FieldRef<"FileVersion", 'String'>
    readonly version: FieldRef<"FileVersion", 'Int'>
    readonly size: FieldRef<"FileVersion", 'Int'>
    readonly storagePath: FieldRef<"FileVersion", 'String'>
    readonly md5Hash: FieldRef<"FileVersion", 'String'>
    readonly comment: FieldRef<"FileVersion", 'String'>
    readonly createdAt: FieldRef<"FileVersion", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * FileVersion findUnique
   */
  export type FileVersionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * Filter, which FileVersion to fetch.
     */
    where: FileVersionWhereUniqueInput
  }

  /**
   * FileVersion findUniqueOrThrow
   */
  export type FileVersionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * Filter, which FileVersion to fetch.
     */
    where: FileVersionWhereUniqueInput
  }

  /**
   * FileVersion findFirst
   */
  export type FileVersionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * Filter, which FileVersion to fetch.
     */
    where?: FileVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileVersions to fetch.
     */
    orderBy?: FileVersionOrderByWithRelationInput | FileVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FileVersions.
     */
    cursor?: FileVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FileVersions.
     */
    distinct?: FileVersionScalarFieldEnum | FileVersionScalarFieldEnum[]
  }

  /**
   * FileVersion findFirstOrThrow
   */
  export type FileVersionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * Filter, which FileVersion to fetch.
     */
    where?: FileVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileVersions to fetch.
     */
    orderBy?: FileVersionOrderByWithRelationInput | FileVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FileVersions.
     */
    cursor?: FileVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileVersions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FileVersions.
     */
    distinct?: FileVersionScalarFieldEnum | FileVersionScalarFieldEnum[]
  }

  /**
   * FileVersion findMany
   */
  export type FileVersionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * Filter, which FileVersions to fetch.
     */
    where?: FileVersionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileVersions to fetch.
     */
    orderBy?: FileVersionOrderByWithRelationInput | FileVersionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing FileVersions.
     */
    cursor?: FileVersionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileVersions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileVersions.
     */
    skip?: number
    distinct?: FileVersionScalarFieldEnum | FileVersionScalarFieldEnum[]
  }

  /**
   * FileVersion create
   */
  export type FileVersionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * The data needed to create a FileVersion.
     */
    data: XOR<FileVersionCreateInput, FileVersionUncheckedCreateInput>
  }

  /**
   * FileVersion createMany
   */
  export type FileVersionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many FileVersions.
     */
    data: FileVersionCreateManyInput | FileVersionCreateManyInput[]
  }

  /**
   * FileVersion createManyAndReturn
   */
  export type FileVersionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many FileVersions.
     */
    data: FileVersionCreateManyInput | FileVersionCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * FileVersion update
   */
  export type FileVersionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * The data needed to update a FileVersion.
     */
    data: XOR<FileVersionUpdateInput, FileVersionUncheckedUpdateInput>
    /**
     * Choose, which FileVersion to update.
     */
    where: FileVersionWhereUniqueInput
  }

  /**
   * FileVersion updateMany
   */
  export type FileVersionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update FileVersions.
     */
    data: XOR<FileVersionUpdateManyMutationInput, FileVersionUncheckedUpdateManyInput>
    /**
     * Filter which FileVersions to update
     */
    where?: FileVersionWhereInput
  }

  /**
   * FileVersion upsert
   */
  export type FileVersionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * The filter to search for the FileVersion to update in case it exists.
     */
    where: FileVersionWhereUniqueInput
    /**
     * In case the FileVersion found by the `where` argument doesn't exist, create a new FileVersion with this data.
     */
    create: XOR<FileVersionCreateInput, FileVersionUncheckedCreateInput>
    /**
     * In case the FileVersion was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FileVersionUpdateInput, FileVersionUncheckedUpdateInput>
  }

  /**
   * FileVersion delete
   */
  export type FileVersionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
    /**
     * Filter which FileVersion to delete.
     */
    where: FileVersionWhereUniqueInput
  }

  /**
   * FileVersion deleteMany
   */
  export type FileVersionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FileVersions to delete
     */
    where?: FileVersionWhereInput
  }

  /**
   * FileVersion without action
   */
  export type FileVersionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileVersion
     */
    select?: FileVersionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileVersionInclude<ExtArgs> | null
  }


  /**
   * Model FileTag
   */

  export type AggregateFileTag = {
    _count: FileTagCountAggregateOutputType | null
    _min: FileTagMinAggregateOutputType | null
    _max: FileTagMaxAggregateOutputType | null
  }

  export type FileTagMinAggregateOutputType = {
    id: string | null
    fileId: string | null
    tagName: string | null
    createdAt: Date | null
  }

  export type FileTagMaxAggregateOutputType = {
    id: string | null
    fileId: string | null
    tagName: string | null
    createdAt: Date | null
  }

  export type FileTagCountAggregateOutputType = {
    id: number
    fileId: number
    tagName: number
    createdAt: number
    _all: number
  }


  export type FileTagMinAggregateInputType = {
    id?: true
    fileId?: true
    tagName?: true
    createdAt?: true
  }

  export type FileTagMaxAggregateInputType = {
    id?: true
    fileId?: true
    tagName?: true
    createdAt?: true
  }

  export type FileTagCountAggregateInputType = {
    id?: true
    fileId?: true
    tagName?: true
    createdAt?: true
    _all?: true
  }

  export type FileTagAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FileTag to aggregate.
     */
    where?: FileTagWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileTags to fetch.
     */
    orderBy?: FileTagOrderByWithRelationInput | FileTagOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: FileTagWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileTags from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileTags.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned FileTags
    **/
    _count?: true | FileTagCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: FileTagMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: FileTagMaxAggregateInputType
  }

  export type GetFileTagAggregateType<T extends FileTagAggregateArgs> = {
        [P in keyof T & keyof AggregateFileTag]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFileTag[P]>
      : GetScalarType<T[P], AggregateFileTag[P]>
  }




  export type FileTagGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileTagWhereInput
    orderBy?: FileTagOrderByWithAggregationInput | FileTagOrderByWithAggregationInput[]
    by: FileTagScalarFieldEnum[] | FileTagScalarFieldEnum
    having?: FileTagScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: FileTagCountAggregateInputType | true
    _min?: FileTagMinAggregateInputType
    _max?: FileTagMaxAggregateInputType
  }

  export type FileTagGroupByOutputType = {
    id: string
    fileId: string
    tagName: string
    createdAt: Date
    _count: FileTagCountAggregateOutputType | null
    _min: FileTagMinAggregateOutputType | null
    _max: FileTagMaxAggregateOutputType | null
  }

  type GetFileTagGroupByPayload<T extends FileTagGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FileTagGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof FileTagGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FileTagGroupByOutputType[P]>
            : GetScalarType<T[P], FileTagGroupByOutputType[P]>
        }
      >
    >


  export type FileTagSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    tagName?: boolean
    createdAt?: boolean
    file?: boolean | FileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fileTag"]>

  export type FileTagSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    tagName?: boolean
    createdAt?: boolean
    file?: boolean | FileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fileTag"]>

  export type FileTagSelectScalar = {
    id?: boolean
    fileId?: boolean
    tagName?: boolean
    createdAt?: boolean
  }

  export type FileTagInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    file?: boolean | FileDefaultArgs<ExtArgs>
  }
  export type FileTagIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    file?: boolean | FileDefaultArgs<ExtArgs>
  }

  export type $FileTagPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "FileTag"
    objects: {
      file: Prisma.$FilePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      fileId: string
      tagName: string
      createdAt: Date
    }, ExtArgs["result"]["fileTag"]>
    composites: {}
  }

  type FileTagGetPayload<S extends boolean | null | undefined | FileTagDefaultArgs> = $Result.GetResult<Prisma.$FileTagPayload, S>

  type FileTagCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<FileTagFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: FileTagCountAggregateInputType | true
    }

  export interface FileTagDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['FileTag'], meta: { name: 'FileTag' } }
    /**
     * Find zero or one FileTag that matches the filter.
     * @param {FileTagFindUniqueArgs} args - Arguments to find a FileTag
     * @example
     * // Get one FileTag
     * const fileTag = await prisma.fileTag.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FileTagFindUniqueArgs>(args: SelectSubset<T, FileTagFindUniqueArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one FileTag that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {FileTagFindUniqueOrThrowArgs} args - Arguments to find a FileTag
     * @example
     * // Get one FileTag
     * const fileTag = await prisma.fileTag.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FileTagFindUniqueOrThrowArgs>(args: SelectSubset<T, FileTagFindUniqueOrThrowArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first FileTag that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileTagFindFirstArgs} args - Arguments to find a FileTag
     * @example
     * // Get one FileTag
     * const fileTag = await prisma.fileTag.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FileTagFindFirstArgs>(args?: SelectSubset<T, FileTagFindFirstArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first FileTag that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileTagFindFirstOrThrowArgs} args - Arguments to find a FileTag
     * @example
     * // Get one FileTag
     * const fileTag = await prisma.fileTag.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FileTagFindFirstOrThrowArgs>(args?: SelectSubset<T, FileTagFindFirstOrThrowArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more FileTags that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileTagFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FileTags
     * const fileTags = await prisma.fileTag.findMany()
     * 
     * // Get first 10 FileTags
     * const fileTags = await prisma.fileTag.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const fileTagWithIdOnly = await prisma.fileTag.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends FileTagFindManyArgs>(args?: SelectSubset<T, FileTagFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a FileTag.
     * @param {FileTagCreateArgs} args - Arguments to create a FileTag.
     * @example
     * // Create one FileTag
     * const FileTag = await prisma.fileTag.create({
     *   data: {
     *     // ... data to create a FileTag
     *   }
     * })
     * 
     */
    create<T extends FileTagCreateArgs>(args: SelectSubset<T, FileTagCreateArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many FileTags.
     * @param {FileTagCreateManyArgs} args - Arguments to create many FileTags.
     * @example
     * // Create many FileTags
     * const fileTag = await prisma.fileTag.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends FileTagCreateManyArgs>(args?: SelectSubset<T, FileTagCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many FileTags and returns the data saved in the database.
     * @param {FileTagCreateManyAndReturnArgs} args - Arguments to create many FileTags.
     * @example
     * // Create many FileTags
     * const fileTag = await prisma.fileTag.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many FileTags and only return the `id`
     * const fileTagWithIdOnly = await prisma.fileTag.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends FileTagCreateManyAndReturnArgs>(args?: SelectSubset<T, FileTagCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a FileTag.
     * @param {FileTagDeleteArgs} args - Arguments to delete one FileTag.
     * @example
     * // Delete one FileTag
     * const FileTag = await prisma.fileTag.delete({
     *   where: {
     *     // ... filter to delete one FileTag
     *   }
     * })
     * 
     */
    delete<T extends FileTagDeleteArgs>(args: SelectSubset<T, FileTagDeleteArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one FileTag.
     * @param {FileTagUpdateArgs} args - Arguments to update one FileTag.
     * @example
     * // Update one FileTag
     * const fileTag = await prisma.fileTag.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends FileTagUpdateArgs>(args: SelectSubset<T, FileTagUpdateArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more FileTags.
     * @param {FileTagDeleteManyArgs} args - Arguments to filter FileTags to delete.
     * @example
     * // Delete a few FileTags
     * const { count } = await prisma.fileTag.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends FileTagDeleteManyArgs>(args?: SelectSubset<T, FileTagDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FileTags.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileTagUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FileTags
     * const fileTag = await prisma.fileTag.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends FileTagUpdateManyArgs>(args: SelectSubset<T, FileTagUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one FileTag.
     * @param {FileTagUpsertArgs} args - Arguments to update or create a FileTag.
     * @example
     * // Update or create a FileTag
     * const fileTag = await prisma.fileTag.upsert({
     *   create: {
     *     // ... data to create a FileTag
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FileTag we want to update
     *   }
     * })
     */
    upsert<T extends FileTagUpsertArgs>(args: SelectSubset<T, FileTagUpsertArgs<ExtArgs>>): Prisma__FileTagClient<$Result.GetResult<Prisma.$FileTagPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of FileTags.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileTagCountArgs} args - Arguments to filter FileTags to count.
     * @example
     * // Count the number of FileTags
     * const count = await prisma.fileTag.count({
     *   where: {
     *     // ... the filter for the FileTags we want to count
     *   }
     * })
    **/
    count<T extends FileTagCountArgs>(
      args?: Subset<T, FileTagCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], FileTagCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a FileTag.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileTagAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends FileTagAggregateArgs>(args: Subset<T, FileTagAggregateArgs>): Prisma.PrismaPromise<GetFileTagAggregateType<T>>

    /**
     * Group by FileTag.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileTagGroupByArgs} args - Group by arguments.
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
      T extends FileTagGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FileTagGroupByArgs['orderBy'] }
        : { orderBy?: FileTagGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, FileTagGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetFileTagGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the FileTag model
   */
  readonly fields: FileTagFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FileTag.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FileTagClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    file<T extends FileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, FileDefaultArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
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
   * Fields of the FileTag model
   */ 
  interface FileTagFieldRefs {
    readonly id: FieldRef<"FileTag", 'String'>
    readonly fileId: FieldRef<"FileTag", 'String'>
    readonly tagName: FieldRef<"FileTag", 'String'>
    readonly createdAt: FieldRef<"FileTag", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * FileTag findUnique
   */
  export type FileTagFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * Filter, which FileTag to fetch.
     */
    where: FileTagWhereUniqueInput
  }

  /**
   * FileTag findUniqueOrThrow
   */
  export type FileTagFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * Filter, which FileTag to fetch.
     */
    where: FileTagWhereUniqueInput
  }

  /**
   * FileTag findFirst
   */
  export type FileTagFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * Filter, which FileTag to fetch.
     */
    where?: FileTagWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileTags to fetch.
     */
    orderBy?: FileTagOrderByWithRelationInput | FileTagOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FileTags.
     */
    cursor?: FileTagWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileTags from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileTags.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FileTags.
     */
    distinct?: FileTagScalarFieldEnum | FileTagScalarFieldEnum[]
  }

  /**
   * FileTag findFirstOrThrow
   */
  export type FileTagFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * Filter, which FileTag to fetch.
     */
    where?: FileTagWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileTags to fetch.
     */
    orderBy?: FileTagOrderByWithRelationInput | FileTagOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FileTags.
     */
    cursor?: FileTagWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileTags from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileTags.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FileTags.
     */
    distinct?: FileTagScalarFieldEnum | FileTagScalarFieldEnum[]
  }

  /**
   * FileTag findMany
   */
  export type FileTagFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * Filter, which FileTags to fetch.
     */
    where?: FileTagWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileTags to fetch.
     */
    orderBy?: FileTagOrderByWithRelationInput | FileTagOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing FileTags.
     */
    cursor?: FileTagWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileTags from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileTags.
     */
    skip?: number
    distinct?: FileTagScalarFieldEnum | FileTagScalarFieldEnum[]
  }

  /**
   * FileTag create
   */
  export type FileTagCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * The data needed to create a FileTag.
     */
    data: XOR<FileTagCreateInput, FileTagUncheckedCreateInput>
  }

  /**
   * FileTag createMany
   */
  export type FileTagCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many FileTags.
     */
    data: FileTagCreateManyInput | FileTagCreateManyInput[]
  }

  /**
   * FileTag createManyAndReturn
   */
  export type FileTagCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many FileTags.
     */
    data: FileTagCreateManyInput | FileTagCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * FileTag update
   */
  export type FileTagUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * The data needed to update a FileTag.
     */
    data: XOR<FileTagUpdateInput, FileTagUncheckedUpdateInput>
    /**
     * Choose, which FileTag to update.
     */
    where: FileTagWhereUniqueInput
  }

  /**
   * FileTag updateMany
   */
  export type FileTagUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update FileTags.
     */
    data: XOR<FileTagUpdateManyMutationInput, FileTagUncheckedUpdateManyInput>
    /**
     * Filter which FileTags to update
     */
    where?: FileTagWhereInput
  }

  /**
   * FileTag upsert
   */
  export type FileTagUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * The filter to search for the FileTag to update in case it exists.
     */
    where: FileTagWhereUniqueInput
    /**
     * In case the FileTag found by the `where` argument doesn't exist, create a new FileTag with this data.
     */
    create: XOR<FileTagCreateInput, FileTagUncheckedCreateInput>
    /**
     * In case the FileTag was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FileTagUpdateInput, FileTagUncheckedUpdateInput>
  }

  /**
   * FileTag delete
   */
  export type FileTagDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
    /**
     * Filter which FileTag to delete.
     */
    where: FileTagWhereUniqueInput
  }

  /**
   * FileTag deleteMany
   */
  export type FileTagDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FileTags to delete
     */
    where?: FileTagWhereInput
  }

  /**
   * FileTag without action
   */
  export type FileTagDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileTag
     */
    select?: FileTagSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileTagInclude<ExtArgs> | null
  }


  /**
   * Model FileAccessLog
   */

  export type AggregateFileAccessLog = {
    _count: FileAccessLogCountAggregateOutputType | null
    _avg: FileAccessLogAvgAggregateOutputType | null
    _sum: FileAccessLogSumAggregateOutputType | null
    _min: FileAccessLogMinAggregateOutputType | null
    _max: FileAccessLogMaxAggregateOutputType | null
  }

  export type FileAccessLogAvgAggregateOutputType = {
    id: number | null
  }

  export type FileAccessLogSumAggregateOutputType = {
    id: number | null
  }

  export type FileAccessLogMinAggregateOutputType = {
    id: number | null
    fileId: string | null
    userId: string | null
    action: string | null
    ipAddress: string | null
    userAgent: string | null
    accessedAt: Date | null
  }

  export type FileAccessLogMaxAggregateOutputType = {
    id: number | null
    fileId: string | null
    userId: string | null
    action: string | null
    ipAddress: string | null
    userAgent: string | null
    accessedAt: Date | null
  }

  export type FileAccessLogCountAggregateOutputType = {
    id: number
    fileId: number
    userId: number
    action: number
    ipAddress: number
    userAgent: number
    accessedAt: number
    _all: number
  }


  export type FileAccessLogAvgAggregateInputType = {
    id?: true
  }

  export type FileAccessLogSumAggregateInputType = {
    id?: true
  }

  export type FileAccessLogMinAggregateInputType = {
    id?: true
    fileId?: true
    userId?: true
    action?: true
    ipAddress?: true
    userAgent?: true
    accessedAt?: true
  }

  export type FileAccessLogMaxAggregateInputType = {
    id?: true
    fileId?: true
    userId?: true
    action?: true
    ipAddress?: true
    userAgent?: true
    accessedAt?: true
  }

  export type FileAccessLogCountAggregateInputType = {
    id?: true
    fileId?: true
    userId?: true
    action?: true
    ipAddress?: true
    userAgent?: true
    accessedAt?: true
    _all?: true
  }

  export type FileAccessLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FileAccessLog to aggregate.
     */
    where?: FileAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileAccessLogs to fetch.
     */
    orderBy?: FileAccessLogOrderByWithRelationInput | FileAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: FileAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileAccessLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned FileAccessLogs
    **/
    _count?: true | FileAccessLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: FileAccessLogAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: FileAccessLogSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: FileAccessLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: FileAccessLogMaxAggregateInputType
  }

  export type GetFileAccessLogAggregateType<T extends FileAccessLogAggregateArgs> = {
        [P in keyof T & keyof AggregateFileAccessLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFileAccessLog[P]>
      : GetScalarType<T[P], AggregateFileAccessLog[P]>
  }




  export type FileAccessLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FileAccessLogWhereInput
    orderBy?: FileAccessLogOrderByWithAggregationInput | FileAccessLogOrderByWithAggregationInput[]
    by: FileAccessLogScalarFieldEnum[] | FileAccessLogScalarFieldEnum
    having?: FileAccessLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: FileAccessLogCountAggregateInputType | true
    _avg?: FileAccessLogAvgAggregateInputType
    _sum?: FileAccessLogSumAggregateInputType
    _min?: FileAccessLogMinAggregateInputType
    _max?: FileAccessLogMaxAggregateInputType
  }

  export type FileAccessLogGroupByOutputType = {
    id: number
    fileId: string
    userId: string
    action: string
    ipAddress: string | null
    userAgent: string | null
    accessedAt: Date
    _count: FileAccessLogCountAggregateOutputType | null
    _avg: FileAccessLogAvgAggregateOutputType | null
    _sum: FileAccessLogSumAggregateOutputType | null
    _min: FileAccessLogMinAggregateOutputType | null
    _max: FileAccessLogMaxAggregateOutputType | null
  }

  type GetFileAccessLogGroupByPayload<T extends FileAccessLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FileAccessLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof FileAccessLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FileAccessLogGroupByOutputType[P]>
            : GetScalarType<T[P], FileAccessLogGroupByOutputType[P]>
        }
      >
    >


  export type FileAccessLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    userId?: boolean
    action?: boolean
    ipAddress?: boolean
    userAgent?: boolean
    accessedAt?: boolean
    file?: boolean | FileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fileAccessLog"]>

  export type FileAccessLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fileId?: boolean
    userId?: boolean
    action?: boolean
    ipAddress?: boolean
    userAgent?: boolean
    accessedAt?: boolean
    file?: boolean | FileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fileAccessLog"]>

  export type FileAccessLogSelectScalar = {
    id?: boolean
    fileId?: boolean
    userId?: boolean
    action?: boolean
    ipAddress?: boolean
    userAgent?: boolean
    accessedAt?: boolean
  }

  export type FileAccessLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    file?: boolean | FileDefaultArgs<ExtArgs>
  }
  export type FileAccessLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    file?: boolean | FileDefaultArgs<ExtArgs>
  }

  export type $FileAccessLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "FileAccessLog"
    objects: {
      file: Prisma.$FilePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      fileId: string
      userId: string
      action: string
      ipAddress: string | null
      userAgent: string | null
      accessedAt: Date
    }, ExtArgs["result"]["fileAccessLog"]>
    composites: {}
  }

  type FileAccessLogGetPayload<S extends boolean | null | undefined | FileAccessLogDefaultArgs> = $Result.GetResult<Prisma.$FileAccessLogPayload, S>

  type FileAccessLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<FileAccessLogFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: FileAccessLogCountAggregateInputType | true
    }

  export interface FileAccessLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['FileAccessLog'], meta: { name: 'FileAccessLog' } }
    /**
     * Find zero or one FileAccessLog that matches the filter.
     * @param {FileAccessLogFindUniqueArgs} args - Arguments to find a FileAccessLog
     * @example
     * // Get one FileAccessLog
     * const fileAccessLog = await prisma.fileAccessLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FileAccessLogFindUniqueArgs>(args: SelectSubset<T, FileAccessLogFindUniqueArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one FileAccessLog that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {FileAccessLogFindUniqueOrThrowArgs} args - Arguments to find a FileAccessLog
     * @example
     * // Get one FileAccessLog
     * const fileAccessLog = await prisma.fileAccessLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FileAccessLogFindUniqueOrThrowArgs>(args: SelectSubset<T, FileAccessLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first FileAccessLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAccessLogFindFirstArgs} args - Arguments to find a FileAccessLog
     * @example
     * // Get one FileAccessLog
     * const fileAccessLog = await prisma.fileAccessLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FileAccessLogFindFirstArgs>(args?: SelectSubset<T, FileAccessLogFindFirstArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first FileAccessLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAccessLogFindFirstOrThrowArgs} args - Arguments to find a FileAccessLog
     * @example
     * // Get one FileAccessLog
     * const fileAccessLog = await prisma.fileAccessLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FileAccessLogFindFirstOrThrowArgs>(args?: SelectSubset<T, FileAccessLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more FileAccessLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAccessLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FileAccessLogs
     * const fileAccessLogs = await prisma.fileAccessLog.findMany()
     * 
     * // Get first 10 FileAccessLogs
     * const fileAccessLogs = await prisma.fileAccessLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const fileAccessLogWithIdOnly = await prisma.fileAccessLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends FileAccessLogFindManyArgs>(args?: SelectSubset<T, FileAccessLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a FileAccessLog.
     * @param {FileAccessLogCreateArgs} args - Arguments to create a FileAccessLog.
     * @example
     * // Create one FileAccessLog
     * const FileAccessLog = await prisma.fileAccessLog.create({
     *   data: {
     *     // ... data to create a FileAccessLog
     *   }
     * })
     * 
     */
    create<T extends FileAccessLogCreateArgs>(args: SelectSubset<T, FileAccessLogCreateArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many FileAccessLogs.
     * @param {FileAccessLogCreateManyArgs} args - Arguments to create many FileAccessLogs.
     * @example
     * // Create many FileAccessLogs
     * const fileAccessLog = await prisma.fileAccessLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends FileAccessLogCreateManyArgs>(args?: SelectSubset<T, FileAccessLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many FileAccessLogs and returns the data saved in the database.
     * @param {FileAccessLogCreateManyAndReturnArgs} args - Arguments to create many FileAccessLogs.
     * @example
     * // Create many FileAccessLogs
     * const fileAccessLog = await prisma.fileAccessLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many FileAccessLogs and only return the `id`
     * const fileAccessLogWithIdOnly = await prisma.fileAccessLog.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends FileAccessLogCreateManyAndReturnArgs>(args?: SelectSubset<T, FileAccessLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a FileAccessLog.
     * @param {FileAccessLogDeleteArgs} args - Arguments to delete one FileAccessLog.
     * @example
     * // Delete one FileAccessLog
     * const FileAccessLog = await prisma.fileAccessLog.delete({
     *   where: {
     *     // ... filter to delete one FileAccessLog
     *   }
     * })
     * 
     */
    delete<T extends FileAccessLogDeleteArgs>(args: SelectSubset<T, FileAccessLogDeleteArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one FileAccessLog.
     * @param {FileAccessLogUpdateArgs} args - Arguments to update one FileAccessLog.
     * @example
     * // Update one FileAccessLog
     * const fileAccessLog = await prisma.fileAccessLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends FileAccessLogUpdateArgs>(args: SelectSubset<T, FileAccessLogUpdateArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more FileAccessLogs.
     * @param {FileAccessLogDeleteManyArgs} args - Arguments to filter FileAccessLogs to delete.
     * @example
     * // Delete a few FileAccessLogs
     * const { count } = await prisma.fileAccessLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends FileAccessLogDeleteManyArgs>(args?: SelectSubset<T, FileAccessLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FileAccessLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAccessLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FileAccessLogs
     * const fileAccessLog = await prisma.fileAccessLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends FileAccessLogUpdateManyArgs>(args: SelectSubset<T, FileAccessLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one FileAccessLog.
     * @param {FileAccessLogUpsertArgs} args - Arguments to update or create a FileAccessLog.
     * @example
     * // Update or create a FileAccessLog
     * const fileAccessLog = await prisma.fileAccessLog.upsert({
     *   create: {
     *     // ... data to create a FileAccessLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FileAccessLog we want to update
     *   }
     * })
     */
    upsert<T extends FileAccessLogUpsertArgs>(args: SelectSubset<T, FileAccessLogUpsertArgs<ExtArgs>>): Prisma__FileAccessLogClient<$Result.GetResult<Prisma.$FileAccessLogPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of FileAccessLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAccessLogCountArgs} args - Arguments to filter FileAccessLogs to count.
     * @example
     * // Count the number of FileAccessLogs
     * const count = await prisma.fileAccessLog.count({
     *   where: {
     *     // ... the filter for the FileAccessLogs we want to count
     *   }
     * })
    **/
    count<T extends FileAccessLogCountArgs>(
      args?: Subset<T, FileAccessLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], FileAccessLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a FileAccessLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAccessLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends FileAccessLogAggregateArgs>(args: Subset<T, FileAccessLogAggregateArgs>): Prisma.PrismaPromise<GetFileAccessLogAggregateType<T>>

    /**
     * Group by FileAccessLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FileAccessLogGroupByArgs} args - Group by arguments.
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
      T extends FileAccessLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FileAccessLogGroupByArgs['orderBy'] }
        : { orderBy?: FileAccessLogGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, FileAccessLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetFileAccessLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the FileAccessLog model
   */
  readonly fields: FileAccessLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FileAccessLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FileAccessLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    file<T extends FileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, FileDefaultArgs<ExtArgs>>): Prisma__FileClient<$Result.GetResult<Prisma.$FilePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
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
   * Fields of the FileAccessLog model
   */ 
  interface FileAccessLogFieldRefs {
    readonly id: FieldRef<"FileAccessLog", 'Int'>
    readonly fileId: FieldRef<"FileAccessLog", 'String'>
    readonly userId: FieldRef<"FileAccessLog", 'String'>
    readonly action: FieldRef<"FileAccessLog", 'String'>
    readonly ipAddress: FieldRef<"FileAccessLog", 'String'>
    readonly userAgent: FieldRef<"FileAccessLog", 'String'>
    readonly accessedAt: FieldRef<"FileAccessLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * FileAccessLog findUnique
   */
  export type FileAccessLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which FileAccessLog to fetch.
     */
    where: FileAccessLogWhereUniqueInput
  }

  /**
   * FileAccessLog findUniqueOrThrow
   */
  export type FileAccessLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which FileAccessLog to fetch.
     */
    where: FileAccessLogWhereUniqueInput
  }

  /**
   * FileAccessLog findFirst
   */
  export type FileAccessLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which FileAccessLog to fetch.
     */
    where?: FileAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileAccessLogs to fetch.
     */
    orderBy?: FileAccessLogOrderByWithRelationInput | FileAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FileAccessLogs.
     */
    cursor?: FileAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileAccessLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FileAccessLogs.
     */
    distinct?: FileAccessLogScalarFieldEnum | FileAccessLogScalarFieldEnum[]
  }

  /**
   * FileAccessLog findFirstOrThrow
   */
  export type FileAccessLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which FileAccessLog to fetch.
     */
    where?: FileAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileAccessLogs to fetch.
     */
    orderBy?: FileAccessLogOrderByWithRelationInput | FileAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FileAccessLogs.
     */
    cursor?: FileAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileAccessLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FileAccessLogs.
     */
    distinct?: FileAccessLogScalarFieldEnum | FileAccessLogScalarFieldEnum[]
  }

  /**
   * FileAccessLog findMany
   */
  export type FileAccessLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * Filter, which FileAccessLogs to fetch.
     */
    where?: FileAccessLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FileAccessLogs to fetch.
     */
    orderBy?: FileAccessLogOrderByWithRelationInput | FileAccessLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing FileAccessLogs.
     */
    cursor?: FileAccessLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FileAccessLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FileAccessLogs.
     */
    skip?: number
    distinct?: FileAccessLogScalarFieldEnum | FileAccessLogScalarFieldEnum[]
  }

  /**
   * FileAccessLog create
   */
  export type FileAccessLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * The data needed to create a FileAccessLog.
     */
    data: XOR<FileAccessLogCreateInput, FileAccessLogUncheckedCreateInput>
  }

  /**
   * FileAccessLog createMany
   */
  export type FileAccessLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many FileAccessLogs.
     */
    data: FileAccessLogCreateManyInput | FileAccessLogCreateManyInput[]
  }

  /**
   * FileAccessLog createManyAndReturn
   */
  export type FileAccessLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many FileAccessLogs.
     */
    data: FileAccessLogCreateManyInput | FileAccessLogCreateManyInput[]
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * FileAccessLog update
   */
  export type FileAccessLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * The data needed to update a FileAccessLog.
     */
    data: XOR<FileAccessLogUpdateInput, FileAccessLogUncheckedUpdateInput>
    /**
     * Choose, which FileAccessLog to update.
     */
    where: FileAccessLogWhereUniqueInput
  }

  /**
   * FileAccessLog updateMany
   */
  export type FileAccessLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update FileAccessLogs.
     */
    data: XOR<FileAccessLogUpdateManyMutationInput, FileAccessLogUncheckedUpdateManyInput>
    /**
     * Filter which FileAccessLogs to update
     */
    where?: FileAccessLogWhereInput
  }

  /**
   * FileAccessLog upsert
   */
  export type FileAccessLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * The filter to search for the FileAccessLog to update in case it exists.
     */
    where: FileAccessLogWhereUniqueInput
    /**
     * In case the FileAccessLog found by the `where` argument doesn't exist, create a new FileAccessLog with this data.
     */
    create: XOR<FileAccessLogCreateInput, FileAccessLogUncheckedCreateInput>
    /**
     * In case the FileAccessLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FileAccessLogUpdateInput, FileAccessLogUncheckedUpdateInput>
  }

  /**
   * FileAccessLog delete
   */
  export type FileAccessLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
    /**
     * Filter which FileAccessLog to delete.
     */
    where: FileAccessLogWhereUniqueInput
  }

  /**
   * FileAccessLog deleteMany
   */
  export type FileAccessLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FileAccessLogs to delete
     */
    where?: FileAccessLogWhereInput
  }

  /**
   * FileAccessLog without action
   */
  export type FileAccessLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FileAccessLog
     */
    select?: FileAccessLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FileAccessLogInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const FileScalarFieldEnum: {
    id: 'id',
    name: 'name',
    type: 'type',
    size: 'size',
    mimeType: 'mimeType',
    parentId: 'parentId',
    ownerId: 'ownerId',
    path: 'path',
    version: 'version',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt'
  };

  export type FileScalarFieldEnum = (typeof FileScalarFieldEnum)[keyof typeof FileScalarFieldEnum]


  export const FileVersionScalarFieldEnum: {
    id: 'id',
    fileId: 'fileId',
    version: 'version',
    size: 'size',
    storagePath: 'storagePath',
    md5Hash: 'md5Hash',
    comment: 'comment',
    createdAt: 'createdAt'
  };

  export type FileVersionScalarFieldEnum = (typeof FileVersionScalarFieldEnum)[keyof typeof FileVersionScalarFieldEnum]


  export const FileTagScalarFieldEnum: {
    id: 'id',
    fileId: 'fileId',
    tagName: 'tagName',
    createdAt: 'createdAt'
  };

  export type FileTagScalarFieldEnum = (typeof FileTagScalarFieldEnum)[keyof typeof FileTagScalarFieldEnum]


  export const FileAccessLogScalarFieldEnum: {
    id: 'id',
    fileId: 'fileId',
    userId: 'userId',
    action: 'action',
    ipAddress: 'ipAddress',
    userAgent: 'userAgent',
    accessedAt: 'accessedAt'
  };

  export type FileAccessLogScalarFieldEnum = (typeof FileAccessLogScalarFieldEnum)[keyof typeof FileAccessLogScalarFieldEnum]


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


  export type FileWhereInput = {
    AND?: FileWhereInput | FileWhereInput[]
    OR?: FileWhereInput[]
    NOT?: FileWhereInput | FileWhereInput[]
    id?: StringFilter<"File"> | string
    name?: StringFilter<"File"> | string
    type?: StringFilter<"File"> | string
    size?: IntNullableFilter<"File"> | number | null
    mimeType?: StringNullableFilter<"File"> | string | null
    parentId?: StringNullableFilter<"File"> | string | null
    ownerId?: StringFilter<"File"> | string
    path?: StringFilter<"File"> | string
    version?: IntFilter<"File"> | number
    createdAt?: DateTimeFilter<"File"> | Date | string
    updatedAt?: DateTimeFilter<"File"> | Date | string
    deletedAt?: DateTimeNullableFilter<"File"> | Date | string | null
    parent?: XOR<FileNullableRelationFilter, FileWhereInput> | null
    children?: FileListRelationFilter
    versions?: FileVersionListRelationFilter
    tags?: FileTagListRelationFilter
    accessLogs?: FileAccessLogListRelationFilter
  }

  export type FileOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    size?: SortOrderInput | SortOrder
    mimeType?: SortOrderInput | SortOrder
    parentId?: SortOrderInput | SortOrder
    ownerId?: SortOrder
    path?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    parent?: FileOrderByWithRelationInput
    children?: FileOrderByRelationAggregateInput
    versions?: FileVersionOrderByRelationAggregateInput
    tags?: FileTagOrderByRelationAggregateInput
    accessLogs?: FileAccessLogOrderByRelationAggregateInput
  }

  export type FileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: FileWhereInput | FileWhereInput[]
    OR?: FileWhereInput[]
    NOT?: FileWhereInput | FileWhereInput[]
    name?: StringFilter<"File"> | string
    type?: StringFilter<"File"> | string
    size?: IntNullableFilter<"File"> | number | null
    mimeType?: StringNullableFilter<"File"> | string | null
    parentId?: StringNullableFilter<"File"> | string | null
    ownerId?: StringFilter<"File"> | string
    path?: StringFilter<"File"> | string
    version?: IntFilter<"File"> | number
    createdAt?: DateTimeFilter<"File"> | Date | string
    updatedAt?: DateTimeFilter<"File"> | Date | string
    deletedAt?: DateTimeNullableFilter<"File"> | Date | string | null
    parent?: XOR<FileNullableRelationFilter, FileWhereInput> | null
    children?: FileListRelationFilter
    versions?: FileVersionListRelationFilter
    tags?: FileTagListRelationFilter
    accessLogs?: FileAccessLogListRelationFilter
  }, "id">

  export type FileOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    size?: SortOrderInput | SortOrder
    mimeType?: SortOrderInput | SortOrder
    parentId?: SortOrderInput | SortOrder
    ownerId?: SortOrder
    path?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    _count?: FileCountOrderByAggregateInput
    _avg?: FileAvgOrderByAggregateInput
    _max?: FileMaxOrderByAggregateInput
    _min?: FileMinOrderByAggregateInput
    _sum?: FileSumOrderByAggregateInput
  }

  export type FileScalarWhereWithAggregatesInput = {
    AND?: FileScalarWhereWithAggregatesInput | FileScalarWhereWithAggregatesInput[]
    OR?: FileScalarWhereWithAggregatesInput[]
    NOT?: FileScalarWhereWithAggregatesInput | FileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"File"> | string
    name?: StringWithAggregatesFilter<"File"> | string
    type?: StringWithAggregatesFilter<"File"> | string
    size?: IntNullableWithAggregatesFilter<"File"> | number | null
    mimeType?: StringNullableWithAggregatesFilter<"File"> | string | null
    parentId?: StringNullableWithAggregatesFilter<"File"> | string | null
    ownerId?: StringWithAggregatesFilter<"File"> | string
    path?: StringWithAggregatesFilter<"File"> | string
    version?: IntWithAggregatesFilter<"File"> | number
    createdAt?: DateTimeWithAggregatesFilter<"File"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"File"> | Date | string
    deletedAt?: DateTimeNullableWithAggregatesFilter<"File"> | Date | string | null
  }

  export type FileVersionWhereInput = {
    AND?: FileVersionWhereInput | FileVersionWhereInput[]
    OR?: FileVersionWhereInput[]
    NOT?: FileVersionWhereInput | FileVersionWhereInput[]
    id?: StringFilter<"FileVersion"> | string
    fileId?: StringFilter<"FileVersion"> | string
    version?: IntFilter<"FileVersion"> | number
    size?: IntFilter<"FileVersion"> | number
    storagePath?: StringFilter<"FileVersion"> | string
    md5Hash?: StringFilter<"FileVersion"> | string
    comment?: StringNullableFilter<"FileVersion"> | string | null
    createdAt?: DateTimeFilter<"FileVersion"> | Date | string
    file?: XOR<FileRelationFilter, FileWhereInput>
  }

  export type FileVersionOrderByWithRelationInput = {
    id?: SortOrder
    fileId?: SortOrder
    version?: SortOrder
    size?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    comment?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    file?: FileOrderByWithRelationInput
  }

  export type FileVersionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    fileId_version?: FileVersionFileIdVersionCompoundUniqueInput
    AND?: FileVersionWhereInput | FileVersionWhereInput[]
    OR?: FileVersionWhereInput[]
    NOT?: FileVersionWhereInput | FileVersionWhereInput[]
    fileId?: StringFilter<"FileVersion"> | string
    version?: IntFilter<"FileVersion"> | number
    size?: IntFilter<"FileVersion"> | number
    storagePath?: StringFilter<"FileVersion"> | string
    md5Hash?: StringFilter<"FileVersion"> | string
    comment?: StringNullableFilter<"FileVersion"> | string | null
    createdAt?: DateTimeFilter<"FileVersion"> | Date | string
    file?: XOR<FileRelationFilter, FileWhereInput>
  }, "id" | "fileId_version">

  export type FileVersionOrderByWithAggregationInput = {
    id?: SortOrder
    fileId?: SortOrder
    version?: SortOrder
    size?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    comment?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: FileVersionCountOrderByAggregateInput
    _avg?: FileVersionAvgOrderByAggregateInput
    _max?: FileVersionMaxOrderByAggregateInput
    _min?: FileVersionMinOrderByAggregateInput
    _sum?: FileVersionSumOrderByAggregateInput
  }

  export type FileVersionScalarWhereWithAggregatesInput = {
    AND?: FileVersionScalarWhereWithAggregatesInput | FileVersionScalarWhereWithAggregatesInput[]
    OR?: FileVersionScalarWhereWithAggregatesInput[]
    NOT?: FileVersionScalarWhereWithAggregatesInput | FileVersionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"FileVersion"> | string
    fileId?: StringWithAggregatesFilter<"FileVersion"> | string
    version?: IntWithAggregatesFilter<"FileVersion"> | number
    size?: IntWithAggregatesFilter<"FileVersion"> | number
    storagePath?: StringWithAggregatesFilter<"FileVersion"> | string
    md5Hash?: StringWithAggregatesFilter<"FileVersion"> | string
    comment?: StringNullableWithAggregatesFilter<"FileVersion"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"FileVersion"> | Date | string
  }

  export type FileTagWhereInput = {
    AND?: FileTagWhereInput | FileTagWhereInput[]
    OR?: FileTagWhereInput[]
    NOT?: FileTagWhereInput | FileTagWhereInput[]
    id?: StringFilter<"FileTag"> | string
    fileId?: StringFilter<"FileTag"> | string
    tagName?: StringFilter<"FileTag"> | string
    createdAt?: DateTimeFilter<"FileTag"> | Date | string
    file?: XOR<FileRelationFilter, FileWhereInput>
  }

  export type FileTagOrderByWithRelationInput = {
    id?: SortOrder
    fileId?: SortOrder
    tagName?: SortOrder
    createdAt?: SortOrder
    file?: FileOrderByWithRelationInput
  }

  export type FileTagWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: FileTagWhereInput | FileTagWhereInput[]
    OR?: FileTagWhereInput[]
    NOT?: FileTagWhereInput | FileTagWhereInput[]
    fileId?: StringFilter<"FileTag"> | string
    tagName?: StringFilter<"FileTag"> | string
    createdAt?: DateTimeFilter<"FileTag"> | Date | string
    file?: XOR<FileRelationFilter, FileWhereInput>
  }, "id">

  export type FileTagOrderByWithAggregationInput = {
    id?: SortOrder
    fileId?: SortOrder
    tagName?: SortOrder
    createdAt?: SortOrder
    _count?: FileTagCountOrderByAggregateInput
    _max?: FileTagMaxOrderByAggregateInput
    _min?: FileTagMinOrderByAggregateInput
  }

  export type FileTagScalarWhereWithAggregatesInput = {
    AND?: FileTagScalarWhereWithAggregatesInput | FileTagScalarWhereWithAggregatesInput[]
    OR?: FileTagScalarWhereWithAggregatesInput[]
    NOT?: FileTagScalarWhereWithAggregatesInput | FileTagScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"FileTag"> | string
    fileId?: StringWithAggregatesFilter<"FileTag"> | string
    tagName?: StringWithAggregatesFilter<"FileTag"> | string
    createdAt?: DateTimeWithAggregatesFilter<"FileTag"> | Date | string
  }

  export type FileAccessLogWhereInput = {
    AND?: FileAccessLogWhereInput | FileAccessLogWhereInput[]
    OR?: FileAccessLogWhereInput[]
    NOT?: FileAccessLogWhereInput | FileAccessLogWhereInput[]
    id?: IntFilter<"FileAccessLog"> | number
    fileId?: StringFilter<"FileAccessLog"> | string
    userId?: StringFilter<"FileAccessLog"> | string
    action?: StringFilter<"FileAccessLog"> | string
    ipAddress?: StringNullableFilter<"FileAccessLog"> | string | null
    userAgent?: StringNullableFilter<"FileAccessLog"> | string | null
    accessedAt?: DateTimeFilter<"FileAccessLog"> | Date | string
    file?: XOR<FileRelationFilter, FileWhereInput>
  }

  export type FileAccessLogOrderByWithRelationInput = {
    id?: SortOrder
    fileId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    ipAddress?: SortOrderInput | SortOrder
    userAgent?: SortOrderInput | SortOrder
    accessedAt?: SortOrder
    file?: FileOrderByWithRelationInput
  }

  export type FileAccessLogWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: FileAccessLogWhereInput | FileAccessLogWhereInput[]
    OR?: FileAccessLogWhereInput[]
    NOT?: FileAccessLogWhereInput | FileAccessLogWhereInput[]
    fileId?: StringFilter<"FileAccessLog"> | string
    userId?: StringFilter<"FileAccessLog"> | string
    action?: StringFilter<"FileAccessLog"> | string
    ipAddress?: StringNullableFilter<"FileAccessLog"> | string | null
    userAgent?: StringNullableFilter<"FileAccessLog"> | string | null
    accessedAt?: DateTimeFilter<"FileAccessLog"> | Date | string
    file?: XOR<FileRelationFilter, FileWhereInput>
  }, "id">

  export type FileAccessLogOrderByWithAggregationInput = {
    id?: SortOrder
    fileId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    ipAddress?: SortOrderInput | SortOrder
    userAgent?: SortOrderInput | SortOrder
    accessedAt?: SortOrder
    _count?: FileAccessLogCountOrderByAggregateInput
    _avg?: FileAccessLogAvgOrderByAggregateInput
    _max?: FileAccessLogMaxOrderByAggregateInput
    _min?: FileAccessLogMinOrderByAggregateInput
    _sum?: FileAccessLogSumOrderByAggregateInput
  }

  export type FileAccessLogScalarWhereWithAggregatesInput = {
    AND?: FileAccessLogScalarWhereWithAggregatesInput | FileAccessLogScalarWhereWithAggregatesInput[]
    OR?: FileAccessLogScalarWhereWithAggregatesInput[]
    NOT?: FileAccessLogScalarWhereWithAggregatesInput | FileAccessLogScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"FileAccessLog"> | number
    fileId?: StringWithAggregatesFilter<"FileAccessLog"> | string
    userId?: StringWithAggregatesFilter<"FileAccessLog"> | string
    action?: StringWithAggregatesFilter<"FileAccessLog"> | string
    ipAddress?: StringNullableWithAggregatesFilter<"FileAccessLog"> | string | null
    userAgent?: StringNullableWithAggregatesFilter<"FileAccessLog"> | string | null
    accessedAt?: DateTimeWithAggregatesFilter<"FileAccessLog"> | Date | string
  }

  export type FileCreateInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    parent?: FileCreateNestedOneWithoutChildrenInput
    children?: FileCreateNestedManyWithoutParentInput
    versions?: FileVersionCreateNestedManyWithoutFileInput
    tags?: FileTagCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogCreateNestedManyWithoutFileInput
  }

  export type FileUncheckedCreateInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    parentId?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    children?: FileUncheckedCreateNestedManyWithoutParentInput
    versions?: FileVersionUncheckedCreateNestedManyWithoutFileInput
    tags?: FileTagUncheckedCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogUncheckedCreateNestedManyWithoutFileInput
  }

  export type FileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    parent?: FileUpdateOneWithoutChildrenNestedInput
    children?: FileUpdateManyWithoutParentNestedInput
    versions?: FileVersionUpdateManyWithoutFileNestedInput
    tags?: FileTagUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUpdateManyWithoutFileNestedInput
  }

  export type FileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    parentId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    children?: FileUncheckedUpdateManyWithoutParentNestedInput
    versions?: FileVersionUncheckedUpdateManyWithoutFileNestedInput
    tags?: FileTagUncheckedUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUncheckedUpdateManyWithoutFileNestedInput
  }

  export type FileCreateManyInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    parentId?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type FileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type FileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    parentId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type FileVersionCreateInput = {
    id: string
    version: number
    size: number
    storagePath: string
    md5Hash: string
    comment?: string | null
    createdAt?: Date | string
    file: FileCreateNestedOneWithoutVersionsInput
  }

  export type FileVersionUncheckedCreateInput = {
    id: string
    fileId: string
    version: number
    size: number
    storagePath: string
    md5Hash: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type FileVersionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    size?: IntFieldUpdateOperationsInput | number
    storagePath?: StringFieldUpdateOperationsInput | string
    md5Hash?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    file?: FileUpdateOneRequiredWithoutVersionsNestedInput
  }

  export type FileVersionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    size?: IntFieldUpdateOperationsInput | number
    storagePath?: StringFieldUpdateOperationsInput | string
    md5Hash?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileVersionCreateManyInput = {
    id: string
    fileId: string
    version: number
    size: number
    storagePath: string
    md5Hash: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type FileVersionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    size?: IntFieldUpdateOperationsInput | number
    storagePath?: StringFieldUpdateOperationsInput | string
    md5Hash?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileVersionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    size?: IntFieldUpdateOperationsInput | number
    storagePath?: StringFieldUpdateOperationsInput | string
    md5Hash?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileTagCreateInput = {
    id: string
    tagName: string
    createdAt?: Date | string
    file: FileCreateNestedOneWithoutTagsInput
  }

  export type FileTagUncheckedCreateInput = {
    id: string
    fileId: string
    tagName: string
    createdAt?: Date | string
  }

  export type FileTagUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tagName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    file?: FileUpdateOneRequiredWithoutTagsNestedInput
  }

  export type FileTagUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    tagName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileTagCreateManyInput = {
    id: string
    fileId: string
    tagName: string
    createdAt?: Date | string
  }

  export type FileTagUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tagName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileTagUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    tagName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileAccessLogCreateInput = {
    userId: string
    action: string
    ipAddress?: string | null
    userAgent?: string | null
    accessedAt?: Date | string
    file: FileCreateNestedOneWithoutAccessLogsInput
  }

  export type FileAccessLogUncheckedCreateInput = {
    id?: number
    fileId: string
    userId: string
    action: string
    ipAddress?: string | null
    userAgent?: string | null
    accessedAt?: Date | string
  }

  export type FileAccessLogUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    accessedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    file?: FileUpdateOneRequiredWithoutAccessLogsNestedInput
  }

  export type FileAccessLogUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    fileId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    accessedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileAccessLogCreateManyInput = {
    id?: number
    fileId: string
    userId: string
    action: string
    ipAddress?: string | null
    userAgent?: string | null
    accessedAt?: Date | string
  }

  export type FileAccessLogUpdateManyMutationInput = {
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    accessedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileAccessLogUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    fileId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    accessedAt?: DateTimeFieldUpdateOperationsInput | Date | string
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

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
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

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type FileNullableRelationFilter = {
    is?: FileWhereInput | null
    isNot?: FileWhereInput | null
  }

  export type FileListRelationFilter = {
    every?: FileWhereInput
    some?: FileWhereInput
    none?: FileWhereInput
  }

  export type FileVersionListRelationFilter = {
    every?: FileVersionWhereInput
    some?: FileVersionWhereInput
    none?: FileVersionWhereInput
  }

  export type FileTagListRelationFilter = {
    every?: FileTagWhereInput
    some?: FileTagWhereInput
    none?: FileTagWhereInput
  }

  export type FileAccessLogListRelationFilter = {
    every?: FileAccessLogWhereInput
    some?: FileAccessLogWhereInput
    none?: FileAccessLogWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type FileOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type FileVersionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type FileTagOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type FileAccessLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type FileCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    size?: SortOrder
    mimeType?: SortOrder
    parentId?: SortOrder
    ownerId?: SortOrder
    path?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type FileAvgOrderByAggregateInput = {
    size?: SortOrder
    version?: SortOrder
  }

  export type FileMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    size?: SortOrder
    mimeType?: SortOrder
    parentId?: SortOrder
    ownerId?: SortOrder
    path?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type FileMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    size?: SortOrder
    mimeType?: SortOrder
    parentId?: SortOrder
    ownerId?: SortOrder
    path?: SortOrder
    version?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type FileSumOrderByAggregateInput = {
    size?: SortOrder
    version?: SortOrder
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

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
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

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type FileRelationFilter = {
    is?: FileWhereInput
    isNot?: FileWhereInput
  }

  export type FileVersionFileIdVersionCompoundUniqueInput = {
    fileId: string
    version: number
  }

  export type FileVersionCountOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    version?: SortOrder
    size?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    comment?: SortOrder
    createdAt?: SortOrder
  }

  export type FileVersionAvgOrderByAggregateInput = {
    version?: SortOrder
    size?: SortOrder
  }

  export type FileVersionMaxOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    version?: SortOrder
    size?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    comment?: SortOrder
    createdAt?: SortOrder
  }

  export type FileVersionMinOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    version?: SortOrder
    size?: SortOrder
    storagePath?: SortOrder
    md5Hash?: SortOrder
    comment?: SortOrder
    createdAt?: SortOrder
  }

  export type FileVersionSumOrderByAggregateInput = {
    version?: SortOrder
    size?: SortOrder
  }

  export type FileTagCountOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    tagName?: SortOrder
    createdAt?: SortOrder
  }

  export type FileTagMaxOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    tagName?: SortOrder
    createdAt?: SortOrder
  }

  export type FileTagMinOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    tagName?: SortOrder
    createdAt?: SortOrder
  }

  export type FileAccessLogCountOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    ipAddress?: SortOrder
    userAgent?: SortOrder
    accessedAt?: SortOrder
  }

  export type FileAccessLogAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type FileAccessLogMaxOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    ipAddress?: SortOrder
    userAgent?: SortOrder
    accessedAt?: SortOrder
  }

  export type FileAccessLogMinOrderByAggregateInput = {
    id?: SortOrder
    fileId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    ipAddress?: SortOrder
    userAgent?: SortOrder
    accessedAt?: SortOrder
  }

  export type FileAccessLogSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type FileCreateNestedOneWithoutChildrenInput = {
    create?: XOR<FileCreateWithoutChildrenInput, FileUncheckedCreateWithoutChildrenInput>
    connectOrCreate?: FileCreateOrConnectWithoutChildrenInput
    connect?: FileWhereUniqueInput
  }

  export type FileCreateNestedManyWithoutParentInput = {
    create?: XOR<FileCreateWithoutParentInput, FileUncheckedCreateWithoutParentInput> | FileCreateWithoutParentInput[] | FileUncheckedCreateWithoutParentInput[]
    connectOrCreate?: FileCreateOrConnectWithoutParentInput | FileCreateOrConnectWithoutParentInput[]
    createMany?: FileCreateManyParentInputEnvelope
    connect?: FileWhereUniqueInput | FileWhereUniqueInput[]
  }

  export type FileVersionCreateNestedManyWithoutFileInput = {
    create?: XOR<FileVersionCreateWithoutFileInput, FileVersionUncheckedCreateWithoutFileInput> | FileVersionCreateWithoutFileInput[] | FileVersionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileVersionCreateOrConnectWithoutFileInput | FileVersionCreateOrConnectWithoutFileInput[]
    createMany?: FileVersionCreateManyFileInputEnvelope
    connect?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
  }

  export type FileTagCreateNestedManyWithoutFileInput = {
    create?: XOR<FileTagCreateWithoutFileInput, FileTagUncheckedCreateWithoutFileInput> | FileTagCreateWithoutFileInput[] | FileTagUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileTagCreateOrConnectWithoutFileInput | FileTagCreateOrConnectWithoutFileInput[]
    createMany?: FileTagCreateManyFileInputEnvelope
    connect?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
  }

  export type FileAccessLogCreateNestedManyWithoutFileInput = {
    create?: XOR<FileAccessLogCreateWithoutFileInput, FileAccessLogUncheckedCreateWithoutFileInput> | FileAccessLogCreateWithoutFileInput[] | FileAccessLogUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileAccessLogCreateOrConnectWithoutFileInput | FileAccessLogCreateOrConnectWithoutFileInput[]
    createMany?: FileAccessLogCreateManyFileInputEnvelope
    connect?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
  }

  export type FileUncheckedCreateNestedManyWithoutParentInput = {
    create?: XOR<FileCreateWithoutParentInput, FileUncheckedCreateWithoutParentInput> | FileCreateWithoutParentInput[] | FileUncheckedCreateWithoutParentInput[]
    connectOrCreate?: FileCreateOrConnectWithoutParentInput | FileCreateOrConnectWithoutParentInput[]
    createMany?: FileCreateManyParentInputEnvelope
    connect?: FileWhereUniqueInput | FileWhereUniqueInput[]
  }

  export type FileVersionUncheckedCreateNestedManyWithoutFileInput = {
    create?: XOR<FileVersionCreateWithoutFileInput, FileVersionUncheckedCreateWithoutFileInput> | FileVersionCreateWithoutFileInput[] | FileVersionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileVersionCreateOrConnectWithoutFileInput | FileVersionCreateOrConnectWithoutFileInput[]
    createMany?: FileVersionCreateManyFileInputEnvelope
    connect?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
  }

  export type FileTagUncheckedCreateNestedManyWithoutFileInput = {
    create?: XOR<FileTagCreateWithoutFileInput, FileTagUncheckedCreateWithoutFileInput> | FileTagCreateWithoutFileInput[] | FileTagUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileTagCreateOrConnectWithoutFileInput | FileTagCreateOrConnectWithoutFileInput[]
    createMany?: FileTagCreateManyFileInputEnvelope
    connect?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
  }

  export type FileAccessLogUncheckedCreateNestedManyWithoutFileInput = {
    create?: XOR<FileAccessLogCreateWithoutFileInput, FileAccessLogUncheckedCreateWithoutFileInput> | FileAccessLogCreateWithoutFileInput[] | FileAccessLogUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileAccessLogCreateOrConnectWithoutFileInput | FileAccessLogCreateOrConnectWithoutFileInput[]
    createMany?: FileAccessLogCreateManyFileInputEnvelope
    connect?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type FileUpdateOneWithoutChildrenNestedInput = {
    create?: XOR<FileCreateWithoutChildrenInput, FileUncheckedCreateWithoutChildrenInput>
    connectOrCreate?: FileCreateOrConnectWithoutChildrenInput
    upsert?: FileUpsertWithoutChildrenInput
    disconnect?: FileWhereInput | boolean
    delete?: FileWhereInput | boolean
    connect?: FileWhereUniqueInput
    update?: XOR<XOR<FileUpdateToOneWithWhereWithoutChildrenInput, FileUpdateWithoutChildrenInput>, FileUncheckedUpdateWithoutChildrenInput>
  }

  export type FileUpdateManyWithoutParentNestedInput = {
    create?: XOR<FileCreateWithoutParentInput, FileUncheckedCreateWithoutParentInput> | FileCreateWithoutParentInput[] | FileUncheckedCreateWithoutParentInput[]
    connectOrCreate?: FileCreateOrConnectWithoutParentInput | FileCreateOrConnectWithoutParentInput[]
    upsert?: FileUpsertWithWhereUniqueWithoutParentInput | FileUpsertWithWhereUniqueWithoutParentInput[]
    createMany?: FileCreateManyParentInputEnvelope
    set?: FileWhereUniqueInput | FileWhereUniqueInput[]
    disconnect?: FileWhereUniqueInput | FileWhereUniqueInput[]
    delete?: FileWhereUniqueInput | FileWhereUniqueInput[]
    connect?: FileWhereUniqueInput | FileWhereUniqueInput[]
    update?: FileUpdateWithWhereUniqueWithoutParentInput | FileUpdateWithWhereUniqueWithoutParentInput[]
    updateMany?: FileUpdateManyWithWhereWithoutParentInput | FileUpdateManyWithWhereWithoutParentInput[]
    deleteMany?: FileScalarWhereInput | FileScalarWhereInput[]
  }

  export type FileVersionUpdateManyWithoutFileNestedInput = {
    create?: XOR<FileVersionCreateWithoutFileInput, FileVersionUncheckedCreateWithoutFileInput> | FileVersionCreateWithoutFileInput[] | FileVersionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileVersionCreateOrConnectWithoutFileInput | FileVersionCreateOrConnectWithoutFileInput[]
    upsert?: FileVersionUpsertWithWhereUniqueWithoutFileInput | FileVersionUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: FileVersionCreateManyFileInputEnvelope
    set?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    disconnect?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    delete?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    connect?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    update?: FileVersionUpdateWithWhereUniqueWithoutFileInput | FileVersionUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: FileVersionUpdateManyWithWhereWithoutFileInput | FileVersionUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: FileVersionScalarWhereInput | FileVersionScalarWhereInput[]
  }

  export type FileTagUpdateManyWithoutFileNestedInput = {
    create?: XOR<FileTagCreateWithoutFileInput, FileTagUncheckedCreateWithoutFileInput> | FileTagCreateWithoutFileInput[] | FileTagUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileTagCreateOrConnectWithoutFileInput | FileTagCreateOrConnectWithoutFileInput[]
    upsert?: FileTagUpsertWithWhereUniqueWithoutFileInput | FileTagUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: FileTagCreateManyFileInputEnvelope
    set?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    disconnect?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    delete?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    connect?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    update?: FileTagUpdateWithWhereUniqueWithoutFileInput | FileTagUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: FileTagUpdateManyWithWhereWithoutFileInput | FileTagUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: FileTagScalarWhereInput | FileTagScalarWhereInput[]
  }

  export type FileAccessLogUpdateManyWithoutFileNestedInput = {
    create?: XOR<FileAccessLogCreateWithoutFileInput, FileAccessLogUncheckedCreateWithoutFileInput> | FileAccessLogCreateWithoutFileInput[] | FileAccessLogUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileAccessLogCreateOrConnectWithoutFileInput | FileAccessLogCreateOrConnectWithoutFileInput[]
    upsert?: FileAccessLogUpsertWithWhereUniqueWithoutFileInput | FileAccessLogUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: FileAccessLogCreateManyFileInputEnvelope
    set?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    disconnect?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    delete?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    connect?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    update?: FileAccessLogUpdateWithWhereUniqueWithoutFileInput | FileAccessLogUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: FileAccessLogUpdateManyWithWhereWithoutFileInput | FileAccessLogUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: FileAccessLogScalarWhereInput | FileAccessLogScalarWhereInput[]
  }

  export type FileUncheckedUpdateManyWithoutParentNestedInput = {
    create?: XOR<FileCreateWithoutParentInput, FileUncheckedCreateWithoutParentInput> | FileCreateWithoutParentInput[] | FileUncheckedCreateWithoutParentInput[]
    connectOrCreate?: FileCreateOrConnectWithoutParentInput | FileCreateOrConnectWithoutParentInput[]
    upsert?: FileUpsertWithWhereUniqueWithoutParentInput | FileUpsertWithWhereUniqueWithoutParentInput[]
    createMany?: FileCreateManyParentInputEnvelope
    set?: FileWhereUniqueInput | FileWhereUniqueInput[]
    disconnect?: FileWhereUniqueInput | FileWhereUniqueInput[]
    delete?: FileWhereUniqueInput | FileWhereUniqueInput[]
    connect?: FileWhereUniqueInput | FileWhereUniqueInput[]
    update?: FileUpdateWithWhereUniqueWithoutParentInput | FileUpdateWithWhereUniqueWithoutParentInput[]
    updateMany?: FileUpdateManyWithWhereWithoutParentInput | FileUpdateManyWithWhereWithoutParentInput[]
    deleteMany?: FileScalarWhereInput | FileScalarWhereInput[]
  }

  export type FileVersionUncheckedUpdateManyWithoutFileNestedInput = {
    create?: XOR<FileVersionCreateWithoutFileInput, FileVersionUncheckedCreateWithoutFileInput> | FileVersionCreateWithoutFileInput[] | FileVersionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileVersionCreateOrConnectWithoutFileInput | FileVersionCreateOrConnectWithoutFileInput[]
    upsert?: FileVersionUpsertWithWhereUniqueWithoutFileInput | FileVersionUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: FileVersionCreateManyFileInputEnvelope
    set?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    disconnect?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    delete?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    connect?: FileVersionWhereUniqueInput | FileVersionWhereUniqueInput[]
    update?: FileVersionUpdateWithWhereUniqueWithoutFileInput | FileVersionUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: FileVersionUpdateManyWithWhereWithoutFileInput | FileVersionUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: FileVersionScalarWhereInput | FileVersionScalarWhereInput[]
  }

  export type FileTagUncheckedUpdateManyWithoutFileNestedInput = {
    create?: XOR<FileTagCreateWithoutFileInput, FileTagUncheckedCreateWithoutFileInput> | FileTagCreateWithoutFileInput[] | FileTagUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileTagCreateOrConnectWithoutFileInput | FileTagCreateOrConnectWithoutFileInput[]
    upsert?: FileTagUpsertWithWhereUniqueWithoutFileInput | FileTagUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: FileTagCreateManyFileInputEnvelope
    set?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    disconnect?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    delete?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    connect?: FileTagWhereUniqueInput | FileTagWhereUniqueInput[]
    update?: FileTagUpdateWithWhereUniqueWithoutFileInput | FileTagUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: FileTagUpdateManyWithWhereWithoutFileInput | FileTagUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: FileTagScalarWhereInput | FileTagScalarWhereInput[]
  }

  export type FileAccessLogUncheckedUpdateManyWithoutFileNestedInput = {
    create?: XOR<FileAccessLogCreateWithoutFileInput, FileAccessLogUncheckedCreateWithoutFileInput> | FileAccessLogCreateWithoutFileInput[] | FileAccessLogUncheckedCreateWithoutFileInput[]
    connectOrCreate?: FileAccessLogCreateOrConnectWithoutFileInput | FileAccessLogCreateOrConnectWithoutFileInput[]
    upsert?: FileAccessLogUpsertWithWhereUniqueWithoutFileInput | FileAccessLogUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: FileAccessLogCreateManyFileInputEnvelope
    set?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    disconnect?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    delete?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    connect?: FileAccessLogWhereUniqueInput | FileAccessLogWhereUniqueInput[]
    update?: FileAccessLogUpdateWithWhereUniqueWithoutFileInput | FileAccessLogUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: FileAccessLogUpdateManyWithWhereWithoutFileInput | FileAccessLogUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: FileAccessLogScalarWhereInput | FileAccessLogScalarWhereInput[]
  }

  export type FileCreateNestedOneWithoutVersionsInput = {
    create?: XOR<FileCreateWithoutVersionsInput, FileUncheckedCreateWithoutVersionsInput>
    connectOrCreate?: FileCreateOrConnectWithoutVersionsInput
    connect?: FileWhereUniqueInput
  }

  export type FileUpdateOneRequiredWithoutVersionsNestedInput = {
    create?: XOR<FileCreateWithoutVersionsInput, FileUncheckedCreateWithoutVersionsInput>
    connectOrCreate?: FileCreateOrConnectWithoutVersionsInput
    upsert?: FileUpsertWithoutVersionsInput
    connect?: FileWhereUniqueInput
    update?: XOR<XOR<FileUpdateToOneWithWhereWithoutVersionsInput, FileUpdateWithoutVersionsInput>, FileUncheckedUpdateWithoutVersionsInput>
  }

  export type FileCreateNestedOneWithoutTagsInput = {
    create?: XOR<FileCreateWithoutTagsInput, FileUncheckedCreateWithoutTagsInput>
    connectOrCreate?: FileCreateOrConnectWithoutTagsInput
    connect?: FileWhereUniqueInput
  }

  export type FileUpdateOneRequiredWithoutTagsNestedInput = {
    create?: XOR<FileCreateWithoutTagsInput, FileUncheckedCreateWithoutTagsInput>
    connectOrCreate?: FileCreateOrConnectWithoutTagsInput
    upsert?: FileUpsertWithoutTagsInput
    connect?: FileWhereUniqueInput
    update?: XOR<XOR<FileUpdateToOneWithWhereWithoutTagsInput, FileUpdateWithoutTagsInput>, FileUncheckedUpdateWithoutTagsInput>
  }

  export type FileCreateNestedOneWithoutAccessLogsInput = {
    create?: XOR<FileCreateWithoutAccessLogsInput, FileUncheckedCreateWithoutAccessLogsInput>
    connectOrCreate?: FileCreateOrConnectWithoutAccessLogsInput
    connect?: FileWhereUniqueInput
  }

  export type FileUpdateOneRequiredWithoutAccessLogsNestedInput = {
    create?: XOR<FileCreateWithoutAccessLogsInput, FileUncheckedCreateWithoutAccessLogsInput>
    connectOrCreate?: FileCreateOrConnectWithoutAccessLogsInput
    upsert?: FileUpsertWithoutAccessLogsInput
    connect?: FileWhereUniqueInput
    update?: XOR<XOR<FileUpdateToOneWithWhereWithoutAccessLogsInput, FileUpdateWithoutAccessLogsInput>, FileUncheckedUpdateWithoutAccessLogsInput>
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

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
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

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
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

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type FileCreateWithoutChildrenInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    parent?: FileCreateNestedOneWithoutChildrenInput
    versions?: FileVersionCreateNestedManyWithoutFileInput
    tags?: FileTagCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogCreateNestedManyWithoutFileInput
  }

  export type FileUncheckedCreateWithoutChildrenInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    parentId?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    versions?: FileVersionUncheckedCreateNestedManyWithoutFileInput
    tags?: FileTagUncheckedCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogUncheckedCreateNestedManyWithoutFileInput
  }

  export type FileCreateOrConnectWithoutChildrenInput = {
    where: FileWhereUniqueInput
    create: XOR<FileCreateWithoutChildrenInput, FileUncheckedCreateWithoutChildrenInput>
  }

  export type FileCreateWithoutParentInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    children?: FileCreateNestedManyWithoutParentInput
    versions?: FileVersionCreateNestedManyWithoutFileInput
    tags?: FileTagCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogCreateNestedManyWithoutFileInput
  }

  export type FileUncheckedCreateWithoutParentInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    children?: FileUncheckedCreateNestedManyWithoutParentInput
    versions?: FileVersionUncheckedCreateNestedManyWithoutFileInput
    tags?: FileTagUncheckedCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogUncheckedCreateNestedManyWithoutFileInput
  }

  export type FileCreateOrConnectWithoutParentInput = {
    where: FileWhereUniqueInput
    create: XOR<FileCreateWithoutParentInput, FileUncheckedCreateWithoutParentInput>
  }

  export type FileCreateManyParentInputEnvelope = {
    data: FileCreateManyParentInput | FileCreateManyParentInput[]
  }

  export type FileVersionCreateWithoutFileInput = {
    id: string
    version: number
    size: number
    storagePath: string
    md5Hash: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type FileVersionUncheckedCreateWithoutFileInput = {
    id: string
    version: number
    size: number
    storagePath: string
    md5Hash: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type FileVersionCreateOrConnectWithoutFileInput = {
    where: FileVersionWhereUniqueInput
    create: XOR<FileVersionCreateWithoutFileInput, FileVersionUncheckedCreateWithoutFileInput>
  }

  export type FileVersionCreateManyFileInputEnvelope = {
    data: FileVersionCreateManyFileInput | FileVersionCreateManyFileInput[]
  }

  export type FileTagCreateWithoutFileInput = {
    id: string
    tagName: string
    createdAt?: Date | string
  }

  export type FileTagUncheckedCreateWithoutFileInput = {
    id: string
    tagName: string
    createdAt?: Date | string
  }

  export type FileTagCreateOrConnectWithoutFileInput = {
    where: FileTagWhereUniqueInput
    create: XOR<FileTagCreateWithoutFileInput, FileTagUncheckedCreateWithoutFileInput>
  }

  export type FileTagCreateManyFileInputEnvelope = {
    data: FileTagCreateManyFileInput | FileTagCreateManyFileInput[]
  }

  export type FileAccessLogCreateWithoutFileInput = {
    userId: string
    action: string
    ipAddress?: string | null
    userAgent?: string | null
    accessedAt?: Date | string
  }

  export type FileAccessLogUncheckedCreateWithoutFileInput = {
    id?: number
    userId: string
    action: string
    ipAddress?: string | null
    userAgent?: string | null
    accessedAt?: Date | string
  }

  export type FileAccessLogCreateOrConnectWithoutFileInput = {
    where: FileAccessLogWhereUniqueInput
    create: XOR<FileAccessLogCreateWithoutFileInput, FileAccessLogUncheckedCreateWithoutFileInput>
  }

  export type FileAccessLogCreateManyFileInputEnvelope = {
    data: FileAccessLogCreateManyFileInput | FileAccessLogCreateManyFileInput[]
  }

  export type FileUpsertWithoutChildrenInput = {
    update: XOR<FileUpdateWithoutChildrenInput, FileUncheckedUpdateWithoutChildrenInput>
    create: XOR<FileCreateWithoutChildrenInput, FileUncheckedCreateWithoutChildrenInput>
    where?: FileWhereInput
  }

  export type FileUpdateToOneWithWhereWithoutChildrenInput = {
    where?: FileWhereInput
    data: XOR<FileUpdateWithoutChildrenInput, FileUncheckedUpdateWithoutChildrenInput>
  }

  export type FileUpdateWithoutChildrenInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    parent?: FileUpdateOneWithoutChildrenNestedInput
    versions?: FileVersionUpdateManyWithoutFileNestedInput
    tags?: FileTagUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUpdateManyWithoutFileNestedInput
  }

  export type FileUncheckedUpdateWithoutChildrenInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    parentId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    versions?: FileVersionUncheckedUpdateManyWithoutFileNestedInput
    tags?: FileTagUncheckedUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUncheckedUpdateManyWithoutFileNestedInput
  }

  export type FileUpsertWithWhereUniqueWithoutParentInput = {
    where: FileWhereUniqueInput
    update: XOR<FileUpdateWithoutParentInput, FileUncheckedUpdateWithoutParentInput>
    create: XOR<FileCreateWithoutParentInput, FileUncheckedCreateWithoutParentInput>
  }

  export type FileUpdateWithWhereUniqueWithoutParentInput = {
    where: FileWhereUniqueInput
    data: XOR<FileUpdateWithoutParentInput, FileUncheckedUpdateWithoutParentInput>
  }

  export type FileUpdateManyWithWhereWithoutParentInput = {
    where: FileScalarWhereInput
    data: XOR<FileUpdateManyMutationInput, FileUncheckedUpdateManyWithoutParentInput>
  }

  export type FileScalarWhereInput = {
    AND?: FileScalarWhereInput | FileScalarWhereInput[]
    OR?: FileScalarWhereInput[]
    NOT?: FileScalarWhereInput | FileScalarWhereInput[]
    id?: StringFilter<"File"> | string
    name?: StringFilter<"File"> | string
    type?: StringFilter<"File"> | string
    size?: IntNullableFilter<"File"> | number | null
    mimeType?: StringNullableFilter<"File"> | string | null
    parentId?: StringNullableFilter<"File"> | string | null
    ownerId?: StringFilter<"File"> | string
    path?: StringFilter<"File"> | string
    version?: IntFilter<"File"> | number
    createdAt?: DateTimeFilter<"File"> | Date | string
    updatedAt?: DateTimeFilter<"File"> | Date | string
    deletedAt?: DateTimeNullableFilter<"File"> | Date | string | null
  }

  export type FileVersionUpsertWithWhereUniqueWithoutFileInput = {
    where: FileVersionWhereUniqueInput
    update: XOR<FileVersionUpdateWithoutFileInput, FileVersionUncheckedUpdateWithoutFileInput>
    create: XOR<FileVersionCreateWithoutFileInput, FileVersionUncheckedCreateWithoutFileInput>
  }

  export type FileVersionUpdateWithWhereUniqueWithoutFileInput = {
    where: FileVersionWhereUniqueInput
    data: XOR<FileVersionUpdateWithoutFileInput, FileVersionUncheckedUpdateWithoutFileInput>
  }

  export type FileVersionUpdateManyWithWhereWithoutFileInput = {
    where: FileVersionScalarWhereInput
    data: XOR<FileVersionUpdateManyMutationInput, FileVersionUncheckedUpdateManyWithoutFileInput>
  }

  export type FileVersionScalarWhereInput = {
    AND?: FileVersionScalarWhereInput | FileVersionScalarWhereInput[]
    OR?: FileVersionScalarWhereInput[]
    NOT?: FileVersionScalarWhereInput | FileVersionScalarWhereInput[]
    id?: StringFilter<"FileVersion"> | string
    fileId?: StringFilter<"FileVersion"> | string
    version?: IntFilter<"FileVersion"> | number
    size?: IntFilter<"FileVersion"> | number
    storagePath?: StringFilter<"FileVersion"> | string
    md5Hash?: StringFilter<"FileVersion"> | string
    comment?: StringNullableFilter<"FileVersion"> | string | null
    createdAt?: DateTimeFilter<"FileVersion"> | Date | string
  }

  export type FileTagUpsertWithWhereUniqueWithoutFileInput = {
    where: FileTagWhereUniqueInput
    update: XOR<FileTagUpdateWithoutFileInput, FileTagUncheckedUpdateWithoutFileInput>
    create: XOR<FileTagCreateWithoutFileInput, FileTagUncheckedCreateWithoutFileInput>
  }

  export type FileTagUpdateWithWhereUniqueWithoutFileInput = {
    where: FileTagWhereUniqueInput
    data: XOR<FileTagUpdateWithoutFileInput, FileTagUncheckedUpdateWithoutFileInput>
  }

  export type FileTagUpdateManyWithWhereWithoutFileInput = {
    where: FileTagScalarWhereInput
    data: XOR<FileTagUpdateManyMutationInput, FileTagUncheckedUpdateManyWithoutFileInput>
  }

  export type FileTagScalarWhereInput = {
    AND?: FileTagScalarWhereInput | FileTagScalarWhereInput[]
    OR?: FileTagScalarWhereInput[]
    NOT?: FileTagScalarWhereInput | FileTagScalarWhereInput[]
    id?: StringFilter<"FileTag"> | string
    fileId?: StringFilter<"FileTag"> | string
    tagName?: StringFilter<"FileTag"> | string
    createdAt?: DateTimeFilter<"FileTag"> | Date | string
  }

  export type FileAccessLogUpsertWithWhereUniqueWithoutFileInput = {
    where: FileAccessLogWhereUniqueInput
    update: XOR<FileAccessLogUpdateWithoutFileInput, FileAccessLogUncheckedUpdateWithoutFileInput>
    create: XOR<FileAccessLogCreateWithoutFileInput, FileAccessLogUncheckedCreateWithoutFileInput>
  }

  export type FileAccessLogUpdateWithWhereUniqueWithoutFileInput = {
    where: FileAccessLogWhereUniqueInput
    data: XOR<FileAccessLogUpdateWithoutFileInput, FileAccessLogUncheckedUpdateWithoutFileInput>
  }

  export type FileAccessLogUpdateManyWithWhereWithoutFileInput = {
    where: FileAccessLogScalarWhereInput
    data: XOR<FileAccessLogUpdateManyMutationInput, FileAccessLogUncheckedUpdateManyWithoutFileInput>
  }

  export type FileAccessLogScalarWhereInput = {
    AND?: FileAccessLogScalarWhereInput | FileAccessLogScalarWhereInput[]
    OR?: FileAccessLogScalarWhereInput[]
    NOT?: FileAccessLogScalarWhereInput | FileAccessLogScalarWhereInput[]
    id?: IntFilter<"FileAccessLog"> | number
    fileId?: StringFilter<"FileAccessLog"> | string
    userId?: StringFilter<"FileAccessLog"> | string
    action?: StringFilter<"FileAccessLog"> | string
    ipAddress?: StringNullableFilter<"FileAccessLog"> | string | null
    userAgent?: StringNullableFilter<"FileAccessLog"> | string | null
    accessedAt?: DateTimeFilter<"FileAccessLog"> | Date | string
  }

  export type FileCreateWithoutVersionsInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    parent?: FileCreateNestedOneWithoutChildrenInput
    children?: FileCreateNestedManyWithoutParentInput
    tags?: FileTagCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogCreateNestedManyWithoutFileInput
  }

  export type FileUncheckedCreateWithoutVersionsInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    parentId?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    children?: FileUncheckedCreateNestedManyWithoutParentInput
    tags?: FileTagUncheckedCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogUncheckedCreateNestedManyWithoutFileInput
  }

  export type FileCreateOrConnectWithoutVersionsInput = {
    where: FileWhereUniqueInput
    create: XOR<FileCreateWithoutVersionsInput, FileUncheckedCreateWithoutVersionsInput>
  }

  export type FileUpsertWithoutVersionsInput = {
    update: XOR<FileUpdateWithoutVersionsInput, FileUncheckedUpdateWithoutVersionsInput>
    create: XOR<FileCreateWithoutVersionsInput, FileUncheckedCreateWithoutVersionsInput>
    where?: FileWhereInput
  }

  export type FileUpdateToOneWithWhereWithoutVersionsInput = {
    where?: FileWhereInput
    data: XOR<FileUpdateWithoutVersionsInput, FileUncheckedUpdateWithoutVersionsInput>
  }

  export type FileUpdateWithoutVersionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    parent?: FileUpdateOneWithoutChildrenNestedInput
    children?: FileUpdateManyWithoutParentNestedInput
    tags?: FileTagUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUpdateManyWithoutFileNestedInput
  }

  export type FileUncheckedUpdateWithoutVersionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    parentId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    children?: FileUncheckedUpdateManyWithoutParentNestedInput
    tags?: FileTagUncheckedUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUncheckedUpdateManyWithoutFileNestedInput
  }

  export type FileCreateWithoutTagsInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    parent?: FileCreateNestedOneWithoutChildrenInput
    children?: FileCreateNestedManyWithoutParentInput
    versions?: FileVersionCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogCreateNestedManyWithoutFileInput
  }

  export type FileUncheckedCreateWithoutTagsInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    parentId?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    children?: FileUncheckedCreateNestedManyWithoutParentInput
    versions?: FileVersionUncheckedCreateNestedManyWithoutFileInput
    accessLogs?: FileAccessLogUncheckedCreateNestedManyWithoutFileInput
  }

  export type FileCreateOrConnectWithoutTagsInput = {
    where: FileWhereUniqueInput
    create: XOR<FileCreateWithoutTagsInput, FileUncheckedCreateWithoutTagsInput>
  }

  export type FileUpsertWithoutTagsInput = {
    update: XOR<FileUpdateWithoutTagsInput, FileUncheckedUpdateWithoutTagsInput>
    create: XOR<FileCreateWithoutTagsInput, FileUncheckedCreateWithoutTagsInput>
    where?: FileWhereInput
  }

  export type FileUpdateToOneWithWhereWithoutTagsInput = {
    where?: FileWhereInput
    data: XOR<FileUpdateWithoutTagsInput, FileUncheckedUpdateWithoutTagsInput>
  }

  export type FileUpdateWithoutTagsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    parent?: FileUpdateOneWithoutChildrenNestedInput
    children?: FileUpdateManyWithoutParentNestedInput
    versions?: FileVersionUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUpdateManyWithoutFileNestedInput
  }

  export type FileUncheckedUpdateWithoutTagsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    parentId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    children?: FileUncheckedUpdateManyWithoutParentNestedInput
    versions?: FileVersionUncheckedUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUncheckedUpdateManyWithoutFileNestedInput
  }

  export type FileCreateWithoutAccessLogsInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    parent?: FileCreateNestedOneWithoutChildrenInput
    children?: FileCreateNestedManyWithoutParentInput
    versions?: FileVersionCreateNestedManyWithoutFileInput
    tags?: FileTagCreateNestedManyWithoutFileInput
  }

  export type FileUncheckedCreateWithoutAccessLogsInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    parentId?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    children?: FileUncheckedCreateNestedManyWithoutParentInput
    versions?: FileVersionUncheckedCreateNestedManyWithoutFileInput
    tags?: FileTagUncheckedCreateNestedManyWithoutFileInput
  }

  export type FileCreateOrConnectWithoutAccessLogsInput = {
    where: FileWhereUniqueInput
    create: XOR<FileCreateWithoutAccessLogsInput, FileUncheckedCreateWithoutAccessLogsInput>
  }

  export type FileUpsertWithoutAccessLogsInput = {
    update: XOR<FileUpdateWithoutAccessLogsInput, FileUncheckedUpdateWithoutAccessLogsInput>
    create: XOR<FileCreateWithoutAccessLogsInput, FileUncheckedCreateWithoutAccessLogsInput>
    where?: FileWhereInput
  }

  export type FileUpdateToOneWithWhereWithoutAccessLogsInput = {
    where?: FileWhereInput
    data: XOR<FileUpdateWithoutAccessLogsInput, FileUncheckedUpdateWithoutAccessLogsInput>
  }

  export type FileUpdateWithoutAccessLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    parent?: FileUpdateOneWithoutChildrenNestedInput
    children?: FileUpdateManyWithoutParentNestedInput
    versions?: FileVersionUpdateManyWithoutFileNestedInput
    tags?: FileTagUpdateManyWithoutFileNestedInput
  }

  export type FileUncheckedUpdateWithoutAccessLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    parentId?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    children?: FileUncheckedUpdateManyWithoutParentNestedInput
    versions?: FileVersionUncheckedUpdateManyWithoutFileNestedInput
    tags?: FileTagUncheckedUpdateManyWithoutFileNestedInput
  }

  export type FileCreateManyParentInput = {
    id: string
    name: string
    type: string
    size?: number | null
    mimeType?: string | null
    ownerId: string
    path: string
    version?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type FileVersionCreateManyFileInput = {
    id: string
    version: number
    size: number
    storagePath: string
    md5Hash: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type FileTagCreateManyFileInput = {
    id: string
    tagName: string
    createdAt?: Date | string
  }

  export type FileAccessLogCreateManyFileInput = {
    id?: number
    userId: string
    action: string
    ipAddress?: string | null
    userAgent?: string | null
    accessedAt?: Date | string
  }

  export type FileUpdateWithoutParentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    children?: FileUpdateManyWithoutParentNestedInput
    versions?: FileVersionUpdateManyWithoutFileNestedInput
    tags?: FileTagUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUpdateManyWithoutFileNestedInput
  }

  export type FileUncheckedUpdateWithoutParentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    children?: FileUncheckedUpdateManyWithoutParentNestedInput
    versions?: FileVersionUncheckedUpdateManyWithoutFileNestedInput
    tags?: FileTagUncheckedUpdateManyWithoutFileNestedInput
    accessLogs?: FileAccessLogUncheckedUpdateManyWithoutFileNestedInput
  }

  export type FileUncheckedUpdateManyWithoutParentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: NullableIntFieldUpdateOperationsInput | number | null
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    ownerId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type FileVersionUpdateWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    size?: IntFieldUpdateOperationsInput | number
    storagePath?: StringFieldUpdateOperationsInput | string
    md5Hash?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileVersionUncheckedUpdateWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    size?: IntFieldUpdateOperationsInput | number
    storagePath?: StringFieldUpdateOperationsInput | string
    md5Hash?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileVersionUncheckedUpdateManyWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    version?: IntFieldUpdateOperationsInput | number
    size?: IntFieldUpdateOperationsInput | number
    storagePath?: StringFieldUpdateOperationsInput | string
    md5Hash?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileTagUpdateWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    tagName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileTagUncheckedUpdateWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    tagName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileTagUncheckedUpdateManyWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    tagName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileAccessLogUpdateWithoutFileInput = {
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    accessedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileAccessLogUncheckedUpdateWithoutFileInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    accessedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FileAccessLogUncheckedUpdateManyWithoutFileInput = {
    id?: IntFieldUpdateOperationsInput | number
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    accessedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use FileCountOutputTypeDefaultArgs instead
     */
    export type FileCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = FileCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use FileDefaultArgs instead
     */
    export type FileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = FileDefaultArgs<ExtArgs>
    /**
     * @deprecated Use FileVersionDefaultArgs instead
     */
    export type FileVersionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = FileVersionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use FileTagDefaultArgs instead
     */
    export type FileTagArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = FileTagDefaultArgs<ExtArgs>
    /**
     * @deprecated Use FileAccessLogDefaultArgs instead
     */
    export type FileAccessLogArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = FileAccessLogDefaultArgs<ExtArgs>

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