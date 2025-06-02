import { GoogleSpreadsheet } from 'google-spreadsheet';
import { Buffer } from 'buffer';

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      const email = data.email;

      if (!email || !email.includes('@')) {
        return new Response('Invalid email', { status: 400 });
      }

      const doc = new GoogleSpreadsheet(env.SHEET_ID);
      await doc.useServiceAccountAuth({
        client_email: env.CLIENT_EMAIL,
        private_key: env.PRIVATE_KEY.replace(/\\n/g, '\n'),
      });

      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      await sheet.addRow({ Email: email, Timestamp: new Date().toISOString() });

      return new Response('Email saved', { status: 200 });
    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  },
};
