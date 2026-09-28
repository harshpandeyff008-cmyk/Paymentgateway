fetch('https://imap-proxy-server.onrender.com/imap/fetch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    host: 'imap.zoho.in',
    port: 993,
    user: 'pandeyharshhack@zohomail.in',
    pass: 'S050Kybi7FCe',
    secure: true,
    folders: ['INBOX', 'Notification', 'Newsletter', 'Spam'],
    limit: 15
  })
}).then(r => r.json()).then(data => {
  console.log('Messages total:', data.data?.length);
  if (data.data) {
    data.data.forEach((m, idx) => {
      console.log(`[MSG ${idx}] Sender: "${m.sender}" | Subject: "${m.subject}" | Time: ${new Date(m.sentTime).toISOString()} | Folder: "${m.folderName}"`);
      console.log('Snippet:', (m.summary || '').substring(0, 150));
      console.log('Body snippet:', (m.body || '').substring(0, 150));
      console.log('---');
    });
  } else {
    console.log('Response error/data:', data);
  }
}).catch(console.error);
