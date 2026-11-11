import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// Single-table, mismo esquema pk/sk que wealth y yt:
//
//   pk = USER#<email>     sk = BOOK#<id>      → un libro leído
//   pk = USER#<email>     sk = TOKEN#<hash>   → un token del MCP (nombre, fecha)
//   pk = TOKEN#<hash>     sk = TOKEN          → token → usuario (solo GetItem)
//
// 🔒 Toda lectura es un Query o GetItem acotado a la pk del usuario de la
// sesión. Nunca se usa Scan.
//
// Sin credenciales de AWS se usa un almacén en memoria con las mismas claves:
// la app funciona entera en dev y en los tests.

export const TABLE_NAME = process.env.DYNAMODB_TABLE || "bk-data";
export const REGION = process.env.AWS_REGION || "eu-west-1";

export const userPk = (userId: string): string => `USER#${userId}`;
export const bookSk = (id: string): string => `BOOK#${id}`;
export const tokenSk = (hash: string): string => `TOKEN#${hash}`;
export const tokenPk = (hash: string): string => `TOKEN#${hash}`;

export type Item = Record<string, unknown> & { pk: string; sk: string };

export interface Store {
  get(pk: string, sk: string): Promise<Item | null>;
  put(item: Item): Promise<void>;
  delete(pk: string, sk: string): Promise<void>;
  /** Todos los ítems de la pk cuya sk empieza por el prefijo, ordenados por sk. */
  query(pk: string, skPrefix: string): Promise<Item[]>;
}

export function isDynamoEnabled(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

class DynamoStore implements Store {
  private client: DynamoDBDocumentClient;
  constructor() {
    const config: ConstructorParameters<typeof DynamoDBClient>[0] = { region: REGION };
    if (process.env.DYNAMODB_ENDPOINT) config.endpoint = process.env.DYNAMODB_ENDPOINT;
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  async get(pk: string, sk: string) {
    const r = await this.client.send(new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));
    return (r.Item as Item | undefined) ?? null;
  }
  async put(item: Item) {
    await this.client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  }
  async delete(pk: string, sk: string) {
    await this.client.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));
  }
  async query(pk: string, skPrefix: string) {
    const out: Item[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
          ExpressionAttributeValues: { ":pk": pk, ":p": skPrefix },
          ExclusiveStartKey: start,
        }),
      );
      out.push(...((r.Items as Item[]) ?? []));
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }
}

export class MemoryStore implements Store {
  private items = new Map<string, Item>();
  private key = (pk: string, sk: string) => `${pk}\u0000${sk}`;
  async get(pk: string, sk: string) {
    const i = this.items.get(this.key(pk, sk));
    return i ? structuredClone(i) : null;
  }
  async put(item: Item) {
    this.items.set(this.key(item.pk, item.sk), structuredClone(item));
  }
  async delete(pk: string, sk: string) {
    this.items.delete(this.key(pk, sk));
  }
  async query(pk: string, skPrefix: string) {
    return [...this.items.values()]
      .filter((i) => i.pk === pk && i.sk.startsWith(skPrefix))
      .sort((a, b) => a.sk.localeCompare(b.sk))
      .map((i) => structuredClone(i));
  }
}

// En dev, Next recarga módulos: el almacén en memoria se cuelga de globalThis
// para no perder los datos en cada guardado de fichero.
const g = globalThis as unknown as { __bkStore?: Store };

export function getStore(): Store {
  if (!g.__bkStore) g.__bkStore = isDynamoEnabled() ? new DynamoStore() : new MemoryStore();
  return g.__bkStore;
}

/** Solo para tests. */
export function setStore(store: Store): void {
  g.__bkStore = store;
}
