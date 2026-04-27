const { db } = require('../lib/firebaseAdmin');

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // 2. Authenticate with SYNC_SECRET_KEY
  const authHeader = req.headers.authorization;
  const syncSecret = process.env.SYNC_SECRET_KEY;

  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== syncSecret) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing Bearer token.' });
  }

  // 3. Extract Payload
  const { title, date, desc } = req.body;

  if (!title || !date || !desc) {
    return res.status(400).json({ error: 'Missing required fields: title, date, desc.' });
  }

  try {
    // 4. Save to Firestore collection 'mock_tests'
    const docRef = await db.collection('mock_tests').add({
      title,
      date, // Expected format: YYYY-MM-DD
      desc,
      createdAt: new Date().toISOString(),
      source: 'iPad Shortcut'
    });

    // 5. Successful Response
    return res.status(200).json({
      success: true,
      message: 'Event added successfully.',
      id: docRef.id
    });
  } catch (error) {
    console.error('Firestore Error:', error);
    return res.status(500).json({ error: 'Failed to save event to database.' });
  }
}
