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
    console.error('Auth Failure: Invalid Secret Key');
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing Bearer token.' });
  }

  // 3. Extract Payload (Handle both userId and userid)
  const userId = req.body.userId || req.body.userid;
  const { title, date, desc } = req.body;

  // Logging for Debugging 400 Errors
  if (!userId || !title || !date || !desc) {
    console.error('400 Bad Request - Missing Fields:', { 
      hasUserId: !!userId, 
      hasTitle: !!title, 
      hasDate: !!date, 
      hasDesc: !!desc,
      bodyReceived: req.body 
    });
    return res.status(400).json({ error: 'Missing required fields: userId, title, date, desc.' });
  }

  // 4. Security Check: Only allow specific userId if ALLOWED_USER_ID is set
  const allowedUser = process.env.ALLOWED_USER_ID;
  if (allowedUser && userId !== allowedUser) {
    console.warn(`403 Forbidden - ID Mismatch. Rec: ${userId}, Alw: ${allowedUser}`);
    return res.status(403).json({ error: 'Forbidden. This API is currently restricted to a specific user.' });
  }

  // 5. Prettify Text (Make it "mannered")
  const cleanTitle = title.trim().charAt(0).toUpperCase() + title.trim().slice(1);
  const cleanDesc = desc.trim()
    .replace(/\r\n/g, '\n') // Normalize newlines
    .replace(/\n{3,}/g, '\n\n'); // Limit excessive spacing

  try {
    // 6. Save to Firestore collection: users/{userId}/events
    const docRef = await db.collection('users').doc(userId).collection('events').add({
      title: cleanTitle,
      // Normalize date to YYYY-MM-DD if it's a full ISO string
      date: date.includes('T') ? date.split('T')[0] : date, 
      desc: cleanDesc,
      createdAt: new Date().toISOString(),
      source: 'iPad Shortcut'
    });

    // 7. Successful Response
    return res.status(200).json({
      success: true,
      message: 'Event added successfully to user profile.',
      id: docRef.id
    });
  } catch (error) {
    console.error('Firestore Error:', error);
    return res.status(500).json({ error: 'Failed to save event to database.' });
  }
}
