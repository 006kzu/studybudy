const fs = require('fs');
const jwt = require('jsonwebtoken');

// --------------------------------------------------------
// CONFIGURATION - FILL THESE OUT
// --------------------------------------------------------
const TEAM_ID = '8QDT7AZTX8';
const KEY_ID = 'QB638YTAHP';
const CLIENT_ID = 'com.learnloop.learnloop';
const P8_FILE_PATH = '/Users/zachthomas/Desktop/AuthKey_QB638YTAHP.p8';

// --------------------------------------------------------

const generateSecret = () => {
    try {
        const privateKey = fs.readFileSync(P8_FILE_PATH);

        const token = jwt.sign({}, privateKey, {
            algorithm: 'ES256',
            expiresIn: '180d', // Max 6 months
            audience: 'https://appleid.apple.com',
            issuer: TEAM_ID,
            subject: CLIENT_ID,
            keyid: KEY_ID,
        });

        console.log('\n✅ Your Apple Client Secret (JWT):\n');
        console.log(token);
        console.log('\n⚠️ Expiration: This key is valid for 180 days. You must generate a new one and update Supabase before it expires.\n');

    } catch (err) {
        console.error('Error generating secret:', err.message);
        console.log('Did you update the configuration variables in the script?');
    }
};

generateSecret();
