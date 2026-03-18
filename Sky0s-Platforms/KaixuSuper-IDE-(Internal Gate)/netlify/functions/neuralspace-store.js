const { query } = require('./_lib/db');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

async function ensureSchema() {
  await query(`
    create table if not exists neuralspace_chats (
      id text primary key,
      app_id text not null,
      user_id text not null,
      title text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await query(`
    create index if not exists neuralspace_chats_user_updated_idx
      on neuralspace_chats (app_id, user_id, updated_at desc)
  `);

  await query(`
    create table if not exists neuralspace_messages (
      id bigserial primary key,
      chat_id text not null references neuralspace_chats(id) on delete cascade,
      role text not null,
      content text not null,
      attachments jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await query(`
    create index if not exists neuralspace_messages_chat_created_idx
      on neuralspace_messages (chat_id, created_at asc)
  `);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body)
  };
}

function parseBody(rawBody) {
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

function requireText(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${name} is required`);
  }
  return normalized;
}

function normalizeAttachments(value) {
  if (!Array.isArray(value) || !value.length) return null;
  return value
    .map((item) => ({
      name: String(item?.name || '').trim(),
      type: String(item?.type || '').trim()
    }))
    .filter((item) => item.name && item.type);
}

exports.handler = async (event) => {
  try {
    await ensureSchema();

    const action = String(event.queryStringParameters?.action || '').trim();
    const body = parseBody(event.body);

    if (event.httpMethod === 'GET' && action === 'list-chats') {
      const appId = requireText(event.queryStringParameters?.appId, 'appId');
      const userId = requireText(event.queryStringParameters?.userId, 'userId');
      const result = await query(
        `select id, title, extract(epoch from updated_at) * 1000 as updated_at_ms
           from neuralspace_chats
          where app_id = $1 and user_id = $2
          order by updated_at desc`,
        [appId, userId]
      );
      return json(200, { ok: true, chats: result.rows });
    }

    if (event.httpMethod === 'GET' && action === 'list-messages') {
      const appId = requireText(event.queryStringParameters?.appId, 'appId');
      const userId = requireText(event.queryStringParameters?.userId, 'userId');
      const chatId = requireText(event.queryStringParameters?.chatId, 'chatId');
      const chatResult = await query(
        `select id from neuralspace_chats where id = $1 and app_id = $2 and user_id = $3 limit 1`,
        [chatId, appId, userId]
      );
      if (!chatResult.rows.length) return json(404, { ok: false, error: 'chat_not_found' });
      const result = await query(
        `select role, content, attachments, extract(epoch from created_at) * 1000 as timestamp
           from neuralspace_messages
          where chat_id = $1
          order by created_at asc, id asc`,
        [chatId]
      );
      return json(200, { ok: true, messages: result.rows });
    }

    if (event.httpMethod === 'POST' && action === 'create-chat') {
      const appId = requireText(body.appId, 'appId');
      const userId = requireText(body.userId, 'userId');
      const title = requireText(body.title, 'title').slice(0, 120);
      const chatId = `nsp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      await query(
        `insert into neuralspace_chats (id, app_id, user_id, title)
         values ($1, $2, $3, $4)`,
        [chatId, appId, userId, title]
      );
      return json(200, { ok: true, chatId });
    }

    if (event.httpMethod === 'POST' && action === 'add-message') {
      const appId = requireText(body.appId, 'appId');
      const userId = requireText(body.userId, 'userId');
      const chatId = requireText(body.chatId, 'chatId');
      const role = requireText(body.role, 'role');
      const content = requireText(body.content, 'content');
      const attachments = normalizeAttachments(body.attachments);

      const chatResult = await query(
        `select id from neuralspace_chats where id = $1 and app_id = $2 and user_id = $3 limit 1`,
        [chatId, appId, userId]
      );
      if (!chatResult.rows.length) return json(404, { ok: false, error: 'chat_not_found' });

      await query(
        `insert into neuralspace_messages (chat_id, role, content, attachments)
         values ($1, $2, $3, $4::jsonb)`,
        [chatId, role, content, attachments ? JSON.stringify(attachments) : null]
      );
      await query(
        `update neuralspace_chats set updated_at = now() where id = $1`,
        [chatId]
      );
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'unsupported_action' });
  } catch (error) {
    return json(500, { ok: false, error: error.message || 'server_error' });
  }
};