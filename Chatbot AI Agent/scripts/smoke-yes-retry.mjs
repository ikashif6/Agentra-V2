async function turn(token, msg, email) {
  const r = await fetch('http://127.0.0.1:5600/v1/chat/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: token, message: msg, visitorEmail: email }),
  });
  const j = await r.json();
  console.log('\n> ' + msg);
  for (const m of j.data?.messages || []) {
    console.log('  ·', m.contentType, (m.body || '').slice(0, 140).replace(/\n/g, ' '), m.form ? 'form=' + m.form.formId : '');
  }
  return j.data;
}
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('  OK:', m); }
const t = 'yesretry' + Date.now();
const bad = 'kaashifahmed02@gmail.com';
await turn(t, 'Where is my order?', bad);
await turn(t, 'Order #1002, ' + bad, bad);
await turn(t, 'why', bad);
const yes = await turn(t, 'yes', bad);
assert(yes.messages?.some(m => m.contentType === 'input_form'), 'yes after failure opens form');
assert(!/no matching order found/i.test(yes.messages?.map(m => m.body || '').join(' ') || ''), 'yes does not re-run same failed lookup');
console.log('\nPassed');
