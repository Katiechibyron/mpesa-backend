import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = 3000;

// Serve frontend static files
import path from 'path';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../'))); // Serve files from project root (where index.html is)


// Replace these with your actual M-Pesa Daraja API credentials
const consumerKey = 'RToRowWoORXfk0wdYWByeZw8rx2TxJUb96u3bxtbNdn96nAG';
const consumerSecret = 'D1Yo1Bwugkbfm14C7CAbRMU4ZVlp4OjZkitSqlgGtO3jDQAag6EqveWvTc6EluqS';
const shortcode = '174379';
const lipaNaMpesaOnlinePasskey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const callbackURL = 'https://28bc-102-135-173-97.ngrok-free.app/api/callback'; // Updated with new provided ngrok URL

// Function to get access token from M-Pesa API
async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

// Function to initiate STK Push
async function initiateSTKPush(phoneNumber: string, amount: number, accessToken: string) {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(shortcode + lipaNaMpesaOnlinePasskey + timestamp).toString('base64');

  const stkPushRequest = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackURL,
    AccountReference: 'FootballClubMerch',
    TransactionDesc: 'Payment for Football Club Merch'
  };

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPushRequest,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error initiating STK Push:', error);
    throw error;
  }
}

app.post('/api/pay', async (req, res) => {
  const { phone, product } = req.body;

  if (!phone || !product) {
    return res.status(400).json({ error: 'Phone number and product are required' });
  }

  // Define product prices here
  const productPrices: Record<string, number> = {
    'Home Kit': 1500,
    'Away Kit': 1400,
    'Starter Pack': 1000,
    'Wristbands': 500
  };

  const amount = productPrices[product];
  if (!amount) {
    return res.status(400).json({ error: 'Invalid product' });
  }

  try {
    const accessToken = await getAccessToken();
    const stkResponse = await initiateSTKPush(phone, amount, accessToken);
    res.json(stkResponse);
  } catch (error) {
    console.error('Error in /api/pay:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

app.post('/api/callback', (req, res) => {
  // Handle M-Pesa payment notification callback
  console.log('Received M-Pesa callback:', req.body);

  // Respond with 200 OK to acknowledge receipt
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  // TODO: Add your business logic here to process the payment notification,
  // e.g., update order status, notify user, log transaction, etc.
});

app.listen(port, () => {
  console.log(`M-Pesa backend server running at http://localhost:${port}`);
});
