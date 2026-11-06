import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path, suffix = '') {
  const source = fs.readFileSync(path, 'utf8') + suffix;
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}

function loadEdge(env = {}) {
  let handler;
  const context = {
    Deno: { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn; } },
    exports: {}, Request, Response, URL, TextEncoder, console,
    fetch: async () => { throw new Error('unexpected fetch'); },
  };
  vm.runInNewContext(compile('supabase/functions/waitlist/index.ts', '\nexport { matchesOrigin, resolveAllowedOrigin, enc };'), context);
  return { ...context.exports, handler };
}

function siteUrl(env = {}) {
  const context = { exports: {}, process: { env } };
  vm.runInNewContext(compile('src/lib/site.ts'), context);
  return context.exports.SITE_URL;
}

test('edge function has no runtime imports', () => {
  const source = fs.readFileSync('supabase/functions/waitlist/index.ts', 'utf8');
  const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
  assert.equal(file.statements.some((s) => ts.isImportDeclaration(s) || ts.isImportEqualsDeclaration(s)), false);
});

test('wildcard CORS matches only a single hostname label', () => {
  const { matchesOrigin } = loadEdge();
  const pattern = 'https://edupay-waitlist-*.vercel.app';
  assert.equal(matchesOrigin('https://edupay-waitlist-git-main.vercel.app', pattern), true);
  for (const origin of [
    'https://edupay-waitlist-foo.vercel.app.evil.com',
    'https://edupay-waitlist-foo.evil.vercel.app',
    'https://someone-else.vercel.app',
    'http://edupay-waitlist-foo.vercel.app',
  ]) assert.equal(matchesOrigin(origin, pattern), false, origin);
  assert.equal(matchesOrigin('https://aXb.example', 'https://a.b.example'), false);
});

test('preflight reflects only allowed origins; GET starts successfully', async () => {
  const { handler } = loadEdge({ WAITLIST_ALLOWED_ORIGINS: 'https://edupay-waitlist.vercel.app,https://edupay-waitlist-*.vercel.app' });
  const preview = 'https://edupay-waitlist-test.vercel.app';
  for (const [origin, expected] of [[preview, preview], ['https://evil.example', 'https://edupay-waitlist.vercel.app']]) {
    const response = await handler(new Request('https://api.example/waitlist', { method: 'OPTIONS', headers: { origin } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), expected);
    assert.equal(response.headers.get('vary'), 'Origin');
    assert.equal(response.headers.get('access-control-max-age'), '600');
  }
  const response = await handler(new Request('https://api.example/waitlist'));
  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: 'method_not_allowed' });
});

test('URL query values are encoded without breaking query boundaries', () => {
  const { enc } = loadEdge();
  const value = "a&b='(x)*@example.com";
  assert.equal(decodeURIComponent(enc(value)), value);
  assert.doesNotMatch(enc(value), /[&='()*]/);
});

test('canonical URL honors override, production URL and fallback, not preview URL', () => {
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: ' example.com/ ', VERCEL_PROJECT_PRODUCTION_URL: 'prod.vercel.app' }), 'https://example.com');
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'prod.vercel.app', VERCEL_URL: 'preview.vercel.app' }), 'https://prod.vercel.app');
  assert.equal(siteUrl({ VERCEL_URL: 'preview.vercel.app' }), 'https://waitlist.edupayafrica.com.ng');
});
