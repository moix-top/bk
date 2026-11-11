# bk · bk.moix.top

Registro de los libros que he leído: **título**, **autor**, **repo de git** con los
apuntes (p. ej. [el-principito](https://github.com/radamuz/el-principito)), **resumen
breve**, **lo más importante** y **lo que me aportó**.

Next.js 14 + Auth.js (Google) + DynamoDB, el mismo patrón que `yt` y `wealth`.
Desplegada en Vercel (proyecto `bk`).

## MCP para agentes de IA

`https://bk.moix.top/api/mcp` (Streamable HTTP, sin estado). Crea un token en
**/ajustes** y conéctalo:

```bash
claude mcp add --transport http --scope user bk https://bk.moix.top/api/mcp \
  --header "Authorization: Bearer bk_…"
```

Herramientas: `list_books`, `search_books`, `get_book`, `add_book`, `update_book`
(parcial) y `delete_book`. Cada libro también es un recurso `bk://libro/<id>` en Markdown.
Los tokens se guardan solo como SHA-256 y se revocan desde /ajustes.

## Datos

Tabla `bk-data` (single-table, ver [lib/dynamo.ts](lib/dynamo.ts) e
[infra/dynamodb.yml](infra/dynamodb.yml)). Sin credenciales de AWS se usa un almacén en
memoria, así que `npm run dev` y `npm test` funcionan sin nada.

## Puesta en marcha (ya hecha)

```bash
aws cloudformation deploy --profile radamuz --template-file infra/dynamodb.yml \
  --stack-name bk-data --parameter-overrides TableName=bk-data
./scripts/setup-aws.sh --profile radamuz   # usuario IAM de runtime + variables
vercel env add …                            # AWS_*, DYNAMODB_TABLE, AUTH_*
vercel deploy --prod
```

El login usa el mismo cliente OAuth de Google que `yt`, con
`https://bk.moix.top/api/auth/callback/google` como redirect URI autorizado.
